package handler

import (
	"kmutt-delivery-backend/internal/service"

	"github.com/gofiber/fiber/v2"
)

type AuthHandler struct {
	authService service.AuthService
}

func NewAuthHandler(authService service.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

type GoogleLoginRequest struct {
	IDToken string `json:"id_token"`
}

func (h *AuthHandler) GoogleLogin(c *fiber.Ctx) error {
	var req GoogleLoginRequest
	if err := c.BodyParser(&req); err != nil || req.IDToken == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "ต้องระบุ id_token ใน request body",
		})
	}

	token, user, err := h.authService.LoginWithGoogle(c.Context(), req.IDToken)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "เข้าสู่ระบบสำเร็จ",
		"token":   token,
		"user":    user,
	})
}
