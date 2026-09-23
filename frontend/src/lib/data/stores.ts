// Mock Store Data for Demo (matches seeder.go data)
import type { Store, MenuItem } from '$lib/types';

export const MOCK_STORES: Store[] = [
	{
		id: 'store-panee',
		locationId: 'canteen-male',
		name: 'ข้าวมันไก่ป้าณี (สูตรไหหลำ)',
		category: 'ข้าวมันไก่',
		description: 'ข้าวมันไก่สูตรไหหลำแท้ๆ น้ำจิ้มเต้าเจี้ยวสูตรลับ',
		imageUrl: 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?auto=format&fit=crop&w=800&q=80',
		isOpen: true,
		rating: 4.9,
		reviewsCount: '1.2k',
		queueStatus: 'ปานกลาง (~10 นาที)',
		dealText: 'สั่งผ่านมดแมน ลดค่าอาหาร 5 บาท + ฟรีค่าบริการ',
		menuItems: [
			{ id: 'pm1', storeId: 'store-panee', name: 'ข้าวมันไก่ผสม (ต้ม+ทอด) พิเศษ', price: 55, originalPrice: 60, description: 'แถมน้ำซุปมะนาวดองร้อนๆ เลือกระบุไม่ใส่แตงกวาได้', imageUrl: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=300&q=80', isAvailable: true, category: 'เมนูยอดฮิต' },
			{ id: 'pm2', storeId: 'store-panee', name: 'ข้าวมันไก่ต้มเนื้อน่องฉ่ำ', price: 45, originalPrice: 50, description: 'เนื้อน่องฉ่ำนุ่ม น้ำจิ้มเต้าเจี้ยวพริกสดสูตรเด็ดป้าณี', imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=300&q=80', isAvailable: true, category: 'ข้าวมันไก่ต้ม' },
			{ id: 'pm3', storeId: 'store-panee', name: 'ข้าวมันไก่ทอดกรอบ', price: 50, description: 'ไก่ทอดกรอบนอกนุ่มใน เสิร์ฟกับข้าวมันหอมๆ', imageUrl: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=300&q=80', isAvailable: true, category: 'ข้าวมันไก่ทอด' },
			{ id: 'pm4', storeId: 'store-panee', name: 'ชามะนาวเย็น ดับร้อน', price: 25, description: 'ชาดำเข้มข้นผสมมะนาวแท้ เปรี้ยวหวานสดชื่น', imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=300&q=80', isAvailable: true, category: 'เครื่องดื่ม' },
		]
	},
	{
		id: 'store-kaprao',
		locationId: 'canteen-male',
		name: 'ร้านพี่แดง กะเพราเด็ดเผ็ด',
		category: 'อาหารตามสั่ง',
		description: 'กะเพราทุกชนิด ไข่ดาวกรอบทุกใบ',
		imageUrl: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=800&q=80',
		isOpen: true,
		rating: 4.7,
		reviewsCount: '890',
		queueStatus: 'ยาว (~15 นาที)',
		dealText: 'สั่ง 2 กล่อง ลด 10 บาท!',
		menuItems: [
			{ id: 'km1', storeId: 'store-kaprao', name: 'ข้าวกะเพราหมูกรอบไข่ดาว', price: 55, description: 'หมูกรอบผัดกะเพราเผ็ดจัด ไข่ดาวกรอบ', imageUrl: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=300&q=80', isAvailable: true, category: 'กะเพรา' },
			{ id: 'km2', storeId: 'store-kaprao', name: 'ข้าวกะเพราไก่ไข่ดาว', price: 45, description: 'ไก่สับผัดกะเพรา ไข่ดาวฟู', imageUrl: 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?auto=format&fit=crop&w=300&q=80', isAvailable: true, category: 'กะเพรา' },
			{ id: 'km3', storeId: 'store-kaprao', name: 'ข้าวผัดต้มยำกุ้ง', price: 60, description: 'ข้าวผัดรสต้มยำ กุ้งสดตัวใหญ่', imageUrl: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=300&q=80', isAvailable: true, category: 'ข้าวผัด' },
		]
	},
	{
		id: 'store-bobatea',
		locationId: 'green-canteen',
		name: 'BobaLab ชานมไข่มุก มจธ.',
		category: 'เครื่องดื่ม',
		description: 'ชานมไข่มุกหลากรสชาติ ไข่มุกนุ่ม Q ต้มสดทุกวัน',
		imageUrl: 'https://images.unsplash.com/photo-1558857563-b371033873b8?auto=format&fit=crop&w=800&q=80',
		isOpen: true,
		rating: 4.8,
		reviewsCount: '2.1k',
		queueStatus: 'สั้น (~5 นาที)',
		dealText: 'แก้วที่ 2 ลด 50% ทุกวันพุธ!',
		menuItems: [
			{ id: 'bb1', storeId: 'store-bobatea', name: 'ชานมไข่มุก Original', price: 45, description: 'ชานมเข้มข้น ไข่มุกนุ่มหนึบ', imageUrl: 'https://images.unsplash.com/photo-1558857563-b371033873b8?auto=format&fit=crop&w=300&q=80', isAvailable: true, category: 'ชานม' },
			{ id: 'bb2', storeId: 'store-bobatea', name: 'โกโก้ไข่มุก', price: 50, description: 'โกโก้เข้มข้นกับไข่มุก Q', imageUrl: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=300&q=80', isAvailable: true, category: 'โกโก้' },
			{ id: 'bb3', storeId: 'store-bobatea', name: 'มัทฉะลาเต้', price: 55, description: 'มัทฉะจากอุจิ นมสดใหม่', imageUrl: 'https://images.unsplash.com/photo-1515823064-d6e0c04616a7?auto=format&fit=crop&w=300&q=80', isAvailable: true, category: 'มัทฉะ' },
		]
	},
	{
		id: 'store-somtam',
		locationId: 'canteen-male',
		name: 'ส้มตำป้าแจ๋ว (โรงชาย ล็อก 3)',
		category: 'อาหารอีสาน',
		description: 'ส้มตำ ลาบ น้ำตก ไก่ย่าง รสแซ่บนัว',
		imageUrl: 'https://images.unsplash.com/photo-1562967916-eb82221dfb44?auto=format&fit=crop&w=800&q=80',
		isOpen: true,
		rating: 4.6,
		reviewsCount: '650',
		queueStatus: 'ปานกลาง (~8 นาที)',
		menuItems: [
			{ id: 'st1', storeId: 'store-somtam', name: 'ส้มตำไทย', price: 40, description: 'ส้มตำรสจัดจ้าน ถั่วลิสง กุ้งแห้ง', imageUrl: 'https://images.unsplash.com/photo-1562967916-eb82221dfb44?auto=format&fit=crop&w=300&q=80', isAvailable: true, category: 'ส้มตำ' },
			{ id: 'st2', storeId: 'store-somtam', name: 'ส้มตำปูปลาร้า', price: 50, description: 'แซ่บนัว ปูดองเค็ม ปลาร้าหอม', imageUrl: 'https://images.unsplash.com/photo-1562967916-eb82221dfb44?auto=format&fit=crop&w=300&q=80', isAvailable: true, category: 'ส้มตำ' },
			{ id: 'st3', storeId: 'store-somtam', name: 'ไก่ย่าง 1/4 ตัว + ข้าวเหนียว', price: 60, description: 'ไก่ย่างหนังกรอบ เสิร์ฟกับน้ำจิ้มแจ่วและข้าวเหนียว', imageUrl: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=300&q=80', isAvailable: true, category: 'ย่าง' },
		]
	},
];

export function getStoreById(id: string): Store | undefined {
	return MOCK_STORES.find(s => s.id === id);
}

export function getStoresByLocation(locationId: string): Store[] {
	return MOCK_STORES.filter(s => s.locationId === locationId);
}
