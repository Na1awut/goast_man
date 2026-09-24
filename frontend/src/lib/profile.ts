// Profile rules for onboarding and editing. The server (complete_profile in
// supabase/migrations) enforces the same rules; these give instant feedback.
import type { User } from '$lib/types';

/** Bump when the terms or privacy notice change: everyone is asked to accept again */
export const TERMS_VERSION = '2026-09';

export type StudyLevel = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | 'grad' | 'staff';

export const STUDY_LEVELS: { id: StudyLevel; label: string }[] = [
	{ id: '1', label: 'ปี 1' },
	{ id: '2', label: 'ปี 2' },
	{ id: '3', label: 'ปี 3' },
	{ id: '4', label: 'ปี 4' },
	{ id: '5', label: 'ปี 5+' },
	{ id: 'grad', label: 'บัณฑิตศึกษา' },
	{ id: 'staff', label: 'บุคลากร' }
];

export function levelLabel(level: string | undefined): string {
	return STUDY_LEVELS.find((l) => l.id === level)?.label ?? (level ? `ปี ${level}` : '');
}

/** KMUTT faculties and schools. "อื่นๆ" lets anyone not listed type their own. */
export const FACULTIES = [
	'คณะวิศวกรรมศาสตร์',
	'คณะวิทยาศาสตร์',
	'คณะครุศาสตร์อุตสาหกรรมและเทคโนโลยี',
	'คณะเทคโนโลยีสารสนเทศ (SIT)',
	'คณะสถาปัตยกรรมศาสตร์และการออกแบบ',
	'คณะพลังงานสิ่งแวดล้อมและวัสดุ',
	'คณะทรัพยากรชีวภาพและเทคโนโลยี',
	'คณะศิลปศาสตร์',
	'สถาบันวิทยาการหุ่นยนต์ภาคสนาม (FIBO)',
	'บัณฑิตวิทยาลัยการจัดการและนวัตกรรม (GMI)',
	'บัณฑิตวิทยาลัยร่วมด้านพลังงานและสิ่งแวดล้อม (JGSEE)'
];

export const digitsOnly = (value: string) => value.replace(/\D/g, '');

/** 0812345678 → 081-234-5678 (display only; digits are what gets stored) */
export function formatPhone(value: string): string {
	const d = digitsOnly(value).slice(0, 10);
	if (d.length <= 3) return d;
	if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
	return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

export const isThaiMobile = (value: string) => /^0[689]\d{8}$/.test(digitsOnly(value));

/** Thai national ID: 13 digits with a mod-11 check digit */
export function isThaiNationalId(value: string): boolean {
	const d = digitsOnly(value);
	if (!/^\d{13}$/.test(d)) return false;
	const sum = [...d.slice(0, 12)].reduce((acc, c, i) => acc + Number(c) * (13 - i), 0);
	return (11 - (sum % 11)) % 10 === Number(d[12]);
}

export interface ProfileInput {
	nickname: string;
	phone: string;
	promptPay: string;
	studentId: string;
	faculty: string;
	studyLevel: StudyLevel | '';
	consent: boolean;
}

export type ProfileErrors = Partial<Record<keyof ProfileInput, string>>;

export function validateProfile(input: ProfileInput, role: User['role']): ProfileErrors {
	const e: ProfileErrors = {};
	const nickname = input.nickname.trim();
	if (!nickname) e.nickname = 'ใส่ชื่อเล่นที่อยากให้เพื่อนเรียก';
	else if (nickname.length > 30) e.nickname = 'ชื่อเล่นยาวได้ไม่เกิน 30 ตัวอักษร';

	if (!isThaiMobile(input.phone)) e.phone = 'เบอร์มือถือ 10 หลัก ขึ้นต้นด้วย 06, 08 หรือ 09';

	const pp = digitsOnly(input.promptPay);
	if (pp && !isThaiMobile(pp) && !isThaiNationalId(pp)) e.promptPay = 'ใส่เบอร์มือถือ หรือเลขบัตรประชาชน 13 หลักที่ผูก PromptPay';

	if (role === 'STUDENT') {
		if (!input.studyLevel) e.studyLevel = 'เลือกชั้นปี';
		if (!input.faculty.trim()) e.faculty = input.studyLevel === 'staff' ? 'ระบุหน่วยงาน' : 'เลือกคณะ';
		if (input.studyLevel !== 'staff' && !/^\d{8,13}$/.test(digitsOnly(input.studentId))) e.studentId = 'รหัสนักศึกษาเป็นตัวเลข เช่น 66070500123';
	}

	if (!input.consent) e.consent = 'ต้องยอมรับเงื่อนไขและนโยบายความเป็นส่วนตัวก่อนใช้งาน';
	return e;
}

/** Signed in but not ready to use the app yet */
export function needsOnboarding(user: User): boolean {
	if (user.termsVersion !== TERMS_VERSION || !user.consentedAt) return true;
	if (!user.nickname || !isThaiMobile(user.phoneNumber)) return true;
	if (user.role === 'STUDENT') return !user.studyLevel || !user.faculty || (user.studyLevel !== 'staff' && !user.studentId);
	return false;
}
