// Store catalogue: the real stalls of โรงอาหาร KFC (หลัก), มจธ., with the menus
// and prices from src/picture/food_store/ร้านKFCหลัก.pdf.
// Also the source for supabase/seed.sql (node supabase/generate-seed.mjs).
//
// Deliberately left unset because the source does not say:
//   - ratings / reviews: every store starts as "ร้านใหม่ในแอป"
//   - partner status and promotions: no stall has signed up yet
// queueMinutes is an estimate by kind of stall, used for the rider's pickup timing.
import type { MenuItem, Promotion, Store, StoreZone } from '$lib/types';
import { mockMenuPhoto } from './menuPhotos.ts';

export const STORE_ZONES: { id: StoreZone | 'all'; label: string }[] = [
	{ id: 'all', label: 'ทั้งหมด' },
	{ id: 'kfc-main', label: 'KFC (หลัก)' },
	{ id: 'canteen-male', label: 'โรงชาย' },
	{ id: 'green-canteen', label: 'Green Canteen 190 ปี' },
	{ id: 'dorm', label: 'หอพัก' }
];

export const ZONE_NAMES: Record<StoreZone, string> = {
	'kfc-main': 'โรงอาหาร KFC (หลัก)',
	'canteen-male': 'โรงอาหารพระจอมเกล้า (โรงชาย)',
	'green-canteen': 'Green Canteen 190 ปี',
	dorm: 'โซนหอพักนักศึกษา'
};

/** [name, price, special price (พิเศษ), description] */
type Line = [string, number, number?, string?];
type Section = [category: string, lines: Line[]];

const BOX_NOTE = 'ร้านคิดค่าใส่กล่อง 5 บาท';
const CURRY_NOTE = 'เลือกกับข้าวหน้าร้าน ระบุในหมายเหตุ';

function menu(storeId: string, sections: Section[]): MenuItem[] {
	let n = 0;
	return sections.flatMap(([category, lines]) =>
		lines.map(([name, price, specialPrice, description]) => ({
			id: `${storeId}-${++n}`,
			storeId,
			name,
			price,
			specialPrice,
			description: description ?? '',
			// Mockup until the stall sends real food photos
			imageUrl: mockMenuPhoto(name, category),
			isAvailable: true,
			category
		}))
	);
}

function stall(o: { id: string; no?: number; name: string; category: string; description: string; queueMinutes: number; sections: Section[] }): Store {
	return {
		id: o.id,
		zone: 'kfc-main',
		name: o.name,
		category: o.category,
		description: o.description,
		imageUrl: `stores/${o.id}.webp`,
		isOpen: true,
		rating: 0,
		reviewsCount: '0',
		queueMinutes: o.queueMinutes,
		lock: o.no ? `ร้านที่ ${o.no}` : 'ซุ้มร้านเสริม',
		isPartner: false,
		promotions: [],
		menuItems: menu(o.id, o.sections)
	};
}

const drinks15 = (names: string[]): Line[] => names.map((n) => [n, 15]);

