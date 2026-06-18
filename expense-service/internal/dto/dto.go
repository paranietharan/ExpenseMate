package dto

import "time"

type ExpenseSplit struct {
	UserID    string  `json:"user_id"`
	UserEmail string  `json:"user_email"`
	Amount    float64 `json:"amount"`
}

type CreateExpenseRequest struct {
	PayerEmail  *string        `json:"payer_email,omitempty"`
	Description string         `json:"description"`
	Amount      float64        `json:"amount"`
	Splits      []ExpenseSplit `json:"splits"`
}

type ExpenseResponse struct {
	ID            string         `json:"id"`
	Description   string         `json:"description"`
	Amount        float64        `json:"amount"`
	PayerID       string         `json:"payer_id"`
	PayerEmail    string         `json:"payer_email"`
	CreatorID     string         `json:"creator_id"`
	CreatorEmail  string         `json:"creator_email"`
	CreatedAt     time.Time      `json:"created_at"`
	Splits        []ExpenseSplit `json:"splits"`
}

type SettlementRequest struct {
	PayeeID    string  `json:"payee_id"`
	PayeeEmail string  `json:"payee_email"`
	Amount     float64 `json:"amount"`
}

type SettlementResponse struct {
	ID         string    `json:"id"`
	PayerID    string    `json:"payer_id"`
	PayerEmail string    `json:"payer_email"`
	PayeeID    string    `json:"payee_id"`
	PayeeEmail string    `json:"payee_email"`
	Amount     float64   `json:"amount"`
	CreatedAt  time.Time `json:"created_at"`
}

type DebtBalance struct {
	UserID    string  `json:"user_id"`
	UserEmail string  `json:"user_email"`
	Balance   float64 `json:"balance"` // Positive means they owe you, negative means you owe them
}

type SettingsResponse struct {
	NotificationsEnabled bool `json:"notifications_enabled"`
}

type UpdateSettingsRequest struct {
	NotificationsEnabled bool `json:"notifications_enabled"`
}
