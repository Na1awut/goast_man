package repository

import (
	"fmt"
	"kmutt-delivery-backend/internal/domain"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type WalletRepository interface {
	GetOrCreateWallet(userEmail string) (*domain.UserWallet, error)
	CreditEarnings(userEmail string, orderID uuid.UUID, deliveryFee float64, itemPrice float64) (*domain.UserWallet, error)
	GetTransactions(walletID uuid.UUID) ([]domain.WalletTransaction, error)
}

type walletRepository struct {
	db *gorm.DB
}

func NewWalletRepository(db *gorm.DB) WalletRepository {
	return &walletRepository{db: db}
}

func (r *walletRepository) GetOrCreateWallet(userEmail string) (*domain.UserWallet, error) {
	var wallet domain.UserWallet
	err := r.db.Preload("Transactions").Where("user_email = ?", userEmail).First(&wallet).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			newWallet := domain.UserWallet{
				UserEmail:          userEmail,
				Balance:            0.0,
				TotalEarnings:      0.0,
				CompletedJobsCount: 0,
			}
			if err := r.db.Create(&newWallet).Error; err != nil {
				return nil, err
			}
			return &newWallet, nil
		}
		return nil, err
	}
	return &wallet, nil
}

func (r *walletRepository) CreditEarnings(userEmail string, orderID uuid.UUID, deliveryFee float64, itemPrice float64) (*domain.UserWallet, error) {
	var updatedWallet domain.UserWallet

	err := r.db.Transaction(func(tx *gorm.DB) error {
		var wallet domain.UserWallet
		if err := tx.Where("user_email = ?", userEmail).First(&wallet).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				wallet = domain.UserWallet{
					UserEmail: userEmail,
				}
				if err := tx.Create(&wallet).Error; err != nil {
					return err
				}
			} else {
				return err
			}
		}

		totalCredit := deliveryFee + itemPrice
		wallet.Balance += totalCredit
		wallet.TotalEarnings += deliveryFee
		wallet.CompletedJobsCount += 1

		if err := tx.Save(&wallet).Error; err != nil {
			return err
		}

		// บันทึก Transaction สำหรับค่าหิ้ว
		feeTx := domain.WalletTransaction{
			WalletID:    wallet.ID,
			OrderID:     &orderID,
			Amount:      deliveryFee,
			Type:        domain.TxTypeDeliveryFee,
			Description: fmt.Sprintf("รายได้ค่าหิ้วออเดอร์ %s", orderID.String()[:8]),
		}
		if err := tx.Create(&feeTx).Error; err != nil {
			return err
		}

		// หากมีค่าสินค้า ให้บันทึกคืนเงิน
		if itemPrice > 0 {
			itemTx := domain.WalletTransaction{
				WalletID:    wallet.ID,
				OrderID:     &orderID,
				Amount:      itemPrice,
				Type:        domain.TxTypeReimbursement,
				Description: fmt.Sprintf("เงินสำรองจ่ายค่าสินค้าออเดอร์ %s", orderID.String()[:8]),
			}
			if err := tx.Create(&itemTx).Error; err != nil {
				return err
			}
		}

		updatedWallet = wallet
		return nil
	})

	if err != nil {
		return nil, err
	}

	return &updatedWallet, nil
}

func (r *walletRepository) GetTransactions(walletID uuid.UUID) ([]domain.WalletTransaction, error) {
	var txs []domain.WalletTransaction
	err := r.db.Where("wallet_id = ?", walletID).Order("created_at DESC").Find(&txs).Error
	if err != nil {
		return nil, err
	}
	return txs, nil
}
