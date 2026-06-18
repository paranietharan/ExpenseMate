package expense

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
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

func (h *ExpenseHandler) getOrCreateUserIDByEmail(email string) (string, error) {
	var id string
	err := h.DB.QueryRow("SELECT user_id FROM user_settings WHERE email = $1", email).Scan(&id)
	if err == sql.ErrNoRows {
		// Create new invitee settings
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

func (h *ExpenseHandler) CreateGroup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, userEmail, err := h.getUserInfo(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	var req dto.CreateGroupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		http.Error(w, "Group name is required", http.StatusBadRequest)
		return
	}

	tx, err := h.DB.Begin()
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	var groupID string
	err = tx.QueryRow("INSERT INTO groups (name) VALUES ($1) RETURNING id", req.Name).Scan(&groupID)
	if err != nil {
		log.Printf("Failed to create group: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Add creator as member
	_, err = tx.Exec("INSERT INTO group_members (group_id, user_id, user_email) VALUES ($1, $2, $3)", groupID, userID, userEmail)
	if err != nil {
		log.Printf("Failed to add creator as group member: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Add other members
	addedEmails := make(map[string]bool)
	addedEmails[userEmail] = true

	for _, email := range req.Members {
		email = strings.TrimSpace(strings.ToLower(email))
		if email == "" || addedEmails[email] {
			continue
		}
		addedEmails[email] = true

		memberID, err := h.getOrCreateUserIDByEmail(email)
		if err != nil {
			log.Printf("Failed to get or create user for email %s: %v", email, err)
			continue
		}

		_, err = tx.Exec("INSERT INTO group_members (group_id, user_id, user_email) VALUES ($1, $2, $3)", groupID, memberID, email)
		if err != nil {
			log.Printf("Failed to add group member: %v", err)
			continue
		}
	}

	if err = tx.Commit(); err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Fetch members list to return response
	rows, err := h.DB.Query("SELECT user_id, user_email, joined_at FROM group_members WHERE group_id = $1", groupID)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	members := []dto.GroupMemberResponse{}
	for rows.Next() {
		var m dto.GroupMemberResponse
		if err := rows.Scan(&m.UserID, &m.UserEmail, &m.JoinedAt); err == nil {
			members = append(members, m)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(dto.GroupResponse{
		ID:        groupID,
		Name:      req.Name,
		CreatedAt: time.Now(),
		Members:   members,
	})
}

func (h *ExpenseHandler) ListGroups(w http.ResponseWriter, r *http.Request) {
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
		SELECT g.id, g.name, g.created_at 
		FROM groups g 
		JOIN group_members gm ON gm.group_id = g.id 
		WHERE gm.user_id = $1 
		ORDER BY g.created_at DESC
	`, userID)
	if err != nil {
		log.Printf("Failed to query user groups: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	groups := []dto.GroupResponse{}
	for rows.Next() {
		var g dto.GroupResponse
		if err := rows.Scan(&g.ID, &g.Name, &g.CreatedAt); err != nil {
			continue
		}

		// Fetch members for this group
		memberRows, err := h.DB.Query("SELECT user_id, user_email, joined_at FROM group_members WHERE group_id = $1", g.ID)
		if err != nil {
			continue
		}
		g.Members = []dto.GroupMemberResponse{}
		for memberRows.Next() {
			var m dto.GroupMemberResponse
			if err := memberRows.Scan(&m.UserID, &m.UserEmail, &m.JoinedAt); err == nil {
				g.Members = append(g.Members, m)
			}
		}
		memberRows.Close()

		groups = append(groups, g)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(groups)
}

func (h *ExpenseHandler) GetGroupDetails(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, _, err := h.getUserInfo(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	groupID := strings.TrimPrefix(r.URL.Path, "/groups/")

	// Verify membership
	var isMember bool
	err = h.DB.QueryRow("SELECT EXISTS(SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2)", groupID, userID).Scan(&isMember)
	if err != nil || !isMember {
		http.Error(w, "Group not found or access denied", http.StatusForbidden)
		return
	}

	var g dto.GroupResponse
	err = h.DB.QueryRow("SELECT id, name, created_at FROM groups WHERE id = $1", groupID).Scan(&g.ID, &g.Name, &g.CreatedAt)
	if err != nil {
		http.Error(w, "Group not found", http.StatusNotFound)
		return
	}

	rows, err := h.DB.Query("SELECT user_id, user_email, joined_at FROM group_members WHERE group_id = $1", groupID)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	g.Members = []dto.GroupMemberResponse{}
	for rows.Next() {
		var m dto.GroupMemberResponse
		if err := rows.Scan(&m.UserID, &m.UserEmail, &m.JoinedAt); err == nil {
			g.Members = append(g.Members, m)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(g)
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

	tx, err := h.DB.Begin()
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// 1. If group_id is supplied, verify membership
	if req.GroupID != nil && *req.GroupID != "" {
		var isMember bool
		err = tx.QueryRow("SELECT EXISTS(SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2)", *req.GroupID, userID).Scan(&isMember)
		if err != nil || !isMember {
			http.Error(w, "Access denied to group", http.StatusForbidden)
			return
		}
	}

	// 2. Insert expense
	var expenseID string
	var groupIDVal sql.NullString
	if req.GroupID != nil && *req.GroupID != "" {
		groupIDVal = sql.NullString{String: *req.GroupID, Valid: true}
	}
	err = tx.QueryRow(`
		INSERT INTO expenses (group_id, description, amount, payer_id, payer_email) 
		VALUES ($1, $2, $3, $4, $5) RETURNING id
	`, groupIDVal, req.Description, req.Amount, userID, userEmail).Scan(&expenseID)
	if err != nil {
		log.Printf("Failed to insert expense: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// 3. Compute splits
	splits := req.Splits
	if len(splits) == 0 {
		// If group expense and no splits given, split equally among all group members
		if req.GroupID != nil && *req.GroupID != "" {
			rows, err := h.DB.Query("SELECT user_id, user_email FROM group_members WHERE group_id = $1", *req.GroupID)
			if err != nil {
				http.Error(w, "Internal server error", http.StatusInternalServerError)
				return
			}
			defer rows.Close()

			var membersList []struct {
				id    string
				email string
			}
			for rows.Next() {
				var m struct {
					id    string
					email string
				}
				if err := rows.Scan(&m.id, &m.email); err == nil {
					membersList = append(membersList, m)
				}
			}

			if len(membersList) > 0 {
				splitAmount := req.Amount / float64(len(membersList))
				for _, m := range membersList {
					splits = append(splits, dto.ExpenseSplit{
						UserID:    m.id,
						UserEmail: m.email,
						Amount:    splitAmount,
					})
				}
			}
		} else {
			// Peer-to-peer expense split equally with self
			splits = append(splits, dto.ExpenseSplit{
				UserID:    userID,
				UserEmail: userEmail,
				Amount:    req.Amount,
			})
		}
	}

	// 4. Insert splits
	for _, split := range splits {
		split.UserEmail = strings.TrimSpace(strings.ToLower(split.UserEmail))
		if split.UserID == "" {
			split.UserID, err = h.getOrCreateUserIDByEmail(split.UserEmail)
			if err != nil {
				log.Printf("Failed to resolve user ID for split email: %v", err)
				continue
			}
		}

		_, err = tx.Exec("INSERT INTO expense_splits (expense_id, user_id, user_email, amount) VALUES ($1, $2, $3, $4)", expenseID, split.UserID, split.UserEmail, split.Amount)
		if err != nil {
			log.Printf("Failed to insert split: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	}

	if err = tx.Commit(); err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if h.Publisher != nil {
		for _, split := range splits {
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

	var retGroupID *string
	if req.GroupID != nil && *req.GroupID != "" {
		retGroupID = req.GroupID
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(dto.ExpenseResponse{
		ID:          expenseID,
		GroupID:     retGroupID,
		Description: req.Description,
		Amount:      req.Amount,
		PayerID:     userID,
		PayerEmail:  userEmail,
		CreatedAt:   time.Now(),
		Splits:      splits,
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

	groupID := r.URL.Query().Get("group_id")

	var rows *sql.Rows
	if groupID != "" {
		rows, err = h.DB.Query(`
			SELECT id, group_id, description, amount, payer_id, payer_email, created_at 
			FROM expenses 
			WHERE group_id = $1 
			ORDER BY created_at DESC
		`, groupID)
	} else {
		rows, err = h.DB.Query(`
			SELECT DISTINCT e.id, e.group_id, e.description, e.amount, e.payer_id, e.payer_email, e.created_at 
			FROM expenses e 
			LEFT JOIN expense_splits s ON s.expense_id = e.id 
			WHERE e.payer_id = $1 OR s.user_id = $1 
			ORDER BY e.created_at DESC
		`, userID)
	}

	if err != nil {
		log.Printf("Failed to query expenses: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	expenses := []dto.ExpenseResponse{}
	for rows.Next() {
		var e dto.ExpenseResponse
		var gID sql.NullString
		var createdAt time.Time
		if err := rows.Scan(&e.ID, &gID, &e.Description, &e.Amount, &e.PayerID, &e.PayerEmail, &createdAt); err != nil {
			continue
		}
		e.CreatedAt = createdAt

		if gID.Valid {
			e.GroupID = &gID.String
		}

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

	userID, _, err := h.getUserInfo(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	expenseID := strings.TrimPrefix(r.URL.Path, "/expenses/")

	var payerID string
	err = h.DB.QueryRow("SELECT payer_id FROM expenses WHERE id = $1", expenseID).Scan(&payerID)
	if err != nil {
		http.Error(w, "Expense not found", http.StatusNotFound)
		return
	}

	if payerID != userID {
		http.Error(w, "Only the payer can update this expense", http.StatusForbidden)
		return
	}

	var req dto.CreateExpenseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	tx, err := h.DB.Begin()
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	_, err = tx.Exec("UPDATE expenses SET description = $1, amount = $2 WHERE id = $3", req.Description, req.Amount, expenseID)
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
		if split.UserID == "" {
			split.UserID, err = h.getOrCreateUserIDByEmail(split.UserEmail)
			if err != nil {
				continue
			}
		}
		_, err = tx.Exec("INSERT INTO expense_splits (expense_id, user_id, user_email, amount) VALUES ($1, $2, $3, $4)", expenseID, split.UserID, split.UserEmail, split.Amount)
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

	var payerID string
	err = h.DB.QueryRow("SELECT payer_id FROM expenses WHERE id = $1", expenseID).Scan(&payerID)
	if err != nil {
		http.Error(w, "Expense not found", http.StatusNotFound)
		return
	}

	if payerID != userID {
		http.Error(w, "Only the payer can delete this expense", http.StatusForbidden)
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

	userID, _, err := h.getUserInfo(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	groupID := r.URL.Query().Get("group_id")

	// 1. Fetch expenses
	var expRows *sql.Rows
	if groupID != "" {
		expRows, err = h.DB.Query("SELECT id, payer_id, payer_email, amount FROM expenses WHERE group_id = $1", groupID)
	} else {
		expRows, err = h.DB.Query(`
			SELECT DISTINCT e.id, e.payer_id, e.payer_email, e.amount 
			FROM expenses e 
			LEFT JOIN expense_splits s ON s.expense_id = e.id 
			WHERE e.payer_id = $1 OR s.user_id = $1
		`, userID)
	}

	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer expRows.Close()

	// Map of friend_email -> balance (positive means they owe you, negative means you owe them)
	balancesMap := make(map[string]*dto.DebtBalance)

	for expRows.Next() {
		var expID, payerID, payerEmail string
		var amount float64
		if err := expRows.Scan(&expID, &payerID, &payerEmail, &amount); err != nil {
			continue
		}

		// Fetch splits for this expense
		splitsRows, err := h.DB.Query("SELECT user_id, user_email, amount FROM expense_splits WHERE expense_id = $1", expID)
		if err != nil {
			continue
		}

		for splitsRows.Next() {
			var splitUserID, splitUserEmail string
			var splitAmount float64
			if err := splitsRows.Scan(&splitUserID, &splitUserEmail, &splitAmount); err != nil {
				continue
			}

			// If I am the payer
			if payerID == userID {
				if splitUserID != userID {
					if _, ok := balancesMap[splitUserEmail]; !ok {
						balancesMap[splitUserEmail] = &dto.DebtBalance{UserID: splitUserID, UserEmail: splitUserEmail, Balance: 0}
					}
					balancesMap[splitUserEmail].Balance += splitAmount
				}
			} else {
				// If I am in the splits, and someone else paid
				if splitUserID == userID {
					if _, ok := balancesMap[payerEmail]; !ok {
						balancesMap[payerEmail] = &dto.DebtBalance{UserID: payerID, UserEmail: payerEmail, Balance: 0}
					}
					balancesMap[payerEmail].Balance -= splitAmount
				}
			}
		}
		splitsRows.Close()
	}

	// 2. Fetch settlements to offset balances
	var setRows *sql.Rows
	if groupID != "" {
		setRows, err = h.DB.Query("SELECT payer_id, payer_email, payee_id, payee_email, amount FROM settlements WHERE group_id = $1", groupID)
	} else {
		setRows, err = h.DB.Query("SELECT payer_id, payer_email, payee_id, payee_email, amount FROM settlements WHERE payer_id = $1 OR payee_id = $1", userID)
	}

	if err == nil {
		for setRows.Next() {
			var pID, pEmail, payeeID, payeeEmail string
			var amount float64
			if err := setRows.Scan(&pID, &pEmail, &payeeID, &payeeEmail, &amount); err == nil {
				if pID == userID {
					// I paid payee, so they owe me less / I owe them less (increases my balance)
					if _, ok := balancesMap[payeeEmail]; !ok {
						balancesMap[payeeEmail] = &dto.DebtBalance{UserID: payeeID, UserEmail: payeeEmail, Balance: 0}
					}
					balancesMap[payeeEmail].Balance += amount
				} else if payeeID == userID {
					// Payer paid me, so I owe them less / they owe me less (decreases my balance)
					if _, ok := balancesMap[pEmail]; !ok {
						balancesMap[pEmail] = &dto.DebtBalance{UserID: pID, UserEmail: pEmail, Balance: 0}
					}
					balancesMap[pEmail].Balance -= amount
				}
			}
		}
		setRows.Close()
	}

	balances := []dto.DebtBalance{}
	for _, b := range balancesMap {
		// round to 2 decimals
		b.Balance = float64(int(b.Balance*100)) / 100.0
		if b.Balance != 0.0 {
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

	var groupIDVal sql.NullString
	if req.GroupID != nil && *req.GroupID != "" {
		groupIDVal = sql.NullString{String: *req.GroupID, Valid: true}
	}

	var settlementID string
	err = h.DB.QueryRow(`
		INSERT INTO settlements (group_id, payer_id, payer_email, payee_id, payee_email, amount) 
		VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
	`, groupIDVal, userID, userEmail, req.PayeeID, req.PayeeEmail, req.Amount).Scan(&settlementID)

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
		GroupID:    req.GroupID,
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

	groupID := r.URL.Query().Get("group_id")

	var rows *sql.Rows
	if groupID != "" {
		rows, err = h.DB.Query(`
			SELECT id, group_id, payer_id, payer_email, payee_id, payee_email, amount, created_at 
			FROM settlements 
			WHERE group_id = $1 
			ORDER BY created_at DESC
		`, groupID)
	} else {
		rows, err = h.DB.Query(`
			SELECT id, group_id, payer_id, payer_email, payee_id, payee_email, amount, created_at 
			FROM settlements 
			WHERE payer_id = $1 OR payee_id = $1 
			ORDER BY created_at DESC
		`, userID)
	}

	if err != nil {
		log.Printf("Failed to query settlements: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	settlements := []dto.SettlementResponse{}
	for rows.Next() {
		var s dto.SettlementResponse
		var gID sql.NullString
		var createdAt time.Time
		if err := rows.Scan(&s.ID, &gID, &s.PayerID, &s.PayerEmail, &s.PayeeID, &s.PayeeEmail, &s.Amount, &createdAt); err == nil {
			s.CreatedAt = createdAt
			if gID.Valid {
				s.GroupID = &gID.String
			}
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
