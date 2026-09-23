package service

import (
	"kmutt-delivery-backend/internal/domain"
	"kmutt-delivery-backend/internal/repository"

	"github.com/google/uuid"
)

type LocationService interface {
	GetAllLocations(hubType string, zone string) ([]domain.LocationHub, error)
	GetLocationByID(id uuid.UUID) (*domain.LocationHub, error)
	GetStoresByLocationID(locationID uuid.UUID) ([]domain.Store, error)
	CreateLocation(hub *domain.LocationHub) error
}

type locationService struct {
	locationRepo repository.LocationRepository
}

func NewLocationService(locationRepo repository.LocationRepository) LocationService {
	return &locationService{locationRepo: locationRepo}
}

func (s *locationService) GetAllLocations(hubType string, zone string) ([]domain.LocationHub, error) {
	return s.locationRepo.FindAll(hubType, zone)
}

func (s *locationService) GetLocationByID(id uuid.UUID) (*domain.LocationHub, error) {
	return s.locationRepo.FindByID(id)
}

func (s *locationService) GetStoresByLocationID(locationID uuid.UUID) ([]domain.Store, error) {
	return s.locationRepo.FindStoresByLocationID(locationID)
}

func (s *locationService) CreateLocation(hub *domain.LocationHub) error {
	return s.locationRepo.Create(hub)
}
