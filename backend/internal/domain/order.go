package domain

import (
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type OrderStatus string

const (
	StatusPending   OrderStatus = "PENDING"   // สร้างออเดอร์แล้ว รอไรเดอร์รับงาน
	StatusAccepted  OrderStatus = "ACCEPTED"  // ไรเดอร์รับงานแล้ว กำลังไปซื้อ
	StatusDelivering OrderStatus = "DELIVERING" // ไรเดอร์ซื้อเสร็จแล้ว กำลังเดินส่ง
	StatusCompleted OrderStatus = "COMPLETED"  // ส่งมอบสำเร็จ (ยืนยัน OTP)
	StatusCancelled OrderStatus = "CANCELLED"  // ยกเลิกออเดอร์
)

type Order struct {
	ID             uuid.UUID   `gorm:"type:uuid;primaryKey" json:"id"`
	OrderCode      string      `gorm:"type:varchar(20);uniqueIndex;not null" json:"order_code"`
	CustomerID     uuid.UUID   `gorm:"type:uuid;index" json:"customer_id"`
	CustomerEmail  string      `gorm:"type:varchar(120);not null" json:"customer_email"`
	RiderID        *uuid.UUID  `gorm:"type:uuid;index" json:"rider_id"`
	RiderEmail     string      `gorm:"type:varchar(120)" json:"rider_email"`
	PickupHubID    uuid.UUID   `gorm:"type:uuid;not null" json:"pickup_hub_id"`
	PickupHubName  string      `gorm:"type:varchar(120);not null" json:"pickup_hub_name"`
	DropoffNodeID  uuid.UUID   `gorm:"type:uuid;not null" json:"dropoff_node_id"`
	DropoffNodeName string     `gorm:"type:varchar(120);not null" json:"dropoff_node_name"`
	ItemDetails    string      `gorm:"type:text;not null" json:"item_details"`
	EstimatedPrice float64     `gorm:"type:decimal(10,2);not null" json:"estimated_price"`
	DeliveryFee    float64     `gorm:"type:decimal(10,2);not null" json:"delivery_fee"`
	Status         OrderStatus `gorm:"type:varchar(20);default:'PENDING';index" json:"status"`
	OTPCode        string      `gorm:"type:varchar(4);not null" json:"otp_code"`
	Note           string      `gorm:"type:text" json:"note"`
	CreatedAt      time.Time   `json:"created_at"`
	UpdatedAt      time.Time   `json:"updated_at"`
}

func (o *Order) BeforeCreate(tx *gorm.DB) (err error) {
	if o.ID == uuid.Nil {
		o.ID = uuid.New()
	}
	return
}

func ValidateOrderStatusTransition(current OrderStatus, target OrderStatus) error {
	switch current {
	case StatusPending:
		if target != StatusAccepted && target != StatusCancelled {
			return errors.New("ออเดอร์สถานะ PENDING สามารถเปลี่ยนเป็น ACCEPTED หรือ CANCELLED ได้เท่านั้น")
		}
	case StatusAccepted:
		if target != StatusDelivering && target != StatusCancelled {
			return errors.New("ออเดอร์สถานะ ACCEPTED สามารถเปลี่ยนเป็น DELIVERING ได้เท่านั้น")
		}
	case StatusDelivering:
		if target != StatusCompleted {
			return errors.New("ออเดอร์สถานะ DELIVERING สามารถเปลี่ยนเป็น COMPLETED ได้เท่านั้น")
		}
	case StatusCompleted, StatusCancelled:
		return errors.New("ออเดอร์ที่เสร็จสิ้นหรือยกเลิกแล้ว ไม่สามารถเปลี่ยนสถานะได้อีก")
	}
	return nil
}
