package redis

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

var Client *redis.Client
var ctx = context.Background()

type TempLoginData struct {
	UserID         string   `json:"user_id"`
	Methods        []string `json:"methods"` // ["totp", "email"]
	SelectedMethod string   `json:"selected_method,omitempty"`
	EmailCode      string   `json:"email_code,omitempty"`
}

func InitRedis(host, port, password string) (*redis.Client, error) {
	addr := fmt.Sprintf("%s:%s", host, port)
	Client = redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       0,
	})

	_, err := Client.Ping(ctx).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to connect to redis: %w", err)
	}

	log.Println("Redis connection established successfully")
	return Client, nil
}

func SaveSession(sessionID, userID, email string, ttl time.Duration) error {
	key := fmt.Sprintf("session:%s", sessionID)
	data := map[string]string{
		"user_id": userID,
		"email":   email,
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal session: %w", err)
	}

	err = Client.Set(ctx, key, jsonData, ttl).Err()
	if err != nil {
		return fmt.Errorf("failed to save session in redis: %w", err)
	}

	return nil
}

func GetSession(sessionID string) (string, error) {
	key := fmt.Sprintf("session:%s", sessionID)
	val, err := Client.Get(ctx, key).Result()
	if err != nil {
		return "", err
	}

	var data map[string]string
	err = json.Unmarshal([]byte(val), &data)
	if err != nil {
		return "", err
	}

	return data["user_id"], nil
}

func DeleteSession(sessionID string) error {
	key := fmt.Sprintf("session:%s", sessionID)
	return Client.Del(ctx, key).Err()
}

func SaveTempLogin(tempToken string, data *TempLoginData, ttl time.Duration) error {
	key := fmt.Sprintf("temp_login:%s", tempToken)
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal temp login: %w", err)
	}

	err = Client.Set(ctx, key, jsonData, ttl).Err()
	if err != nil {
		return fmt.Errorf("failed to save temp login in redis: %w", err)
	}

	return nil
}

func GetTempLogin(tempToken string) (*TempLoginData, error) {
	key := fmt.Sprintf("temp_login:%s", tempToken)
	val, err := Client.Get(ctx, key).Result()
	if err != nil {
		return nil, err
	}

	var data TempLoginData
	err = json.Unmarshal([]byte(val), &data)
	if err != nil {
		return nil, err
	}

	return &data, nil
}

func DeleteTempLogin(tempToken string) error {
	key := fmt.Sprintf("temp_login:%s", tempToken)
	return Client.Del(ctx, key).Err()
}
