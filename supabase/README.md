# Supabase สำหรับ Goose Man

ฐานข้อมูล, ระบบล็อกอิน, อัปเดตสถานะแบบเรียลไทม์ และที่เก็บรูป ของแอป Goose Man
(ใช้แทน backend Go เดิมในโฟลเดอร์ `backend/` ซึ่งเก็บไว้อ้างอิงเท่านั้น)

ถ้ายังไม่ได้ตั้งค่า แอปจะรันด้วย **ข้อมูลเดโม** ตามปกติ พอใส่ key ใน `.env` แอปจะสลับไปใช้ข้อมูลจริงเอง

## ไฟล์ในโฟลเดอร์นี้

| ไฟล์ | คืออะไร |
|---|---|
| `migrations/20260924000000_init.sql` | ตาราง, สิทธิ์การเข้าถึง (RLS), ฟังก์ชันสั่งอาหาร/รับงาน/ยืนยัน OTP, Realtime, ที่เก็บรูป |
| `migrations/20260925000000_profile_onboarding.sql` | หน้ากรอกข้อมูลครั้งแรก, ตรวจเบอร์/รหัสนักศึกษา, บันทึกการยินยอม PDPA |
| `migrations/20260926000000_riders.sql` | รายชื่อคนหิ้ว, จำกัด 4 งานต่อรอบ, คืนงาน, ข้อมูลหน้าคนหิ้ว |
| `seed.sql` | ร้าน เมนู และโปรโมชันตัวอย่าง (สร้างจาก `frontend/src/lib/data/stores.ts`) |
| `generate-seed.mjs` | สร้าง `seed.sql` ใหม่หลังแก้ข้อมูลร้านในแอป: `node supabase/generate-seed.mjs` |

## ตั้งค่าครั้งแรก

