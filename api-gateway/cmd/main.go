package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"api-gateway/internal/config"
	"api-gateway/internal/server"

	"github.com/redis/go-redis/v9"
)

func main() {
	log.Println("Starting api-gateway...")

	cfg := config.Load()

	redisAddr := fmt.Sprintf("%s:%s", cfg.RedisHost, cfg.RedisPort)
	rClient := redis.NewClient(&redis.Options{
		Addr:     redisAddr,
		Password: cfg.RedisPassword,
		DB:       0,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := rClient.Ping(ctx).Result()
	if err != nil {
		log.Fatalf("Redis connection error: %v", err)
	}
	log.Println("Redis connection established successfully")
	defer rClient.Close()

	gateway, err := server.NewGatewayServer(cfg.AuthServiceURL, cfg.ExpenseServiceURL, rClient)
	if err != nil {
		log.Fatalf("Failed to initialize gateway proxies: %v", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/auth/", gateway.HandleAuth)
	mux.HandleFunc("/api/auth/", gateway.HandleAuth)
	mux.HandleFunc("/api/v1/auth/", gateway.HandleAuth)

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		redisStatus := "OK"
		pingCtx, pingCancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer pingCancel()
		if err := rClient.Ping(pingCtx).Err(); err != nil {
			redisStatus = "DOWN"
			w.WriteHeader(http.StatusServiceUnavailable)
		} else {
			w.WriteHeader(http.StatusOK)
		}
		fmt.Fprintf(w, `{"status":"UP","redis":"%s"}`, redisStatus)
	})

	mux.Handle("/", gateway.AuthMiddleware(http.HandlerFunc(gateway.HandleExpense)))

	serverAddr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("API Gateway listening on port %s...\n", cfg.Port)
	if err := http.ListenAndServe(serverAddr, mux); err != nil {
		log.Fatalf("Gateway failed to start: %v", err)
	}
}
