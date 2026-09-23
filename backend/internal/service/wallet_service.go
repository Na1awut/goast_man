package service

import (
	"kmutt-delivery-backend/internal/domain"
	"kmutt-delivery-backend/internal/repository"

	"github.com/google/uuid"
)

type WalletService interface {
	GetUserWallet(userEmail string) (*domain.UserWallet, error)
	ProcessOrderCompletion(orderID uuid.UUID, riderEmail string, deliveryFee float64, itemPrice float64) (*domain.UserWallet, error)
}

type walletService struct {
	walletRepo repository.WalletRepository
}

func NewWalletService(walletRepo repository.WalletRepository) WalletService {
	return &walletService{walletRepo: walletRepo}
}

func (s *walletService) GetUserWallet(userEmail string) (*domain.UserWallet, error) {
	return s.walletRepo.GetOrCreateWallet(userEmail)
}

func (s *walletService) ProcessOrderCompletion(orderID uuid.UUID, riderEmail string, deliveryFee float64, itemPrice float64) (*domain.UserWallet, error) {
	return s.walletRepo.CreditEarnings(riderEmail, orderID, deliveryFee, itemPrice)
}
