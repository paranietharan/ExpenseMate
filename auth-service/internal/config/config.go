package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port string

	// Postgresql config
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string

	// Redis config
	RedisHost     string
	RedisPort     string
	RedisPassword string

	// Seeding config
	AdminEmail    string
	AdminPassword string

	// MFA console print option
	PrintMFACodes bool

	// JWT config
	JWTSecret string
	JWTTTL    string
	JWTIssuer string
}

func Load() Config {
	_ = godotenv.Load(".env")

	printMFA := getenv("PRINT_MFA_CODES_TO_CONSOLE", "true") == "true"

	return Config{
		Port:          getenv("PORT", "8081"),
		DBHost:        getenv("DB_HOST", "localhost"),
		DBPort:        getenv("DB_PORT", "5432"),
		DBUser:        getenv("DB_USER", "postgres"),
		DBPassword:    getenv("DB_PASSWORD", "password"),
		DBName:        getenv("DB_NAME", "postgres"),
		RedisHost:     getenv("REDIS_HOST", "localhost"),
		RedisPort:     getenv("REDIS_PORT", "6379"),
		RedisPassword: getenv("REDIS_PASSWORD", ""),
		AdminEmail:    getenv("ADMIN_EMAIL", "admin@expensemate.com"),
		AdminPassword: getenv("ADMIN_PASSWORD", "adminpassword"),
		PrintMFACodes: printMFA,
		JWTSecret:     getenv("JWT_SECRET", "secret"),
		JWTTTL:        getenv("JWT_TTL", "24h"),
		JWTIssuer:     getenv("JWT_ISSUER", "auth-service"),
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
