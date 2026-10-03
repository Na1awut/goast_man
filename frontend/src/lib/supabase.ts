// Supabase client. When the public env vars are missing the app runs in demo
// mode on in-memory data, so the UI stays usable before a project exists.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/public';
import { isSimulation } from '$lib/sim';
import { t } from '$lib/i18n';

const REQUEST_TIMEOUT_MS = 15_000;

/** fetch that gives up, so a dead network can't hold a screen forever */
const fetchWithTimeout: typeof fetch = (input, init) => {
	const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
	const signal = init?.signal && 'any' in AbortSignal ? AbortSignal.any([init.signal, timeout]) : (init?.signal ?? timeout);
	return fetch(input, { ...init, signal });
};

/**
 * The page just came back from Google sign-in (PKCE code in the URL). Read before
 * the client is created, because the client removes the code once it signs in.
 */
export const returnedFromSignIn = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('code');

const url = env.PUBLIC_SUPABASE_URL?.trim();
const anonKey = env.PUBLIC_SUPABASE_ANON_KEY?.trim();

/** The test site never opens a connection to the real database, whatever keys the build has (see lib/sim.ts) */
export const supabase: SupabaseClient | null =
	url && anonKey && !isSimulation
		? createClient(url, anonKey, {
				auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
				global: { fetch: fetchWithTimeout }
			})
		: null;

/** true = real database, auth and realtime; false = local demo data */
export const isLive = supabase !== null;

/** Narrow to the client inside live-only code paths */
export function db(): SupabaseClient {
	if (!supabase) throw new Error('Supabase is not configured');
	return supabase;
}

