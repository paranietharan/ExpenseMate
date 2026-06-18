package expense

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"strings"
	"time"

	"expense-service/internal/dto"
	"expense-service/internal/rabbitmq"
)

type ExpenseHandler struct {
	DB        *sql.DB
	Publisher *rabbitmq.RabbitMQPublisher
}

func NewExpenseHandler(db *sql.DB, pub *rabbitmq.RabbitMQPublisher) *ExpenseHandler {
	return &ExpenseHandler{DB: db, Publisher: pub}
}

func (h *ExpenseHandler) getUserInfo(r *http.Request) (string, string, error) {
	userID := r.Header.Get("X-User-ID")
	userEmail := r.Header.Get("X-User-Email")

	if userID == "" {
		return "", "", fmt.Errorf("unauthorized: X-User-ID header missing")
	}

	// Default fallback email if not supplied by gateway
	if userEmail == "" {
		userEmail = "user@example.com"
	}

	return userID, userEmail, nil
}

func normalizeEmail(email string) string {
	return strings.TrimSpace(strings.ToLower(email))
}

func (h *ExpenseHandler) getOrCreateUserIDByEmail(email string) (string, error) {
	email = normalizeEmail(email)
	var id string
	err := h.DB.QueryRow("SELECT user_id FROM user_settings WHERE email = $1", email).Scan(&id)
	if err == sql.ErrNoRows {
		err = h.DB.QueryRow("INSERT INTO user_settings (user_id, email, notifications_enabled) VALUES (gen_random_uuid(), $1, TRUE) RETURNING user_id", email).Scan(&id)
		if err != nil {
			return "", err
		}
		return id, nil
	} else if err != nil {
		return "", err
	}
	return id, nil
}

// resolvePayerID prefers auth and split-provided IDs over email-only lookups so
// payer_id stays aligned with auth user IDs used in expense_splits.
func (h *ExpenseHandler) resolvePayerID(payerEmail, authUserID, authUserEmail string, splits []dto.ExpenseSplit) (string, error) {
	payerEmail = normalizeEmail(payerEmail)
	if payerEmail == "" {
		return authUserID, nil
	}
	if payerEmail == normalizeEmail(authUserEmail) {
		return authUserID, nil
	}
	for _, split := range splits {
		if normalizeEmail(split.UserEmail) == payerEmail && split.UserID != "" {
			return split.UserID, nil
		}
	}
	return h.getOrCreateUserIDByEmail(payerEmail)
}

