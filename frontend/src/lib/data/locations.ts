// Campus location hubs (mirrors backend location_hubs seed)
import type { DropoffPoint, PickupHub } from '$lib/types';

export const DROPOFF_POINTS: DropoffPoint[] = [
	// Names match campus_places in the database (orders say "<name> ชั้น <floor>")
	{ id: 'lx-1', name: 'อาคาร LX', shortName: 'ตึก LX', note: 'ชั้น 1: หน้าตู้เต่าบิน', zone: 'ACADEMIC' },
	{ id: 'cb2', name: 'อาคารเรียนรวม CB2', shortName: 'CB2', note: 'ชั้น 1: ม้าหินอ่อนใต้อาคาร', zone: 'ACADEMIC' },
	{ id: 'cb3', name: 'อาคารเรียนรวม CB3', shortName: 'CB3', note: 'ชั้น 1: ใต้ถุนตึกข้างลิฟต์', zone: 'ACADEMIC' },
	{ id: 'sit', name: 'อาคาร SIT', shortName: 'SIT', note: 'คณะเทคโนโลยีสารสนเทศ', zone: 'ACADEMIC' },
	{ id: 'eng12', name: 'ตึกวิศวะ 12 ชั้น', shortName: 'ตึก 12 ชั้น', note: 'ชั้น 1: ล็อบบี้หน้าลิฟต์', zone: 'ACADEMIC' },
	{ id: 'lib', name: 'หอสมุด มจธ. (KMUTT Library)', shortName: 'หอสมุด', note: 'ทางเข้าหน้าประตูกระจก (เฉพาะชั้น 1)', zone: 'OFFICE', maxFloor: 1 },
	{ id: 'dorm-s5', name: 'หอพักชาย S5', shortName: 'หอ S5', note: 'ล็อบบี้หน้าหอ (เฉพาะชั้น 1)', zone: 'DORM', maxFloor: 1 },
	{ id: 'dorm-s6', name: 'หอพักหญิง S6', shortName: 'หอ S6', note: 'ล็อบบี้หน้าหอ (เฉพาะชั้น 1)', zone: 'DORM', maxFloor: 1 }
];

export const PICKUP_HUBS: PickupHub[] = [
	{ id: 'kfc-main', name: 'โรงอาหาร KFC (หลัก)', shortName: 'KFC หลัก', icon: 'utensils', zone: 'CANTEEN' },
	{ id: 'female-dorm', name: 'โรงอาหารหอหญิง', shortName: 'หอหญิง', icon: 'utensils', zone: 'CANTEEN' },
	{ id: 'male-dorm', name: 'โรงอาหารหอชาย', shortName: 'หอชาย', icon: 'utensils', zone: 'CANTEEN' },
	{ id: 'cb1', name: 'อาคาร CB1', shortName: 'CB1', icon: 'store', zone: 'ACADEMIC' },
	{ id: 'green-canteen', name: 'โรงอาหาร 190 ปี (Green Canteen)', shortName: 'Green Canteen', icon: 'utensils', zone: 'CANTEEN' },
	{ id: '7eleven-dorm', name: 'เซเว่นหน้าหอใน มจธ.', shortName: 'เซเว่นหน้าหอใน', icon: 'cart', zone: 'OFF_CAMPUS' },
	{ id: 'soi45', name: 'ร้านอาหารซอยประชาอุทิศ 45', shortName: 'ซอย 45', icon: 'store', zone: 'OFF_CAMPUS' }
];

export const DEFAULT_DROPOFF = DROPOFF_POINTS[0];
