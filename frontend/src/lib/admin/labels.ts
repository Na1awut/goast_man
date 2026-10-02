// Thai vocabulary of the team console: order stages, problems, log actions.
import type { Attention, AttentionCode, OrdersTab, PromoState, Stage } from './types';

/** One colour per stage, used by the pill and the donut alike */
export const STAGE: Record<Stage, { label: string; pill: string; dot: string; color: string }> = {
	AWAITING_PAYMENT: { label: 'รอชำระ', pill: 'bg-amber-50 text-amber-700', dot: 'bg-amber-400', color: '#FBBF24' },
	PENDING: { label: 'รอคนรับ', pill: 'bg-brand-50 text-brand-700', dot: 'bg-brand', color: '#FA4616' },
	ACCEPTED: { label: 'รับงานแล้ว', pill: 'bg-sky-50 text-sky-700', dot: 'bg-sky-500', color: '#0EA5E9' },
	DELIVERING: { label: 'กำลังไปส่ง', pill: 'bg-violet-50 text-violet-700', dot: 'bg-violet-500', color: '#8B5CF6' },
	COMPLETED: { label: 'ส่งสำเร็จ', pill: 'bg-fresh-50 text-fresh-700', dot: 'bg-fresh', color: '#10B981' },
	CANCELLED: { label: 'ยกเลิก', pill: 'bg-red-50 text-red-600', dot: 'bg-red-500', color: '#EF4444' }
};

export const STAGE_ORDER: Stage[] = ['AWAITING_PAYMENT', 'PENDING', 'ACCEPTED', 'DELIVERING', 'COMPLETED', 'CANCELLED'];

/** Problem chip text, e.g. "ไม่มีคนรับ 12 นาที" */
export function attentionLabel(a: Attention): string {
	switch (a.code) {
		case 'OTP_LOCKED':
			return 'OTP ถูกล็อก';
		case 'REFUND_DUE':
			return `รอคืนเงิน ฿${a.amount ?? ''}`.trim();
		case 'LATE':
			return `ส่งช้า ${a.minutes} นาที`;
		case 'UNASSIGNED':
			return `ไม่มีคนรับ ${a.minutes} นาที`;
		case 'UNPAID':
			return 'รอชำระนาน';
	}
}

/** What the banner says and which fix it offers */
export const ATTENTION_HELP: Record<AttentionCode, { text: string; severe: boolean }> = {
	OTP_LOCKED: { text: 'คนหิ้วกรอก OTP ผิดครบ 5 ครั้ง งานนี้ถูกล็อก ตรวจกับผู้ซื้อแล้วปลดล็อกให้คนหิ้วกรอกใหม่', severe: true },
	REFUND_DUE: { text: 'ออเดอร์ถูกยกเลิกหลังผู้ซื้อจ่าย PromptPay แล้ว ต้องโอนเงินคืนผู้ซื้อ', severe: true },
	LATE: { text: 'เกินเวลาส่งที่สัญญาไว้ 40 นาที โทรถามคนหิ้วว่าติดอะไร', severe: true },
	UNASSIGNED: { text: 'ยังไม่มีคนหิ้วรับงาน โทรแจ้งผู้ซื้อ หรือยกเลิกถ้ารอไม่ไหว', severe: false },
	UNPAID: { text: 'ผู้ซื้อยังไม่ได้ชำระ PromptPay ถ้าผู้ซื้อโอนแล้วแต่ระบบตรวจสลิปไม่ผ่าน ให้ยืนยันรับเงินเอง', severe: false }
};

export const ORDER_TABS: { id: OrdersTab; label: string }[] = [
	{ id: 'attention', label: 'ต้องจัดการ' },
	{ id: 'active', label: 'กำลังดำเนินการ' },
	{ id: 'awaiting_payment', label: 'รอชำระ' },
	{ id: 'done', label: 'เสร็จ' },
	{ id: 'cancelled', label: 'ยกเลิก' },
	{ id: 'all', label: 'ทั้งหมด' }
];

export const CANCEL_REASONS = ['ร้านปิดหรือของหมด', 'ไม่มีคนรับงาน', 'ผู้ซื้อขอยกเลิก', 'ปัญหาการชำระเงิน'];

export const PROMO_STATE: Record<PromoState, { label: string; pill: string }> = {
	PENDING: { label: 'รออนุมัติ', pill: 'bg-amber-50 text-amber-700' },
	LIVE: { label: 'ใช้อยู่', pill: 'bg-fresh-50 text-fresh-700' },
	OFF: { label: 'ปิดอยู่', pill: 'bg-slate-100 text-slate-600' },
	REJECTED: { label: 'ไม่อนุมัติ', pill: 'bg-red-50 text-red-600' },
	ENDED: { label: 'หมดเขต', pill: 'bg-slate-100 text-slate-500' }
};

