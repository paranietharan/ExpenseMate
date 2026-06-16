package database

import (
	"fmt"
	"log"

	"golang.org/x/crypto/bcrypt"
)

func SeedAdmin(adminEmail, adminPassword string) error {
	if adminEmail == "" || adminPassword == "" {
		log.Println("Seeding bypassed: Admin credentials not set in environment")
		return nil
	}

	var exists bool
	query := "SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)"
	err := DB.QueryRow(query, adminEmail).Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed to check admin existence: %w", err)
	}

	if exists {
		log.Println("Seeding skipped: Admin user already exists")
		return nil
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash admin password: %w", err)
	}

	insertQuery := `
	INSERT INTO users (email, password_hash, role, is_verified) 
	VALUES ($1, $2, 'admin', TRUE)`
	
	_, err = DB.Exec(insertQuery, adminEmail, string(hashedPassword))
	if err != nil {
		return fmt.Errorf("failed to seed admin user: %w", err)
	}

	log.Printf("Admin user (%s) seeded successfully\n", adminEmail)
	return nil
}
