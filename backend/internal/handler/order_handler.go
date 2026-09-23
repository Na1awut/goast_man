package handler

import (
	"errors"
	"kmutt-delivery-backend/internal/domain"
	"kmutt-delivery-backend/internal/repository"
	"kmutt-delivery-backend/internal/service"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type OrderHandler struct {
	orderService service.OrderService
}

func NewOrderHandler(orderService service.OrderService) *OrderHandler {
	return &OrderHandler{orderService: orderService}
}

// POST /api/v1/orders
func (h *OrderHandler) CreateOrder(c *fiber.Ctx) error {
	var req service.CreateOrderDTO
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "รูปแบบ Request Body ไม่ถูกต้อง",
		})
	}

	order, err := h.orderService.CreateOrder(req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "สร้างออเดอร์สำเร็จ",
		"order":   order,
	})
}

// GET /api/v1/orders?status=PENDING
func (h *OrderHandler) GetOrders(c *fiber.Ctx) error {
	status := c.Query("status")
	orders, err := h.orderService.GetOrders(status)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "ไม่สามารถดึงข้อมูลออเดอร์ได้: " + err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"count":  len(orders),
		"orders": orders,
	})
}

// GET /api/v1/orders/:id
func (h *OrderHandler) GetOrderByID(c *fiber.Ctx) error {
	idParam := c.Params("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "ID ของออเดอร์ไม่ถูกต้อง",
		})
	}

	order, err := h.orderService.GetOrderByID(id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "ไม่พบข้อมูลออเดอร์ในระบบ",
		})
	}

	return c.JSON(order)
}

type AcceptOrderRequest struct {
	RiderID    string `json:"rider_id"`
	RiderEmail string `json:"rider_email"`
}

// POST /api/v1/orders/:id/accept (Atomic Lock)
func (h *OrderHandler) AcceptOrder(c *fiber.Ctx) error {
	idParam := c.Params("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "ID ของออเดอร์ไม่ถูกต้อง",
		})
	}

	var req AcceptOrderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "ต้องระบุ rider_email ใน request body",
		})
	}

	riderUUID := uuid.Nil
	if req.RiderID != "" {
		riderUUID, _ = uuid.Parse(req.RiderID)
	}

	order, err := h.orderService.AcceptOrder(id, riderUUID, req.RiderEmail)
	if err != nil {
		if errors.Is(err, repository.ErrOrderAlreadyAccepted) {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"error": err.Error(),
			})
		}
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "รับงานหิ้วสำเร็จ",
		"order":   order,
	})
}

type CompleteOrderRequest struct {
	OTP string `json:"otp"`
}

// POST /api/v1/orders/:id/complete (OTP Verification)
func (h *OrderHandler) CompleteOrder(c *fiber.Ctx) error {
	idParam := c.Params("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "ID ของออเดอร์ไม่ถูกต้อง",
		})
	}

	var req CompleteOrderRequest
	if err := c.BodyParser(&req); err != nil || req.OTP == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "ต้องระบุ otp 4 หลักใน request body",
		})
	}

	order, err := h.orderService.CompleteOrderWithOTP(id, req.OTP)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "ยืนยัน OTP สำเร็จ ปิดงานเรียบร้อย",
		"order":   order,
	})
}
