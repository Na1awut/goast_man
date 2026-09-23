package websocket

import (
	"encoding/json"
	"log"
	"sync"
)

type WSEvent struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	mu         sync.Mutex
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			log.Printf("🔌 [WebSocket] ไรเดอร์/ผู้ใช้ เชื่อมต่อเรียลไทม์ใหม่ (Total: %d clients)\n", len(h.clients))

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()
			log.Printf("🔌 [WebSocket] ตัดการเชื่อมต่อเรียลไทม์ (Total: %d clients)\n", len(h.clients))

		case message := <-h.broadcast:
			h.mu.Lock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mu.Unlock()
		}
	}
}

func (h *Hub) RegisterClient(client *Client) {
	h.register <- client
}

func (h *Hub) UnregisterClient(client *Client) {
	h.unregister <- client
}

func (h *Hub) BroadcastEvent(eventType string, payload interface{}) {
	event := WSEvent{
		Type:    eventType,
		Payload: payload,
	}

	data, err := json.Marshal(event)
	if err != nil {
		log.Printf("⚠️ [WebSocket] Marshal Event Error: %v\n", err)
		return
	}

	h.broadcast <- data
	log.Printf("📡 [WebSocket Broadcast] ส่งข่าวด่วน Event '%s' สู่ %d clients (< 1s)\n", eventType, len(h.clients))
}
