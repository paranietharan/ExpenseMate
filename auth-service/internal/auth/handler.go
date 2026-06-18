package auth

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"auth-service/internal/database"
	"auth-service/internal/dto"
	"auth-service/internal/rabbitmq"
	internal_redis "auth-service/internal/redis"

	"github.com/redis/go-redis/v9"
	qrcode "github.com/skip2/go-qrcode"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	DB            *sql.DB
	RedisClient   *redis.Client
	PrintMFACodes bool
	Publisher     *rabbitmq.RabbitMQPublisher
}

func NewAuthHandler(database *sql.DB, rdb *redis.Client, printMFACodes bool, pub *rabbitmq.RabbitMQPublisher) *AuthHandler {
	return &AuthHandler{
		DB:            database,
		RedisClient:   rdb,
		PrintMFACodes: printMFACodes,
		Publisher:     pub,
	}
}

func generateSecureToken() (string, error) {
	b := make([]byte, 32)
	_, err := rand.Read(b)
	if err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func generateEmailCode() (string, error) {
	b := make([]byte, 4)
	_, err := rand.Read(b)
	if err != nil {
		return "", err
	}
	num := binary.BigEndian.Uint32(b)%900000 + 100000
	return fmt.Sprintf("%06d", num), nil
}

func (h *AuthHandler) getAuthenticatedUserID(r *http.Request) (string, error) {
	cookie, err := r.Cookie("session_id")
	if err != nil {
		return "", fmt.Errorf("session cookie missing: %w", err)
	}

	userID, err := internal_redis.GetSession(cookie.Value)
	if err != nil {
		return "", fmt.Errorf("session invalid or expired: %w", err)
	}

	return userID, nil
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req dto.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || len(req.Password) < 8 {
		http.Error(w, "Invalid email or password (min 8 characters)", http.StatusBadRequest)
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	query := "INSERT INTO users (email, password_hash) VALUES ($1, $2)"
	_, err = h.DB.Exec(query, req.Email, string(hashedPassword))
	if err != nil {
		if strings.Contains(err.Error(), "unique constraint") || strings.Contains(err.Error(), "duplicate key") {
			http.Error(w, "User already exists", http.StatusConflict)
			return
		}
		log.Printf("Failed to register user: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	code, err := generateEmailCode()
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	pendingKey := fmt.Sprintf("pending_registration_verify:%s", req.Email)
	err = h.RedisClient.Set(r.Context(), pendingKey, code, 15*time.Minute).Err()
	if err != nil {
		log.Printf("Failed to cache pending registration verification: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if h.PrintMFACodes {
		log.Printf("[REGISTRATION] Verification Code for user %s: %s\n", req.Email, code)
		fmt.Printf("\n--- [EMAIL OUTBOX SIMULATOR - REGISTRATION] ---\nTo: %s\nSubject: ExpenseMate Email Verification\nCode: %s\n-----------------------------------------------\n\n", req.Email, code)
	}

	if h.Publisher != nil {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			h.Publisher.PublishNotification(ctx, req.Email, "register", map[string]string{"code": code})
		}()
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "Registration successful. Please verify your email."})
}

func (h *AuthHandler) VerifyRegister(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req dto.VerifyRegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || req.Code == "" {
		http.Error(w, "Email and verification code are required", http.StatusBadRequest)
		return
	}

	pendingKey := fmt.Sprintf("pending_registration_verify:%s", req.Email)
	cachedCode, err := h.RedisClient.Get(r.Context(), pendingKey).Result()
	if err != nil {
		http.Error(w, "Verification code expired or not found", http.StatusBadRequest)
		return
	}

	if cachedCode != req.Code {
		http.Error(w, "Invalid verification code", http.StatusUnauthorized)
		return
	}

	query := "UPDATE users SET is_verified = TRUE, updated_at = NOW() WHERE email = $1"
	res, err := h.DB.Exec(query, req.Email)
	if err != nil {
		log.Printf("Failed to verify user email: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil || rowsAffected == 0 {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	_ = h.RedisClient.Del(r.Context(), pendingKey).Err()

	if h.Publisher != nil {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			h.Publisher.PublishNotification(ctx, req.Email, "welcome", nil)
		}()
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Email verified successfully. You can now login."})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req dto.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	var user database.User
	query := "SELECT id, email, password_hash, role, totp_secret, totp_enabled, email_mfa_enabled, is_verified FROM users WHERE email = $1"
	err := h.DB.QueryRow(query, req.Email).Scan(
		&user.ID, &user.Email, &user.PasswordHash, &user.Role, &user.TOTPSecret, &user.TOTPEnabled, &user.EmailMFAEnabled, &user.IsVerified,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Invalid credentials", http.StatusUnauthorized)
			return
		}
		log.Printf("Database query error: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	if !user.IsVerified {
		code, err := generateEmailCode()
		if err != nil {
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		pendingKey := fmt.Sprintf("pending_registration_verify:%s", req.Email)
		err = h.RedisClient.Set(r.Context(), pendingKey, code, 15*time.Minute).Err()
		if err != nil {
			log.Printf("Failed to cache pending registration verification: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		if h.PrintMFACodes {
			log.Printf("[REGISTRATION] Verification Code for user %s: %s\n", req.Email, code)
			fmt.Printf("\n--- [EMAIL OUTBOX SIMULATOR - REGISTRATION] ---\nTo: %s\nSubject: ExpenseMate Email Verification\nCode: %s\n-----------------------------------------------\n\n", req.Email, code)
		}

		if h.Publisher != nil {
			go func() {
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				h.Publisher.PublishNotification(ctx, req.Email, "register", map[string]string{"code": code})
			}()
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "Account not verified. A verification code has been sent to your email.",
			"verification_required": true,
			"email": req.Email,
		})
		return
	}

	// Check if MFA is enabled
	if user.TOTPEnabled || user.EmailMFAEnabled {
		tempToken, err := generateSecureToken()
		if err != nil {
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		var methods []string
		if user.TOTPEnabled {
			methods = append(methods, "totp")
		}
		if user.EmailMFAEnabled {
			methods = append(methods, "email")
		}

		tempData := &internal_redis.TempLoginData{
			UserID:  user.ID,
			Methods: methods,
		}

		// If ONLY email is enabled, select it automatically and generate code
		if !user.TOTPEnabled && user.EmailMFAEnabled {
			tempData.SelectedMethod = "email"
			code, err := generateEmailCode()
			if err != nil {
				http.Error(w, "Internal server error", http.StatusInternalServerError)
				return
			}
			tempData.EmailCode = code

			if h.PrintMFACodes {
				log.Printf("[EMAIL MFA] Verification Code for user %s: %s\n", user.Email, code)
				fmt.Printf("\n--- [EMAIL OUTBOX SIMULATOR] ---\nTo: %s\nSubject: ExpenseMate Verification Code\nCode: %s\n--------------------------------\n\n", user.Email, code)
			}
		}

		err = internal_redis.SaveTempLogin(tempToken, tempData, 5*time.Minute)
		if err != nil {
			log.Printf("Failed to save temp login session: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"mfa_required": true,
			"temp_token":   tempToken,
			"methods":      methods,
		})
		return
	}

	sessionID, err := generateSecureToken()
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	err = internal_redis.SaveSession(sessionID, user.ID, user.Email, 7*24*time.Hour)
	if err != nil {
		log.Printf("Failed to save session: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "session_id",
		Value:    sessionID,
		Path:     "/",
		MaxAge:   int((7 * 24 * time.Hour).Seconds()),
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
	})

	if h.Publisher != nil {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			h.Publisher.PublishNotification(ctx, user.Email, "login", nil)
		}()
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Login successful",
		"user_id": user.ID,
	})
}

func (h *AuthHandler) SelectMFA(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req dto.SelectMFARequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.TempToken == "" || (req.Method != "totp" && req.Method != "email") {
		http.Error(w, "Invalid temp token or method selection", http.StatusBadRequest)
		return
	}

	tempData, err := internal_redis.GetTempLogin(req.TempToken)
	if err != nil {
		http.Error(w, "Invalid or expired MFA session", http.StatusUnauthorized)
		return
	}

	// Verify the method is allowed
	allowed := false
	for _, m := range tempData.Methods {
		if m == req.Method {
			allowed = true
			break
		}
	}
	if !allowed {
		http.Error(w, "Selected method not enabled for this user", http.StatusForbidden)
		return
	}

	tempData.SelectedMethod = req.Method

	if req.Method == "email" {
		code, err := generateEmailCode()
		if err != nil {
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		tempData.EmailCode = code

		// Print code to console
		var email string
		h.DB.QueryRow("SELECT email FROM users WHERE id = $1", tempData.UserID).Scan(&email)

		if h.PrintMFACodes {
			log.Printf("[EMAIL MFA] Verification Code for user %s: %s\n", email, code)
			fmt.Printf("\n--- [EMAIL OUTBOX SIMULATOR] ---\nTo: %s\nSubject: ExpenseMate Verification Code\nCode: %s\n--------------------------------\n\n", email, code)
		}
	}

	err = internal_redis.SaveTempLogin(req.TempToken, tempData, 5*time.Minute)
	if err != nil {
		log.Printf("Failed to update temp login session: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": fmt.Sprintf("MFA method %s selected successfully", req.Method)})
}

func (h *AuthHandler) VerifyLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req dto.VerifyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.TempToken == "" {
		http.Error(w, "Missing temp token", http.StatusBadRequest)
		return
	}

	tempData, err := internal_redis.GetTempLogin(req.TempToken)
	if err != nil {
		http.Error(w, "Invalid or expired MFA session", http.StatusUnauthorized)
		return
	}

	// Determine method to verify
	method := req.Method
	if method == "" {
		if tempData.SelectedMethod != "" {
			method = tempData.SelectedMethod
		} else if len(tempData.Methods) == 1 {
			method = tempData.Methods[0]
		} else {
			http.Error(w, "Multiple MFA methods available. You must select a method first.", http.StatusBadRequest)
			return
		}
	}

	// Verify the selected method is valid for this login session
	methodAllowed := false
	for _, m := range tempData.Methods {
		if m == method {
			methodAllowed = true
			break
		}
	}
	if !methodAllowed {
		http.Error(w, "Selected method not enabled for this user", http.StatusForbidden)
		return
	}

	var user database.User
	query := "SELECT id, email, totp_secret, totp_enabled, email_mfa_enabled FROM users WHERE id = $1"
	err = h.DB.QueryRow(query, tempData.UserID).Scan(&user.ID, &user.Email, &user.TOTPSecret, &user.TOTPEnabled, &user.EmailMFAEnabled)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	switch method {
	case "totp":
		if req.Code == "" {
			http.Error(w, "Missing TOTP code", http.StatusUnauthorized)
			return
		}
		if !user.TOTPSecret.Valid || !ValidateTOTPCode(user.TOTPSecret.String, req.Code) {
			http.Error(w, "Invalid TOTP code", http.StatusUnauthorized)
			return
		}
	case "email":
		if req.Code == "" {
			http.Error(w, "Missing email verification code", http.StatusUnauthorized)
			return
		}
		if tempData.EmailCode == "" {
			http.Error(w, "Email verification code not generated. Please select the email MFA method first to receive the code.", http.StatusBadRequest)
			return
		}
		if tempData.EmailCode != req.Code {
			http.Error(w, "Invalid email verification code", http.StatusUnauthorized)
			return
		}
	default:
		http.Error(w, "Unsupported MFA verification method", http.StatusBadRequest)
		return
	}

	_ = internal_redis.DeleteTempLogin(req.TempToken)

	sessionID, err := generateSecureToken()
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	err = internal_redis.SaveSession(sessionID, user.ID, user.Email, 7*24*time.Hour)
	if err != nil {
		log.Printf("Failed to save session: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "session_id",
		Value:    sessionID,
		Path:     "/",
		MaxAge:   int((7 * 24 * time.Hour).Seconds()),
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
	})

	if h.Publisher != nil {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			h.Publisher.PublishNotification(ctx, user.Email, "login", nil)
		}()
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Login successful",
		"user_id": user.ID,
	})
}

func (h *AuthHandler) SetupTOTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.getAuthenticatedUserID(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	secret, err := GenerateTOTPSecret()
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	pendingKey := fmt.Sprintf("pending_totp:%s", userID)
	err = h.RedisClient.Set(r.Context(), pendingKey, secret, 10*time.Minute).Err()
	if err != nil {
		log.Printf("Failed to cache pending TOTP: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	var email string
	h.DB.QueryRow("SELECT email FROM users WHERE id = $1", userID).Scan(&email)
	otpauthURL := fmt.Sprintf("otpauth://totp/ExpenseMate:%s?secret=%s&issuer=ExpenseMate", email, secret)

	if h.PrintMFACodes {
		fmt.Printf("\n--- [TOTP SETUP SIMULATOR] ---\nUser ID: %s\nSecret: %s\nURI: %s\n", userID, secret, otpauthURL)
		if qr, qrErr := qrcode.New(otpauthURL, qrcode.Medium); qrErr == nil {
			fmt.Println("\nScan this QR code with your Authenticator App:")
			fmt.Println(qr.ToSmallString(false))
		} else {
			log.Printf("Failed to generate terminal QR code: %v", qrErr)
		}
		fmt.Printf("------------------------------\n\n")
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"secret":      secret,
		"otpauth_url": otpauthURL,
	})
}

func (h *AuthHandler) EnableTOTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.getAuthenticatedUserID(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	var req dto.MFATOTPEnableRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	pendingKey := fmt.Sprintf("pending_totp:%s", userID)
	secret, err := h.RedisClient.Get(r.Context(), pendingKey).Result()
	if err != nil {
		http.Error(w, "MFA setup session expired or not initiated", http.StatusBadRequest)
		return
	}

	if !ValidateTOTPCode(secret, req.Code) {
		http.Error(w, "Invalid code. Verification failed.", http.StatusUnauthorized)
		return
	}
	query := "UPDATE users SET totp_secret = $1, totp_enabled = TRUE, updated_at = NOW() WHERE id = $2"
	_, err = h.DB.Exec(query, secret, userID)
	if err != nil {
		log.Printf("Failed to enable TOTP in DB: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	_ = h.RedisClient.Del(r.Context(), pendingKey).Err()

	if h.Publisher != nil {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			var email string
			h.DB.QueryRow("SELECT email FROM users WHERE id = $1", userID).Scan(&email)
			h.Publisher.PublishNotification(ctx, email, "enable_totp", nil)
		}()
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "TOTP Multi-factor authentication enabled successfully"})
}

func (h *AuthHandler) DisableTOTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.getAuthenticatedUserID(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	query := "UPDATE users SET totp_secret = NULL, totp_enabled = FALSE, updated_at = NOW() WHERE id = $1"
	_, err = h.DB.Exec(query, userID)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if h.Publisher != nil {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			var email string
			h.DB.QueryRow("SELECT email FROM users WHERE id = $1", userID).Scan(&email)
			h.Publisher.PublishNotification(ctx, email, "disable_totp", nil)
		}()
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "TOTP Multi-factor authentication disabled successfully"})
}

// SetupEmailMFA generates a verification code and registers email ownership confirmation pending.
func (h *AuthHandler) SetupEmailMFA(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.getAuthenticatedUserID(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	code, err := generateEmailCode()
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	pendingKey := fmt.Sprintf("pending_email_mfa:%s", userID)
	err = h.RedisClient.Set(r.Context(), pendingKey, code, 10*time.Minute).Err()
	if err != nil {
		log.Printf("Failed to cache pending email verification: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	var email string
	h.DB.QueryRow("SELECT email FROM users WHERE id = $1", userID).Scan(&email)

	if h.PrintMFACodes {
		log.Printf("[EMAIL MFA SETUP] Verification Code for user %s: %s\n", email, code)
		fmt.Printf("\n--- [EMAIL OUTBOX SIMULATOR - SETUP] ---\nTo: %s\nSubject: ExpenseMate Email MFA Setup\nCode: %s\n----------------------------------------\n\n", email, code)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Email verification code sent successfully"})
}

func (h *AuthHandler) EnableEmailMFA(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.getAuthenticatedUserID(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	var req dto.MFAEmailEnableRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	pendingKey := fmt.Sprintf("pending_email_mfa:%s", userID)
	cachedCode, err := h.RedisClient.Get(r.Context(), pendingKey).Result()
	if err != nil {
		http.Error(w, "Email verification setup session expired or not initiated", http.StatusBadRequest)
		return
	}

	if cachedCode != req.Code {
		http.Error(w, "Invalid verification code. Enable failed.", http.StatusUnauthorized)
		return
	}

	query := "UPDATE users SET email_mfa_enabled = TRUE, updated_at = NOW() WHERE id = $1"
	_, err = h.DB.Exec(query, userID)
	if err != nil {
		log.Printf("Failed to enable email MFA: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	_ = h.RedisClient.Del(r.Context(), pendingKey).Err()

	if h.Publisher != nil {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			var email string
			h.DB.QueryRow("SELECT email FROM users WHERE id = $1", userID).Scan(&email)
			h.Publisher.PublishNotification(ctx, email, "enable_email_2fa", nil)
		}()
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Email Multi-factor authentication enabled successfully"})
}

func (h *AuthHandler) DisableEmailMFA(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.getAuthenticatedUserID(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	query := "UPDATE users SET email_mfa_enabled = FALSE, updated_at = NOW() WHERE id = $1"
	_, err = h.DB.Exec(query, userID)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if h.Publisher != nil {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			var email string
			h.DB.QueryRow("SELECT email FROM users WHERE id = $1", userID).Scan(&email)
			h.Publisher.PublishNotification(ctx, email, "disable_email_2fa", nil)
		}()
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Email Multi-factor authentication disabled successfully"})
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	cookie, err := r.Cookie("session_id")
	if err == nil {
		_ = internal_redis.DeleteSession(cookie.Value)
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "session_id",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Logged out successfully"})
}

func (h *AuthHandler) Status(w http.ResponseWriter, r *http.Request) {
	userID, err := h.getAuthenticatedUserID(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	var email string
	var role string
	var totpEnabled bool
	var emailEnabled bool
	var name string
	var avatarURL string
	query := "SELECT email, role, totp_enabled, email_mfa_enabled, name, avatar_url FROM users WHERE id = $1"
	err = h.DB.QueryRow(query, userID).Scan(&email, &role, &totpEnabled, &emailEnabled, &name, &avatarURL)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(dto.StatusResponse{
		UserID:          userID,
		Email:           email,
		Role:            role,
		TOTPEnabled:     totpEnabled,
		EmailMFAEnabled: emailEnabled,
		Name:            name,
		AvatarURL:       avatarURL,
	})
}

func (h *AuthHandler) RequestPasswordReset(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req dto.PasswordResetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" {
		http.Error(w, "Email is required", http.StatusBadRequest)
		return
	}

	// Verify user exists
	var userID string
	err := h.DB.QueryRow("SELECT id FROM users WHERE email = $1", req.Email).Scan(&userID)
	if err != nil {
		if err == sql.ErrNoRows {
			// For security, do not leak user existence. Still print or say success.
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{"message": "If the email is registered, a password reset code has been sent."})
			return
		}
		log.Printf("Failed to verify user email: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	code, err := generateEmailCode()
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	pendingKey := fmt.Sprintf("password_reset_code:%s", req.Email)
	err = h.RedisClient.Set(r.Context(), pendingKey, code, 15*time.Minute).Err()
	if err != nil {
		log.Printf("Failed to cache password reset code: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if h.PrintMFACodes {
		log.Printf("[PASSWORD RESET] Verification Code for user %s: %s\n", req.Email, code)
		fmt.Printf("\n--- [EMAIL OUTBOX SIMULATOR - PASSWORD RESET] ---\nTo: %s\nSubject: ExpenseMate Password Reset Code\nCode: %s\n-------------------------------------------------\n\n", req.Email, code)
	}

	if h.Publisher != nil {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			h.Publisher.PublishNotification(ctx, req.Email, "forgot_password", map[string]string{"code": code})
		}()
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "If the email is registered, a password reset code has been sent."})
}

func (h *AuthHandler) VerifyPasswordReset(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req dto.PasswordResetVerifyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Code = strings.TrimSpace(req.Code)
	if req.Email == "" || req.Code == "" || len(req.NewPassword) < 8 {
		http.Error(w, "Email, code and a password with min 8 characters are required", http.StatusBadRequest)
		return
	}

	pendingKey := fmt.Sprintf("password_reset_code:%s", req.Email)
	cachedCode, err := h.RedisClient.Get(r.Context(), pendingKey).Result()
	if err != nil {
		http.Error(w, "Verification code expired or not found", http.StatusBadRequest)
		return
	}

	if cachedCode != req.Code {
		http.Error(w, "Invalid verification code", http.StatusUnauthorized)
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	query := "UPDATE users SET password_hash = $1, is_verified = TRUE, updated_at = NOW() WHERE email = $2"
	_, err = h.DB.Exec(query, string(hashedPassword), req.Email)
	if err != nil {
		log.Printf("Failed to update password: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	_ = h.RedisClient.Del(r.Context(), pendingKey).Err()

	if h.Publisher != nil {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			h.Publisher.PublishNotification(ctx, req.Email, "change_password", nil)
		}()
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Password has been reset successfully. You can now login."})
}

func (h *AuthHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.getAuthenticatedUserID(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	var req dto.PasswordChangeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.OldPassword == "" || len(req.NewPassword) < 8 {
		http.Error(w, "Old password and new password (min 8 characters) are required", http.StatusBadRequest)
		return
	}

	var passwordHash string
	err = h.DB.QueryRow("SELECT password_hash FROM users WHERE id = $1", userID).Scan(&passwordHash)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.OldPassword)); err != nil {
		http.Error(w, "Invalid old password", http.StatusUnauthorized)
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	_, err = h.DB.Exec("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", string(hashedPassword), userID)
	if err != nil {
		log.Printf("Failed to change password: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if h.Publisher != nil {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			var email string
			h.DB.QueryRow("SELECT email FROM users WHERE id = $1", userID).Scan(&email)
			h.Publisher.PublishNotification(ctx, email, "change_password", nil)
		}()
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Password changed successfully"})
}

func (h *AuthHandler) ChangeName(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.getAuthenticatedUserID(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	var req dto.ChangeNameRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		http.Error(w, "Name cannot be empty", http.StatusBadRequest)
		return
	}

	_, err = h.DB.Exec("UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2", req.Name, userID)
	if err != nil {
		log.Printf("Failed to change name: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Name changed successfully"})
}

func (h *AuthHandler) ChangeAvatar(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.getAuthenticatedUserID(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	var req dto.ChangeAvatarRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	req.AvatarURL = strings.TrimSpace(req.AvatarURL)
	_, err = h.DB.Exec("UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2", req.AvatarURL, userID)
	if err != nil {
		log.Printf("Failed to change avatar: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Avatar updated successfully"})
}

func (h *AuthHandler) RequestEmailChange(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.getAuthenticatedUserID(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	var req dto.RequestEmailChangeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	req.NewEmail = strings.TrimSpace(strings.ToLower(req.NewEmail))
	if req.NewEmail == "" {
		http.Error(w, "New email is required", http.StatusBadRequest)
		return
	}

	var exists bool
	err = h.DB.QueryRow("SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)", req.NewEmail).Scan(&exists)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	if exists {
		http.Error(w, "Email is already taken", http.StatusConflict)
		return
	}

	code, err := generateEmailCode()
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cacheVal := fmt.Sprintf("%s:%s", req.NewEmail, code)
	err = h.RedisClient.Set(r.Context(), fmt.Sprintf("pending_email_change:%s", userID), cacheVal, 15*time.Minute).Err()
	if err != nil {
		log.Printf("Failed to save pending email change: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if h.PrintMFACodes {
		log.Printf("[EMAIL CHANGE] Verification Code for user %s: %s\n", req.NewEmail, code)
	}

	if h.Publisher != nil {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			h.Publisher.PublishNotification(ctx, req.NewEmail, "register", map[string]string{"code": code})
		}()
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Verification code sent to your new email."})
}

func (h *AuthHandler) VerifyEmailChange(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.getAuthenticatedUserID(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	var req dto.VerifyEmailChangeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	key := fmt.Sprintf("pending_email_change:%s", userID)
	cacheVal, err := h.RedisClient.Get(r.Context(), key).Result()
	if err != nil {
		http.Error(w, "Verification code expired or email change not requested", http.StatusBadRequest)
		return
	}

	parts := strings.Split(cacheVal, ":")
	if len(parts) != 2 {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	newEmail := parts[0]
	expectedCode := parts[1]

	if req.Code != expectedCode {
		http.Error(w, "Invalid verification code", http.StatusUnauthorized)
		return
	}

	_, err = h.DB.Exec("UPDATE users SET email = $1, updated_at = NOW() WHERE id = $2", newEmail, userID)
	if err != nil {
		log.Printf("Failed to verify email change: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	_ = h.RedisClient.Del(r.Context(), key).Err()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Email updated successfully"})
}

func (h *AuthHandler) SearchFriend(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.getAuthenticatedUserID(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	email := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("email")))
	if email == "" {
		http.Error(w, "Email query parameter is required", http.StatusBadRequest)
		return
	}

	var searchedID, searchedEmail, name, avatarURL string
	query := "SELECT id, email, name, avatar_url FROM users WHERE email = $1 AND is_verified = TRUE"
	err = h.DB.QueryRow(query, email).Scan(&searchedID, &searchedEmail, &name, &avatarURL)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "User not found", http.StatusNotFound)
			return
		}
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	var isBlocked bool
	blockQuery := "SELECT EXISTS(SELECT 1 FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1))"
	err = h.DB.QueryRow(blockQuery, userID, searchedID).Scan(&isBlocked)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	if isBlocked {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(dto.UserSearchResponse{
		UserID:    searchedID,
		Email:     searchedEmail,
		Name:      name,
		AvatarURL: avatarURL,
	})
}

func (h *AuthHandler) SendFriendRequest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.getAuthenticatedUserID(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	var req dto.FriendRequestInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	req.FriendEmail = strings.TrimSpace(strings.ToLower(req.FriendEmail))
	if req.FriendEmail == "" {
		http.Error(w, "Friend email is required", http.StatusBadRequest)
		return
	}

	var receiverID string
	err = h.DB.QueryRow("SELECT id FROM users WHERE email = $1 AND is_verified = TRUE", req.FriendEmail).Scan(&receiverID)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "User not found", http.StatusNotFound)
			return
		}
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if userID == receiverID {
		http.Error(w, "You cannot add yourself as a friend", http.StatusBadRequest)
		return
	}

	var isBlocked bool
	blockQuery := "SELECT EXISTS(SELECT 1 FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1))"
	err = h.DB.QueryRow(blockQuery, userID, receiverID).Scan(&isBlocked)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	if isBlocked {
		http.Error(w, "Action blocked", http.StatusForbidden)
		return
	}

	var isFriend bool
	friendQuery := "SELECT EXISTS(SELECT 1 FROM friendships WHERE (user_id_1 = $1 AND user_id_2 = $2) OR (user_id_1 = $2 AND user_id_2 = $1))"
	err = h.DB.QueryRow(friendQuery, userID, receiverID).Scan(&isFriend)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	if isFriend {
		http.Error(w, "You are already friends with this user", http.StatusConflict)
		return
	}

	var requestExists bool
	reqCheckQuery := "SELECT EXISTS(SELECT 1 FROM friend_requests WHERE sender_id = $1 AND receiver_id = $2 AND status = 'pending')"
	err = h.DB.QueryRow(reqCheckQuery, userID, receiverID).Scan(&requestExists)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	if requestExists {
		http.Error(w, "Friend request already sent", http.StatusConflict)
		return
	}

	var userEmail string
	err = h.DB.QueryRow("SELECT email FROM users WHERE id = $1", userID).Scan(&userEmail)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	_, err = h.DB.Exec("INSERT INTO friend_requests (sender_id, receiver_id, status) VALUES ($1, $2, 'pending') ON CONFLICT (sender_id, receiver_id) DO UPDATE SET status = 'pending', updated_at = NOW()", userID, receiverID)
	if err != nil {
		log.Printf("Failed to insert friend request: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if h.Publisher != nil {
		ctx := r.Context()
		_ = h.Publisher.PublishNotification(ctx, req.FriendEmail, "friend_request", map[string]string{
			"sender_email": userEmail,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Friend request sent successfully"})
}

func (h *AuthHandler) AcceptFriendRequest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.getAuthenticatedUserID(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	var req dto.AcceptFriendRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	var senderID string
	var receiverID string
	var status string
	err = h.DB.QueryRow("SELECT sender_id, receiver_id, status FROM friend_requests WHERE id = $1", req.RequestID).Scan(&senderID, &receiverID, &status)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Friend request not found", http.StatusNotFound)
			return
		}
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if receiverID != userID {
		http.Error(w, "Unauthorized action", http.StatusForbidden)
		return
	}

	if status != "pending" {
		http.Error(w, "Friend request already processed", http.StatusBadRequest)
		return
	}

	var isBlocked bool
	blockQuery := "SELECT EXISTS(SELECT 1 FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1))"
	err = h.DB.QueryRow(blockQuery, senderID, receiverID).Scan(&isBlocked)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	if isBlocked {
		http.Error(w, "Action blocked", http.StatusForbidden)
		return
	}

	tx, err := h.DB.Begin()
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	_, err = tx.Exec("UPDATE friend_requests SET status = 'accepted', updated_at = NOW() WHERE id = $1", req.RequestID)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	u1, u2 := senderID, receiverID
	if u1 > u2 {
		u1, u2 = u2, u1
	}

	_, err = tx.Exec("INSERT INTO friendships (user_id_1, user_id_2) VALUES ($1, $2) ON CONFLICT DO NOTHING", u1, u2)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if err = tx.Commit(); err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Friend request accepted successfully"})
}

func (h *AuthHandler) RejectFriendRequest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.getAuthenticatedUserID(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	var req dto.AcceptFriendRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	var receiverID string
	err = h.DB.QueryRow("SELECT receiver_id FROM friend_requests WHERE id = $1", req.RequestID).Scan(&receiverID)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Friend request not found", http.StatusNotFound)
			return
		}
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if receiverID != userID {
		http.Error(w, "Unauthorized action", http.StatusForbidden)
		return
	}

	_, err = h.DB.Exec("UPDATE friend_requests SET status = 'rejected', updated_at = NOW() WHERE id = $1", req.RequestID)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Friend request rejected"})
}

func (h *AuthHandler) BlockUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.getAuthenticatedUserID(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	var req dto.BlockUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.UserID == userID {
		http.Error(w, "You cannot block yourself", http.StatusBadRequest)
		return
	}

	tx, err := h.DB.Begin()
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	_, err = tx.Exec("INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", userID, req.UserID)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	_, err = tx.Exec("DELETE FROM friendships WHERE (user_id_1 = $1 AND user_id_2 = $2) OR (user_id_1 = $2 AND user_id_2 = $1)", userID, req.UserID)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	_, err = tx.Exec("DELETE FROM friend_requests WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)", userID, req.UserID)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if err = tx.Commit(); err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "User blocked successfully"})
}

func (h *AuthHandler) UnblockUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.getAuthenticatedUserID(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	var req dto.BlockUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	_, err = h.DB.Exec("DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2", userID, req.UserID)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "User unblocked successfully"})
}

func (h *AuthHandler) ListFriends(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.getAuthenticatedUserID(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	rows, err := h.DB.Query(`
		SELECT u.id, u.email, u.name, u.avatar_url 
		FROM friendships f 
		JOIN users u ON (f.user_id_1 = $1 AND u.id = f.user_id_2) OR (f.user_id_2 = $1 AND u.id = f.user_id_1)
	`, userID)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	friends := []dto.UserSearchResponse{}
	for rows.Next() {
		var f dto.UserSearchResponse
		if err := rows.Scan(&f.UserID, &f.Email, &f.Name, &f.AvatarURL); err != nil {
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		friends = append(friends, f)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(friends)
}

func (h *AuthHandler) ListBlockedUsers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.getAuthenticatedUserID(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	rows, err := h.DB.Query(`
		SELECT u.id, u.email, u.name, u.avatar_url 
		FROM blocks b 
		JOIN users u ON u.id = b.blocked_id 
		WHERE b.blocker_id = $1
	`, userID)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	blocked := []dto.UserSearchResponse{}
	for rows.Next() {
		var b dto.UserSearchResponse
		if err := rows.Scan(&b.UserID, &b.Email, &b.Name, &b.AvatarURL); err != nil {
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		blocked = append(blocked, b)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(blocked)
}

func (h *AuthHandler) ListFriendRequests(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.getAuthenticatedUserID(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	rows, err := h.DB.Query(`
		SELECT r.id, r.sender_id, u.email, r.receiver_id, r.status, r.created_at 
		FROM friend_requests r 
		JOIN users u ON u.id = r.sender_id 
		WHERE r.receiver_id = $1 AND r.status = 'pending'
	`, userID)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	requests := []dto.FriendRequestResponse{}
	for rows.Next() {
		var req dto.FriendRequestResponse
		var createdAt time.Time
		if err := rows.Scan(&req.ID, &req.SenderID, &req.SenderEmail, &req.ReceiverID, &req.Status, &createdAt); err != nil {
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		req.CreatedAt = createdAt.Format(time.RFC3339)
		requests = append(requests, req)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(requests)
}


