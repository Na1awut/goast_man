# Supabase สำหรับ Goose Man

ฐานข้อมูล, ระบบล็อกอิน, อัปเดตสถานะแบบเรียลไทม์ และที่เก็บรูป ของแอป Goose Man
(ใช้แทน backend Go เดิมในโฟลเดอร์ `backend/` ซึ่งเก็บไว้อ้างอิงเท่านั้น)

ถ้ายังไม่ได้ตั้งค่า แอปจะรันด้วย **ข้อมูลเดโม** ตามปกติ พอใส่ key ใน `.env` แอปจะสลับไปใช้ข้อมูลจริงเอง

## ไฟล์ในโฟลเดอร์นี้

| ไฟล์ | คืออะไร |
|---|---|
| `migrations/20260924000000_init.sql` | ตาราง, สิทธิ์การเข้าถึง (RLS), ฟังก์ชันสั่งอาหาร/รับงาน/ยืนยัน OTP, Realtime, ที่เก็บรูป |
| `migrations/20260925000000_profile_onboarding.sql` | ฟอร์มข้อมูลผู้ใช้, ตรวจเบอร์/รหัสนักศึกษา, บันทึกการยินยอม PDPA |
| `migrations/20260926000000_riders.sql` | รายชื่อคนหิ้ว, จำกัด 4 งานต่อรอบ, คืนงาน, ข้อมูลหน้าคนหิ้ว |
| `migrations/20260927000000_store_images.sql` | โลโก้และรูปหน้าร้านที่ร้าน Partner ตั้งเอง |
| `migrations/20260928000000_kfc_menu_sizes.sql` | โซนโรงอาหาร KFC (หลัก), เมนูขนาดธรรมดา/พิเศษ |
| `migrations/20260929000000_profile_at_first_order.sql` | ไม่ต้องกรอกข้อมูลตอนล็อกอิน แต่ต้องมีข้อมูลครบก่อนสั่งหรือรับงาน |
| `migrations/20260930000000_promptpay_slips.sql` | PromptPay: สถานะจ่ายเงิน, กันสลิปซ้ำ, ซ่อนออเดอร์ที่ยังไม่จ่ายจากคนหิ้ว, รายการเงินที่ต้องโอนให้คนหิ้ว |
| `migrations/20261001000000_team_console.sql` | หน้าทีมงาน: รายชื่อทีม (ADMIN / STAFF), บันทึกการทำงาน, ฟังก์ชัน `admin_*` ทุกปุ่ม |
| `migrations/20261002000000_client_errors.sql` | Error log: error จากเว็บ รวมเป็นกลุ่ม ให้ทีมดูในหน้าทีมงาน |
| `functions/verify-slip/` | Edge Function ตรวจสลิปกับ SlipOK แล้วบันทึกว่าจ่ายแล้ว |
| `seed.sql` | ร้านจริง 12 ร้านของโรงอาหาร KFC (หลัก) และเมนู (สร้างจาก `frontend/src/lib/data/stores.ts`) |
| `generate-seed.mjs` | สร้าง `seed.sql` ใหม่หลังแก้ข้อมูลร้านในแอป: `node supabase/generate-seed.mjs` |

## ตั้งค่าครั้งแรก