export const ACTION_LABEL: Record<string, string> = {
	ORDER_CANCELLED: 'ยกเลิกออเดอร์',
	PAYMENT_CONFIRMED: 'ยืนยันรับเงินเอง',
	OTP_UNLOCKED: 'ปลดล็อก OTP',
	ORDER_REQUEUED: 'คืนงานเข้าคิว',
	REFUNDED: 'บันทึกคืนเงิน',
	PAYOUT_PAID: 'บันทึกโอนคนหิ้ว',
	STORE_OPENED: 'เปิดรับออเดอร์',
	STORE_CLOSED: 'ปิดรับออเดอร์',
	STORE_LOCKED: 'ล็อกปิดร้าน (ร้านเปิดเองไม่ได้)',
	STORE_UNLOCKED: 'ปลดล็อกร้าน',
	STORE_FOLLOW_SCHEDULE: 'ให้ร้านเปิด-ปิดตามเวลา',
	STORE_OPERATING_HOURS_UPDATED: 'แก้เวลาเปิด-ปิดร้าน',
	STORE_CREATED: 'สร้างร้าน',
	STORE_IMPORTED: 'นำเข้าร้านและเมนู',
	STORE_EDITED: 'แก้ข้อมูลร้าน',
	STORE_HIDDEN: 'ซ่อนร้านจากแอป',
	STORE_SHOWN: 'แสดงร้านในแอป',
	STORE_DELETED: 'ลบร้าน (ย้ายไปถังขยะ)',
	STORE_RESTORED: 'กู้คืนร้านจากถังขยะ',
	STORE_PURGED: 'ลบร้านถาวร',
	PAYMENT_TEST_ON: 'เปิดโหมดทดสอบจ่าย QR',
	PAYMENT_TEST_OFF: 'ปิดโหมดทดสอบจ่าย QR',
	RAIN_ON: 'เปิดค่าหิ้วช่วงฝนตก',
	RAIN_OFF: 'ปิดค่าหิ้วช่วงฝนตก',
	PROMO_CODE_CREATED: 'สร้างโค้ดส่วนลด',
	PROMO_CODE_ON: 'เปิดโค้ดส่วนลด',
	PROMO_CODE_OFF: 'ปิดโค้ดส่วนลด',
	MENU_CLEARED: 'ล้างเมนูทั้งร้าน',
	ITEM_ADDED: 'เพิ่มเมนู',
	ITEM_EDITED: 'แก้เมนู',
	ITEM_REMOVED: 'ลบเมนู',
	ITEM_ON: 'เปิดเมนู',
	ITEM_OFF: 'ปิดเมนู (หมด)',
	RIDER_ADDED: 'เพิ่มคนหิ้ว',
	RIDER_REMOVED: 'นำคนหิ้วออก',
	RIDER_APPROVED: 'อนุมัติใบสมัครคนหิ้ว',
	RIDER_REJECTED: 'ไม่อนุมัติใบสมัครคนหิ้ว',
	PROMO_APPROVED: 'อนุมัติโปร',
	PROMO_REJECTED: 'ไม่อนุมัติโปร',
	PROMO_ON: 'เปิดโปร',
	PROMO_OFF: 'ปิดโปร',
	PARTNER_INVITED: 'เชิญร้าน Partner',
	INVITE_CANCELLED: 'ยกเลิกคำเชิญ',
	MEMBER_ADDED: 'เพิ่มทีมงาน',
	MEMBER_ROLE_CHANGED: 'เปลี่ยนบทบาท',
	MEMBER_REMOVED: 'นำทีมงานออก',
	ERROR_RESOLVED: 'ปิดข้อผิดพลาด (แก้แล้ว)'
};

/** One-line detail for a log row: reason, amount, reference, item */
export function describeDetail(detail: Record<string, unknown>): string {
	const parts: string[] = [];
	if (detail.item) parts.push(String(detail.item));
	if (typeof detail.amount === 'number') parts.push(`฿${detail.amount.toLocaleString('en-US')}`);
	if (detail.role) parts.push(String(detail.role));
	if (detail.email) parts.push(String(detail.email));
	if (detail.reason) parts.push(`เหตุผล: ${detail.reason}`);
	if (typeof detail.until === 'string') parts.push(`ถึง ${new Date(detail.until).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} น.`);
	const hours = detail.hours as { enabled?: boolean; openTime?: string; closeTime?: string } | undefined;
	if (hours) parts.push(hours.enabled ? `เปิด ${hours.openTime}-${hours.closeTime} น.` : 'ปิดระบบตั้งเวลา');
	if (detail.note) parts.push(String(detail.note));
	if (detail.ref) parts.push(`อ้างอิง ${detail.ref}`);
	return parts.join(' · ');
}

