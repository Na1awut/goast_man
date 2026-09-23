package domain

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type HubType string

const (
	HubTypePickup  HubType = "PICKUP"
	HubTypeDropoff HubType = "DROPOFF"
)

type HubZone string

const (
	ZoneCanteen   HubZone = "CANTEEN"   // โรงอาหาร
	ZoneAcademic  HubZone = "ACADEMIC"  // อาคารเรียนรวม
	ZoneOffice    HubZone = "OFFICE"    // อาคารทำงาน/แล็บ
	ZoneDorm      HubZone = "DORM"      // หอพักนักศึกษา
	ZoneOffCampus HubZone = "OFF_CAMPUS" // หน้ามอ/ซอยรอบมอ
)

type LocationHub struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	Name        string    `gorm:"type:varchar(120);not null" json:"name"`
	Code        string    `gorm:"type:varchar(30);uniqueIndex;not null" json:"code"`
	Building    string    `gorm:"type:varchar(100)" json:"building"`
	Floor       string    `gorm:"type:varchar(50)" json:"floor"`
	Zone        HubZone   `gorm:"type:varchar(30);not null;index" json:"zone"`
	HubType     HubType   `gorm:"type:varchar(20);not null;index" json:"hub_type"`
	Description string    `gorm:"type:text" json:"description"`
	IsActive    bool      `gorm:"default:true" json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	Stores []Store `gorm:"foreignKey:LocationID" json:"stores,omitempty"`
}

func (l *LocationHub) BeforeCreate(tx *gorm.DB) (err error) {
	if l.ID == uuid.Nil {
		l.ID = uuid.New()
	}
	return
}

type Store struct {
	ID          uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	LocationID  uuid.UUID  `gorm:"type:uuid;not null;index" json:"location_id"`
	Name        string     `gorm:"type:varchar(120);not null" json:"name"`
	Category    string     `gorm:"type:varchar(50)" json:"category"`
	Description string     `gorm:"type:text" json:"description"`
	ImageURL    string     `gorm:"type:text" json:"image_url"`
	IsOpen      bool       `gorm:"default:true" json:"is_open"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`

	MenuItems []MenuItem `gorm:"foreignKey:StoreID" json:"menu_items,omitempty"`
}

func (s *Store) BeforeCreate(tx *gorm.DB) (err error) {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	return
}

type MenuItem struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	StoreID     uuid.UUID `gorm:"type:uuid;not null;index" json:"store_id"`
	Name        string    `gorm:"type:varchar(120);not null" json:"name"`
	Price       float64   `gorm:"type:decimal(10,2);not null" json:"price"`
	Description string    `gorm:"type:text" json:"description"`
	ImageURL    string    `gorm:"type:text" json:"image_url"`
	IsAvailable bool      `gorm:"default:true" json:"is_available"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (m *MenuItem) BeforeCreate(tx *gorm.DB) (err error) {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	return
}