func (h *ExpenseHandler) CreateExpense(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, userEmail, err := h.getUserInfo(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	var req dto.CreateExpenseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Description == "" || req.Amount <= 0 {
		http.Error(w, "Description and positive amount are required", http.StatusBadRequest)
		return
	}

	// Enforce 2-10 people split check
	if len(req.Splits) < 2 || len(req.Splits) > 10 {
		http.Error(w, "An expense must be shared between 2 to 10 people", http.StatusBadRequest)
		return
	}

	tx, err := h.DB.Begin()
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Payer resolution — keep payer_id aligned with auth IDs from splits
	payerEmail := userEmail
	if req.PayerEmail != nil && *req.PayerEmail != "" {
		payerEmail = normalizeEmail(*req.PayerEmail)
	}
	payerID, err := h.resolvePayerID(payerEmail, userID, userEmail, req.Splits)
	if err != nil {
		log.Printf("Failed to resolve payer ID: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Insert expense (saving payer and creator)
	var expenseID string
	err = tx.QueryRow(`
		INSERT INTO expenses (description, amount, payer_id, payer_email, creator_id, creator_email) 
		VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
	`, req.Description, req.Amount, payerID, payerEmail, userID, userEmail).Scan(&expenseID)
	if err != nil {
		log.Printf("Failed to insert expense: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Insert splits
	var resolvedSplits []dto.ExpenseSplit
	for _, split := range req.Splits {
		split.UserEmail = normalizeEmail(split.UserEmail)
		if split.UserID == "" {
			if split.UserEmail == normalizeEmail(userEmail) {
				split.UserID = userID
			} else {
				split.UserID, err = h.getOrCreateUserIDByEmail(split.UserEmail)
				if err != nil {
					log.Printf("Failed to resolve user ID for split email %s: %v", split.UserEmail, err)
					continue
				}
			}
		}

		_, err = tx.Exec(`
			INSERT INTO expense_splits (expense_id, user_id, user_email, amount) 
			VALUES ($1, $2, $3, $4)
		`, expenseID, split.UserID, split.UserEmail, split.Amount)
		if err != nil {
			log.Printf("Failed to insert split: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		resolvedSplits = append(resolvedSplits, split)
	}

	if err = tx.Commit(); err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Publish notifications
	if h.Publisher != nil {
		for _, split := range resolvedSplits {
			if split.UserEmail == userEmail {
				continue
			}
			go func(recipientEmail string) {
				ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
				defer cancel()
				_ = h.Publisher.PublishNotification(ctx, recipientEmail, "expense_added", map[string]string{
					"sender_email": userEmail,
					"description":  req.Description,
					"amount":       fmt.Sprintf("%.2f", req.Amount),
				})
			}(split.UserEmail)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(dto.ExpenseResponse{
		ID:           expenseID,
		Description:  req.Description,
		Amount:       req.Amount,
		PayerID:      payerID,
		PayerEmail:   payerEmail,
		CreatorID:    userID,
		CreatorEmail: userEmail,
		CreatedAt:    time.Now(),
		Splits:       resolvedSplits,
	})
}

func (h *ExpenseHandler) ListExpenses(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, _, err := h.getUserInfo(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	rows, err := h.DB.Query(`
		SELECT DISTINCT e.id, e.description, e.amount, e.payer_id, e.payer_email, e.creator_id, e.creator_email, e.created_at 
		FROM expenses e 
		LEFT JOIN expense_splits s ON s.expense_id = e.id 
		WHERE e.payer_id = $1 OR s.user_id = $1 OR e.creator_id = $1
		ORDER BY e.created_at DESC
	`, userID)

	if err != nil {
		log.Printf("Failed to query expenses: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	expenses := []dto.ExpenseResponse{}
	for rows.Next() {
		var e dto.ExpenseResponse
		var createdAt time.Time
		if err := rows.Scan(&e.ID, &e.Description, &e.Amount, &e.PayerID, &e.PayerEmail, &e.CreatorID, &e.CreatorEmail, &createdAt); err != nil {
			continue
		}
		e.CreatedAt = createdAt

		// Fetch splits
		splitRows, err := h.DB.Query("SELECT user_id, user_email, amount FROM expense_splits WHERE expense_id = $1", e.ID)
		if err != nil {
			continue
		}
		e.Splits = []dto.ExpenseSplit{}
		for splitRows.Next() {
			var s dto.ExpenseSplit
			if err := splitRows.Scan(&s.UserID, &s.UserEmail, &s.Amount); err == nil {
				e.Splits = append(e.Splits, s)
			}
		}
		splitRows.Close()

		expenses = append(expenses, e)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(expenses)
}

func (h *ExpenseHandler) UpdateExpense(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, userEmail, err := h.getUserInfo(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	expenseID := strings.TrimPrefix(r.URL.Path, "/expenses/")

	var payerID, creatorID string
	err = h.DB.QueryRow("SELECT payer_id, creator_id FROM expenses WHERE id = $1", expenseID).Scan(&payerID, &creatorID)
	if err != nil {
		http.Error(w, "Expense not found", http.StatusNotFound)
		return
	}

	// Authorize either payer OR creator to edit
	if payerID != userID && creatorID != userID {
		http.Error(w, "Only the payer or creator can update this expense", http.StatusForbidden)
		return
	}

	var req dto.CreateExpenseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Description == "" || req.Amount <= 0 {
		http.Error(w, "Description and positive amount are required", http.StatusBadRequest)
		return
	}

	if len(req.Splits) < 2 || len(req.Splits) > 10 {
		http.Error(w, "An expense must be shared between 2 to 10 people", http.StatusBadRequest)
		return
	}

	tx, err := h.DB.Begin()
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Update payer details if supplied
	newPayerID := payerID
	newPayerEmail := ""
	err = h.DB.QueryRow("SELECT payer_email FROM expenses WHERE id = $1", expenseID).Scan(&newPayerEmail)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if req.PayerEmail != nil && *req.PayerEmail != "" {
		newPayerEmail = normalizeEmail(*req.PayerEmail)
	}
	newPayerID, err = h.resolvePayerID(newPayerEmail, userID, userEmail, req.Splits)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	_, err = tx.Exec(`
		UPDATE expenses 
		SET description = $1, amount = $2, payer_id = $3, payer_email = $4 
		WHERE id = $5
	`, req.Description, req.Amount, newPayerID, newPayerEmail, expenseID)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	_, err = tx.Exec("DELETE FROM expense_splits WHERE expense_id = $1", expenseID)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	for _, split := range req.Splits {
		split.UserEmail = normalizeEmail(split.UserEmail)
		if split.UserID == "" {
			if split.UserEmail == normalizeEmail(userEmail) {
				split.UserID = userID
			} else {
				split.UserID, err = h.getOrCreateUserIDByEmail(split.UserEmail)
				if err != nil {
					continue
				}
			}
		}
		_, err = tx.Exec(`
			INSERT INTO expense_splits (expense_id, user_id, user_email, amount) 
			VALUES ($1, $2, $3, $4)
		`, expenseID, split.UserID, split.UserEmail, split.Amount)
		if err != nil {
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	}

	if err = tx.Commit(); err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Expense updated successfully"})
}

func (h *ExpenseHandler) DeleteExpense(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, _, err := h.getUserInfo(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	expenseID := strings.TrimPrefix(r.URL.Path, "/expenses/")

	var payerID, creatorID string
	err = h.DB.QueryRow("SELECT payer_id, creator_id FROM expenses WHERE id = $1", expenseID).Scan(&payerID, &creatorID)
	if err != nil {
		http.Error(w, "Expense not found", http.StatusNotFound)
		return
	}

	// Authorize either payer OR creator to delete
	if payerID != userID && creatorID != userID {
		http.Error(w, "Only the payer or creator can delete this expense", http.StatusForbidden)
		return
	}

	_, err = h.DB.Exec("DELETE FROM expenses WHERE id = $1", expenseID)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Expense deleted successfully"})
}

func (h *ExpenseHandler) GetBalances(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, userEmail, err := h.getUserInfo(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	balancesMap := make(map[string]*dto.DebtBalance)

	// ------ Expenses ------
	expRows, err := h.DB.Query(`
		SELECT DISTINCT e.id, e.payer_id, e.payer_email, e.amount
		FROM expenses e
		LEFT JOIN expense_splits s ON s.expense_id = e.id
		WHERE e.payer_id = $1 OR s.user_id = $1
	`, userID)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer expRows.Close()

	for expRows.Next() {
		var expID, payerID, payerEmail string
		var totalAmount float64
		if err := expRows.Scan(&expID, &payerID, &payerEmail, &totalAmount); err != nil {
			continue
		}

		splitRows, err := h.DB.Query("SELECT user_id, user_email, amount FROM expense_splits WHERE expense_id = $1", expID)
		if err != nil {
			continue
		}

		splits := []dto.ExpenseSplit{}
		for splitRows.Next() {
			var splitUserID, splitUserEmail string
			var splitAmount float64
			if err := splitRows.Scan(&splitUserID, &splitUserEmail, &splitAmount); err != nil {
				continue
			}
			splits = append(splits, dto.ExpenseSplit{
				UserID:    splitUserID,
				UserEmail: splitUserEmail,
				Amount:    splitAmount,
			})
		}
		splitRows.Close()

		effectivePayerID := payerID
		for _, split := range splits {
			if normalizeEmail(split.UserEmail) == normalizeEmail(payerEmail) && split.UserID != "" {
				effectivePayerID = split.UserID
				break
			}
		}
		youPaid := effectivePayerID == userID || normalizeEmail(payerEmail) == normalizeEmail(userEmail)

		for _, split := range splits {
			if youPaid {
				if split.UserID != userID {
					if _, ok := balancesMap[split.UserID]; !ok {
						balancesMap[split.UserID] = &dto.DebtBalance{UserID: split.UserID, UserEmail: split.UserEmail, Balance: 0}
					}
					balancesMap[split.UserID].Balance += split.Amount
				}
			} else if split.UserID == userID {
				if _, ok := balancesMap[effectivePayerID]; !ok {
					balancesMap[effectivePayerID] = &dto.DebtBalance{UserID: effectivePayerID, UserEmail: payerEmail, Balance: 0}
				}
				balancesMap[effectivePayerID].Balance -= split.Amount
			}
		}
	}

	// ------ Settlements ------
	setRows, err := h.DB.Query(`
		SELECT payer_id, payer_email, payee_id, payee_email, amount
		FROM settlements
		WHERE payer_id = $1 OR payee_id = $1
	`, userID)
	if err == nil {
		defer setRows.Close()
		for setRows.Next() {
			var pID, pEmail, payeeID, payeeEmail string
			var amount float64
			if err := setRows.Scan(&pID, &pEmail, &payeeID, &payeeEmail, &amount); err != nil {
				continue
			}
			if pID == userID {
				if _, ok := balancesMap[payeeID]; !ok {
					balancesMap[payeeID] = &dto.DebtBalance{UserID: payeeID, UserEmail: payeeEmail, Balance: 0}
				}
				balancesMap[payeeID].Balance += amount // user paid → reduces debt
			} else if payeeID == userID {
				if _, ok := balancesMap[pID]; !ok {
					balancesMap[pID] = &dto.DebtBalance{UserID: pID, UserEmail: pEmail, Balance: 0}
				}
				balancesMap[pID].Balance -= amount // user received → reduces credit
			}
		}
	}

	// Round and filter
	balances := []dto.DebtBalance{}
	for _, b := range balancesMap {
		b.Balance = math.Round(b.Balance*100) / 100
		if b.Balance != 0 {
			balances = append(balances, *b)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(balances)
}

func (h *ExpenseHandler) SettleDebt(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, userEmail, err := h.getUserInfo(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	var req dto.SettlementRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.PayeeID == "" || req.Amount <= 0 {
		http.Error(w, "Payee ID and positive amount are required", http.StatusBadRequest)
		return
	}

	req.PayeeEmail = normalizeEmail(req.PayeeEmail)

	var settlementID string
	err = h.DB.QueryRow(`
		INSERT INTO settlements (payer_id, payer_email, payee_id, payee_email, amount) 
		VALUES ($1, $2, $3, $4, $5) RETURNING id
	`, userID, userEmail, req.PayeeID, req.PayeeEmail, req.Amount).Scan(&settlementID)

	if err != nil {
		log.Printf("Failed to settle debt: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if h.Publisher != nil {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer cancel()
			_ = h.Publisher.PublishNotification(ctx, req.PayeeEmail, "settlement_added", map[string]string{
				"sender_email": userEmail,
				"payee_email":  req.PayeeEmail,
				"amount":       fmt.Sprintf("%.2f", req.Amount),
			})
		}()
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(dto.SettlementResponse{
		ID:         settlementID,
		PayerID:    userID,
		PayerEmail: userEmail,
		PayeeID:    req.PayeeID,
		PayeeEmail: req.PayeeEmail,
		Amount:     req.Amount,
		CreatedAt:  time.Now(),
	})
}

func (h *ExpenseHandler) ListSettlements(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, _, err := h.getUserInfo(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	rows, err := h.DB.Query(`
		SELECT id, payer_id, payer_email, payee_id, payee_email, amount, created_at 
		FROM settlements 
		WHERE payer_id = $1 OR payee_id = $1 
		ORDER BY created_at DESC
	`, userID)

	if err != nil {
		log.Printf("Failed to query settlements: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	settlements := []dto.SettlementResponse{}
	for rows.Next() {
		var s dto.SettlementResponse
		var createdAt time.Time
		if err := rows.Scan(&s.ID, &s.PayerID, &s.PayerEmail, &s.PayeeID, &s.PayeeEmail, &s.Amount, &createdAt); err == nil {
			s.CreatedAt = createdAt
			settlements = append(settlements, s)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(settlements)
}

func (h *ExpenseHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	email := r.URL.Query().Get("email")
	var enabled bool
	var err error

	if email != "" {
		err = h.DB.QueryRow("SELECT notifications_enabled FROM user_settings WHERE email = $1", email).Scan(&enabled)
	} else {
		userID, _, errInfo := h.getUserInfo(r)
		if errInfo != nil {
			http.Error(w, errInfo.Error(), http.StatusUnauthorized)
			return
		}
		err = h.DB.QueryRow("SELECT notifications_enabled FROM user_settings WHERE user_id = $1", userID).Scan(&enabled)
	}

	if err == sql.ErrNoRows {
		enabled = true // default enabled
	} else if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(dto.SettingsResponse{NotificationsEnabled: enabled})
}

func (h *ExpenseHandler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, _, err := h.getUserInfo(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	var req dto.UpdateSettingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	_, err = h.DB.Exec(`
		INSERT INTO user_settings (user_id, email, notifications_enabled) 
		VALUES ($1, 'unknown@example.com', $2) 
		ON CONFLICT (user_id) DO UPDATE SET notifications_enabled = $2
	`, userID, req.NotificationsEnabled)

	if err != nil {
		log.Printf("Failed to update user settings: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Settings updated successfully"})
}
