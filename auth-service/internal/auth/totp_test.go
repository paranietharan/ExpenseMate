package auth

import (
	"testing"
	"time"
)

func TestTOTPSecretGeneration(t *testing.T) {
	secret, err := GenerateTOTPSecret()
	if err != nil {
		t.Fatalf("Failed to generate TOTP secret: %v", err)
	}

	if len(secret) == 0 {
		t.Error("Generated secret is empty")
	}
}

func TestTOTPCurrentStepValidation(t *testing.T) {
	secret, err := GenerateTOTPSecret()
	if err != nil {
		t.Fatalf("Failed to generate TOTP secret: %v", err)
	}

	// Get the code for the current time step
	currentStep := time.Now().Unix() / 30
	code, err := GenerateTOTPCode(secret, currentStep)
	if err != nil {
		t.Fatalf("Failed to generate code for current step: %v", err)
	}

	// Validate current code
	if !ValidateTOTPCode(secret, code) {
		t.Error("ValidateTOTPCode failed to validate a code generated for the current step")
	}

	// Validate with drift step (-1)
	codePrev, err := GenerateTOTPCode(secret, currentStep-1)
	if err != nil {
		t.Fatalf("Failed to generate code for previous step: %v", err)
	}
	if !ValidateTOTPCode(secret, codePrev) {
		t.Error("ValidateTOTPCode failed to validate a code generated for the previous step (skew window)")
	}

	// Validate with drift step (+1)
	codeNext, err := GenerateTOTPCode(secret, currentStep+1)
	if err != nil {
		t.Fatalf("Failed to generate code for next step: %v", err)
	}
	if !ValidateTOTPCode(secret, codeNext) {
		t.Error("ValidateTOTPCode failed to validate a code generated for the next step (skew window)")
	}

	// Validate invalid code
	if ValidateTOTPCode(secret, "999999") {
		// Extremely low probability that the generated code is exactly "999999", but we verify it's incorrect.
		if code != "999999" && codePrev != "999999" && codeNext != "999999" {
			t.Error("ValidateTOTPCode validated an incorrect code")
		}
	}
}
