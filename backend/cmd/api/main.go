package main

import (
	"log"
	"os"

	"kmutt-delivery-backend/internal/database"
	"kmutt-delivery-backend/internal/handler"
	"kmutt-delivery-backend/internal/repository"
	"kmutt-delivery-backend/internal/service"
	"kmutt-delivery-backend/internal/websocket"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://kmutt_user:kmutt_password@localhost:5432/kmutt_delivery_db?sslmode=disable"
	}

	// 1. เชื่อมต่อฐานข้อมูล & Auto-Migrate & Seed Data
	db, err := database.ConnectPostgres(dsn)
	if err != nil {
		log.Fatalf("ไม่สามารถเริ่มต้นฐานข้อมูลได้: %v", err)
	}

	// 2. เริ่มต้น Real-Time WebSocket Hub (Background Goroutine)
	hub := websocket.NewHub()
	go hub.Run()
	wsHandler := handler.NewWSHandler(hub)

	// 3. Dependency Injection
	// User / Auth
	userRepo := repository.NewUserRepository(db)
	authService := service.NewAuthService(userRepo)
	authHandler := handler.NewAuthHandler(authService)

	// Location / Stores
	locationRepo := repository.NewLocationRepository(db)
	locationService := service.NewLocationService(locationRepo)
	locationHandler := handler.NewLocationHandler(locationService)

	// Escrow Wallet
	walletRepo := repository.NewWalletRepository(db)
	walletService := service.NewWalletService(walletRepo)
	walletHandler := handler.NewWalletHandler(walletService)

	// Order Lifecycle & State Machine (พร้อม WebSocket Broadcasts & Wallet Processing)
	orderRepo := repository.NewOrderRepository(db)
	orderService := service.NewOrderService(orderRepo, walletService, hub)
	orderHandler := handler.NewOrderHandler(orderService)

	// 4. เริ่มต้น Fiber Web App
	app := fiber.New(fiber.Config{
		AppName: "KMUTT Campus Delivery Backend v1 🐜",
	})

	app.Use(logger.New())
	app.Use(cors.New())

	// 5. เส้นทาง API
	api := app.Group("/api/v1")
	api.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "app": "KMUTT Delivery Backend", "wallet": "active"})
	})

	// WebSocket Endpoint
	api.Get("/ws", wsHandler.ServeWS)

	// Auth Routes
	auth := api.Group("/auth")
	auth.Post("/google", authHandler.GoogleLogin)

	// Location Routes
	locations := api.Group("/locations")
	locations.Get("/", locationHandler.GetLocations)
	locations.Get("/:id", locationHandler.GetLocationByID)
	locations.Get("/:id/stores", locationHandler.GetStoresByLocation)
	locations.Post("/", locationHandler.CreateLocation)

	// Wallet Routes
	wallet := api.Group("/wallet")
	wallet.Get("/me", walletHandler.GetMyWallet)

	// Order Routes
	orders := api.Group("/orders")
	orders.Post("/", orderHandler.CreateOrder)
	orders.Get("/", orderHandler.GetOrders)
	orders.Get("/:id", orderHandler.GetOrderByID)
	orders.Post("/:id/accept", orderHandler.AcceptOrder)
	orders.Post("/:id/complete", orderHandler.CompleteOrder)

	log.Printf("🚀 Server เริ่มทำงานที่พอร์ต http://localhost:%s (WebSocket at ws://localhost:%s/api/v1/ws)\n", port, port)
	if err := app.Listen(":" + port); err != nil {
		log.Fatalf("Server หยุดการทำงาน: %v", err)
	}
}
