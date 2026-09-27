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
| `migrations/20261003000000_rider_tools.sql` | คนหิ้ว: พร้อมรับงาน, ใบสมัครคนหิ้ว, ทิปปัดเศษรวมในยอดโอน |
| `migrations/20261004000000_partner_dashboard.sql` | ร้านค้า: ยอดขายของร้านตัวเอง, เปิด/ปิดร้าน, กดเมนูหมด |
| `migrations/20261005000000_team_personal_email.sql` | ทีมงานสมัคร/login ด้วยอีเมลส่วนตัวได้ ถ้า ADMIN เพิ่มอีเมลไว้ |
| `migrations/20261006000000_partner_menu.sql` | ร้านเพิ่ม/แก้/ลบเมนู ใส่รูป และแก้ข้อมูลร้านเอง |
| `migrations/20261007000000_free_delivery_team_only.sql` | ร้านตั้งโปรฟรีค่าหิ้วเองไม่ได้ |
| `migrations/20261011000000_female_dorm_zone.sql` | โซนโรงอาหารหอหญิง |
| `data/female_dorm_stores.sql` | ร้านจริงโรงอาหารหอหญิง 6 ร้าน (รันหลัง migration ครบ ซ่อนไว้ก่อน รันซ้ำได้) |
| `migrations/20261012000000_cb1_zone.sql` | โซนอาคาร CB1; ต้อง commit ก่อนนำเข้าร้าน |
| `migrations/20261013000000_male_dorm_zone.sql` | โซนโรงอาหารหอชาย |
| `migrations/20261014000000_payment_test_mode.sql` | โหมดทดสอบจ่าย QR: ADMIN เปิด/ปิดจากหน้าตั้งค่า ระหว่างเปิดลูกค้ากด "จ่ายแบบทดสอบ" ได้โดยไม่โอนเงินจริง (อ้างอิง `TEST:<รหัสออเดอร์>`) |
| `data/male_dorm_stores.sql` | ร้านจริงโรงอาหารหอชาย 3 ร้าน / 111 เมนู (รันหลัง migration ครบ ซ่อนไว้ก่อน รันซ้ำได้) |
| `data/loongnoom_square.sql` | ลุงหนุ่ม Square ที่ CB1: 87 เมนู / 10 หมวด พร้อมรูป; [รายละเอียดและรายการรอยืนยัน](data/loongnoom_square.md) |
| `migrations/20261010000000_store_recycle_bin.sql` | ถังขยะร้าน: ลบ, กู้คืนใน 60 วัน, ลบถาวรเอง (pg_cron ทุกคืน) |
| `migrations/20261009000000_team_store_editing.sql` | ทีมสร้างร้าน แก้ทุกร้าน ซ่อนร้าน และล้างเมนู |
| `migrations/20261008000000_store_discount.sql` | ส่วนลดใครออก (`store_discount`) และเลิกโปรร่วม |
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
   10. `migrations/20261003000000_rider_tools.sql`
   11. `migrations/20261004000000_partner_dashboard.sql`
   12. `migrations/20261005000000_team_personal_email.sql`
   13. `migrations/20261006000000_partner_menu.sql`
   14. `migrations/20261007000000_free_delivery_team_only.sql`
   15. `migrations/20261008000000_store_discount.sql`
   16. `migrations/20261009000000_team_store_editing.sql`
   17. `migrations/20261010000000_store_recycle_bin.sql`
   18. `migrations/20261011000000_female_dorm_zone.sql`
   19. `migrations/20261012000000_cb1_zone.sql`
   20. `migrations/20261013000000_male_dorm_zone.sql`
   21. `migrations/20261014000000_payment_test_mode.sql`
   21. `seed.sql`
3. เพิ่ม ADMIN คนแรกของหน้าทีมงาน (คนต่อไป ADMIN เพิ่มเองในหน้าทีมงาน):
   ```sql
   insert into team_members (email, role, note) values ('<อีเมล มจธ.>', 'ADMIN', 'first admin');
   ```

**โปรเจกต์ที่ใช้อยู่ (`pguhzjtdwgualqeqzleu`):** รันครบถึง `20261014000000_payment_test_mode.sql` (โหมดทดสอบจ่าย QR ปิดอยู่) และใส่ `data/female_dorm_stores.sql`, `data/loongnoom_square.sql` กับ `data/male_dorm_stores.sql` แล้ว ร้านที่ใช้งาน 10 ร้าน / 284 เมนู (ร้าน KFC mockup 12 ร้านอยู่ในถังขยะ) ณ 27 กันยายน 2569 ร้านนำเข้าเริ่มซ่อนและปิดรับออเดอร์ (เปิด pg_cron แล้ว งาน `purge-deleted-stores` ทุกคืนตี 3) (รันด้วย `npx supabase db query --linked --project-ref pguhzjtdwgualqeqzleu -f <ไฟล์>` ได้ หลัง `npx supabase login`) ADMIN คนแรกคือ `natthawut.napa@mail.kmutt.ac.th`

**บันทึก deploy 27 กันยายน 2569:** รัน `client_errors_deploy.sql` แล้วต่อด้วย `rider_tools_deploy.sql` ผ่าน Supabase CLI ไปยังโปรเจกต์ `goose-man` แต่ละไฟล์ครอบด้วย `begin;` … `commit;` และสำเร็จแล้ว ตรวจหลัง deploy พบตาราง `client_errors`, `rider_presence`, `rider_applications` เปิด RLS, คอลัมน์ `orders.tip_in_total` และฟังก์ชันครบ ตรวจสิทธิ์การเรียกฟังก์ชันและสูตรทิปผ่าน ส่วน API `riders_online` ตอบ HTTP 200 และค่า `0` ณ เวลาตรวจ ก่อน deploy ชุดทดสอบ SQL ในเครื่องผ่าน 233 รายการ ไม่ได้สร้างออเดอร์หรือใบสมัครทดสอบบนฐานข้อมูลจริง **ไม่ต้องรันสองไฟล์นี้ซ้ำ** เพราะคำสั่งสร้างตาราง/เพิ่มคอลัมน์ไม่ได้รองรับการรันซ้ำ

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
คนที่อยู่ในรายชื่อจะเห็นปุ่ม "โหมดคนหิ้ว" ในหน้าโปรไฟล์ (ถ้า login อยู่ตอนที่ถูกเพิ่ม ให้รีเฟรชหน้าแอป) · ทีมโอนค่าหิ้วเข้าเลข PromptPay ในโปรไฟล์ หรือเบอร์มือถือถ้าไม่ได้ใส่

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

### โปรของร้าน
ร้านตั้งโปรของร้าน (`DEAL`) เองในแอป ขึ้นทันที และ **ร้านเป็นคนออกส่วนลด** (คนหิ้วจ่ายหน้าร้านในราคาที่ลดแล้ว) ลดได้เฉพาะค่าอาหาร ฟรีค่าหิ้วไม่ได้ · ส่วนลดของแอปคือโค้ดส่วนลด (`KMUTTFIRST`, `GOOSEFREE`) ใช้ได้ทุกร้าน แอปออกเงิน · **โปรร่วม (`CO_PROMO`) เลิกใช้แล้ว** ฐานข้อมูลปฏิเสธถ้าร้านสร้าง
ADMIN ปิดโปรที่ไม่เหมาะสมได้ที่หน้าทีมงาน → Partner และโปร หรือ `update promotions set active = false where id = '<promotion-id>';`

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
