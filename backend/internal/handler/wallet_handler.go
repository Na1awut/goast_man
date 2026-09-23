package handler

import (
	"kmutt-delivery-backend/internal/service"

	"github.com/gofiber/fiber/v2"
)

type WalletHandler struct {
	walletService service.WalletService
}

func NewWalletHandler(walletService service.WalletService) *WalletHandler {
	return &WalletHandler{walletService: walletService}
}

// GET /api/v1/wallet/me?email=s66070501234@mail.kmutt.ac.th
func (h *WalletHandler) GetMyWallet(c *fiber.Ctx) error {
	email := c.Query("email")
	if email == "" {
		email = "s66070501234@mail.kmutt.ac.th" // default fallback
	}

	wallet, err := h.walletService.GetUserWallet(email)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "ไม่สามารถดึงข้อมูลกระเป๋าเงินได้: " + err.Error(),
		})
	}

	return c.JSON(wallet)
}
