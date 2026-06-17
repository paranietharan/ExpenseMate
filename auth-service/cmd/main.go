package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"auth-service/internal/auth"
	"auth-service/internal/config"
	"auth-service/internal/database"
	"auth-service/internal/redis"
)

func main() {
	log.Println("Starting auth-service...")

	cfg := config.Load()

	dbConn, err := database.InitDB(cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName)
	if err != nil {
		log.Fatalf("PostgreSQL connection error: %v", err)
	}
	defer dbConn.Close()

	if err = database.Migrate(); err != nil {
		log.Fatalf("Migration failed: %v", err)
	}
	if err = database.SeedAdmin(cfg.AdminEmail, cfg.AdminPassword); err != nil {
		log.Fatalf("Seeding admin failed: %v", err)
	}

	rClient, err := redis.InitRedis(cfg.RedisHost, cfg.RedisPort, cfg.RedisPassword)
	if err != nil {
		log.Fatalf("Redis connection error: %v", err)
	}
	defer rClient.Close()

	authHandler := auth.NewAuthHandler(dbConn, rClient, cfg.PrintMFACodes)
	mux := http.NewServeMux()
	mux.HandleFunc("/register", authHandler.Register)
	mux.HandleFunc("/register/verify", authHandler.VerifyRegister)
	mux.HandleFunc("/login", authHandler.Login)
	mux.HandleFunc("/login/select-mfa", authHandler.SelectMFA)
	mux.HandleFunc("/login/verify", authHandler.VerifyLogin)
	mux.HandleFunc("/mfa/totp/setup", authHandler.SetupTOTP)
	mux.HandleFunc("/mfa/totp/enable", authHandler.EnableTOTP)
	mux.HandleFunc("/mfa/totp/disable", authHandler.DisableTOTP)
	mux.HandleFunc("/mfa/email/setup", authHandler.SetupEmailMFA)
	mux.HandleFunc("/mfa/email/enable", authHandler.EnableEmailMFA)
	mux.HandleFunc("/mfa/email/disable", authHandler.DisableEmailMFA)
	mux.HandleFunc("/logout", authHandler.Logout)
	mux.HandleFunc("/status", authHandler.Status)
	mux.HandleFunc("/password-reset/request", authHandler.RequestPasswordReset)
	mux.HandleFunc("/password-reset/verify", authHandler.VerifyPasswordReset)
	mux.HandleFunc("/password/change", authHandler.ChangePassword)

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()

		dbStatus := "OK"
		if err := dbConn.PingContext(ctx); err != nil {
			dbStatus = "DOWN"
		}

		redisStatus := "OK"
		if err := rClient.Ping(ctx).Err(); err != nil {
			redisStatus = "DOWN"
		}

		w.Header().Set("Content-Type", "application/json")
		if dbStatus == "DOWN" || redisStatus == "DOWN" {
			w.WriteHeader(http.StatusServiceUnavailable)
		} else {
			w.WriteHeader(http.StatusOK)
		}
		fmt.Fprintf(w, `{"status":"UP","postgres":"%s","redis":"%s"}`, dbStatus, redisStatus)
	})

	serverAddr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("Auth service listening on port %s...\n", cfg.Port)
	if err := http.ListenAndServe(serverAddr, mux); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
