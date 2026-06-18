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

	// RabbitMQ config
	RabbitMQHost     string
	RabbitMQPort     string
	RabbitMQUser     string
	RabbitMQPassword string
}

func Load() Config {
	_ = godotenv.Load(".env")

	printMFA := getenv("PRINT_MFA_CODES_TO_CONSOLE", "true") == "true"

	return Config{
		Port:             getenv("PORT", "8081"),
		DBHost:           getenv("DB_HOST", "localhost"),
		DBPort:           getenv("DB_PORT", "5432"),
		DBUser:           getenv("DB_USER", "postgres"),
		DBPassword:       getenv("DB_PASSWORD", "password"),
		DBName:           getenv("DB_NAME", "postgres"),
		RedisHost:        getenv("REDIS_HOST", "localhost"),
		RedisPort:        getenv("REDIS_PORT", "6379"),
		RedisPassword:    getenv("REDIS_PASSWORD", ""),
		AdminEmail:       getenv("ADMIN_EMAIL", "admin@expensemate.com"),
		AdminPassword:    getenv("ADMIN_PASSWORD", "adminpassword"),
		PrintMFACodes:    printMFA,
		JWTSecret:        getenv("JWT_SECRET", "secret"),
		JWTTTL:           getenv("JWT_TTL", "24h"),
		JWTIssuer:        getenv("JWT_ISSUER", "auth-service"),
		RabbitMQHost:     getenv("RABBITMQ_HOST", "127.0.0.1"),
		RabbitMQPort:     getenv("RABBITMQ_PORT", "5672"),
		RabbitMQUser:     getenv("RABBITMQ_USER", "admin"),
		RabbitMQPassword: getenv("RABBITMQ_PASSWORD", "RabbitMQPassword@1234"),
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