### 1. สร้างโปรเจกต์
1. สมัคร/เข้า [supabase.com](https://supabase.com) → **New project** (เลือก Region: Singapore จะเร็วสุดสำหรับไทย)
2. เปิด **SQL Editor** แล้วรันไฟล์ตามลำดับนี้ (วางเนื้อหาทีละไฟล์ → **Run**)
   1. `migrations/20260924000000_init.sql`
   2. `migrations/20260925000000_profile_onboarding.sql`
   3. `migrations/20260926000000_riders.sql`
   4. `seed.sql`

### 2. เปิดล็อกอินด้วย Google
1. ที่ [Google Cloud Console](https://console.cloud.google.com/apis/credentials) สร้าง **OAuth client ID** (ประเภท Web application)
   - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
2. ใน Supabase: **Authentication → Providers → Google** → เปิดใช้ แล้วใส่ Client ID / Client Secret
3. **Authentication → URL Configuration**
   - Site URL: โดเมนจริงของแอป (หรือ `http://localhost:5173` ตอนพัฒนา)
   - Redirect URLs: เพิ่ม `http://localhost:5173` และโดเมนจริง

> ระบบจำกัดให้สมัครได้เฉพาะ `@kmutt.ac.th` / `@mail.kmutt.ac.th` **ที่ฝั่งฐานข้อมูล** (trigger `handle_new_user`)
> ปุ่มในแอปแค่ช่วยให้ Google เลือกบัญชี มจธ. ให้ก่อน คนที่ใช้อีเมลอื่นจะถูกปฏิเสธแม้จะแก้โค้ดฝั่งแอป

### 3. ใส่ key ในแอป
```sh
cd frontend
cp .env.example .env
```
แล้วใส่ค่าจาก **Project Settings → API**:
```
PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
PUBLIC_SUPABASE_ANON_KEY=<anon public key>
```
ใช้เฉพาะ **anon key** เท่านั้น ห้ามใส่ `service_role` key ในแอปเด็ดขาด (key นั้นข้ามสิทธิ์ทุกอย่างได้)
`.env` ถูก gitignore ไว้แล้ว จะไม่หลุดขึ้น GitHub

## เปลี่ยนเงื่อนไขหรือนโยบายความเป็นส่วนตัว

ข้อความอยู่ที่ `frontend/src/lib/data/legal.ts` ถ้าแก้เนื้อหา ให้เปลี่ยน `TERMS_VERSION` ใน `frontend/src/lib/profile.ts` ด้วย
ผู้ใช้ทุกคนจะถูกพาไปหน้ายอมรับเงื่อนไขใหม่อีกครั้งตอนเปิดแอป

## คนหิ้ว (Rider)

ตอนนี้ให้เฉพาะทีมเราหิ้ว ใครจะหิ้วได้ต้องมีอีเมลอยู่ในตาราง `rider_roster` (รันใน SQL Editor):

```sql
-- เพิ่มคนหิ้ว (ใช้อีเมล มจธ. ที่เขาล็อกอิน สมัครก่อนหรือหลังเพิ่มก็ได้)
insert into rider_roster (email, note) values ('somchai.k@mail.kmutt.ac.th', 'ทีมงาน');

-- ดูรายชื่อ
select * from rider_roster order by added_at;

-- เอาออก (งานที่ถืออยู่ยังส่งต่อจนจบได้ แต่รับงานใหม่ไม่ได้)
delete from rider_roster where email = 'somchai.k@mail.kmutt.ac.th';
```

คนหิ้วเข้าหน้า **โปรไฟล์ → โหมดคนหิ้ว** ในแอป ถือได้ไม่เกิน 4 งานต่อรอบ และเมื่อเริ่มส่งของแล้วจะรับงานใหม่ไม่ได้จนกว่าจะส่งครบ

**เปิดให้นักศึกษาทุกคนหิ้วในอนาคต:** แก้ฟังก์ชันเดียว ไม่ต้องแก้แอป

```sql
create or replace function public.is_rider() returns boolean
language sql stable security definer set search_path = public as $$
	select public.current_role_is('STUDENT')
$$;
```

## เพิ่มร้าน Partner

เจ้าของร้านไม่ใช่นักศึกษา จึงต้อง **เชิญด้วยอีเมล** ก่อน (รันใน SQL Editor):

```sql
insert into partner_invites (email, store_id) values ('owner@gmail.com', 'store-panee');
```

เจ้าของร้านกด **"สำหรับร้านค้า Partner เข้าสู่ระบบที่นี่"** ในหน้าล็อกอิน ด้วยอีเมลนั้น
ระบบจะผูกบัญชีกับร้าน ตั้งเป็น Partner และเปิดหน้า "จัดการร้านของฉัน" ให้

### อนุมัติโปรร่วม (Co-promotion)
โปรของร้าน (`DEAL`) ขึ้นแอปทันที ส่วน **โปรร่วมกับ Goose Man** (`CO_PROMO`) ต้องให้ทีมอนุมัติก่อน:

```sql
-- ดูโปรร่วมที่รออนุมัติ
select p.id, s.name, p.title, p.discount, p.free_delivery, p.min_qty
from promotions p join stores s on s.id = p.store_id
where p.kind = 'CO_PROMO' and not p.approved;

-- อนุมัติ
update promotions set approved = true where id = '<promotion-id>';
```
ถ้าร้านแก้เงื่อนไขโปรร่วมภายหลัง (ส่วนลด ขั้นต่ำ ฯลฯ) ระบบจะดึงกลับไปรออนุมัติใหม่อัตโนมัติ

## กฎที่ฐานข้อมูลบังคับเอง

- **ราคาคำนวณที่เซิร์ฟเวอร์:** `place_order` คิดราคาจากเมนูในฐานข้อมูล ไม่เชื่อยอดที่แอปส่งมา
- **โปรโมชัน:** ใช้โปรที่คุ้มที่สุด 1 โปรต่อออเดอร์ (ไม่ซ้อนกัน)
  - `GOOSEFREE` ไม่ลดค่าหิ้วซ้ำ ถ้าโปรร้านฟรีค่าหิ้วให้อยู่แล้ว
  - `KMUTTFIRST` ใช้ได้เฉพาะออเดอร์แรก
- **ห้ามแก้ออเดอร์ตรงๆ:** ทุกการเปลี่ยนสถานะต้องผ่านฟังก์ชัน ซึ่งตรวจทุกครั้งว่าใครเป็นคนเรียก
- **รับงานพร้อมกันไม่ได้:** ถ้าคนหิ้ว 2 คนกดรับงานพร้อมกัน มีคนได้คนเดียว
- **OTP:** เก็บในตารางแยกที่แอปอ่านตรงไม่ได้ ลูกค้าเห็นรหัสเฉพาะตอนที่ต้องใช้ ถ้าคนหิ้วกรอกผิด 5 ครั้งจะล็อกทันที
- **แชท:** เห็นได้เฉพาะลูกค้ากับคนหิ้วของออเดอร์นั้น
- **สิทธิ์ของตัวเอง:** ผู้ใช้เปลี่ยน role ของตัวเองไม่ได้ ร้าน Partner แก้ได้เฉพาะร้านตัวเอง

## ยังไม่มี (ต้องทำต่อ)

- **จำนวนเพื่อนที่ออนไลน์:** ยังไม่มีข้อมูลจริง ในโหมดจริงแอปจึงซ่อนตัวเลขนี้ไว้ แทนการแสดงตัวเลขปลอม
- **PromptPay:** QR ยังเป็นภาพจำลอง ยังไม่ได้ต่อกับระบบรับชำระเงินจริง
