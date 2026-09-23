package handler

import (
	"log"
	"net/http"

	"kmutt-delivery-backend/internal/websocket"

	"github.com/gofiber/fiber/v2"
	gorillaWS "github.com/gorilla/websocket"
)

var upgrader = gorillaWS.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // อนุญาตทุก Origin สำหรับการทดสอบใน มจธ.
	},
}

type WSHandler struct {
	hub *websocket.Hub
}

func NewWSHandler(hub *websocket.Hub) *WSHandler {
	return &WSHandler{hub: hub}
}

// GET /api/v1/ws (WebSocket Protocol Upgrade)
func (h *WSHandler) ServeWS(c *fiber.Ctx) error {
	// ใช้ Adaptor สำหรับ Gorilla WebSocket
	c.Context().SetUserValue("ws_upgrade", true)

	// upgrade connection
	err := upgrader.Upgrade(c.Context(), func(conn *gorillaWS.Conn) {
		client := websocket.NewClient(h.hub, conn)
		h.hub.RegisterClient(client)

		go client.WritePump()
		go client.ReadPump()
	})

	if err != nil {
		log.Printf("⚠️ [WebSocket Upgrade Error]: %v\n", err)
		return c.Status(fiber.StatusBadRequest).SendString("ไม่สามารถอัปเกรดเป็น WebSocket ได้")
	}

	return nil
}
