package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port              string
	AuthServiceURL    string
	ExpenseServiceURL string
	RedisHost         string
	RedisPort         string
	RedisPassword     string
}

func Load() Config {
	_ = godotenv.Load(".env")

	return Config{
		Port:              getenv("GATEWAY_PORT", "8080"),
		AuthServiceURL:    getenv("AUTH_SERVICE_URL", "http://localhost:8081"),
		ExpenseServiceURL: getenv("EXPENSE_SERVICE_URL", "http://localhost:8082"),
		RedisHost:         getenv("REDIS_HOST", "localhost"),
		RedisPort:         getenv("REDIS_PORT", "6379"),
		RedisPassword:     getenv("REDIS_PASSWORD", ""),
	}
}

func getenv(key, def string) string {
	val := os.Getenv(key)
	if val == "" {
		fmt.Println("Warning: Missing environment variable", key)
		return def
	}
	return val
}