### 1. สร้างโปรเจกต์
1. สมัคร/เข้า [supabase.com](https://supabase.com) → **New project** (เลือก Region: Singapore จะเร็วสุดสำหรับไทย)
2. เปิด **SQL Editor** แล้วรันไฟล์ตามลำดับนี้ (วางเนื้อหาทีละไฟล์ → **Run**)
   1. `migrations/20260924000000_init.sql`
   2. `migrations/20260925000000_profile_onboarding.sql`
   3. `migrations/20260926000000_riders.sql`
   4. `migrations/20260927000000_store_images.sql`
   5. `migrations/20260928000000_kfc_menu_sizes.sql` (ต้องกด Run ไฟล์นี้แยกก่อน `seed.sql`)
   6. `migrations/20260929000000_profile_at_first_order.sql`
   7. `migrations/20260930000000_promptpay_slips.sql`
   8. `migrations/20261001000000_team_console.sql`
   9. `migrations/20261002000000_client_errors.sql`
   10. `seed.sql`
3. เพิ่ม ADMIN คนแรกของหน้าทีมงาน (คนต่อไป ADMIN เพิ่มเองในหน้าทีมงาน):
   ```sql
   insert into team_members (email, role, note) values ('<อีเมล มจธ.>', 'ADMIN', 'first admin');
   ```

**โปรเจกต์ที่ใช้อยู่ (`pguhzjtdwgualqeqzleu`):** รันถึง `20261001000000_team_console.sql` แล้ว ADMIN คนแรกคือ `natthawut.napa@mail.kmutt.ac.th` · **ยังต้องรัน `20261002000000_client_errors.sql`** (ครอบด้วย `begin;` … `commit;` ถ้ามี error จะไม่มีอะไรเปลี่ยน)

### 2. เปิดล็อกอินด้วย Google
1. ที่ [Google Cloud Console](https://console.cloud.google.com/apis/credentials) สร้าง **OAuth client ID** (ประเภท Web application)
   - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
2. ใน Supabase: **Authentication → Providers → Google** → เปิดใช้ แล้วใส่ Client ID / Client Secret
3. **Authentication → URL Configuration**
   - Site URL: โดเมนจริงของแอป (หรือ `http://localhost:5173` ตอนพัฒนา)
   - Redirect URLs: เพิ่ม `http://localhost:5173` และโดเมนจริง
   - ตอนนี้ตั้งไว้: Site URL `https://goose-man.tech` · Redirect URLs `goose-man.tech/**`, `www.goose-man.tech/**`, `goastman.dev/**`, `www.goastman.dev/**` (หน้าทีมงาน), ลิงก์ Vercel และ `localhost:5173/**`, `localhost:5174/**`
   - ถ้า login แล้วเด้งไป localhost แปลว่า Site URL ยังเป็น localhost หรือโดเมนที่เปิดไม่อยู่ใน Redirect URLs

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

ตอนนี้ให้เฉพาะทีมเราหิ้ว ใครจะหิ้วได้ต้องมีอีเมลอยู่ในตาราง `rider_roster`

**ปกติทำในหน้าทีมงาน → คนหิ้ว (ADMIN)** จะบันทึกว่าใครเพิ่มและเหตุผลที่นำออก · SQL ด้านล่างใช้สำรอง (รันใน SQL Editor):

```sql
-- เพิ่มคนหิ้ว (ใช้อีเมล มจธ. ที่เขาล็อกอิน สมัครก่อนหรือหลังเพิ่มก็ได้)
insert into rider_roster (email, note) values ('somchai.k@mail.kmutt.ac.th', 'ทีมงาน');

-- ดูรายชื่อ
select * from rider_roster order by added_at;

-- เอาออก (งานที่ถืออยู่ยังส่งต่อจนจบได้ แต่รับงานใหม่ไม่ได้)
delete from rider_roster where email = 'somchai.k@mail.kmutt.ac.th';
```

คนหิ้วต้องผ่านการ verify จากทีมก่อนจึงเพิ่มชื่อในตารางนี้ ถือได้ไม่เกิน 4 งานต่อรอบ และเมื่อเริ่มส่งของแล้วจะรับงานใหม่ไม่ได้จนกว่าจะส่งครบ
(หน้าโหมดคนหิ้วในแอปสร้างไว้แล้ว แต่ตอนนี้ยังไม่มีทางเข้า ดู `PROJECT_GUIDE.md` ข้อ 19)

**ถ้าวันหนึ่งจะเปิดให้นักศึกษาทุกคนหิ้วโดยไม่ต้อง verify:** แก้ฟังก์ชันเดียว ไม่ต้องแก้แอป (นโยบายตอนนี้คือต้อง verify ก่อน)

```sql
create or replace function public.is_rider() returns boolean
language sql stable security definer set search_path = public as $$
	select public.current_role_is('STUDENT')
$$;
```

## เพิ่มร้าน Partner

เจ้าของร้านไม่ใช่นักศึกษา จึงต้อง **เชิญด้วยอีเมล** ก่อน · **ปกติทำในหน้าทีมงาน → Partner และโปร → เชิญร้าน (ADMIN)** หรือรันใน SQL Editor:

```sql
insert into partner_invites (email, store_id) values ('owner@gmail.com', 'kfc-05');
```

เจ้าของร้านกด **"สำหรับร้านค้า Partner เข้าสู่ระบบที่นี่"** ในหน้าล็อกอิน ด้วยอีเมลนั้น
ระบบจะผูกบัญชีกับร้าน ตั้งเป็น Partner และเปิดหน้า "จัดการร้านของฉัน" ให้

### อนุมัติโปรร่วม (Co-promotion)
โปรของร้าน (`DEAL`) ขึ้นแอปทันที ส่วน **โปรร่วมกับ Goose Man** (`CO_PROMO`) ต้องให้ทีมอนุมัติก่อน · **ปกติทำในหน้าทีมงาน → Partner และโปร (ADMIN)** หรือใช้ SQL:

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
- **หน้าทีมงาน:** ทุกฟังก์ชัน `admin_*` ตรวจว่าคนเรียกอยู่ใน `team_members` (บางอันต้องเป็น ADMIN) และบันทึก `admin_log` · ไม่มีฟังก์ชันไหนคืน OTP · เปลี่ยน/ลบตัวเองไม่ได้ และลบ ADMIN คนสุดท้ายไม่ได้
- **Error log:** ทุกคนส่ง error เข้าได้ผ่าน `log_client_error` แต่อ่านตารางตรงไม่ได้ · ข้อความถูกตัดความยาว, error ใหม่เกิน 30 แบบต่อนาทีถูกทิ้ง, เก็บ 30 วัน

## ยังไม่มี (ต้องทำต่อ)

- **จำนวนเพื่อนที่ออนไลน์:** ยังไม่มีข้อมูลจริง ในโหมดจริงแอปจึงซ่อนตัวเลขนี้ไว้ แทนการแสดงตัวเลขปลอม
- **PromptPay:** ระบบเสร็จแล้ว รอใส่ SlipOK secret และเลข PromptPay ของทีม (หัวข้อถัดไป) ระหว่างนี้เว็บจริงรับเงินสดอย่างเดียว

## PromptPay + SlipOK (รับเงินเข้าบัญชีทีม)

ผู้ซื้อโอนเข้า PromptPay ของทีม แนบสลิป แล้ว Edge Function `verify-slip` ตรวจกับ SlipOK
(ยอดตรง, เข้าบัญชีทีมจริง, สลิปไม่ซ้ำ) ผ่านแล้วออเดอร์จึงขึ้นให้คนหิ้วเห็น

### ตั้งค่าครั้งแรก
1. **Deploy function** (ต้องมี Supabase access token):
   ```sh
   SUPABASE_ACCESS_TOKEN=<token> npx supabase functions deploy verify-slip --project-ref <project-ref> --use-api
   ```
2. **ใส่ secret** ที่ Supabase → Edge Functions → Secrets (ห้ามใส่ในแอปหรือ Vercel):
   - `SLIPOK_API_KEY`: API key จาก SlipOK
   - `SLIPOK_BRANCH_ID`: เลข Branch ใน SlipOK ที่ผูกกับบัญชี PromptPay ของทีม
3. **เปิดในแอป** ที่ Vercel → Settings → Environment Variables แล้ว Redeploy:
   - `PUBLIC_PROMPTPAY_API_URL` = `https://<project-ref>.supabase.co/functions/v1/verify-slip`
   - `PUBLIC_PROMPTPAY_ID` = เลข PromptPay ของทีม (บัญชีเดียวกับที่ผูกใน SlipOK)
   - `PUBLIC_PROMPTPAY_NAME` = ชื่อบัญชีที่ให้ผู้ซื้อเห็น (ไม่บังคับ)

   ถ้าขาดตัวใดตัวหนึ่ง เว็บจริงจะซ่อน PromptPay และให้จ่ายเงินสดอย่างเดียว

### โอนเงินให้คนหิ้ว (หลังคนหิ้วกรอก OTP สำเร็จ)

**ปกติทำในหน้าทีมงาน → การเงิน:** เห็นยอดต่อคนพร้อม QR PromptPay ของคนหิ้ว โอนแล้วใส่เลขอ้างอิง ระบบคำนวณยอดใหม่ตอนบันทึกเพื่อกันยอดเปลี่ยนระหว่างนั้น · SQL สำรอง:

```sql
-- ดูว่าต้องโอนให้ใครเท่าไร (PromptPay: ค่าอาหาร + ค่าหิ้ว · เงินสด: เฉพาะส่วนลดที่ผู้ซื้อไม่ได้จ่าย)
select rider_name, rider_promptpay, order_code, owed, completed_at from rider_payouts_due();

-- ยอดรวมต่อคน
select rider_name, rider_promptpay, sum(owed) as total from rider_payouts_due() group by 1, 2;

-- โอนแล้ว: บันทึกเลขอ้างอิงการโอน รายการจะหายจากลิสต์
select mark_payout_paid(array(select order_id from rider_payouts_due() where rider_name = 'เฟิร์น'), 'KBANK-0001');
```
ทิปยังไม่รวม เพราะยังไม่มีช่องให้ผู้ซื้อจ่ายทิปเข้ามา · ยกเลิกหลังจ่ายแล้ว ออเดอร์จะขึ้นในหน้าทีมงาน → การเงิน → คืนเงิน ให้ทีมโอนคืนเองแล้วบันทึกเลขอ้างอิง
