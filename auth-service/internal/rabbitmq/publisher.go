package rabbitmq

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

type NotificationEvent struct {
	Email     string            `json:"email"`
	EventType string            `json:"event_type"` // "login", "register", "welcome", "forgot_password", "change_password", "enable_totp", "disable_totp", "enable_email_2fa", "disable_email_2fa"
	Timestamp time.Time         `json:"timestamp"`
	Metadata  map[string]string `json:"metadata,omitempty"`
}

type RabbitMQPublisher struct {
	conn      *amqp.Connection
	channel   *amqp.Channel
	queueName string
}

func NewRabbitMQPublisher(user, password, host, port, queueName string) (*RabbitMQPublisher, error) {
	amqpURI := fmt.Sprintf("amqp://%s:%s@%s:%s/", user, password, host, port)
	
	conn, err := amqp.Dial(amqpURI)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RabbitMQ: %w", err)
	}

	ch, err := conn.Channel()
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to open a channel: %w", err)
	}

	_, err = ch.QueueDeclare(
		queueName, // name
		true,      // durable
		false,     // delete when unused
		false,     // exclusive
		false,     // no-wait
		nil,       // arguments
	)
	if err != nil {
		ch.Close()
		conn.Close()
		return nil, fmt.Errorf("failed to declare a queue: %w", err)
	}

	return &RabbitMQPublisher{
		conn:      conn,
		channel:   ch,
		queueName: queueName,
	}, nil
}

func (p *RabbitMQPublisher) PublishNotification(ctx context.Context, email, eventType string, metadata map[string]string) error {
	event := NotificationEvent{
		Email:     email,
		EventType: eventType,
		Timestamp: time.Now().UTC(),
		Metadata:  metadata,
	}

	body, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	err = p.channel.PublishWithContext(
		ctx,
		"",          // exchange
		p.queueName, // routing key
		false,       // mandatory
		false,       // immediate
		amqp.Publishing{
			ContentType: "application/json",
			Body:        body,
		},
	)
	if err != nil {
		return fmt.Errorf("failed to publish message: %w", err)
	}

	log.Printf("[RabbitMQ] Published event: %s for %s", eventType, email)
	return nil
}

func (p *RabbitMQPublisher) Close() {
	if p.channel != nil {
		p.channel.Close()
	}
	if p.conn != nil {
		p.conn.Close()
	}
}
