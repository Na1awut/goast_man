package repository

import (
	"errors"
	"fmt"

	"kmutt-delivery-backend/internal/domain"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	ErrOrderAlreadyAccepted = errors.New("ออเดอร์นี้มีไรเดอร์ท่านอื่นกดรับไปแล้ว (Race Condition Prevention)")
	ErrOrderNotFound        = errors.New("ไม่พบข้อมูลออเดอร์ในระบบ")
	ErrInvalidOTP           = errors.New("รหัสยืนยัน OTP ไม่ถูกต้อง")
)

type OrderRepository interface {
	Create(order *domain.Order) error
	FindByID(id uuid.UUID) (*domain.Order, error)
	FindAll(status string) ([]domain.Order, error)
	AcceptOrderWithLock(orderID uuid.UUID, riderID uuid.UUID, riderEmail string) (*domain.Order, error)
	UpdateStatus(orderID uuid.UUID, targetStatus domain.OrderStatus) error
	VerifyAndComplete(orderID uuid.UUID, otp string) (*domain.Order, error)
}

type orderRepository struct {
	db *gorm.DB
}

func NewOrderRepository(db *gorm.DB) OrderRepository {
	return &orderRepository{db: db}
}

func (r *orderRepository) Create(order *domain.Order) error {
	return r.db.Create(order).Error
}

func (r *orderRepository) FindByID(id uuid.UUID) (*domain.Order, error) {
	var order domain.Order
	err := r.db.First(&order, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrOrderNotFound
		}
		return nil, err
	}
	return &order, nil
}

func (r *orderRepository) FindAll(status string) ([]domain.Order, error) {
	var orders []domain.Order
	query := r.db.Model(&domain.Order{})

	if status != "" {
		query = query.Where("status = ?", status)
	}

	err := query.Order("created_at DESC").Find(&orders).Error
	if err != nil {
		return nil, err
	}
	return orders, nil
}

// AcceptOrderWithLock: ใช้ Database Transaction + Row Locking ป้องกัน Race Condition
func (r *orderRepository) AcceptOrderWithLock(orderID uuid.UUID, riderID uuid.UUID, riderEmail string) (*domain.Order, error) {
	var updatedOrder domain.Order

	err := r.db.Transaction(func(tx *gorm.DB) error {
		var order domain.Order

		// Lock Row สำหรับ UPDATE ป้องกันการเข้าถึงพร้อมกัน (SELECT FOR UPDATE)
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&order, "id = ?", orderID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrOrderNotFound
			}
			return err
		}

		// ตรวจสอบว่าออเดอร์ยังอยู่ในสถานะ PENDING หรือไม่
		if order.Status != domain.StatusPending {
			return ErrOrderAlreadyAccepted
		}

		// อัปเดตสถานะเป็น ACCEPTED พร้อมผูก ID และ Email ไรเดอร์
		order.Status = domain.StatusAccepted
		order.RiderID = &riderID
		order.RiderEmail = riderEmail

		if err := tx.Save(&order).Error; err != nil {
			return fmt.Errorf("ไม่สามารถบันทึกการรับงานได้: %w", err)
		}

		updatedOrder = order
		return nil
	})

	if err != nil {
		return nil, err
	}

	return &updatedOrder, nil
}

func (r *orderRepository) UpdateStatus(orderID uuid.UUID, targetStatus domain.OrderStatus) error {
	var order domain.Order
	if err := r.db.First(&order, "id = ?", orderID).Error; err != nil {
		return err
	}

	if err := domain.ValidateOrderStatusTransition(order.Status, targetStatus); err != nil {
		return err
	}

	return r.db.Model(&order).Update("status", targetStatus).Error
}

func (r *orderRepository) VerifyAndComplete(orderID uuid.UUID, otp string) (*domain.Order, error) {
	var order domain.Order
	if err := r.db.First(&order, "id = ?", orderID).Error; err != nil {
		return nil, ErrOrderNotFound
	}

	if order.OTPCode != otp {
		return nil, ErrInvalidOTP
	}

	if order.Status != domain.StatusDelivering && order.Status != domain.StatusAccepted {
		return nil, errors.New("ออเดอร์ต้องอยู่ในสถานะกำลังซื้อหรือกำลังส่งจึงจะสามารถยืนยัน OTP ได้")
	}

	order.Status = domain.StatusCompleted
	if err := r.db.Save(&order).Error; err != nil {
		return nil, err
	}

	return &order, nil
}