/** Map a Postgres RAISE code from our RPCs to a message a student understands */
export function friendlyError(error: unknown): string {
	const text = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : String(error);
	const known: Record<string, string> = {
		KMUTT_ONLY: t('ใช้ได้เฉพาะอีเมล @kmutt.ac.th / @mail.kmutt.ac.th หรือร้าน Partner ที่ได้รับเชิญเท่านั้น'),
		// Supabase Auth hides the sign-up trigger's reason; the only thing that trigger rejects is a non-KMUTT email
		// (it also refuses unverified emails and sign-up floods: see 20261030_signup_guard.sql)
		'saving new user': t('สมัครไม่สำเร็จ ใช้ได้เฉพาะบัญชี มจธ. (@kmutt.ac.th / @mail.kmutt.ac.th) ผ่าน Google หรือ Microsoft ถ้าใช้บัญชี มจธ. อยู่แล้ว ลองใหม่อีกครั้งในอีก 1 นาที'),
		AUTH_REQUIRED: t('กรุณาเข้าสู่ระบบก่อน'),
		STORE_UNAVAILABLE: t('ร้านนี้ปิดรับออเดอร์อยู่ตอนนี้'),
		TOO_MANY_ITEMS: t('สั่งได้สูงสุด 5 ชิ้นต่อออเดอร์ (คนหิ้วถือได้เท่านี้)'),
		BAD_DROPOFF: t('เลือกจุดส่งใหม่อีกครั้ง'),
		BAD_FLOOR: t('เลือกชั้นใหม่อีกครั้ง'),
		TEST_MODE_OFF: t('ทีมปิดโหมดทดสอบแล้ว ชำระด้วยการโอนจริงแล้วแนบสลิป'),
		STORE_DELETED: t('ร้านนี้ถูกลบแล้ว ติดต่อทีม Goose Man'),
		ITEM_UNAVAILABLE: t('มีเมนูในตะกร้าที่หมดแล้ว ลองเอาออกแล้วสั่งใหม่'),
		STORE_LOCKED: t('ทีม Goose Man ปิดร้านนี้ไว้ชั่วคราว ร้านเปิดเองไม่ได้ ติดต่อทีมงานเพื่อเปิดอีกครั้ง'),
		STORE_STATE_CHANGED: t('สถานะร้านเพิ่งเปลี่ยน (อาจเป็นฝั่งทีมงาน) อัปเดตให้แล้ว ตรวจดูแล้วลองอีกครั้ง'),
		BAD_HOURS: t('เวลาเปิด-ปิดไม่ถูกต้อง เวลาเปิดต้องไม่เท่าเวลาปิด และเลือกวันอย่างน้อย 1 วัน'),
		NO_SCHEDULE: t('ยังไม่ได้ตั้งเวลาเปิด-ปิดอัตโนมัติ'),
		NO_RIDERS_ONLINE: t('ขณะนี้ไม่มีคนหิ้วเปิดรับงาน ไม่สามารถสร้าง QR ชำระเงินได้'),
		EMPTY_CART: t('ตะกร้ายังว่างอยู่'),
		PROMO_INVALID: t('โค้ดนี้ใช้ไม่ได้'),
		PROMO_NOT_STARTED: t('โค้ดนี้ยังไม่เริ่มใช้ได้'),
		PROMO_USES_UP: t('โค้ดนี้ถูกใช้ครบจำนวนแล้ว'),
		CANNOT_CANCEL: t('ยกเลิกไม่ได้แล้ว เพื่อนรับงานไปแล้ว'),
		CANNOT_RATE: t('ให้คะแนนได้เมื่อส่งมอบสำเร็จแล้วเท่านั้น'),
		PARTNER_ONLY: t('บัญชีนี้ไม่มีสิทธิ์จัดการร้าน'),
		TIMEOUT: t('เชื่อมต่อระบบช้าเกินไป ลองใหม่อีกครั้ง'),
		STUDENT_ID_TAKEN: t('รหัสนักศึกษานี้ถูกใช้กับบัญชีอื่นแล้ว ถ้าไม่ใช่คุณ ติดต่อทีม Goose Man'),
		BAD_PHONE: t('เบอร์มือถือไม่ถูกต้อง'),
		BAD_PROMPTPAY: t('หมายเลข PromptPay ไม่ถูกต้อง'),
		BAD_STUDENT_ID: t('รหัสนักศึกษาไม่ถูกต้อง'),
		BAD_NICKNAME: t('ชื่อเล่นไม่ถูกต้อง'),
		BAD_FACULTY: t('กรุณาเลือกคณะ'),
		BAD_STUDY_LEVEL: t('กรุณาเลือกชั้นปี'),
		CONSENT_REQUIRED: t('ต้องยอมรับเงื่อนไขก่อนใช้งาน'),
		BAD_IMAGE: t('รูปต้องอัปโหลดผ่านแอปเท่านั้น ลองเลือกรูปใหม่อีกครั้ง'),
		RIDER_ONLY: t('บัญชีนี้ยังไม่ได้อยู่ในรายชื่อคนหิ้ว'),
		PROFILE_REQUIRED: t('กรอกข้อมูลผู้ใช้ (ชื่อเล่น เบอร์ คณะ) ก่อน แล้วลองอีกครั้ง'),
		RIDER_FULL: t('รอบนี้ถือครบ 4 งานแล้ว ส่งให้ครบก่อนค่อยรับเพิ่ม'),
		FINISH_ROUND_FIRST: t('เริ่มส่งของแล้ว ส่งรอบนี้ให้ครบก่อนค่อยรับงานใหม่'),
		ALREADY_TAKEN: t('มีเพื่อนรับงานนี้ไปแล้ว'),
		BAD_STATE: t('สถานะงานเปลี่ยนไปแล้ว ลองรีเฟรชอีกครั้ง'),
		OTP_LOCKED: t('ใส่รหัสผิดครบ 5 ครั้งแล้ว งานนี้ถูกล็อก ติดต่อทีม Goose Man'),
		STUDENT_ONLY: t('สมัครเป็นคนหิ้วได้เฉพาะบัญชีนักศึกษา มจธ.'),
		ALREADY_RIDER: t('บัญชีนี้เป็นคนหิ้วอยู่แล้ว ลองรีเฟรชหน้าแอป'),
		APPLICATION_PENDING: t('ส่งใบสมัครไปแล้ว รอทีมติดต่อกลับนะ'),
		BAD_AVAILABILITY: t('เลือกวันและช่วงเวลาที่ว่างก่อน'),
		NOTE_TOO_LONG: t('ข้อความยาวเกินไป (ไม่เกิน 300 ตัวอักษร)'),
		BAD_TIP: t('ยอดทิปไม่ถูกต้อง ลองกดปัดเศษใหม่อีกครั้ง'),
		ITEM_NOT_FOUND: t('ไม่พบเมนูนี้ในร้านของคุณ'),
		BAD_ITEM_NAME: t('ชื่อเมนูต้องมี 1-80 ตัวอักษร'),
		BAD_CATEGORY: t('ใส่หมวดหมู่ (ไม่เกิน 40 ตัวอักษร)'),
		BAD_PRICE: t('ราคาต้องอยู่ระหว่าง 1-2,000 บาท'),
		BAD_SPECIAL_PRICE: t('ราคาพิเศษต้องมากกว่าราคาธรรมดา (ไม่เกิน 2,000 บาท)'),
		BAD_STORE_NAME: t('ชื่อร้านต้องมี 1-60 ตัวอักษร'),
		BAD_QUEUE: t('เวลาคิวต้องอยู่ระหว่าง 0-120 นาที'),
		NOT_STORE_OWNER: t('คุณไม่ใช่เจ้าของร้านนี้ ติดต่อทีมเพื่อขอสิทธิ์'),
		STORE_NOT_FOUND: t('ไม่พบร้านค้านี้ในระบบ'),
		STORE_ALREADY_OWNED: t('ร้านนี้มีเจ้าของดูแลอยู่แล้ว'),
		CLAIM_NEEDS_INVITE: t('ร้านนี้ต้องให้ทีม Goose Man ส่งคำเชิญถึงอีเมลของคุณก่อน'),
		STORE_PENDING_REVIEW: t('ร้านรอทีม Goose Man ตรวจก่อน ทีมจะเปิดให้ลูกค้าเห็นแล้วแจ้งกลับ'),
		OPTION_CHANGED: t('ตัวเลือกของเมนูเปลี่ยนไปแล้ว ลองเอาออกจากตะกร้าแล้วเลือกใหม่'),
		FREE_DELIVERY_NEEDS_TEAM: t('โปรของร้านลดได้เฉพาะค่าอาหาร ค่าหิ้วเป็นของคนหิ้ว'),
		STORE_DEALS_ONLY: t('ร้านสร้างได้เฉพาะโปรของร้าน (โปรร่วมเลิกใช้แล้ว)'),
		SLIPOK_NOT_CONFIGURED: t('ยังไม่เปิดรับชำระผ่าน PromptPay ใช้เงินสดไปก่อนนะ'),
		SLIPOK_UNAVAILABLE: t('ระบบตรวจสลิปขัดข้องชั่วคราว ลองแนบใหม่อีกครั้ง'),
		SLIP_USED: t('สลิปนี้ถูกใช้ไปแล้ว ใช้สลิปของการโอนครั้งนี้'),
		SLIP_AMOUNT_MISMATCH: t('ยอดในสลิปไม่ตรงกับยอดที่ต้องชำระ'),
		SLIP_WRONG_RECEIVER: t('สลิปนี้ไม่ได้โอนเข้าบัญชี Goose Man'),
		SLIP_TOO_LARGE: t('รูปสลิปใหญ่เกินไป (ไม่เกิน 5 MB)'),
		SLIP_INVALID: t('อ่านสลิปไม่ได้ ลองเลือกรูปสลิปที่ชัดกว่านี้'),
		SLIP_NOT_IMAGE: t('ไฟล์นี้ไม่ใช่รูปภาพ เลือกรูปสลิปหรือสกรีนช็อตจากแอปธนาคาร'),
		SLIP_ALREADY_QUEUED: t('ส่งสลิปไปแล้ว กำลังตรวจอยู่ รอสักครู่ ไม่ต้องส่งซ้ำ'),
		SLIP_UNDER_REVIEW: t('ทีมงานกำลังตรวจสลิปของคุณ ไม่ต้องโอนซ้ำ จะแจ้งเมื่อเสร็จ'),
		TOO_MANY_ATTEMPTS: t('ส่งสลิปครบ 5 ครั้งแล้ว ติดต่อทีมงานให้ช่วยตรวจ'),
		RATE_LIMITED: t('ส่งสลิปถี่เกินไป รอ 10 นาทีแล้วลองใหม่ หรือติดต่อทีมงาน'),
		UPLOAD_FAILED: t('อัปโหลดสลิปไม่สำเร็จ ลองใหม่อีกครั้ง'),
		TOO_MANY_UNPAID: t('มีออเดอร์ PromptPay ที่ยังไม่ชำระครบ 3 รายการแล้ว ชำระหรือยกเลิกอันเก่าก่อน'),
		ALREADY_PAID: t('ออเดอร์นี้ชำระแล้ว'),
		ORDER_NOT_PAYABLE: t('ออเดอร์นี้ชำระด้วย PromptPay ไม่ได้แล้ว'),
		ORDER_NOT_FOUND: t('ไม่พบออเดอร์นี้'),
		CALL_NOT_ALLOWED: t('โทรผ่านแอปได้เฉพาะตอนออเดอร์กำลังดำเนินการ'),
		CALL_BUSY: t('มีสายที่กำลังโทรอยู่แล้ว ลองใหม่อีกครั้ง'),
		CALL_GONE: t('สายนี้จบไปแล้ว'),
		// Auth / session errors from Supabase (refresh token failure, JWT expired)
		'JWT expired': t('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'),
		'Invalid Refresh Token': t('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'),
		'Refresh Token Not Found': t('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'),
		'invalid claim': t('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'),
		'Auth session missing': t('กรุณาเข้าสู่ระบบก่อน'),
		'not_authenticated': t('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'),
		'401': t('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่')
	};
	const code = Object.keys(known).find((k) => text.includes(k));
	if (code) return known[code];
	if (typeof navigator !== 'undefined' && !navigator.onLine) return t('ไม่มีอินเทอร์เน็ต ลองใหม่เมื่อสัญญาณกลับมา');
	return t('เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง');
}
