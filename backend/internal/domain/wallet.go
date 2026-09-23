package domain

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type TransactionType string

const (
	TxTypeDeliveryFee   TransactionType = "CREDIT_DELIVERY_FEE"   // ค่าหิ้วที่ได้รับ
	TxTypeReimbursement TransactionType = "CREDIT_REIMBURSEMENT" // ค่าสินค้าที่สำรองจ่ายคืน
	TxTypeWithdrawal    TransactionType = "DEBIT_WITHDRAWAL"     // ถอนเงินเข้า PromptPay
)

type UserWallet struct {
	ID                 uuid.UUID           `gorm:"type:uuid;primaryKey" json:"id"`
	UserID             uuid.UUID           `gorm:"type:uuid;index" json:"user_id"`
	UserEmail          string              `gorm:"type:varchar(120);uniqueIndex;not null" json:"user_email"`
	Balance            float64             `gorm:"type:decimal(10,2);default:0.00" json:"balance"`
	TotalEarnings      float64             `gorm:"type:decimal(10,2);default:0.00" json:"total_earnings"`
	CompletedJobsCount int                 `gorm:"default:0" json:"completed_jobs_count"`
	CreatedAt          time.Time           `json:"created_at"`
	UpdatedAt          time.Time           `json:"updated_at"`
	Transactions       []WalletTransaction `gorm:"foreignKey:WalletID" json:"transactions,omitempty"`
}

func (w *UserWallet) BeforeCreate(tx *gorm.DB) (err error) {
	if w.ID == uuid.Nil {
		w.ID = uuid.New()
	}
	return
}

type WalletTransaction struct {
	ID          uuid.UUID       `gorm:"type:uuid;primaryKey" json:"id"`
	WalletID    uuid.UUID       `gorm:"type:uuid;not null;index" json:"wallet_id"`
	OrderID     *uuid.UUID      `gorm:"type:uuid;index" json:"order_id"`
	Amount      float64         `gorm:"type:decimal(10,2);not null" json:"amount"`
	Type        TransactionType `gorm:"type:varchar(30);not null" json:"type"`
	Description string          `gorm:"type:text" json:"description"`
	CreatedAt   time.Time       `json:"created_at"`
}

func (wt *WalletTransaction) BeforeCreate(tx *gorm.DB) (err error) {
	if wt.ID == uuid.Nil {
		wt.ID = uuid.New()
	}
	return
}
