package auth

import (
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
	internal_redis "auth-service/internal/redis"

	"github.com/redis/go-redis/v9"
	qrcode "github.com/skip2/go-qrcode"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	DB            *sql.DB
	RedisClient   *redis.Client
	PrintMFACodes bool
}

func NewAuthHandler(database *sql.DB, rdb *redis.Client, printMFACodes bool) *AuthHandler {
	return &AuthHandler{
		DB:            database,
		RedisClient:   rdb,
		PrintMFACodes: printMFACodes,
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
		http.Error(w, "Account not verified. Please verify your email first.", http.StatusForbidden)
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

	err = internal_redis.SaveSession(sessionID, user.ID, 7*24*time.Hour)
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

	err = internal_redis.SaveSession(sessionID, user.ID, 7*24*time.Hour)
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
	query := "SELECT email, role, totp_enabled, email_mfa_enabled FROM users WHERE id = $1"
	err = h.DB.QueryRow(query, userID).Scan(&email, &role, &totpEnabled, &emailEnabled)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"user_id":           userID,
		"email":             email,
		"role":              role,
		"totp_enabled":      totpEnabled,
		"email_mfa_enabled": emailEnabled,
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

	query := "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2"
	_, err = h.DB.Exec(query, string(hashedPassword), req.Email)
	if err != nil {
		log.Printf("Failed to update password: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	_ = h.RedisClient.Del(r.Context(), pendingKey).Err()

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

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Password changed successfully"})
}

