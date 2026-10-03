# เว็บทดสอบการอัปเดต (Test site)

เว็บแยกจากเว็บจริงทั้งหมด ใช้ลองฟีเจอร์ใหม่ก่อนปล่อยขึ้นเว็บจริง มี 2 แบบ ใช้โค้ดชุดเดียวกัน ต่างกันที่ตัวแปรตอน build

| | **แบบ B: มีฐานข้อมูลทดสอบ (แนะนำ)** | แบบ A: ข้อมูลจำลอง |
|---|---|---|
| ตัวแปร | `PUBLIC_TEST_SITE=true` + `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY` ของโปรเจกต์ทดสอบ | `PUBLIC_SIMULATION=true` (ไม่ใส่ Supabase) |
| ข้อมูล | ฐานข้อมูล Supabase ทดสอบของมันเอง ใช้ร่วมกันทุกคน | ข้อมูลตัวอย่างในเบราว์เซอร์ของแต่ละคน |
| หลายคนคนละบทบาทพร้อมกัน | **ได้** ออเดอร์ แชท เปิด-ปิดร้าน วิ่งถึงกันจริง | ไม่ได้ (แยกกัน) |
| ทดสอบ migration / ฐานข้อมูล | ได้ | ไม่ได้ |
| ล็อกอิน | บัญชีทดสอบ (อีเมล + รหัสผ่าน) | กดเลือกบทบาท |

ทั้งสองแบบ: แถบเหลืองด้านบนทุกหน้า, ชื่อแท็บขึ้นต้น "[ทดสอบ]", `noindex` และ `robots.txt` ห้ามทั้งหมด, เว็บจริงไม่เปลี่ยนเมื่อไม่มีตัวแปรเหล่านี้ (ดู `src/lib/sim.ts`)

## แบบ B: ฐานข้อมูลทดสอบ

- โปรเจกต์ Supabase ทดสอบ: ref `bvsupdlsbgbispeubstt` (บัญชีแยกจากเว็บจริง `pguhzjtdwgualqeqzleu`)
- โครงสร้างมาจากไฟล์ใน `supabase/migrations/` ทั้งหมด + `supabase/seed.sql` (ไม่มีข้อมูลจริงจากเว็บจริงเลย)
- สมัครเองไม่ได้ (ตัวกันสมัครของเรากันไว้ ต้องมาจาก Google/Microsoft) บัญชีทดสอบสร้างด้วย SQL เท่านั้น
- ตั้งค่า Test mode ชำระเงินแล้ว (หน้าตั้งค่าของทีมงาน) ผู้ซื้อกดจ่ายทดสอบได้โดยไม่ต้องโอนเงินจริง

### บัญชีทดสอบ

รหัสผ่านร่วมของทุกบัญชีอยู่ในไฟล์ `.env.test` ที่รากโปรเจกต์ (`TEST_ACCOUNT_PASSWORD`, ไฟล์ถูก gitignore) ผู้ดูแลส่งให้ทีมเป็นการส่วนตัว ห้ามใส่ในแชทสาธารณะหรือโค้ด

| อีเมล | บทบาท | เข้าที่ |
|---|---|---|
| `buyer1@mail.kmutt.ac.th`, `buyer2@...` | ผู้ซื้อ | แอป `/` |
| `rider1@mail.kmutt.ac.th`, `rider2@...` | คนหิ้ว (อยู่ในรายชื่อแล้ว) | แอป `/` → โปรไฟล์ → โหมดคนหิ้ว |
| `shop1@example.com` (ร้านป้าวาบ), `shop2@...` (ครัวกรุงศรี) | ร้านค้า | แอป `/` |
| `admin1@mail.kmutt.ac.th`, `admin2@...` | ทีมงาน ADMIN | คอนโซล `/admin/` |
| `staff1@mail.kmutt.ac.th` | ทีมงาน STAFF | คอนโซล `/admin/` |

หน้าล็อกอินของเว็บทดสอบมีกล่องสีเหลือง "เข้าสู่ระบบด้วยบัญชีทดสอบ" แยกจากปุ่ม Google/Microsoft เดิม

