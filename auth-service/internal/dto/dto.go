package dto

type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

type VerifyRegisterRequest struct {
	Email string `json:"email"`
	Code  string `json:"code"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type SelectMFARequest struct {
	TempToken string `json:"temp_token"`
	Method    string `json:"method"` // "totp" or "email"
}

type VerifyRequest struct {
	TempToken string `json:"temp_token"`
	Method    string `json:"method"` // "totp" or "email"
	Code      string `json:"code"`
}

type MFATOTPEnableRequest struct {
	Code string `json:"code"`
}

type MFAEmailEnableRequest struct {
	Code string `json:"code"`
}

type StatusResponse struct {
	UserID          string `json:"user_id"`
	Email           string `json:"email"`
	Role            string `json:"role"`
	TOTPEnabled     bool   `json:"totp_enabled"`
	EmailMFAEnabled bool   `json:"email_mfa_enabled"`
	Name            string `json:"name"`
	AvatarURL       string `json:"avatar_url"`
}

type MFARequiredResponse struct {
	MFARequired bool     `json:"mfa_required"`
	TempToken   string   `json:"temp_token"`
	Methods     []string `json:"methods"` // ["totp"], ["email"], or ["totp", "email"]
}

type LoginResponse struct {
	Message string `json:"message"`
	UserID  string `json:"user_id"`
}

type PasswordResetRequest struct {
	Email string `json:"email"`
}

type PasswordResetVerifyRequest struct {
	Email       string `json:"email"`
	Code        string `json:"code"`
	NewPassword string `json:"new_password"`
}

type PasswordChangeRequest struct {
	OldPassword string `json:"old_password"`
	NewPassword string `json:"new_password"`
}

type ChangeNameRequest struct {
	Name string `json:"name"`
}

type ChangeAvatarRequest struct {
	AvatarURL string `json:"avatar_url"`
}

type RequestEmailChangeRequest struct {
	NewEmail string `json:"new_email"`
}

type VerifyEmailChangeRequest struct {
	Code string `json:"code"`
}

type FriendRequestInput struct {
	FriendEmail string `json:"friend_email"`
}

type AcceptFriendRequest struct {
	RequestID string `json:"request_id"`
}

type BlockUserRequest struct {
	UserID string `json:"user_id"`
}

type UserSearchResponse struct {
	UserID    string `json:"user_id"`
	Email     string `json:"email"`
	Name      string `json:"name"`
	AvatarURL string `json:"avatar_url"`
}

type FriendRequestResponse struct {
	ID         string `json:"id"`
	SenderID   string `json:"sender_id"`
	SenderEmail string `json:"sender_email"`
	ReceiverID string `json:"receiver_id"`
	Status     string `json:"status"`
	CreatedAt  string `json:"created_at"`
}


