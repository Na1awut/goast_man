# เอกสารส่งมอบงาน: Goose Man (ห่านบางมด)

**โปรเจกต์:** แพลตฟอร์มฝากหิ้วอาหารแบบ P2P ภายใน มจธ. บางมด
**อัปเดตล่าสุด:** 24 กันยายน 2569
**สถานะ:** แอปฝั่งผู้สั่ง (buyer) ใช้งานได้ทั้งโหมดเดโมและโหมดจริง (Supabase) · แอปฝั่งคนหิ้วยังไม่ได้สร้าง

---

## 1. ภาพรวม

นักศึกษา มจธ. สั่งอาหารจากร้านในแคมปัส แล้วเพื่อนนักศึกษาเป็นคน "หิ้ว" ไปส่งถึงหน้าตึก
แก้ปัญหาการเดินตากแดดช่วงเที่ยง ใช้ได้เฉพาะบัญชี `@kmutt.ac.th` / `@mail.kmutt.ac.th`

- **Mobile-first PWA** ติดตั้งลงมือถือได้ (`frontend/static/manifest.json`)
- **สีหลัก:** ส้ม `#FA4616` (token อยู่ใน `frontend/src/routes/layout.css`)
- **ร้าน Partner** มีหน้าร้าน แบนเนอร์ Fast lane และโปรโมชันของตัวเอง

## 2. สถาปัตยกรรม

| ส่วน | เทคโนโลยี | หน้าที่ |
| :--- | :--- | :--- |
| Frontend | SvelteKit + Svelte 5 runes + Tailwind CSS v4 | แอปผู้สั่ง เรนเดอร์ฝั่ง client (`ssr = false`) |
| Backend | Supabase (Postgres + Auth + Realtime + Storage) | ตาราง, RLS, ฟังก์ชัน RPC, Google OAuth, อัปเดตสถานะเรียลไทม์ |
| Route planner | TypeScript (`frontend/src/lib/routing/`) | จัดลำดับจุดรับ/ส่งให้คนหิ้ว (พอร์ตจาก OR-Tools PDPTW) |

แอปมี **2 โหมด** ถ้าใส่ `PUBLIC_SUPABASE_URL` + `PUBLIC_SUPABASE_ANON_KEY` ใน `frontend/.env` จะใช้ฐานข้อมูลจริง
ถ้าไม่ใส่ จะรันด้วยข้อมูลเดโมในหน่วยความจำ (จำลองคนหิ้วรับงาน, OTP, แชท)

> backend Go/Fiber เดิมใน `backend/` และ `docker-compose.yml` **เลิกใช้แล้ว** เก็บไว้อ้างอิงเท่านั้น
> กฎทั้งหมดย้ายไปอยู่ใน `supabase/migrations/` แล้ว

## 3. ฐานข้อมูล (Supabase)

**ตาราง:** `stores`, `menu_items`, `promotions`, `profiles`, `partner_invites`, `orders`, `order_items`, `order_secrets`, `chat_messages`

**สถานะออเดอร์:** `PENDING → ACCEPTED → DELIVERING → COMPLETED` (หรือ `CANCELLED`)

**ฟังก์ชันหลัก**
- ฝั่งผู้สั่ง: `place_order`, `place_custom_order`, `cancel_order`, `rate_order`, `my_orders`, `complete_profile`
- ฝั่งคนหิ้ว: `accept_order`, `mark_delivering`, `confirm_delivery`
- ฝั่ง Partner: `update_storefront`

**กฎที่ฐานข้อมูลบังคับเอง**
- คิดราคาที่เซิร์ฟเวอร์ ไม่เชื่อยอดที่แอปส่งมา · ใช้โปรที่คุ้มที่สุด 1 โปรต่อออเดอร์
- รับงานพร้อมกันได้คนเดียว · OTP เก็บในตารางแยก กรอกผิด 5 ครั้งล็อก
- แชทเห็นเฉพาะผู้สั่งกับคนหิ้วของออเดอร์นั้น · ผู้ใช้แก้ role ตัวเองไม่ได้

รายละเอียดการตั้งค่าและคำสั่ง SQL ดูที่ [`supabase/README.md`](supabase/README.md)

## 4. โครงสร้างโค้ด

```text
.
├── frontend/              # แอปผู้สั่ง (SvelteKit) — ดู frontend/README.md
│   └── src/lib/
│       ├── screens/       # หน้าจอ: Login, Onboarding, Home, Stores, StoreDetail, CustomOrder, Checkout,
│       │                  #   Payment, Tracking, Chat, Success, Orders, Profile, EditProfile, Partner
│       ├── components/    # UI ที่ใช้ร่วมกัน
│       ├── stores/        # state แบบ rune
│       ├── api/live.ts    # การเรียก Supabase ทั้งหมด
│       ├── routing/       # route planner + เทสต์
│       ├── data/          # ข้อมูลเดโม (ใช้สร้าง supabase/seed.sql ด้วย)
│       └── pricing.ts     # กฎราคาและโปรโมชัน
├── supabase/              # migrations, seed.sql, generate-seed.mjs
├── bench/routing/         # benchmark route planner + เทียบกับ OR-Tools + Colab notebook
├── src/picture/, picture/ # ไฟล์ภาพต้นฉบับ (โลโก้, แบนเนอร์, mockup)
├── backend/               # (เลิกใช้) Go/Fiber เดิม
└── docker-compose.yml     # (เลิกใช้) Postgres สำหรับ backend เดิม
```

## 5. การรัน

```sh
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run check    # svelte-check / TypeScript
npm test         # vitest (route planner)
```

Benchmark route planner (Node ≥ 22.6):

```sh
node --experimental-strip-types bench/routing/bench.ts [--quick]
python bench/routing/ortools_compare.py      # ต้อง pip install ortools
```

## 6. งานที่ยังค้าง

1. **แอปฝั่งคนหิ้ว** ฟังก์ชัน `accept_order` / `mark_delivering` / `confirm_delivery` พร้อมแล้ว แต่ยังไม่มีหน้าจอ
   ในโหมดจริงออเดอร์จึงค้างที่ "กำลังหาคนหิ้ว" · route planner ใน `frontend/src/lib/routing/` เตรียมไว้สำหรับแอปนี้
2. **จำนวนคนหิ้วที่ออนไลน์** ยังไม่มีข้อมูลจริง (โหมดจริงซ่อนตัวเลขไว้)
3. **PromptPay** QR ยังเป็นภาพจำลอง ยังไม่ได้ต่อระบบรับเงินจริง
