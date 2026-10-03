// Campus location hubs (mirrors backend location_hubs seed)
import type { DropoffPoint, PickupHub } from '$lib/types';
import { t } from '$lib/i18n';

export const DROPOFF_POINTS: DropoffPoint[] = [
	// Names match campus_places in the database (orders say "<name> ชั้น <floor>")
	{ id: 'lx-1', name: t('อาคาร LX'), shortName: t('ตึก LX'), note: t('ชั้น 1: หน้าตู้เต่าบิน'), zone: 'ACADEMIC' },
	{ id: 'cb2', name: t('อาคารเรียนรวม CB2'), shortName: 'CB2', note: t('ชั้น 1: ม้าหินอ่อนใต้อาคาร'), zone: 'ACADEMIC' },
	{ id: 'cb3', name: t('อาคารเรียนรวม CB3'), shortName: 'CB3', note: t('ชั้น 1: ใต้ถุนตึกข้างลิฟต์'), zone: 'ACADEMIC' },
	{ id: 'sit', name: t('อาคาร SIT'), shortName: 'SIT', note: t('คณะเทคโนโลยีสารสนเทศ'), zone: 'ACADEMIC' },
	{ id: 'eng12', name: t('ตึกวิศวะ 12 ชั้น'), shortName: t('ตึก 12 ชั้น'), note: t('ชั้น 1: ล็อบบี้หน้าลิฟต์'), zone: 'ACADEMIC' },
	{ id: 'lib', name: t('หอสมุด มจธ. (KMUTT Library)'), shortName: t('หอสมุด'), note: t('ทางเข้าหน้าประตูกระจก (เฉพาะชั้น 1)'), zone: 'OFFICE', maxFloor: 1 },
	{ id: 'dorm-s5', name: t('หอพักชาย S5'), shortName: t('หอ S5'), note: t('ล็อบบี้หน้าหอ (เฉพาะชั้น 1)'), zone: 'DORM', maxFloor: 1 },
	{ id: 'dorm-s6', name: t('หอพักหญิง S6'), shortName: t('หอ S6'), note: t('ล็อบบี้หน้าหอ (เฉพาะชั้น 1)'), zone: 'DORM', maxFloor: 1 }
];

export const PICKUP_HUBS: PickupHub[] = [
	{ id: 'kfc-main', name: t('โรงอาหาร KFC (หลัก)'), shortName: t('KFC หลัก'), icon: 'utensils', zone: 'CANTEEN' },
	{ id: 'female-dorm', name: t('โรงอาหารหอหญิง'), shortName: t('หอหญิง'), icon: 'utensils', zone: 'CANTEEN' },
	{ id: 'male-dorm', name: t('โรงอาหารหอชาย'), shortName: t('หอชาย'), icon: 'utensils', zone: 'CANTEEN' },
	{ id: 'cb1', name: t('อาคาร CB1'), shortName: 'CB1', icon: 'store', zone: 'ACADEMIC' },
	{ id: 'green-canteen', name: t('โรงอาหาร 190 ปี (Green Canteen)'), shortName: 'Green Canteen', icon: 'utensils', zone: 'CANTEEN' },
	{ id: '7eleven-dorm', name: t('เซเว่นหน้าหอใน มจธ.'), shortName: t('เซเว่นหน้าหอใน'), icon: 'cart', zone: 'OFF_CAMPUS' },
	{ id: 'soi45', name: t('ร้านอาหารซอยประชาอุทิศ 45'), shortName: t('ซอย 45'), icon: 'store', zone: 'OFF_CAMPUS' }
];

export const DEFAULT_DROPOFF = DROPOFF_POINTS[0];
