package database

import (
	"fmt"
	"log"

	"kmutt-delivery-backend/internal/domain"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func ConnectPostgres(dsn string) (*gorm.DB, error) {
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return nil, fmt.Errorf("เชื่อมต่อฐานข้อมูลล้มเหลว: %w", err)
	}

	log.Println("✅ เชื่อมต่อ PostgreSQL สำเร็จ")

	// Auto-Migrate Tables
	if err := db.AutoMigrate(
		&domain.User{},
		&domain.LocationHub{},
		&domain.Store{},
		&domain.MenuItem{},
		&domain.Order{},
		&domain.UserWallet{},
		&domain.WalletTransaction{},
	); err != nil {
		return nil, fmt.Errorf("Auto-migration ล้มเหลว: %w", err)
	}
	log.Println("✅ Auto-Migration ตาราง 'users', 'location_hubs', 'stores', 'menu_items', 'orders', 'user_wallets', 'wallet_transactions' เรียบร้อย")

	// Seed Master Data
	if err := SeedLocationHubs(db); err != nil {
		log.Printf("⚠️ การ Seed ข้อมูล Master Data ขัดข้อง: %v\n", err)
	}

	return db, nil
}