export const STORE_CATALOGUE: Store[] = [
	stall({
		id: 'kfc-01',
		no: 1,
		name: 'ป้าวาบ (PA WAB FRESH MILK)',
		category: 'เครื่องดื่ม',
		description: 'นมสด ชา กาแฟ อิตาเลี่ยนโซดา และเบเกอรี่',
		queueMinutes: 3,
		sections: [
			['นมสด', [['นมสด', 25], ['โกโก้', 25], ['กาแฟ', 25], ['โอวัลติน', 25], ['นมสดปั่น', 30], ['โกโก้ปั่น', 30], ['นมสดคาราเมล', 30]]],
			['อิตาเลี่ยนโซดา', ['แดงโซดา', 'เขียวโซดา', 'น้ำผึ้งโซดา', 'ลิ้นจี่โซดา', 'บลูฮาวายโซดา', 'เสาวรสโซดา', 'ส้มโซดา', 'มะนาวโซดา'].map((n): Line => [n, 20])],
			['เครื่องดื่มสมุนไพร / ทั่วไป', [...drinks15(['น้ำส้ม', 'น้ำลำไย', 'เก๊กฮวย', 'กระเจี๊ยบ', 'ใบเตย', 'โอเลี้ยง', 'ชาเย็น', 'ชาดำเย็น', 'ชามะนาว', 'ชาเขียว', 'นมเย็น', 'น้ำอัดลม (แก้ว)']), ['น้ำเปล่า (ขวด)', 6]]],
			['เบเกอรี่', [['เค้กโดนัท', 20], ['เค้กช็อกโกแลต', 25], ['เค้กส้ม', 25], ['บัตเตอร์เค้ก', 25], ['บราวนี่', 30]]]
		]
	}),
	stall({
		id: 'kfc-02',
		no: 2,
		name: 'ครัวกรุงศรี (KRUA KRUNGSRI)',
		category: 'ข้าวราดแกง ฮาลาล',
		description: `ข้าวราดแกงและกับข้าวฮาลาล · ${BOX_NOTE}`,
		queueMinutes: 5,
		sections: [
			[
				'ข้าวแกงและจานเดียว',
				[
					['ข้าวราดแกง 1 อย่าง', 30, 40, CURRY_NOTE],
					['ข้าวราดแกง 2 อย่าง', 40, 45, CURRY_NOTE],
					['กับข้าว', 35, 40, CURRY_NOTE],
					['ข้าวเปล่า', 10],
					['ข้าวมัสมั่นไก่', 40, 50],
					['ข้าวไก่อบ', 40, 50],
					['ข้าวคลุกกะปิ', 40, 50],
					['ก๋วยเตี๋ยวแกงไก่', 40, 50]
				]
			],
			['เมนูเนื้อวัว', [['ข้าวเนื้ออบ', 50, 60], ['ข้าวมัสมั่นเนื้อ', 50, 60], ['ก๋วยเตี๋ยวลูกชิ้น + เนื้อสด', 45, 55], ['ก๋วยเตี๋ยวลูกชิ้น + เนื้อตุ๋น', 50, 60]]],
			['เพิ่มเติม', [['ไข่ดาว', 10], ['ไข่ต้ม', 10]]]
		]
	}),
	stall({
		id: 'kfc-03',
		no: 3,
		name: 'NUY หนุ่ม บะหมี่เกี๊ยว',
		category: 'บะหมี่ ก๋วยเตี๋ยว',
		description: `บะหมี่เกี๊ยว หมูแดง หมูกรอบ สไตล์จีน · ${BOX_NOTE}`,
		queueMinutes: 7,
		sections: [
			[
				'ก๋วยเตี๋ยวและบะหมี่',
				[
					['บะหมี่หมูแดง', 30, 40],
					['ก๋วยเตี๋ยวหมูแดง', 30, 40],
					['ก๋วยเตี๋ยวลูกชิ้นปลา', 35, 45],
					['ก๋วยเตี๋ยวต้มยำ', 35, 45],
					['เย็นตาโฟ', 35, 45],
					['เย็นตาโฟต้มยำ', 35, 45],
					['มาม่าต้มยำ', 40, 50],
					['เกาเหลา', 35, 45],
					['เกี๊ยวน้ำ', 35, 45],
					['เกี๊ยวเย็นตาโฟ', 40, 50]
				]
			],
			['ข้าว', [['ข้าวหมูแดง', 40, 50], ['ข้าวหมูแดง + หมูกรอบ', 40, 50], ['ข้าวเปล่า', 7, 10]]],
			[
				'เพิ่มเติมและทานเล่น',
				[
					['เกี๊ยวทอดกรอบ', 5],
					['ไข่ต้ม', 7],
					['เพิ่มหมูกรอบ', 10],
					['เพิ่มหมูแดง', 10],
					['เพิ่มลูกชิ้น', 10],
					['เพิ่มหมูสับ', 10],
					['มาม่า OK ฮอตแอนด์สไปซี่ (1 ห่อ)', 45],
					['มาม่า OK ฮอตแอนด์สไปซี่ (2 ห่อ)', 60]
				]
			]
		]
	}),
	stall({
		id: 'kfc-04',
		no: 4,
		name: 'Dino Papa EXPRESS',
		category: 'ไก่ทอด ไอศกรีม',
		description: 'ข้าวไก่ทอดเกาหลี อาหารทานเล่น และไอศกรีม',
		queueMinutes: 5,
		sections: [
			[
				'ข้าวและอาหารทานเล่น',
				[
					['ข้าวไก่ทอดเกาหลี', 45],
					['ข้าวไก่ทอดเกาหลี + ออนเซ็น', 55],
					['ข้าวไก่ทอดเกาหลี Orange Mayo', 55],
					['ข้าวไก่ทอดเกาหลี Snow Onion เมเปิ้ล', 55],
					['ข้าวไก่ทอดเกาหลี Orange ออนเซ็น', 65],
					['ไก่นิวออลีนส์', 15],
					['ไข่ออนเซ็น', 10],
					['กิมจิ', 15]
				]
			],
			[
				'ไอศกรีม',
				[
					['ไอศกรีมถ้วยเล็ก', 25, undefined, 'รสโยเกิร์ต / นม / ทูโทน ระบุในหมายเหตุ'],
					['ไอศกรีมถ้วยใหญ่ (พร้อม 1-2 ท็อปปิ้ง)', 30, undefined, 'รสโยเกิร์ต / นม / ทูโทน ระบุในหมายเหตุ'],
					['เพิ่มท็อปปิ้ง', 5],
					['เพิ่มไอศกรีม', 5]
				]
			]
		]
	}),
	stall({
		id: 'kfc-05',
		no: 5,
		name: 'ร้านข้าวมันไก่ & ข้าวหมกไก่ (HALAL FOODS)',
		category: 'ข้าวมันไก่ ข้าวหมกไก่ ฮาลาล',
		description: `ข้าวมันไก่ ไก่ทอด และข้าวหมกไก่ ฮาลาล · ${BOX_NOTE}`,
		queueMinutes: 5,
		sections: [
			[
				'ข้าวและไก่',
				[
					['ข้าวไก่หวาน', 30, 40],
					['ข้าวคั่วกลิ้งไก่', 30, 40],
					['ข้าวมันไก่ต้ม', 35, 40],
					...[
						'ข้าวมันไก่ทอด',
						'ข้าวมันไก่ย่าง',
						'ข้าวหมกไก่ต้ม',
						'ข้าวหมกไก่ทอด',
						'ข้าวหมกไก่ย่าง',
						'ข้าวแกงมัสมั่นไก่',
						'ข้าวแกงกุรุม่าไก่',
						'ข้าวไก่อบเห็ดหอม',
						'ข้าวไก่แดงเห็ดหอม',
						'ข้าวไก่ย่างยำแซ่บ',
						'ข้าวไก่ทอดยำแซ่บ',
						'ข้าวไก่ย่างซอสกะเพรา',
						'ข้าวไก่ย่างซอสพริกไทยดำ',
						'ข้าวสตูไก่',
						'ข้าวไก่กระเทียม',
						'ข้าวแกงกะหรี่ไก่',
						'ข้าวแกงพะแนงไก่',
						'ข้าวไก่ย่างเทอริยากิ'
					].map((n): Line => [n, 40, 50])
				]
			],
			['เพิ่มเติม', [['ไข่ดาว', 10], ['ไข่ต้ม', 10], ['ฮอทดอก', 10], ['ไก่ทอด', 10]]]
		]
	}),
	stall({
		id: 'kfc-06',
		no: 6,
		name: 'ฟ้าใสแซ่บเว่อร์',
		category: 'อาหารจานเดียว ของทานเล่น',
		description: `ข้าวไก่ทอด ทงคัตสึ ข้าวหน้าหมูย่างเกาหลี และของทานเล่น · ${BOX_NOTE}`,
		queueMinutes: 7,
		sections: [
			[
				'อาหารจานเดียว',
				[
					['ข้าวมันไก่ทอด', 35, 40],
					['ข้าวไก่ทอด', 35, 40],
					['ข้าวไก่ย่างเทอริยากิ', 40, 50],
					['ข้าวไก่ทอดเทอริยากิ', 40, 50],
					['ข้าวไก่ทอดบอนชอน', 45, 55],
					['ข้าวหมูทอดทงคัตสึ', 45, 55],
					['ข้าวแกงกะหรี่ญี่ปุ่นไก่ทอด', 45],
					['ข้าวหน้าหมูย่างเกาหลี', 45, 55],
					['สลัดไก่ทอด', 40],
					['สลัดหมูทอด', 40],
					['ชุดข้าวหน้าปลาซาบะ', 69]
				]
			],
			['เพิ่มเนื้อสัตว์', [['เพิ่มไก่ทอด', 25], ['เพิ่มไก่ย่าง', 25], ['เพิ่มหมูทอด', 35], ['เพิ่มหมูย่าง', 35]]],
			['ทานเล่น', [['ไก่ป๊อป', 25], ['นักเก็ตไก่ (5 ชิ้น)', 30], ['เฟรนช์ฟรายส์', 25], ['หอมทอด', 20], ['เพิ่มชีส', 10]]]
		]
	}),
	stall({
		id: 'kfc-07',
		no: 7,
		name: 'ร้านตำลึงทอง อาหารตามสั่ง & ก๋วยเตี๋ยวไก่',
		category: 'อาหารตามสั่ง ก๋วยเตี๋ยวไก่',
		description: `ข้าวตามสั่ง และก๋วยเตี๋ยวไก่มะระ · ${BOX_NOTE}`,
		queueMinutes: 10,
		sections: [
			[
				'ก๋วยเตี๋ยวไก่',
				[
					['ก๋วยเตี๋ยวไก่ฉีก', 35, 40, 'เลือกเส้น: เส้นเล็ก เส้นใหญ่ หมี่ขาว บะหมี่ วุ้นเส้น มาม่า ระบุในหมายเหตุ'],
					['ก๋วยเตี๋ยวไก่น่องไก่ตุ๋น', 45, undefined, 'เลือกเส้นระบุในหมายเหตุ'],
					['ก๋วยเตี๋ยวไก่น่องไก่ติดสะโพก', 55, undefined, 'เลือกเส้นระบุในหมายเหตุ'],
					['ทำเป็นเกาเหลา', 5],
					['เพิ่มตีนไก่ (ต่อขา)', 5]
				]
			],
			[
				'อาหารตามสั่ง',
				[
					['อาหารตามสั่ง: ไม่ใส่เนื้อสัตว์ / ไก่', 40, undefined, 'บอกเมนูในหมายเหตุ เช่น ผัดกะเพรา ผัดพริกแกง ข้าวผัด ราดหน้า ผัดซีอิ๊ว ต้มยำ'],
					['อาหารตามสั่ง: หมูสับ / หมูชิ้น', 45, undefined, 'บอกเมนูในหมายเหตุ เช่น ผัดกะเพรา ผัดพริกแกง ข้าวผัด ราดหน้า ผัดซีอิ๊ว ต้มยำ'],
					['อาหารตามสั่ง: เนื้อ / หมูกรอบ / กุ้ง / ปลาหมึก / รวมมิตร', 50, undefined, 'บอกเมนูในหมายเหตุ เช่น ผัดกะเพรา ผัดพริกแกง ข้าวผัด ราดหน้า ผัดซีอิ๊ว ต้มยำ'],
					['ไข่เจียวทรงเครื่องราดข้าว (1 ฟอง)', 25],
					['ไข่เจียวทรงเครื่องราดข้าว (2 ฟอง)', 35]
				]
			],
			['เพิ่มเติม', [['ไข่ดาว', 10], ['ไข่เจียว', 10], ['เพิ่มข้าว', 5]]]
		]
	}),
	stall({
		id: 'kfc-08',
		no: 8,
		name: 'ครัวสุดารัตน์ (Krua Sudarat)',
		category: 'ข้าวราดแกง',
		description: `ข้าวแกงและกับข้าวหลากหลายเมนูต่อวัน · ${BOX_NOTE}`,
		queueMinutes: 5,
		sections: [
			[
				'ข้าวแกงและจานเดียว',
				[
					['ข้าวราดแกง 1 อย่าง', 30, 40, CURRY_NOTE],
					['ข้าวราดแกง 2 อย่าง', 35, 45, CURRY_NOTE],
					['กับข้าว', 35, 40, CURRY_NOTE],
					['ข้าวเปล่า', 10],
					['ข้าวเขียวหวานไก่ทอด', 35, 40],
					['ข้าวผัดแฮม', 35, 40],
					['ข้าวผัดไส้กรอก', 35, 40],
					['ข้าวกะเพราโบราณ + ไข่ดาว', 35, 40],
					['ข้าวไข่ระเบิด', 35, 40],
					['ข้าวไก่ทอดสามรส', 35, 40],
					['ขนมจีนแกงเขียวหวานไก่', 35, 40]
				]
			],
			['เพิ่มเติม', [['ไส้กรอกจัมโบ้', 15], ['ไก่ทอด', 20], ['ไข่ดาว', 10], ['ไข่ต้ม', 10]]]
		]
	}),
	stall({
		id: 'kfc-09',
		no: 9,
		name: 'ครัวคุณอู๋ BY COMCAMP',
		category: 'ข้าวราดแกง สุกี้',
		description: `ข้าวแกงกับข้าวสไตล์โฮมเมด และสุกี้ · ${BOX_NOTE}`,
		queueMinutes: 5,
		sections: [
			[
				'ข้าวแกงและจานเดียว',
				[
					['ข้าวราดแกง 1 อย่าง', 30, 40, CURRY_NOTE],
					['ข้าวราดแกง 2 อย่าง', 35, 45, CURRY_NOTE],
					['กับข้าว', 35, 40, CURRY_NOTE],
					['ข้าวเปล่า', 10],
					['ข้าวไก่ทอดแกงกะหรี่ญี่ปุ่น', 40, 50],
					['สุกี้หมู + ไก่', 40, 50, 'น้ำหรือแห้ง ระบุในหมายเหตุ'],
					['สุกี้ทะเล', 50, 60, 'น้ำหรือแห้ง ระบุในหมายเหตุ']
				]
			],
			['เพิ่มเติม', [['หมูนึ่งไข่เค็ม', 25], ['ไข่เค็มดาว', 15], ['ไข่ดาว', 10], ['ไข่ต้ม', 10]]]
		]
	}),
	stall({
		id: 'kfc-10',
		no: 10,
		name: 'จิรพันธุ์ เครื่องดื่ม',
		category: 'เครื่องดื่ม น้ำปั่น',
		description: 'ชา กาแฟ น้ำปั่น และอิตาเลี่ยนโซดา',
		queueMinutes: 3,
		sections: [
			['น้ำปั่น', ['ส้มปั่น', 'มะนาวปั่น', 'ลิ้นจี่ปั่น', 'โยเกิร์ตปั่น', 'แดงแมงลักปั่น', 'เฉาก๊วยปั่น', 'โกโก้ปั่น'].map((n): Line => [n, 18])],
			['อิตาเลี่ยนโซดา', ['แอปเปิ้ลโซดา', 'กีวี่โซดา', 'ลิ้นจี่โซดา', 'มะม่วงโซดา', 'แดงโซดา', 'เขียวโซดา', 'สตรอว์เบอร์รี่โซดา', 'บลูเลมอนโซดา'].map((n): Line => [n, 20])],
			[
				'สมุนไพร ชา กาแฟ',
				[
					...drinks15([
						'น้ำส้ม',
						'น้ำมะพร้าว',
						'น้ำฝรั่ง',
						'น้ำลำไย',
						'สับปะรด + เงาะ',
						'กระเจี๊ยบพุทราจีน',
						'น้ำผึ้งมะนาว',
						'วุ้นใบเตย',
						'ใบบัวบก',
						'เก๊กฮวย',
						'ชาเย็น',
						'ชาดำเย็น',
						'ชามะนาว',
						'ชาเขียวมะลิ',
						'ชาเขียวนม',
						'โกโก้',
						'กาแฟโบราณ',
						'นมชมพู',
						'น้ำอัดลม (แก้ว)'
					]),
					['น้ำเปล่า (ขวด)', 6]
				]
			]
		]
	}),
	stall({
		id: 'kfc-aroi',
		name: 'อร่อยไม่ซ้ำ (ขนมปังปิ้ง & ลูกชิ้น)',
		category: 'ของว่าง ทานเล่น',
		description: 'ขนมปังปิ้ง ลูกชิ้นยำ/ทอด และไอศกรีม',
		queueMinutes: 5,
		sections: [
			['ขนมปังปิ้ง', ['เนยนม', 'แยมสตรอว์เบอร์รี่', 'ช็อกโกแลต', 'คาราเมล', 'โอวัลติน'].map((n): Line => [`ขนมปังปิ้ง ${n}`, 15])],
			[
				'ลูกชิ้น (ไม้ละ 10 บาท)',
				['ปูอัด', 'ลูกชิ้นหมู', 'ลูกชิ้นเนื้อ', 'ลูกชิ้นไก่', 'เต้าหู้ชีส', 'เต้าหู้ปลา', 'ไส้กรอกชีส', 'ไส้กรอกรมควัน', 'ไส้กรอกหนังกรอบ', 'ไส้กรอกนม', 'มินิสอดหมู', 'เกี๊ยวห่อไข่', 'เกี๊ยวห่อไส้กรอก'].map(
					(n): Line => [n, 10, undefined, 'ยำหรือทอด และน้ำจิ้ม (ซีฟู้ด / หม่าล่า / มะขาม) ระบุในหมายเหตุ']
				)
			]
		]
	}),
	stall({
		id: 'kfc-artter',
		name: 'อาร์ทเตอร์ผลไม้สด-ปั่น',
		category: 'ผลไม้ น้ำผลไม้ปั่น',
		description: 'ผลไม้สดปลอก และน้ำผลไม้ปั่น',
		queueMinutes: 4,
		sections: [
			['น้ำผลไม้ปั่น', ['ส้ม', 'แตงโม', 'แอปเปิ้ล', 'สับปะรด', 'กล้วย', 'มะม่วง', 'สตรอว์เบอร์รี่', 'ฝรั่ง'].map((n): Line => [`น้ำ${n}ปั่น`, 30])],
			[
				'ผสมนมสด / โยเกิร์ต',
				['น้ำมะพร้าวนมสดปั่น', 'น้ำแคนตาลูปนมสดปั่น', 'น้ำกล้วยนมสดปั่น', 'น้ำมะม่วงโยเกิร์ตปั่น', 'น้ำสตรอว์เบอร์รี่โยเกิร์ตปั่น', 'น้ำผลไม้รวมปั่น'].map((n): Line => [n, 35])
			]
		]
	})
];

// ---------- Pure helpers over a store list (the live list lives in stores/catalog) ----------

export function findStore(stores: Store[], id: string): Store | undefined {
	return stores.find((s) => s.id === id);
}

/** A store with no reviews yet shows "ร้านใหม่ในแอป" instead of a made-up rating */
export function hasReviews(store: Store): boolean {
	return store.reviewsCount !== '0' && store.rating > 0;
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
