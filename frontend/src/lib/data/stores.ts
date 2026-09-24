// Demo store catalogue. Also the source for supabase/seed.sql (npm run seed:sql).
import type { Promotion, Store, StoreZone } from '$lib/types';

const img = (id: string, w: number) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=75`;

export const STORE_ZONES: { id: StoreZone | 'all'; label: string }[] = [
	{ id: 'all', label: 'ทั้งหมด' },
	{ id: 'canteen-male', label: 'โรงชาย' },
	{ id: 'green-canteen', label: 'Green Canteen 190 ปี' },
	{ id: 'dorm', label: 'หอพัก' }
];

export const ZONE_NAMES: Record<StoreZone, string> = {
	'canteen-male': 'โรงอาหารพระจอมเกล้า (โรงชาย)',
	'green-canteen': 'Green Canteen 190 ปี',
	dorm: 'โซนหอพักนักศึกษา'
};

export const MOCK_STORES: Store[] = [
	{
		id: 'store-panee',
		zone: 'canteen-male',
		name: 'ข้าวมันไก่ป้าณี (สูตรไหหลำ)',
		category: 'ข้าวมันไก่',
		description: 'ข้าวมันไก่สูตรไหหลำแท้ๆ น้ำจิ้มเต้าเจี้ยวสูตรลับ',
		imageUrl: img('photo-1569058242253-92a9c755a0ec', 800),
		isOpen: true,
		rating: 4.9,
		reviewsCount: '1.2k',
		queueMinutes: 10,
		lock: 'ล็อก 8',
		isPartner: true,
		tagline: 'ต้มสดทุกเช้า น้ำจิ้มสูตรบ้านป้าณี',
		fastLaneMinutes: 5,
		promotions: [
			{ id: 'promo-panee-deal', storeId: 'store-panee', kind: 'DEAL', title: 'สั่งผ่านแอป ลดค่าอาหาร 5 บาททันที', description: 'ลดทุกออเดอร์ที่สั่งผ่าน Goose Man', minQty: 1, discount: 5, freeDelivery: false, active: true, approved: true },
			{ id: 'promo-panee-co', storeId: 'store-panee', kind: 'CO_PROMO', title: 'Goose Man × ป้าณี ฟรีค่าหิ้ว', description: 'สั่ง 3 ชิ้นขึ้นไป ไม่เสียค่าหิ้วเลย', minQty: 3, discount: 0, freeDelivery: true, active: true, approved: true }
		],
		menuItems: [
			{ id: 'pm1', storeId: 'store-panee', name: 'ข้าวมันไก่ผสม (ต้ม+ทอด) พิเศษ', price: 55, originalPrice: 60, description: 'แถมน้ำซุปร้อนๆ ระบุไม่ใส่แตงกวาได้', imageUrl: img('photo-1626082927389-6cd097cdc6ec', 300), isAvailable: true, category: 'ข้าวมันไก่', isPopular: true },
			{ id: 'pm2', storeId: 'store-panee', name: 'ข้าวมันไก่ต้มเนื้อน่องฉ่ำ', price: 45, originalPrice: 50, description: 'เนื้อน่องนุ่มฉ่ำ น้ำจิ้มเต้าเจี้ยวพริกสด', imageUrl: img('photo-1546069901-ba9599a7e63c', 300), isAvailable: true, category: 'ข้าวมันไก่ต้ม' },
			{ id: 'pm3', storeId: 'store-panee', name: 'ข้าวมันไก่ทอดกรอบ', price: 50, description: 'ไก่ทอดกรอบนอกนุ่มใน เสิร์ฟกับข้าวมันหอมๆ', imageUrl: img('photo-1598515214211-89d3c73ae83b', 300), isAvailable: true, category: 'ข้าวมันไก่ทอด' },
			{ id: 'pm4', storeId: 'store-panee', name: 'ชามะนาวเย็น ดับร้อน', price: 25, description: 'ชาดำเข้มข้นผสมมะนาวแท้ เปรี้ยวหวานสดชื่น', imageUrl: img('photo-1556679343-c7306c1976bc', 300), isAvailable: true, category: 'เครื่องดื่ม' }
		]
	},
	{
		id: 'store-kaprao',
		zone: 'canteen-male',
		name: 'พี่แดง กะเพราเด็ดเผ็ด',
		category: 'อาหารตามสั่ง',
		description: 'กะเพราทุกชนิด ไข่ดาวกรอบทุกใบ',
		imageUrl: img('photo-1604908176997-125f25cc6f3d', 800),
		isOpen: true,
		rating: 4.7,
		reviewsCount: '890',
		queueMinutes: 15,
		lock: 'ล็อก 3',
		isPartner: true,
		tagline: 'ไข่ดาวกรอบทุกใบ เผ็ดได้ตามสั่ง',
		fastLaneMinutes: 8,
		promotions: [
			{ id: 'promo-kaprao-deal', storeId: 'store-kaprao', kind: 'DEAL', title: 'สั่ง 2 กล่องขึ้นไป ลด 10 บาท', description: 'ชวนเพื่อนสั่งด้วยกันคุ้มกว่า', minQty: 2, discount: 10, freeDelivery: false, active: true, approved: true }
		],
		menuItems: [
			{ id: 'km1', storeId: 'store-kaprao', name: 'ข้าวกะเพราหมูกรอบไข่ดาว', price: 55, description: 'หมูกรอบผัดกะเพราเผ็ดจัด ไข่ดาวกรอบ', imageUrl: img('photo-1604908176997-125f25cc6f3d', 300), isAvailable: true, category: 'กะเพรา', isPopular: true },
			{ id: 'km2', storeId: 'store-kaprao', name: 'ข้าวกะเพราไก่ไข่ดาว', price: 45, description: 'ไก่สับผัดกะเพรา ไข่ดาวฟู', imageUrl: img('photo-1562565652-a0d8f0c59eb4', 300), isAvailable: true, category: 'กะเพรา' },
			{ id: 'km3', storeId: 'store-kaprao', name: 'ข้าวผัดต้มยำกุ้ง', price: 60, originalPrice: 65, description: 'ข้าวผัดรสต้มยำ กุ้งสดตัวใหญ่', imageUrl: img('photo-1512058564366-18510be2db19', 300), isAvailable: true, category: 'ข้าวผัด' },
			{ id: 'km4', storeId: 'store-kaprao', name: 'ผัดซีอิ๊วหมู', price: 45, description: 'เส้นใหญ่ผัดหอมกระทะ', imageUrl: img('photo-1559314809-0d155014e29e', 300), isAvailable: false, category: 'เส้น' }
		]
	},
	{
		id: 'store-boba',
		zone: 'green-canteen',
		name: 'BobaLab ชานมไข่มุก มจธ.',
		category: 'เครื่องดื่ม',
		description: 'ชานมไข่มุกหลากรส ไข่มุกนุ่มหนึบ ต้มสดทุกวัน',
		imageUrl: img('photo-1558857563-b371033873b8', 800),
		isOpen: true,
		rating: 4.8,
		reviewsCount: '2.1k',
		queueMinutes: 5,
		lock: 'ชั้น 1',
		isPartner: true,
		tagline: 'ไข่มุกต้มใหม่ทุก 2 ชั่วโมง',
		fastLaneMinutes: 3,
		promotions: [
			{ id: 'promo-boba-deal', storeId: 'store-boba', kind: 'DEAL', title: 'สั่ง 2 แก้วขึ้นไป ลด 10 บาท', description: 'แก้วเดียวไม่พอ ชวนเพื่อนอีกแก้ว', minQty: 2, discount: 10, freeDelivery: false, active: true, approved: true },
			{ id: 'promo-boba-co', storeId: 'store-boba', kind: 'CO_PROMO', title: 'Goose Man × BobaLab ลด 20 บาท', description: 'สั่ง 3 แก้วขึ้นไปผ่านแอป ลดทันที 20 บาท', minQty: 3, discount: 20, freeDelivery: false, active: true, approved: true }
		],
		menuItems: [
			{ id: 'bb1', storeId: 'store-boba', name: 'ชานมไข่มุก Original', price: 45, description: 'ชานมเข้มข้น ไข่มุกนุ่มหนึบ', imageUrl: img('photo-1558857563-b371033873b8', 300), isAvailable: true, category: 'ชานม', isPopular: true },
			{ id: 'bb2', storeId: 'store-boba', name: 'โกโก้ไข่มุก', price: 50, description: 'โกโก้เข้มข้นกับไข่มุก Q', imageUrl: img('photo-1572490122747-3968b75cc699', 300), isAvailable: true, category: 'โกโก้' },
			{ id: 'bb3', storeId: 'store-boba', name: 'มัทฉะลาเต้', price: 55, description: 'มัทฉะเกรดพรีเมียม นมสดใหม่', imageUrl: img('photo-1515823064-d6e0c04616a7', 300), isAvailable: true, category: 'มัทฉะ' }
		]
	},
	{
		id: 'store-greenbowl',
		zone: 'green-canteen',
		name: 'Green Bowl สลัดคลีน',
		category: 'อาหารคลีน',
		description: 'สลัดและข้าวกล้องอกไก่ สายสุขภาพต้องโดน',
		imageUrl: img('photo-1512621776951-a57141f2eefd', 800),
		isOpen: true,
		rating: 4.6,
		reviewsCount: '420',
		queueMinutes: 7,
		lock: 'ล็อก 12',
		isPartner: false,
		promotions: [],
		menuItems: [
			{ id: 'gb1', storeId: 'store-greenbowl', name: 'สลัดอกไก่ย่างซอสงา', price: 65, description: 'ผักสลัดสด อกไก่ย่างนุ่ม ซอสงาญี่ปุ่น', imageUrl: img('photo-1512621776951-a57141f2eefd', 300), isAvailable: true, category: 'สลัด', isPopular: true },
			{ id: 'gb2', storeId: 'store-greenbowl', name: 'ข้าวกล้องแซลมอนเทอริยากิ', price: 89, originalPrice: 99, description: 'แซลมอนย่างซอสเทอริยากิ ข้าวกล้องหอมมะลิ', imageUrl: img('photo-1467003909585-2f8a72700288', 300), isAvailable: true, category: 'ข้าวกล่อง' }
		]
	},
	{
		id: 'store-somtam',
		zone: 'canteen-male',
		name: 'ส้มตำป้าแจ๋ว',
		category: 'อาหารอีสาน',
		description: 'ส้มตำ ลาบ น้ำตก ไก่ย่าง รสแซ่บนัว',
		imageUrl: img('photo-1562967916-eb82221dfb44', 800),
		isOpen: true,
		rating: 4.6,
		reviewsCount: '650',
		queueMinutes: 8,
		lock: 'ล็อก 3',
		isPartner: false,
		promotions: [],
		menuItems: [
			{ id: 'st1', storeId: 'store-somtam', name: 'ส้มตำไทย', price: 40, description: 'ส้มตำรสจัดจ้าน ถั่วลิสง กุ้งแห้ง', imageUrl: img('photo-1562967916-eb82221dfb44', 300), isAvailable: true, category: 'ส้มตำ', isPopular: true },
			{ id: 'st2', storeId: 'store-somtam', name: 'ส้มตำปูปลาร้า', price: 50, description: 'แซ่บนัว ปูดองเค็ม ปลาร้าหอม', imageUrl: img('photo-1559847844-5315695dadae', 300), isAvailable: true, category: 'ส้มตำ' },
			{ id: 'st3', storeId: 'store-somtam', name: 'ไก่ย่าง 1/4 ตัว + ข้าวเหนียว', price: 60, description: 'ไก่ย่างหนังกรอบ น้ำจิ้มแจ่ว ข้าวเหนียวร้อนๆ', imageUrl: img('photo-1532550907401-a500c9a57435', 300), isAvailable: true, category: 'ไก่ย่าง' }
		]
	},
	{
		id: 'store-dormkitchen',
		zone: 'dorm',
		name: 'ครัวป้าติ๋ม หน้าหอใน',
		category: 'ข้าวราดแกง',
		description: 'ข้าวราดแกง 2 อย่าง ไข่เจียวฟูๆ อิ่มคุ้ม',
		imageUrl: img('photo-1455619452474-d2be8b1e70cd', 800),
		isOpen: true,
		rating: 4.5,
		reviewsCount: '310',
		queueMinutes: 4,
		lock: 'หอพัก S5',
		isPartner: false,
		promotions: [],
		menuItems: [
			{ id: 'dk1', storeId: 'store-dormkitchen', name: 'ข้าวราดแกง 2 อย่าง', price: 40, description: 'เลือกกับข้าวหน้าร้านได้ ระบุในหมายเหตุ', imageUrl: img('photo-1455619452474-d2be8b1e70cd', 300), isAvailable: true, category: 'ข้าวราดแกง', isPopular: true },
			{ id: 'dk2', storeId: 'store-dormkitchen', name: 'ข้าวไข่เจียวหมูสับ', price: 35, description: 'ไข่เจียวฟูกรอบ หมูสับแน่นๆ', imageUrl: img('photo-1525351484163-7529414344d8', 300), isAvailable: true, category: 'ไข่เจียว' }
		]
	}
];

// ---------- Pure helpers over a store list (the live list lives in stores/catalog) ----------

export function findStore(stores: Store[], id: string): Store | undefined {
	return stores.find((s) => s.id === id);
}

/** Promotions a buyer can use right now */
export function livePromotions(store: Store, now = Date.now()): Promotion[] {
	return store.promotions.filter((p) => p.active && p.approved && (!p.endsAt || new Date(p.endsAt).getTime() > now));
}

/** Partner stores first, then by rating: the "listed first" partner perk */
export function sortForBrowsing(stores: Store[]): Store[] {
	return [...stores].sort((a, b) => Number(b.isPartner) - Number(a.isPartner) || b.rating - a.rating);
}

/** Live search across store name, category and menu item names */
export function searchStores(stores: Store[], query: string, zone: StoreZone | 'all'): { store: Store; matchedItems: string[] }[] {
	const q = query.trim().toLowerCase();
	return sortForBrowsing(stores)
		.filter((s) => zone === 'all' || s.zone === zone)
		.map((store) => {
			if (!q) return { store, matchedItems: [] };
			const storeHit = store.name.toLowerCase().includes(q) || store.category.toLowerCase().includes(q);
			const matchedItems = store.menuItems.filter((m) => m.name.toLowerCase().includes(q)).map((m) => m.name);
			return storeHit || matchedItems.length > 0 ? { store, matchedItems } : null;
		})
		.filter((r): r is { store: Store; matchedItems: string[] } => r !== null);
}
