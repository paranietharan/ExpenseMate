package database

import (
	"fmt"
	"log"
)

func Migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		email VARCHAR(255) UNIQUE NOT NULL,
		password_hash VARCHAR(255) NOT NULL,
		role VARCHAR(50) NOT NULL DEFAULT 'user',
		totp_secret VARCHAR(255),
		totp_enabled BOOLEAN DEFAULT FALSE,
		email_mfa_enabled BOOLEAN DEFAULT FALSE,
		is_verified BOOLEAN DEFAULT FALSE,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
	);

	-- Add name and avatar_url if they do not exist
	ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255) DEFAULT '';
	ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(1024) DEFAULT '';

	CREATE TABLE IF NOT EXISTS friendships (
		user_id_1 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		user_id_2 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (user_id_1, user_id_2)
	);

	CREATE TABLE IF NOT EXISTS friend_requests (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, accepted, rejected
		created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(sender_id, receiver_id)
	);

	CREATE TABLE IF NOT EXISTS blocks (
		blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (blocker_id, blocked_id)
	);`

	_, err := DB.Exec(schema)
	if err != nil {
		return fmt.Errorf("failed to run database migration: %w", err)
	}

	log.Println("Database migration completed successfully")
	return nil
}
