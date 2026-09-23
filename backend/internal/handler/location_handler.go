package handler

import (
	"kmutt-delivery-backend/internal/domain"
	"kmutt-delivery-backend/internal/service"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type LocationHandler struct {
	locationService service.LocationService
}

func NewLocationHandler(locationService service.LocationService) *LocationHandler {
	return &LocationHandler{locationService: locationService}
}

// GET /api/v1/locations?type=PICKUP&zone=CANTEEN
func (h *LocationHandler) GetLocations(c *fiber.Ctx) error {
	hubType := c.Query("type")
	zone := c.Query("zone")

	locations, err := h.locationService.GetAllLocations(hubType, zone)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "ไม่สามารถดึงข้อมูลจุดรับ-ส่งได้: " + err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"count":     len(locations),
		"locations": locations,
	})
}

// GET /api/v1/locations/:id
func (h *LocationHandler) GetLocationByID(c *fiber.Ctx) error {
	idParam := c.Params("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "ID ของจุดรับ-ส่ง ไม่ถูกต้อง",
		})
	}

	location, err := h.locationService.GetLocationByID(id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "ไม่พบข้อมูลจุดรับ-ส่งตามที่ระบุ",
		})
	}

	return c.JSON(location)
}

// GET /api/v1/locations/:id/stores
func (h *LocationHandler) GetStoresByLocation(c *fiber.Ctx) error {
	idParam := c.Params("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "ID ของจุดรับ-ส่ง ไม่ถูกต้อง",
		})
	}

	stores, err := h.locationService.GetStoresByLocationID(id)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "ไม่สามารถดึงข้อมูลร้านค้าได้: " + err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"count":  len(stores),
		"stores": stores,
	})
}

// POST /api/v1/locations (Admin)
func (h *LocationHandler) CreateLocation(c *fiber.Ctx) error {
	var hub domain.LocationHub
	if err := c.BodyParser(&hub); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "ข้อมูล Request Body ไม่ถูกต้อง",
		})
	}

	if err := h.locationService.CreateLocation(&hub); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "ไม่สามารถสร้างจุดรับ-ส่งใหม่ได้: " + err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message":  "สร้างจุดรับ-ส่ง สำเร็จ",
		"location": hub,
	})
}
