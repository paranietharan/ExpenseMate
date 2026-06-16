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
	);`

	_, err := DB.Exec(schema)
	if err != nil {
		return fmt.Errorf("failed to run database migration: %w", err)
	}

	log.Println("Database migration completed successfully")
	return nil
}
