package server

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

type GatewayServer struct {
	AuthServiceURL    *url.URL
	ExpenseServiceURL *url.URL
	RedisClient       *redis.Client
	authProxy         *httputil.ReverseProxy
	expenseProxy      *httputil.ReverseProxy
}

func NewGatewayServer(authURL, expenseURL string, rdb *redis.Client) (*GatewayServer, error) {
	aURL, err := url.Parse(authURL)
	if err != nil {
		return nil, fmt.Errorf("invalid auth service URL: %w", err)
	}

	eURL, err := url.Parse(expenseURL)
	if err != nil {
		return nil, fmt.Errorf("invalid expense service URL: %w", err)
	}

	gateway := &GatewayServer{
		AuthServiceURL:    aURL,
		ExpenseServiceURL: eURL,
		RedisClient:       rdb,
	}

	authProxy := &httputil.ReverseProxy{
		Rewrite: func(pr *httputil.ProxyRequest) {
			pr.SetURL(aURL)
			path := pr.Out.URL.Path
			if strings.HasPrefix(path, "/api/v1/auth") {
				pr.Out.URL.Path = strings.TrimPrefix(path, "/api/v1/auth")
			} else if strings.HasPrefix(path, "/api/auth") {
				pr.Out.URL.Path = strings.TrimPrefix(path, "/api/auth")
			} else if strings.HasPrefix(path, "/auth") {
				pr.Out.URL.Path = strings.TrimPrefix(path, "/auth")
			}
		},
		ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
			log.Printf("Auth service proxy error: %v", err)
			http.Error(w, "Auth Service is temporarily unavailable", http.StatusBadGateway)
		},
	}
	gateway.authProxy = authProxy

	expenseProxy := &httputil.ReverseProxy{
		Rewrite: func(pr *httputil.ProxyRequest) {
			pr.SetURL(eURL)
		},
		ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
			log.Printf("Expense service proxy error: %v", err)
			http.Error(w, "Expense Service is temporarily unavailable", http.StatusBadGateway)
		},
	}
	gateway.expenseProxy = expenseProxy

	return gateway, nil
}

func isPublicRoute(path string) bool { // TODO: Need to check once the all services development completed
	return strings.HasPrefix(path, "/auth/") ||
		strings.HasPrefix(path, "/api/auth/") ||
		strings.HasPrefix(path, "/api/v1/auth/") ||
		strings.HasPrefix(path, "/api/expenses/public/") ||
		path == "/auth" ||
		path == "/api/auth" ||
		path == "/api/v1/auth" ||
		path == "/api/expenses/public" ||
		path == "/health" ||
		path == "/"
}

func (h *GatewayServer) AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if isPublicRoute(path) {
			next.ServeHTTP(w, r)
			return
		}

		cookie, err := r.Cookie("session_id")
		if err != nil {
			http.Error(w, "Unauthorized: Session cookie missing", http.StatusUnauthorized)
			return
		}

		sessionKey := fmt.Sprintf("session:%s", cookie.Value)
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()

		val, err := h.RedisClient.Get(ctx, sessionKey).Result()
		if err != nil {
			if err == redis.Nil {
				http.Error(w, "Unauthorized: Session expired or invalid", http.StatusUnauthorized)
				return
			}
			log.Printf("Redis session verification error: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		var data map[string]string
		if err := json.Unmarshal([]byte(val), &data); err != nil {
			log.Printf("Session unmarshal error: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		userID, ok := data["user_id"]
		if !ok || userID == "" {
			http.Error(w, "Unauthorized: Invalid session format", http.StatusUnauthorized)
			return
		}

		r.Header.Set("X-User-ID", userID)
		r.Header.Del("Cookie")
		next.ServeHTTP(w, r)
	})
}
func (h *GatewayServer) HandleAuth(w http.ResponseWriter, r *http.Request) {
	h.authProxy.ServeHTTP(w, r)
}

func (h *GatewayServer) HandleExpense(w http.ResponseWriter, r *http.Request) {
	h.expenseProxy.ServeHTTP(w, r)
}
