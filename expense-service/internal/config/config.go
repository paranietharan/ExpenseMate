package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port       string
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	RabbitMQUser     string
	RabbitMQPassword string
	RabbitMQHost     string
	RabbitMQPort     string
	RabbitMQQueue    string
}

func Load() Config {
	_ = godotenv.Load(".env")

	return Config{
		Port:       getenv("PORT", "8082"),
		DBHost:     getenv("DB_HOST", "localhost"),
		DBPort:     getenv("DB_PORT", "5433"),
		DBUser:     getenv("DB_USER", "expense_user"),
		DBPassword: getenv("DB_PASSWORD", "ExpensePassword@1234"),
		DBName:     getenv("DB_NAME", "expense_db"),
		RabbitMQUser:     getenv("RABBITMQ_USER", "admin"),
		RabbitMQPassword: getenv("RABBITMQ_PASSWORD", "RabbitMQPassword@1234"),
		RabbitMQHost:     getenv("RABBITMQ_HOST", "127.0.0.1"),
		RabbitMQPort:     getenv("RABBITMQ_PORT", "5672"),
		RabbitMQQueue:    getenv("RABBITMQ_QUEUE", "auth_notifications"),
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
