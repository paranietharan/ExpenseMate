package database

import (
	"fmt"
	"log"
)

func Migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS groups (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		name VARCHAR(255) NOT NULL,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS group_members (
		group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
		user_id UUID NOT NULL,
		user_email VARCHAR(255) NOT NULL,
		joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (group_id, user_id)
	);

	CREATE TABLE IF NOT EXISTS expenses (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		group_id UUID REFERENCES groups(id) ON DELETE CASCADE, -- NULL for non-group expenses (with friends)
		description VARCHAR(255) NOT NULL,
		amount NUMERIC(12, 2) NOT NULL,
		payer_id UUID NOT NULL,
		payer_email VARCHAR(255) NOT NULL,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS expense_splits (
		expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
		user_id UUID NOT NULL,
		user_email VARCHAR(255) NOT NULL,
		amount NUMERIC(12, 2) NOT NULL,
		PRIMARY KEY (expense_id, user_id)
	);

	CREATE TABLE IF NOT EXISTS settlements (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		group_id UUID REFERENCES groups(id) ON DELETE CASCADE, -- Optional
		payer_id UUID NOT NULL,
		payer_email VARCHAR(255) NOT NULL,
		payee_id UUID NOT NULL,
		payee_email VARCHAR(255) NOT NULL,
		amount NUMERIC(12, 2) NOT NULL,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS user_settings (
		user_id UUID PRIMARY KEY,
		email VARCHAR(255) NOT NULL,
		notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE
	);`

	_, err := DB.Exec(schema)
	if err != nil {
		return fmt.Errorf("failed to run database migration: %w", err)
	}

	log.Println("Expense database migration completed successfully")
	return nil
}
