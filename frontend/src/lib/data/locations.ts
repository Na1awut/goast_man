// Campus location hubs (mirrors backend location_hubs seed)
import type { DropoffPoint, PickupHub } from '$lib/types';

export const DROPOFF_POINTS: DropoffPoint[] = [
	{ id: 'lx-1', name: 'อาคาร LX ชั้น 1 หน้าตู้เต่าบิน', shortName: 'ตึก LX ชั้น 1', note: 'อาคารการเรียนรู้พหุวิทยาการ', zone: 'ACADEMIC' },
	{ id: 'cb2', name: 'อาคารเรียนรวม CB2', shortName: 'CB2 ม้าหินอ่อน', note: 'ม้าหินอ่อนใต้อาคาร', zone: 'ACADEMIC' },
	{ id: 'cb3', name: 'อาคารเรียนรวม CB3', shortName: 'CB3 ใต้ถุน', note: 'ใต้ถุนตึกข้างลิฟต์', zone: 'ACADEMIC' },
	{ id: 'sit', name: 'อาคาร SIT ชั้น 1', shortName: 'SIT ชั้น 1', note: 'คณะเทคโนโลยีสารสนเทศ', zone: 'ACADEMIC' },
	{ id: 'eng12', name: 'ตึกวิศวะ 12 ชั้น', shortName: 'ตึก 12 ชั้น', note: 'ล็อบบี้ชั้น 1 หน้าลิฟต์', zone: 'ACADEMIC' },
	{ id: 'lib', name: 'หอสมุด มจธ. (KMUTT Library)', shortName: 'หอสมุด', note: 'ทางเข้าหน้าประตูกระจก', zone: 'OFFICE' },
	{ id: 'dorm-s5', name: 'หอพักชาย S5', shortName: 'หอ S5', note: 'ล็อบบี้หน้าหอ', zone: 'DORM' },
	{ id: 'dorm-s6', name: 'หอพักหญิง S6', shortName: 'หอ S6', note: 'ล็อบบี้หน้าหอ', zone: 'DORM' }
];

export const PICKUP_HUBS: PickupHub[] = [
	{ id: 'kfc-main', name: 'โรงอาหาร KFC (หลัก)', shortName: 'KFC หลัก', icon: 'utensils', zone: 'CANTEEN' },
	{ id: 'canteen-male', name: 'โรงอาหารพระจอมเกล้า (โรงชาย)', shortName: 'โรงชาย', icon: 'utensils', zone: 'CANTEEN' },
	{ id: 'green-canteen', name: 'โรงอาหาร 190 ปี (Green Canteen)', shortName: 'Green Canteen', icon: 'utensils', zone: 'CANTEEN' },
	{ id: '7eleven-dorm', name: 'เซเว่นหน้าหอใน มจธ.', shortName: 'เซเว่นหน้าหอใน', icon: 'cart', zone: 'OFF_CAMPUS' },
	{ id: 'soi45', name: 'ร้านอาหารซอยประชาอุทิศ 45', shortName: 'ซอย 45', icon: 'store', zone: 'OFF_CAMPUS' }
];

export const DEFAULT_DROPOFF = DROPOFF_POINTS[0];
