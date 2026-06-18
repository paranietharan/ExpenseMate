package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"net/smtp"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/joho/godotenv"
	amqp "github.com/rabbitmq/amqp091-go"
)

type NotificationEvent struct {
	Email     string            `json:"email"`
	EventType string            `json:"event_type"`
	Timestamp time.Time         `json:"timestamp"`
	Metadata  map[string]string `json:"metadata,omitempty"`
}

type EmailData struct {
	Email       string
	Code        string
	Date        string
	SenderEmail string
	Description string
	Amount      string
	PayeeEmail  string
}

func getenv(key, def string) string {
	val := os.Getenv(key)
	if val == "" {
		return def
	}
	return val
}

func isNotificationEnabled(expenseServiceURL, email string) bool {
	client := http.Client{
		Timeout: 2 * time.Second,
	}
	url := fmt.Sprintf("%s/settings?email=%s", expenseServiceURL, email)
	resp, err := client.Get(url)
	if err != nil {
		log.Printf("[Notification Settings Check] Error calling expense-service: %v. Defaulting to enabled.", err)
		return true // fail-open for alerts if service check fails
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("[Notification Settings Check] Bad status code: %d. Defaulting to enabled.", resp.StatusCode)
		return true
	}

	var data struct {
		NotificationsEnabled bool `json:"notifications_enabled"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		log.Printf("[Notification Settings Check] JSON decode error: %v. Defaulting to enabled.", err)
		return true
	}

	return data.NotificationsEnabled
}

func main() {
	_ = godotenv.Load()

	log.Println("Starting notification-service consumer...")

	rabbitUser := getenv("RABBITMQ_USER", "admin")
	rabbitPass := getenv("RABBITMQ_PASSWORD", "RabbitMQPassword@1234")
	rabbitHost := getenv("RABBITMQ_HOST", "127.0.0.1")
	rabbitPort := getenv("RABBITMQ_PORT", "5672")

	smtpHost := getenv("SMTP_HOST", "smtp.gmail.com")
	smtpPort := getenv("SMTP_PORT", "587")
	smtpUser := os.Getenv("SMTP_USER")
	smtpPass := os.Getenv("SMTP_PASS")
	smtpFrom := getenv("SMTP_FROM", smtpUser)

	amqpURI := fmt.Sprintf("amqp://%s:%s@%s:%s/", rabbitUser, rabbitPass, rabbitHost, rabbitPort)

	var conn *amqp.Connection
	var err error

	for i := 1; i <= 5; i++ {
		log.Printf("Connecting to RabbitMQ (attempt %d/5)...", i)
		conn, err = amqp.Dial(amqpURI)
		if err == nil {
			break
		}
		time.Sleep(3 * time.Second)
	}

	if err != nil {
		log.Fatalf("Failed to connect to RabbitMQ broker after retries: %v", err)
	}
	defer conn.Close()

	ch, err := conn.Channel()
	if err != nil {
		log.Fatalf("Failed to open a channel: %v", err)
	}
	defer ch.Close()

	queueName := "auth_notifications"
	q, err := ch.QueueDeclare(
		queueName, // name
		true,      // durable
		false,     // delete when unused
		false,     // exclusive
		false,     // no-wait
		nil,       // arguments
	)
	if err != nil {
		log.Fatalf("Failed to declare queue: %v", err)
	}

	msgs, err := ch.Consume(
		q.Name, // queue
		"",     // consumer
		true,   // auto-ack
		false,  // exclusive
		false,  // no-local
		false,  // no-wait
		nil,    // args
	)
	if err != nil {
		log.Fatalf("Failed to register a consumer: %v", err)
	}

	log.Printf("Listening for authentication events on queue '%s'...\n", queueName)
	if smtpUser != "" && smtpPass != "" {
		log.Printf("Gmail SMTP dispatching ENABLED (from: %s)\n", smtpFrom)
	} else {
		log.Println("Gmail SMTP credentials NOT configured. Falling back to local outbox files and browser links.")
	}

	var forever chan struct{}

	go func() {
		for d := range msgs {
			var event NotificationEvent
			err := json.Unmarshal(d.Body, &event)
			if err != nil {
				log.Printf("Error unmarshaling event payload: %v\n", err)
				continue
			}

			// Toggles notifications validation check on friend request, expense adding, and settlements
			if event.EventType == "friend_request" || event.EventType == "expense_added" || event.EventType == "settlement_added" {
				expenseServiceURL := getenv("EXPENSE_SERVICE_URL", "http://127.0.0.1:8082")
				if !isNotificationEnabled(expenseServiceURL, event.Email) {
					log.Printf("[Notification Service] Skipping sending email for event '%s' to %s because user settings has email notifications disabled.\n", event.EventType, event.Email)
					continue
				}
			}

			subject := getSubject(event)

			data := EmailData{
				Email:       event.Email,
				Code:        event.Metadata["code"],
				Date:        event.Timestamp.Local().Format(time.RFC1123),
				SenderEmail: event.Metadata["sender_email"],
				Description: event.Metadata["description"],
				Amount:      event.Metadata["amount"],
				PayeeEmail:  event.Metadata["payee_email"],
			}

			htmlContent, err := renderTemplate(event.EventType, data)
			if err != nil {
				log.Printf("Error rendering template for event '%s': %v\n", event.EventType, err)
				continue
			}

			if smtpUser != "" && smtpPass != "" {
				log.Printf("Sending real email to %s for event '%s'...\n", event.Email, event.EventType)
				err := sendEmail(smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom, event.Email, subject, htmlContent)
				if err != nil {
					log.Printf("Failed to send email via SMTP: %v. Falling back to stdout preview.\n", err)
					printLocalFallback(event, subject, htmlContent)
				} else {
					log.Printf("Successfully sent email to %s for event '%s'\n", event.Email, event.EventType)
				}
			} else {
				printLocalFallback(event, subject, htmlContent)
			}
		}
	}()

	<-forever
}

func getSubject(event NotificationEvent) string {
	switch event.EventType {
	case "register":
		return "Verify your ExpenseMate Account"
	case "welcome":
		return "Welcome to ExpenseMate!"
	case "login":
		return "Security Alert: New Sign-in Detected"
	case "forgot_password":
		return "Reset your ExpenseMate Password"
	case "change_password":
		return "Security Notification: Password Changed"
	case "enable_totp":
		return "MFA Enabled: Authenticator App"
	case "disable_totp":
		return "SECURITY WARNING: Authenticator MFA Disabled"
	case "enable_email_2fa":
		return "MFA Enabled: Email Challenges"
	case "disable_email_2fa":
		return "SECURITY WARNING: Email MFA Disabled"
	case "friend_request":
		return fmt.Sprintf("New Friend Request from %s", event.Metadata["sender_email"])
	case "expense_added":
		return fmt.Sprintf("New Shared Bill Added: %s", event.Metadata["description"])
	case "settlement_added":
		return fmt.Sprintf("Balance Settled: %s paid %s", event.Metadata["sender_email"], event.Metadata["payee_email"])
	default:
		return fmt.Sprintf("ExpenseMate Notification: %s", event.EventType)
	}
}

func renderTemplate(eventType string, data EmailData) (string, error) {
	templatesDir := getenv("TEMPLATES_DIR", "templates")
	filePath := filepath.Join(templatesDir, fmt.Sprintf("%s.html", eventType))

	cleanPath := filepath.Clean(filePath)

	tmpl, err := template.ParseFiles(cleanPath)
	if err != nil {
		return "", fmt.Errorf("failed to parse template file %s: %w", cleanPath, err)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("failed to execute template: %w", err)
	}

	return buf.String(), nil
}

func sendEmail(host, port, user, pass, from, to, subject, htmlBody string) error {
	auth := smtp.PlainAuth("", user, pass, host)

	var msg bytes.Buffer
	msg.WriteString(fmt.Sprintf("From: %s\r\n", from))
	msg.WriteString(fmt.Sprintf("To: %s\r\n", to))
	msg.WriteString(fmt.Sprintf("Subject: %s\r\n", subject))
	msg.WriteString("MIME-Version: 1.0\r\n")
	msg.WriteString("Content-Type: text/html; charset=\"UTF-8\"\r\n")
	msg.WriteString("\r\n")
	msg.WriteString(htmlBody)

	addr := fmt.Sprintf("%s:%s", host, port)
	return smtp.SendMail(addr, auth, from, []string{to}, msg.Bytes())
}

func printLocalFallback(event NotificationEvent, subject, htmlBody string) {
	absPath, err := saveToOutbox(event.EventType, event.Email, htmlBody)

	var previewLink string
	if err != nil {
		previewLink = fmt.Sprintf("Error saving outbox preview file: %v", err)
	} else {
		previewLink = fmt.Sprintf("file://%s", absPath)
	}

	fmt.Printf(`
================================================================================
[SMTP OUTBOX SIMULATOR] Dispatching Email Alert
================================================================================
From:    no-reply@expensemate.com
To:      %s
Subject: %s
Date:    %s
--------------------------------------------------------------------------------

You can review this premium HTML email in your browser using the link below:
👉 %s

--------------------------------------------------------------------------------
================================================================================
`, event.Email, subject, event.Timestamp.Local().Format(time.RFC1123), previewLink)
}

func saveToOutbox(eventType string, to string, htmlContent string) (string, error) {
	outboxDir := "outbox"
	if err := os.MkdirAll(outboxDir, 0755); err != nil {
		return "", err
	}

	safeEmail := strings.ReplaceAll(to, "@", "_at_")
	safeEmail = strings.ReplaceAll(safeEmail, ".", "_")
	filename := fmt.Sprintf("%s_%s_%d.html", eventType, safeEmail, time.Now().UnixNano())
	filePath := filepath.Join(outboxDir, filename)

	cleanPath := filepath.Clean(filePath)

	err := os.WriteFile(cleanPath, []byte(htmlContent), 0644)
	if err != nil {
		return "", err
	}

	return filepath.Abs(cleanPath)
}
