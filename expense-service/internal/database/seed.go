package database

import (
	"log"
)

// SeedUserIfNew checks if the user has settings; if not, it seeds default settings,
// a demo group ("Flatmates 402") with virtual friends, and initial mock expenses.
func SeedUserIfNew(userID string, email string) {
	var exists bool
	err := DB.QueryRow("SELECT EXISTS(SELECT 1 FROM user_settings WHERE user_id = $1)", userID).Scan(&exists)
	if err != nil {
		log.Printf("Failed to check user settings existence: %v", err)
		return
	}

	if exists {
		return
	}

	// 1. Insert user settings
	_, err = DB.Exec("INSERT INTO user_settings (user_id, email, notifications_enabled) VALUES ($1, $2, TRUE)", userID, email)
	if err != nil {
		log.Printf("Failed to insert user settings during seeding: %v", err)
		return
	}

	// 2. Create demo group
	tx, err := DB.Begin()
	if err != nil {
		log.Printf("Failed to start transaction for user seeding: %v", err)
		return
	}
	defer tx.Rollback()

	var groupID string
	err = tx.QueryRow("INSERT INTO groups (name) VALUES ('Flatmates 402') RETURNING id").Scan(&groupID)
	if err != nil {
		log.Printf("Failed to create demo group: %v", err)
		return
	}

	// 3. Add members (Self + Sarah + David + James)
	members := []struct {
		id    string
		email string
	}{
		{userID, email},
		{"a0000000-0000-0000-0000-000000000001", "sarah@example.com"},
		{"a0000000-0000-0000-0000-000000000002", "david@example.com"},
		{"a0000000-0000-0000-0000-000000000003", "james@example.com"},
	}

	for _, m := range members {
		_, err = tx.Exec("INSERT INTO group_members (group_id, user_id, user_email) VALUES ($1, $2, $3)", groupID, m.id, m.email)
		if err != nil {
			log.Printf("Failed to insert group member: %v", err)
			return
		}
	}

	// 4. Add Seed Expenses

	// Expense 1: Weekly Groceries ($120.00), paid by self, split equally ($30 each)
	var exp1ID string
	err = tx.QueryRow(`
		INSERT INTO expenses (group_id, description, amount, payer_id, payer_email) 
		VALUES ($1, 'Weekly Grocery Shopping', 120.00, $2, $3) RETURNING id
	`, groupID, userID, email).Scan(&exp1ID)
	if err != nil {
		log.Printf("Failed to insert seed expense 1: %v", err)
		return
	}

	for _, m := range members {
		_, err = tx.Exec("INSERT INTO expense_splits (expense_id, user_id, user_email, amount) VALUES ($1, $2, $3, 30.00)", exp1ID, m.id, m.email)
		if err != nil {
			log.Printf("Failed to insert split for expense 1: %v", err)
			return
		}
	}

	// Expense 2: Internet & Electricity ($80.00), paid by Sarah, split equally ($20 each, user owes $20)
	var exp2ID string
	err = tx.QueryRow(`
		INSERT INTO expenses (group_id, description, amount, payer_id, payer_email) 
		VALUES ($1, 'Internet & Electricity Bill', 80.00, 'a0000000-0000-0000-0000-000000000001', 'sarah@example.com') RETURNING id
	`, groupID).Scan(&exp2ID)
	if err != nil {
		log.Printf("Failed to insert seed expense 2: %v", err)
		return
	}

	for _, m := range members {
		_, err = tx.Exec("INSERT INTO expense_splits (expense_id, user_id, user_email, amount) VALUES ($1, $2, $3, 20.00)", exp2ID, m.id, m.email)
		if err != nil {
			log.Printf("Failed to insert split for expense 2: %v", err)
			return
		}
	}

	// Expense 3: Dinner & Drinks ($100.00), paid by David, split equally ($25 each, user owes $25)
	var exp3ID string
	err = tx.QueryRow(`
		INSERT INTO expenses (group_id, description, amount, payer_id, payer_email) 
		VALUES ($1, 'Dinner & Drinks', 100.00, 'a0000000-0000-0000-0000-000000000002', 'david@example.com') RETURNING id
	`, groupID).Scan(&exp3ID)
	if err != nil {
		log.Printf("Failed to insert seed expense 3: %v", err)
		return
	}

	for _, m := range members {
		_, err = tx.Exec("INSERT INTO expense_splits (expense_id, user_id, user_email, amount) VALUES ($1, $2, $3, 25.00)", exp3ID, m.id, m.email)
		if err != nil {
			log.Printf("Failed to insert split for expense 3: %v", err)
			return
		}
	}

	if err = tx.Commit(); err != nil {
		log.Printf("Failed to commit user seed transaction: %v", err)
		return
	}

	log.Printf("Successfully seeded demo data for user: %s\n", email)
}
