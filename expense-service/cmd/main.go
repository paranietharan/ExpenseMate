package main

import (
	"fmt"
	"log"
	"net/http"

	"expense-service/internal/config"
	"expense-service/internal/database"
	"expense-service/internal/expense"
	"expense-service/internal/rabbitmq"
)

func main() {
	log.Println("Starting expense-service...")

	cfg := config.Load()

	dbConn, err := database.InitDB(cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName)
	if err != nil {
		log.Fatalf("PostgreSQL connection error: %v", err)
	}
	defer dbConn.Close()

	if err = database.Migrate(); err != nil {
		log.Fatalf("Migration failed: %v", err)
	}

	pub, err := rabbitmq.NewRabbitMQPublisher(
		cfg.RabbitMQUser,
		cfg.RabbitMQPassword,
		cfg.RabbitMQHost,
		cfg.RabbitMQPort,
		cfg.RabbitMQQueue,
	)
	if err != nil {
		log.Printf("Warning: Failed to connect to RabbitMQ: %v. Running without publisher.", err)
	} else {
		log.Println("RabbitMQ publisher connection established successfully")
		defer pub.Close()
	}

	expenseHandler := expense.NewExpenseHandler(dbConn, pub)
	mux := http.NewServeMux()

	// Expenses
	mux.HandleFunc("/expenses", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/expenses" {
			if r.Method == http.MethodPost {
				expenseHandler.CreateExpense(w, r)
			} else if r.Method == http.MethodGet {
				expenseHandler.ListExpenses(w, r)
			} else {
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
		} else {
			if r.Method == http.MethodPut {
				expenseHandler.UpdateExpense(w, r)
			} else if r.Method == http.MethodDelete {
				expenseHandler.DeleteExpense(w, r)
			} else {
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
		}
	})

	// Settlements
	mux.HandleFunc("/settlements", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			expenseHandler.SettleDebt(w, r)
		} else if r.Method == http.MethodGet {
			expenseHandler.ListSettlements(w, r)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	// Balances
	mux.HandleFunc("/balances", expenseHandler.GetBalances)

	// Settings
	mux.HandleFunc("/settings", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			expenseHandler.GetSettings(w, r)
		} else if r.Method == http.MethodPut {
			expenseHandler.UpdateSettings(w, r)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if err := dbConn.Ping(); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			fmt.Fprint(w, `{"status":"DOWN"}`)
		} else {
			w.WriteHeader(http.StatusOK)
			fmt.Fprint(w, `{"status":"UP"}`)
		}
	})

	serverAddr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("Expense service listening on port %s...\n", cfg.Port)
	if err := http.ListenAndServe(serverAddr, mux); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
