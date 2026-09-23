package service

import (
	"errors"
	"fmt"
	"math/rand"
	"time"

	"kmutt-delivery-backend/internal/domain"
	"kmutt-delivery-backend/internal/repository"
	"kmutt-delivery-backend/internal/websocket"

	"github.com/google/uuid"
)

type CreateOrderDTO struct {
	CustomerEmail   string  `json:"customer_email"`
	PickupHubID     string  `json:"pickup_hub_id"`
	PickupHubName   string  `json:"pickup_hub_name"`
	DropoffNodeID   string  `json:"dropoff_node_id"`
	DropoffNodeName string  `json:"dropoff_node_name"`
	ItemDetails     string  `json:"item_details"`
	EstimatedPrice  float64 `json:"estimated_price"`
	DeliveryFee     float64 `json:"delivery_fee"`
	Note            string  `json:"note"`
}

type OrderService interface {
	CreateOrder(dto CreateOrderDTO) (*domain.Order, error)
	GetOrders(status string) ([]domain.Order, error)
	GetOrderByID(id uuid.UUID) (*domain.Order, error)
	AcceptOrder(orderID uuid.UUID, riderID uuid.UUID, riderEmail string) (*domain.Order, error)
	UpdateOrderStatus(orderID uuid.UUID, targetStatus domain.OrderStatus) error
	CompleteOrderWithOTP(orderID uuid.UUID, otp string) (*domain.Order, error)
}

type orderService struct {
	orderRepo     repository.OrderRepository
	walletService WalletService
	hub           *websocket.Hub
	randSrc       *rand.Rand
}

func NewOrderService(orderRepo repository.OrderRepository, walletService WalletService, hub *websocket.Hub) OrderService {
	return &orderService{
		orderRepo:     orderRepo,
		walletService: walletService,
		hub:           hub,
		randSrc:       rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

func (s *orderService) CreateOrder(dto CreateOrderDTO) (*domain.Order, error) {
	if dto.CustomerEmail == "" {
		return nil, errors.New("ต้องระบุอีเมลผู้สั่ง (@kmutt.ac.th)")
	}
	if dto.ItemDetails == "" {
		return nil, errors.New("ต้องระบุรายละเอียดของที่ต้องการให้หิ้ว")
	}

	pickupUUID, err := uuid.Parse(dto.PickupHubID)
	if err != nil {
		return nil, errors.New("PickupHubID ไม่ถูกต้อง")
	}

	dropoffUUID, err := uuid.Parse(dto.DropoffNodeID)
	if err != nil {
		return nil, errors.New("DropoffNodeID ไม่ถูกต้อง")
	}

	if dto.DeliveryFee < 15.0 {
		dto.DeliveryFee = 15.0 // ขั้นต่ำ 15 บาท
	}

	// สุ่มรหัส OTP 4 หลัก
	otp := fmt.Sprintf("%04d", s.randSrc.Intn(10000))
	// สุ่ม Code ออเดอร์
	orderCode := fmt.Sprintf("MOD-%04d", s.randSrc.Intn(10000))

	order := &domain.Order{
		OrderCode:       orderCode,
		CustomerEmail:   dto.CustomerEmail,
		PickupHubID:     pickupUUID,
		PickupHubName:   dto.PickupHubName,
		DropoffNodeID:   dropoffUUID,
		DropoffNodeName: dto.DropoffNodeName,
		ItemDetails:     dto.ItemDetails,
		EstimatedPrice:  dto.EstimatedPrice,
		DeliveryFee:     dto.DeliveryFee,
		Status:          domain.StatusPending,
		OTPCode:         otp,
		Note:            dto.Note,
	}

	if err := s.orderRepo.Create(order); err != nil {
		return nil, fmt.Errorf("สร้างออเดอร์ล้มเหลว: %w", err)
	}

	// 📡 Real-Time Broadcast Event: ORDER_CREATED
	if s.hub != nil {
		s.hub.BroadcastEvent("ORDER_CREATED", order)
	}

	return order, nil
}

func (s *orderService) GetOrders(status string) ([]domain.Order, error) {
	return s.orderRepo.FindAll(status)
}

func (s *orderService) GetOrderByID(id uuid.UUID) (*domain.Order, error) {
	return s.orderRepo.FindByID(id)
}

func (s *orderService) AcceptOrder(orderID uuid.UUID, riderID uuid.UUID, riderEmail string) (*domain.Order, error) {
	if riderEmail == "" {
		return nil, errors.New("ต้องระบุอีเมลไรเดอร์นักศึกษา (@kmutt.ac.th)")
	}

	order, err := s.orderRepo.AcceptOrderWithLock(orderID, riderID, riderEmail)
	if err != nil {
		return nil, err
	}

	// 📡 Real-Time Broadcast Event: ORDER_ACCEPTED
	if s.hub != nil {
		s.hub.BroadcastEvent("ORDER_ACCEPTED", order)
	}

	return order, nil
}

func (s *orderService) UpdateOrderStatus(orderID uuid.UUID, targetStatus domain.OrderStatus) error {
	err := s.orderRepo.UpdateStatus(orderID, targetStatus)
	if err == nil && s.hub != nil {
		s.hub.BroadcastEvent("ORDER_STATUS_CHANGED", map[string]interface{}{
			"id":     orderID,
			"status": targetStatus,
		})
	}
	return err
}

func (s *orderService) CompleteOrderWithOTP(orderID uuid.UUID, otp string) (*domain.Order, error) {
	if otp == "" || len(otp) != 4 {
		return nil, errors.New("รหัส OTP ต้องมี 4 หลัก")
	}

	order, err := s.orderRepo.VerifyAndComplete(orderID, otp)
	if err != nil {
		return nil, err
	}

	// 💰 โอนเงินเข้า Wallet ไรเดอร์เมื่อ OTP ถูกต้อง
	if s.walletService != nil && order.RiderEmail != "" {
		_, _ = s.walletService.ProcessOrderCompletion(order.ID, order.RiderEmail, order.DeliveryFee, order.EstimatedPrice)
	}

	// 📡 Real-Time Broadcast Event: ORDER_COMPLETED
	if s.hub != nil {
		s.hub.BroadcastEvent("ORDER_COMPLETED", order)
	}

	return order, nil
}
