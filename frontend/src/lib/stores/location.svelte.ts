// Location global store (Svelte 5 runes)
import type { LocationHub } from '$lib/types';

// --- State ---
let selectedDropoff = $state<string>('ตึก LX ชั้น 1 (พหุวิทยาการ)');
let selectedDropoffId = $state<string>('');

// --- Predefined Dropoff Points ---
export const DROPOFF_POINTS = [
	{ id: 'lx-1', name: 'ตึก LX ชั้น 1 (พหุวิทยาการ)', note: 'หน้าตู้เต่าบิน / โซนเรียนรู้', zone: 'ACADEMIC' as const },
	{ id: 'cb2', name: 'อาคาร CB2 ม้าหินอ่อน', note: 'โถงใต้อาคารเรียนรวม 2', zone: 'ACADEMIC' as const },
	{ id: 'cb3', name: 'อาคาร CB3 ใต้ถุนตึก', note: 'ใต้ถุนตึก CB3 ข้างลิฟต์', zone: 'ACADEMIC' as const },
	{ id: 'sit', name: 'อาคาร SIT ชั้น 1', note: 'คณะเทคโนโลยีสารสนเทศ', zone: 'ACADEMIC' as const },
	{ id: 'dorm-s5', name: 'หอพักชาย S5 ล็อบบี้', note: 'หอพักนักศึกษาชายหน้าล็อบบี้', zone: 'DORM' as const },
	{ id: 'dorm-s6', name: 'หอพักหญิง S6 ล็อบบี้', note: 'หอพักนักศึกษาหญิงหน้าล็อบบี้', zone: 'DORM' as const },
	{ id: 'green', name: 'โรงอาหาร 190 ปี (Green Canteen)', note: 'โต๊ะหน้าทางเข้า', zone: 'CANTEEN' as const },
];

// --- Predefined Pickup Hubs ---
export const PICKUP_HUBS = [
	{ id: 'canteen-male', name: 'โรงอาหารพระจอมเกล้า (โรงชาย)', zone: 'CANTEEN' as const },
	{ id: 'green-canteen', name: 'โรงอาหาร 190 ปี (Green Canteen)', zone: 'CANTEEN' as const },
	{ id: '7eleven-dorm', name: 'เซเว่นหน้าหอใน มจธ.', zone: 'OFF_CAMPUS' as const },
	{ id: 'soi45', name: 'ร้านอาหารซอยประชาอุทิศ 45', zone: 'OFF_CAMPUS' as const },
];

// --- Actions ---
export function setDropoff(id: string, name: string) {
	selectedDropoffId = id;
	selectedDropoff = name;
}

// --- Getters ---
export function getDropoff() {
	return { id: selectedDropoffId, name: selectedDropoff };
}

export function getDropoffName(): string {
	return selectedDropoff;
}
