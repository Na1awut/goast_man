// Supabase client. When the public env vars are missing the app runs in demo
// mode on in-memory data, so the UI stays usable before a project exists.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/public';

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

export const supabase: SupabaseClient | null =
	url && anonKey
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
		KMUTT_ONLY: 'ใช้ได้เฉพาะอีเมล @kmutt.ac.th / @mail.kmutt.ac.th หรือร้าน Partner ที่ได้รับเชิญเท่านั้น',
		// Supabase Auth hides the sign-up trigger's reason; the only thing that trigger rejects is a non-KMUTT email
		'saving new user': 'ใช้ได้เฉพาะอีเมล @kmutt.ac.th / @mail.kmutt.ac.th กรุณาเลือกบัญชี มจธ.',
		AUTH_REQUIRED: 'กรุณาเข้าสู่ระบบก่อน',
		STORE_UNAVAILABLE: 'ร้านนี้ปิดรับออเดอร์อยู่ตอนนี้',
		TOO_MANY_ITEMS: 'สั่งได้สูงสุด 5 ชิ้นต่อออเดอร์ (คนหิ้วถือได้เท่านี้)',
		BAD_DROPOFF: 'เลือกจุดส่งใหม่อีกครั้ง',
		BAD_FLOOR: 'เลือกชั้นใหม่อีกครั้ง',
		TEST_MODE_OFF: 'ทีมปิดโหมดทดสอบแล้ว ชำระด้วยการโอนจริงแล้วแนบสลิป',
		STORE_DELETED: 'ร้านนี้ถูกลบแล้ว ติดต่อทีม Goose Man',
		ITEM_UNAVAILABLE: 'มีเมนูในตะกร้าที่หมดแล้ว ลองเอาออกแล้วสั่งใหม่',
		EMPTY_CART: 'ตะกร้ายังว่างอยู่',
		PROMO_INVALID: 'โค้ดนี้ใช้ไม่ได้',
		PROMO_NOT_STARTED: 'โค้ดนี้ยังไม่เริ่มใช้ได้',
		PROMO_USES_UP: 'โค้ดนี้ถูกใช้ครบจำนวนแล้ว',
		CANNOT_CANCEL: 'ยกเลิกไม่ได้แล้ว เพื่อนรับงานไปแล้ว',
		CANNOT_RATE: 'ให้คะแนนได้เมื่อส่งมอบสำเร็จแล้วเท่านั้น',
		PARTNER_ONLY: 'บัญชีนี้ไม่มีสิทธิ์จัดการร้าน',
		TIMEOUT: 'เชื่อมต่อระบบช้าเกินไป ลองใหม่อีกครั้ง',
		STUDENT_ID_TAKEN: 'รหัสนักศึกษานี้ถูกใช้กับบัญชีอื่นแล้ว ถ้าไม่ใช่คุณ ติดต่อทีม Goose Man',
		BAD_PHONE: 'เบอร์มือถือไม่ถูกต้อง',
		BAD_PROMPTPAY: 'หมายเลข PromptPay ไม่ถูกต้อง',
		BAD_STUDENT_ID: 'รหัสนักศึกษาไม่ถูกต้อง',
		BAD_NICKNAME: 'ชื่อเล่นไม่ถูกต้อง',
		BAD_FACULTY: 'กรุณาเลือกคณะ',
		BAD_STUDY_LEVEL: 'กรุณาเลือกชั้นปี',
		CONSENT_REQUIRED: 'ต้องยอมรับเงื่อนไขก่อนใช้งาน',
		BAD_IMAGE: 'รูปต้องอัปโหลดผ่านแอปเท่านั้น ลองเลือกรูปใหม่อีกครั้ง',
		RIDER_ONLY: 'บัญชีนี้ยังไม่ได้อยู่ในรายชื่อคนหิ้ว',
		PROFILE_REQUIRED: 'กรอกข้อมูลผู้ใช้ (ชื่อเล่น เบอร์ คณะ) ก่อน แล้วลองอีกครั้ง',
		RIDER_FULL: 'รอบนี้ถือครบ 4 งานแล้ว ส่งให้ครบก่อนค่อยรับเพิ่ม',
		FINISH_ROUND_FIRST: 'เริ่มส่งของแล้ว ส่งรอบนี้ให้ครบก่อนค่อยรับงานใหม่',
		ALREADY_TAKEN: 'มีเพื่อนรับงานนี้ไปแล้ว',
		BAD_STATE: 'สถานะงานเปลี่ยนไปแล้ว ลองรีเฟรชอีกครั้ง',
		OTP_LOCKED: 'ใส่รหัสผิดครบ 5 ครั้งแล้ว งานนี้ถูกล็อก ติดต่อทีม Goose Man',
		STUDENT_ONLY: 'สมัครเป็นคนหิ้วได้เฉพาะบัญชีนักศึกษา มจธ.',
		ALREADY_RIDER: 'บัญชีนี้เป็นคนหิ้วอยู่แล้ว ลองรีเฟรชหน้าแอป',
		APPLICATION_PENDING: 'ส่งใบสมัครไปแล้ว รอทีมติดต่อกลับนะ',
		BAD_AVAILABILITY: 'เลือกวันและช่วงเวลาที่ว่างก่อน',
		NOTE_TOO_LONG: 'ข้อความยาวเกินไป (ไม่เกิน 300 ตัวอักษร)',
		BAD_TIP: 'ยอดทิปไม่ถูกต้อง ลองกดปัดเศษใหม่อีกครั้ง',
		ITEM_NOT_FOUND: 'ไม่พบเมนูนี้ในร้านของคุณ',
		BAD_ITEM_NAME: 'ชื่อเมนูต้องมี 1-80 ตัวอักษร',
		BAD_CATEGORY: 'ใส่หมวดหมู่ (ไม่เกิน 40 ตัวอักษร)',
		BAD_PRICE: 'ราคาต้องอยู่ระหว่าง 1-2,000 บาท',
		BAD_SPECIAL_PRICE: 'ราคาพิเศษต้องมากกว่าราคาธรรมดา (ไม่เกิน 2,000 บาท)',
		BAD_STORE_NAME: 'ชื่อร้านต้องมี 1-60 ตัวอักษร',
		BAD_QUEUE: 'เวลาคิวต้องอยู่ระหว่าง 0-120 นาที',
		FREE_DELIVERY_NEEDS_TEAM: 'โปรของร้านลดได้เฉพาะค่าอาหาร ค่าหิ้วเป็นของคนหิ้ว',
		STORE_DEALS_ONLY: 'ร้านสร้างได้เฉพาะโปรของร้าน (โปรร่วมเลิกใช้แล้ว)',
		SLIPOK_NOT_CONFIGURED: 'ยังไม่เปิดรับชำระผ่าน PromptPay ใช้เงินสดไปก่อนนะ',
		SLIPOK_UNAVAILABLE: 'ระบบตรวจสลิปขัดข้องชั่วคราว ลองแนบใหม่อีกครั้ง',
		SLIP_USED: 'สลิปนี้ถูกใช้ไปแล้ว ใช้สลิปของการโอนครั้งนี้',
		SLIP_AMOUNT_MISMATCH: 'ยอดในสลิปไม่ตรงกับยอดที่ต้องชำระ',
		SLIP_WRONG_RECEIVER: 'สลิปนี้ไม่ได้โอนเข้าบัญชี Goose Man',
		SLIP_TOO_LARGE: 'รูปสลิปใหญ่เกินไป (ไม่เกิน 5 MB)',
		SLIP_INVALID: 'อ่านสลิปไม่ได้ ลองเลือกรูปสลิปที่ชัดกว่านี้',
		ALREADY_PAID: 'ออเดอร์นี้ชำระแล้ว',
		ORDER_NOT_PAYABLE: 'ออเดอร์นี้ชำระด้วย PromptPay ไม่ได้แล้ว',
		ORDER_NOT_FOUND: 'ไม่พบออเดอร์นี้',
		// Auth / session errors from Supabase (refresh token failure, JWT expired)
		'JWT expired': 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่',
		'Invalid Refresh Token': 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่',
		'Refresh Token Not Found': 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่',
		'invalid claim': 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่',
		'Auth session missing': 'กรุณาเข้าสู่ระบบก่อน',
		'not_authenticated': 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่',
		'401': 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'
	};
	const code = Object.keys(known).find((k) => text.includes(k));
	return code ? known[code] : 'เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง';
}
