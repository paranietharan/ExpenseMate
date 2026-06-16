package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"encoding/base32"
	"encoding/binary"
	"fmt"
	"math"
	"strings"
	"time"
)

func GenerateTOTPSecret() (string, error) {
	secret := make([]byte, 20)
	_, err := rand.Read(secret)
	if err != nil {
		return "", fmt.Errorf("failed to generate random bytes for TOTP: %w", err)
	}
	return base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(secret), nil
}

func GenerateTOTPCode(secret string, timeStep int64) (string, error) {
	secret = strings.ToUpper(strings.TrimSpace(secret))
	key, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(secret)
	if err != nil {
		key, err = base32.StdEncoding.DecodeString(secret)
		if err != nil {
			return "", fmt.Errorf("invalid base32 secret: %w", err)
		}
	}

	buf := make([]byte, 8)
	binary.BigEndian.PutUint64(buf, uint64(timeStep))

	mac := hmac.New(sha1.New, key)
	mac.Write(buf)
	sum := mac.Sum(nil)

	offset := sum[len(sum)-1] & 0x0f
	binaryCode := binary.BigEndian.Uint32(sum[offset : offset+4])
	binaryCode = binaryCode & 0x7fffffff
	code := binaryCode % uint32(math.Pow10(6))
	return fmt.Sprintf("%06d", code), nil
}

func ValidateTOTPCode(secret, code string) bool {
	if len(code) != 6 {
		return false
	}

	currentTime := time.Now().Unix()
	currentStep := currentTime / 30

	for i := int64(-1); i <= 1; i++ {
		generated, err := GenerateTOTPCode(secret, currentStep+i)
		if err == nil && generated == code {
			return true
		}
	}

	return false
}
