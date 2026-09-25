import { describe, expect, it } from 'vitest';
import { STORE_CATALOGUE } from './stores';
import { mockMenuPhoto } from './menuPhotos';

// Two names that must share a photo, and pairs that must not
const same = (a: [string, string], b: [string, string]) => expect(mockMenuPhoto(...a)).toBe(mockMenuPhoto(...b));
const differ = (a: [string, string], b: [string, string]) => expect(mockMenuPhoto(...a)).not.toBe(mockMenuPhoto(...b));

describe('mockMenuPhoto', () => {
	it('matches dishes before their ingredients', () => {
		same(['ก๋วยเตี๋ยวลูกชิ้น + เนื้อสด', 'ข้าว'], ['ก๋วยเตี๋ยวหมูแดง', 'ข้าว']);
		same(['ข้าวผัดไส้กรอก', 'ข้าว'], ['ข้าวผัดแฮม', 'ข้าว']);
		differ(['อาหารตามสั่ง: เนื้อ / หมูกรอบ / กุ้ง / ปลาหมึก', 'อาหารตามสั่ง'], ['ชุดข้าวหน้าปลาซาบะ', 'อาหารจานเดียว']);
		differ(['ลูกชิ้นหมู', 'ลูกชิ้น'], ['ก๋วยเตี๋ยวลูกชิ้นปลา', 'ก๋วยเตี๋ยว']);
	});

	it('reads the menu section, so drinks and bakery at one stall get the right photo', () => {
		differ(['นมสด', 'นมสด'], ['เค้กช็อกโกแลต', 'เบเกอรี่']);
		differ(['เค้กช็อกโกแลต', 'เบเกอรี่'], ['โกโก้', 'นมสด']);
		differ(['ข้าวหมูแดง', 'ข้าว'], ['แดงโซดา', 'อิตาเลี่ยนโซดา']);
	});

	it('gives every catalogue item a photo', () => {
		for (const store of STORE_CATALOGUE) for (const item of store.menuItems) expect(item.imageUrl, item.name).toMatch(/^https:\/\/images\.unsplash\.com\//);
	});
});
