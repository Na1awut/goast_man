package domain

import (
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type UserRole string

const (
	RoleStudent UserRole = "STUDENT"
	RoleAdmin   UserRole = "ADMIN"
)

type UserStatus string

const (
	StatusActive    UserStatus = "ACTIVE"
	StatusSuspended UserStatus = "SUSPENDED"
)

type User struct {
	ID             uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	Email          string     `gorm:"type:varchar(120);uniqueIndex;not null" json:"email"`
	FullName       string     `gorm:"type:varchar(120);not null" json:"full_name"`
	StudentID      string     `gorm:"type:varchar(15);index" json:"student_id"`
	AvatarURL      string     `gorm:"type:text" json:"avatar_url"`
	PhoneNumber    string     `gorm:"type:varchar(20)" json:"phone_number"`
	PromptPayNo    string     `gorm:"type:varchar(20)" json:"promptpay_no"`
	Role           UserRole   `gorm:"type:varchar(20);default:'STUDENT'" json:"role"`
	Status         UserStatus `gorm:"type:varchar(20);default:'ACTIVE'" json:"status"`
	RiderRatingAvg float64    `gorm:"type:decimal(3,2);default:5.00" json:"rider_rating_avg"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

func (u *User) BeforeCreate(tx *gorm.DB) (err error) {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return
}

// Validation Rule: กรองเฉพาะอีเมลนักศึกษา มจธ. เท่านั้น
func ValidateKMUTTEmail(email string) error {
	cleanEmail := strings.ToLower(strings.TrimSpace(email))
	if !strings.HasSuffix(cleanEmail, "@kmutt.ac.th") && !strings.HasSuffix(cleanEmail, "@mail.kmutt.ac.th") {
		return errors.New("เข้าสู่ระบบได้เฉพาะบัญชีนักศึกษา มจธ. (@kmutt.ac.th หรือ @mail.kmutt.ac.th) เท่านั้น")
	}
	return nil
}
