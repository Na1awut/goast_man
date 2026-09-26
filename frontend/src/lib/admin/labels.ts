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
	ITEM_ON: 'เปิดเมนู',
	ITEM_OFF: 'ปิดเมนู (หมด)',
	RIDER_ADDED: 'เพิ่มคนหิ้ว',
	RIDER_REMOVED: 'นำคนหิ้วออก',
	PROMO_APPROVED: 'อนุมัติโปร',
	PROMO_REJECTED: 'ไม่อนุมัติโปร',
	PROMO_ON: 'เปิดโปร',
	PROMO_OFF: 'ปิดโปร',
	PARTNER_INVITED: 'เชิญร้าน Partner',
	INVITE_CANCELLED: 'ยกเลิกคำเชิญ',
	MEMBER_ADDED: 'เพิ่มทีมงาน',
	MEMBER_ROLE_CHANGED: 'เปลี่ยนบทบาท',
	MEMBER_REMOVED: 'นำทีมงานออก'
};

/** One-line detail for a log row: reason, amount, reference, item */
export function describeDetail(detail: Record<string, unknown>): string {
	const parts: string[] = [];
	if (detail.item) parts.push(String(detail.item));
	if (typeof detail.amount === 'number') parts.push(`฿${detail.amount.toLocaleString('en-US')}`);
	if (detail.role) parts.push(String(detail.role));
	if (detail.email) parts.push(String(detail.email));
	if (detail.reason) parts.push(`เหตุผล: ${detail.reason}`);
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
	ITEM_NOT_FOUND: 'ไม่พบเมนูนี้',
	ALREADY_RIDER: 'อีเมลนี้อยู่ในรายชื่อคนหิ้วแล้ว',
	NOT_A_RIDER: 'อีเมลนี้ไม่ได้อยู่ในรายชื่อคนหิ้ว',
	PROMO_NOT_FOUND: 'ไม่พบโปรนี้',
	BAD_EMAIL: 'อีเมลไม่ถูกต้อง',
	STORE_HAS_OWNER: 'ร้านนี้มีเจ้าของบัญชี Partner แล้ว',
	EMAIL_HAS_ACCOUNT: 'อีเมลนี้มีบัญชีในแอปแล้ว ใช้อีเมลอื่นของเจ้าของร้าน',
	INVITE_NOT_FOUND: 'ไม่พบคำเชิญนี้',
	BAD_ROLE: 'บทบาทไม่ถูกต้อง',
	CANNOT_CHANGE_SELF: 'เปลี่ยนสิทธิ์ของตัวเองไม่ได้',
	NOT_A_MEMBER: 'อีเมลนี้ไม่ได้อยู่ในทีมงาน',
	LAST_ADMIN: 'ต้องเหลือ ADMIN อย่างน้อย 1 คน'
};
