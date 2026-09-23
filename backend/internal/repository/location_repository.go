package repository

import (
	"kmutt-delivery-backend/internal/domain"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type LocationRepository interface {
	FindAll(hubType string, zone string) ([]domain.LocationHub, error)
	FindByID(id uuid.UUID) (*domain.LocationHub, error)
	Create(hub *domain.LocationHub) error
	FindStoresByLocationID(locationID uuid.UUID) ([]domain.Store, error)
	CreateStore(store *domain.Store) error
}

type locationRepository struct {
	db *gorm.DB
}

func NewLocationRepository(db *gorm.DB) LocationRepository {
	return &locationRepository{db: db}
}

func (r *locationRepository) FindAll(hubType string, zone string) ([]domain.LocationHub, error) {
	var hubs []domain.LocationHub
	query := r.db.Model(&domain.LocationHub{}).Where("is_active = ?", true)

	if hubType != "" {
		query = query.Where("hub_type = ?", hubType)
	}
	if zone != "" {
		query = query.Where("zone = ?", zone)
	}

	err := query.Order("name ASC").Find(&hubs).Error
	if err != nil {
		return nil, err
	}
	return hubs, nil
}

func (r *locationRepository) FindByID(id uuid.UUID) (*domain.LocationHub, error) {
	var hub domain.LocationHub
	err := r.db.Preload("Stores").Preload("Stores.MenuItems").First(&hub, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &hub, nil
}

func (r *locationRepository) Create(hub *domain.LocationHub) error {
	return r.db.Create(hub).Error
}

func (r *locationRepository) FindStoresByLocationID(locationID uuid.UUID) ([]domain.Store, error) {
	var stores []domain.Store
	err := r.db.Preload("MenuItems").Where("location_id = ? AND is_open = ?", locationID, true).Find(&stores).Error
	if err != nil {
		return nil, err
	}
	return stores, nil
}

func (r *locationRepository) CreateStore(store *domain.Store) error {
	return r.db.Create(store).Error
}
