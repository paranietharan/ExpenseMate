package dto

import "time"

type CreateGroupRequest struct {
	Name    string   `json:"name"`
	Members []string `json:"members"` // List of emails to add as members
}

type GroupMemberResponse struct {
	UserID    string    `json:"user_id"`
	UserEmail string    `json:"user_email"`
	JoinedAt  time.Time `json:"joined_at"`
}

type GroupResponse struct {
	ID        string                `json:"id"`
	Name      string                `json:"name"`
	CreatedAt time.Time             `json:"created_at"`
	Members   []GroupMemberResponse `json:"members"`
}

type ExpenseSplit struct {
	UserID    string  `json:"user_id"`
	UserEmail string  `json:"user_email"`
	Amount    float64 `json:"amount"`
}

type CreateExpenseRequest struct {
	GroupID     *string        `json:"group_id,omitempty"` // Nullable for peer-to-peer expenses
	Description string         `json:"description"`
	Amount      float64        `json:"amount"`
	Splits      []ExpenseSplit `json:"splits"`
}

type ExpenseResponse struct {
	ID          string         `json:"id"`
	GroupID     *string        `json:"group_id,omitempty"`
	Description string         `json:"description"`
	Amount      float64        `json:"amount"`
	PayerID     string         `json:"payer_id"`
	PayerEmail  string         `json:"payer_email"`
	CreatedAt   time.Time      `json:"created_at"`
	Splits      []ExpenseSplit `json:"splits"`
}

type SettlementRequest struct {
	GroupID    *string `json:"group_id,omitempty"`
	PayeeID    string  `json:"payee_id"`
	PayeeEmail string  `json:"payee_email"`
	Amount     float64 `json:"amount"`
}

type SettlementResponse struct {
	ID         string    `json:"id"`
	GroupID    *string   `json:"group_id,omitempty"`
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