ลองเล่นข้ามบทบาท: ให้ A เข้า ผู้ซื้อ, B เข้า คนหิ้ว (กด "พร้อมรับงาน"), C เข้า ร้านค้า, D เข้า คอนโซล ADMIN แล้วผู้ซื้อสั่งอาหาร

### ตั้งค่า Vercel (ทำครั้งเดียว)

1. สร้าง **Vercel project ใหม่** (เช่น `goose-man-test`) ต่อ GitHub repo เดียวกัน
2. Settings → Git → **Production Branch = `dev`**
3. Settings → Environment Variables (Production) ใส่:
   - `PUBLIC_TEST_SITE` = `true`
   - `PUBLIC_SUPABASE_URL` = `https://bvsupdlsbgbispeubstt.supabase.co`
   - `PUBLIC_SUPABASE_ANON_KEY` = anon key ของโปรเจกต์ทดสอบ (Supabase → Project Settings → API ค่านี้ไม่ลับเหมือนของเว็บจริง)
   - **ห้ามใส่** `PUBLIC_PROMPTPAY_*`, `PUBLIC_VAPID_*` และห้ามใส่ key ของเว็บจริง
4. แนะนำเปิด **Deployment Protection (Vercel Authentication)** ให้เฉพาะคนในทีมเปิดเว็บทดสอบได้
5. ให้โปรเจกต์ **เว็บจริง** ข้ามการ build branch อื่นนอกจาก `main` (Settings → Git → Ignored Build Step: `[ "$VERCEL_GIT_COMMIT_REF" != "main" ]`) ไม่งั้น Vercel จะสร้างลิงก์ชั่วคราวของ branch `dev` ที่ต่อฐานข้อมูลจริง

### Migration ใหม่

ทุกครั้งที่มีไฟล์ migration ใหม่ ผู้ดูแลรันลงฐานข้อมูลทดสอบก่อน (ใช้ token ใน `.env.test`):
```
SUPABASE_ACCESS_TOKEN=<จาก .env.test> npx supabase db query --linked=false --project-ref bvsupdlsbgbispeubstt -f supabase/migrations/<ไฟล์>.sql
```
ลองบนเว็บทดสอบจนมั่นใจ แล้วค่อยรันลงฐานข้อมูลจริง และ merge `dev` → `main` ตามลำดับนี้

## แบบ A: ข้อมูลจำลอง

หน้าแรกเป็นหน้าเลือกบทบาท (ผู้ซื้อ / คนหิ้ว / ร้านค้า / ทีมงาน) กดแล้วเข้าไปด้วยข้อมูลตัวอย่างในเบราว์เซอร์ ปุ่ม "ล้างข้อมูลทดสอบ" ในแถบเหลือง ไม่ต่อฐานข้อมูลเลย แม้ build นั้นจะมีกุญแจ Supabase อยู่ ใช้เมื่อต้องการลองหน้าตาคนเดียวโดยไม่ต้องมีฐานข้อมูล

จำลองไม่ได้: ออเดอร์ข้ามบทบาท, แจ้งเตือนตอนปิดแอป, โทรในแอป, ตรวจสลิป, ล็อกอิน Google/Microsoft

## วิธีทำงานกับเว็บจริง

```
git switch dev          # ทำงานและลองที่นี่
git push                # -> เว็บทดสอบอัปเดต เว็บจริงไม่ขยับ
# (มี migration ใหม่: รันลงฐานข้อมูลทดสอบก่อน)
# พอพร้อมปล่อย: รัน migration ลงฐานข้อมูลจริง แล้ว
git switch main
git merge dev
git push                # -> เว็บจริงอัปเดต
```

เว็บจริง deploy จาก `main` เท่านั้น การ push `dev` ไม่แตะเว็บจริง

## ตรวจว่าเว็บทดสอบแยกจริง

เปิดเว็บทดสอบ → F12 → Network → ใช้งานทุกบทบาท ต้องเห็นคำขอไปที่ `bvsupdlsbgbispeubstt.supabase.co` เท่านั้น ไม่มี `pguhzjtdwgualqeqzleu` (ของเว็บจริง)