/** Database error codes of the admin functions, in the team's words */
export const ADMIN_ERRORS: Record<string, string> = {
	TEAM_ONLY: 'บัญชีนี้ไม่ได้อยู่ในทีมงาน',
	ADMIN_ONLY: 'เฉพาะ ADMIN ทำได้',
	REASON_REQUIRED: 'ต้องใส่เหตุผล',
	REF_REQUIRED: 'ต้องใส่เลขอ้างอิงการโอน',
	ORDER_NOT_FOUND: 'ไม่พบออเดอร์นี้',
	NOT_LOCKED: 'OTP ของงานนี้ไม่ได้ถูกล็อกแล้ว',
	PAYOUT_CHANGED: 'รายการที่ต้องโอนเปลี่ยนไปแล้ว รีเฟรชแล้วลองใหม่',
	STORE_NOT_FOUND: 'ไม่พบร้านนี้',
	STORE_DELETED: 'ร้านนี้อยู่ในถังขยะ กู้คืนก่อนแล้วค่อยแก้',
	STORE_HAS_ACTIVE_ORDERS: 'ร้านนี้ยังมีออเดอร์ที่กำลังทำอยู่ รอให้ส่งเสร็จหรือยกเลิกก่อนแล้วค่อยลบ',
	ITEM_NOT_FOUND: 'ไม่พบเมนูนี้',
	ALREADY_RIDER: 'อีเมลนี้อยู่ในรายชื่อคนหิ้วแล้ว',
	NOT_A_RIDER: 'อีเมลนี้ไม่ได้อยู่ในรายชื่อคนหิ้ว',
	PROMO_NOT_FOUND: 'ไม่พบโปรนี้',
	BAD_EMAIL: 'อีเมลไม่ถูกต้อง',
	// Sign-up refused by the database (not KMUTT, not invited, not on the team)
	'saving new user': 'อีเมลนี้ยังไม่อยู่ในรายชื่อทีมงาน ให้ ADMIN เพิ่มที่หน้าทีมงานก่อน แล้วลองใหม่',
	STORE_HAS_OWNER: 'ร้านนี้มีเจ้าของบัญชี Partner แล้ว',
	EMAIL_HAS_ACCOUNT: 'อีเมลนี้มีบัญชีในแอปแล้ว ใช้อีเมลอื่นของเจ้าของร้าน',
	INVITE_NOT_FOUND: 'ไม่พบคำเชิญนี้',
	BAD_ROLE: 'บทบาทไม่ถูกต้อง',
	CANNOT_CHANGE_SELF: 'เปลี่ยนสิทธิ์ของตัวเองไม่ได้',
	NOT_A_MEMBER: 'อีเมลนี้ไม่ได้อยู่ในทีมงาน',
	LAST_ADMIN: 'ต้องเหลือ ADMIN อย่างน้อย 1 คน',
	BAD_CODE: 'โค้ดต้องมี 3-20 ตัวอักษร ใช้ได้เฉพาะ A-Z และ 0-9',
	BAD_KIND: 'เลือกประเภทส่วนลดใหม่อีกครั้ง',
	BAD_AMOUNT: 'ใส่ส่วนลด 1-500 บาท (ฟรีค่าหิ้วไม่ต้องใส่จำนวนเงิน)',
	BAD_MAX_USES: 'จำนวนครั้งที่ใช้ได้ต้องอยู่ระหว่าง 1-100,000',
	CODE_TAKEN: 'มีโค้ดนี้อยู่แล้ว ตั้งชื่ออื่น',
	STORE_STATE_CHANGED: 'มีคนเพิ่งเปลี่ยนสถานะร้านนี้ (เช่น ร้านเองหรือทีมอีกคน) อัปเดตหน้าจอให้แล้ว ตรวจดูแล้วลองอีกครั้ง',
	BAD_HOURS: 'เวลาเปิด-ปิดไม่ถูกต้อง (เวลาเปิดต้องไม่เท่าเวลาปิด และเลือกวันอย่างน้อย 1 วัน)',
	BAD_UNTIL: 'เวลาสิ้นสุดต้องเป็นเวลาในอนาคต',
	STORE_HIDDEN: 'ร้านนี้ซ่อนอยู่ กด "แสดงร้านในแอป" ก่อนแล้วค่อยเปิดรับออเดอร์',
	NO_SCHEDULE: 'ร้านนี้ยังไม่ได้ตั้งเวลาเปิด-ปิดอัตโนมัติ'
};
