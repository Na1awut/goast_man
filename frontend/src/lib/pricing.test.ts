import { describe, expect, it } from 'vitest';
import { lineName, promoDiscount, quoteDelivery, roundUpTip, unitPrice, type AppliedCode } from './pricing';
import { distanceMeters, PLACES, STORE_ZONE_PLACE } from './routing';

describe('round-up tip', () => {
	it('rounds to the next 5 baht', () => {
		expect(roundUpTip(52)).toBe(3);
		expect(roundUpTip(58)).toBe(2);
		expect(roundUpTip(61)).toBe(4);
	});
	it('offers nothing when the total already ends in 0 or 5', () => {
		expect(roundUpTip(55)).toBe(0);
		expect(roundUpTip(60)).toBe(0);
		expect(roundUpTip(0)).toBe(0);
	});
});

// Same cases as the delivery fee tests in tests/sql.mjs (delivery_quote() decides; this must agree)
describe('delivery fee', () => {
	const from = (zone: keyof typeof STORE_ZONE_PLACE, to: string) => distanceMeters(PLACES[STORE_ZONE_PLACE[zone]], PLACES[to]);
	const q = (distanceM: number | null, floor = 1, raining = false) => quoteDelivery({ distanceM, floor, raining });

	it('is 15 near the canteen and 20 beyond 300 m', () => {
		expect(q(from('kfc-main', 'sit'))).toMatchObject({ base: 15, fee: 15, near: true });
		expect(q(from('kfc-main', 'dorm-s6'))).toMatchObject({ base: 20, fee: 20, near: false });
	});

	it('adds 1 baht a floor and stays within 25', () => {
		expect(q(from('kfc-main', 'sit'), 5).fee).toBe(19);
		expect(q(from('kfc-main', 'sit'), 20).fee).toBe(25);
		expect(q(from('kfc-main', 'dorm-s6'), 8).fee).toBe(25);
	});

	it('charges ฝากซื้อ from 20', () => {
		expect(q(null, 3).fee).toBe(22);
	});

	it('adds 5 in the rain, above the 25 cap too', () => {
		expect(q(from('kfc-main', 'sit'), 1, true).fee).toBe(20);
		expect(q(from('kfc-main', 'dorm-s6'), 8, true).fee).toBe(30);
		expect(q(null, 2, true).fee).toBe(26);
	});
});

// App discount codes: an admin-created effect (AMOUNT off or FREE_DELIVERY), never a hardcoded string
describe('promo code discount', () => {
	it('is 0 with no code applied', () => {
		expect(promoDiscount(null, 15)).toBe(0);
	});
	it('takes the code’s amount off for AMOUNT', () => {
		const code: AppliedCode = { code: 'WELCOME15', kind: 'AMOUNT', amount: 15 };
		expect(promoDiscount(code, 20)).toBe(15);
	});
	it('waives whatever fee is still payable for FREE_DELIVERY', () => {
		const code: AppliedCode = { code: 'GOOSEFREE', kind: 'FREE_DELIVERY', amount: null };
		expect(promoDiscount(code, 24)).toBe(24);
		// Already free from a store promotion: nothing left to waive
		expect(promoDiscount(code, 0)).toBe(0);
	});
});

describe('cart line options and toppings', () => {
	const dish = {
		id: 'dish-1',
		storeId: 'store-1',
		name: 'ข้าวกะเพราหมูกรอบ',
		price: 50,
		specialPrice: 60,
		description: '',
		imageUrl: '',
		isAvailable: true,
		category: 'อาหารจานเดียว'
	};

	it('computes unitPrice with special size and extra options', () => {
		// Normal size without options
		expect(unitPrice({ menuItem: dish })).toBe(50);
		// Special size without options
		expect(unitPrice({ menuItem: dish, special: true })).toBe(60);
		// Normal size + ไข่ดาว (10฿) + ไข่เจียว (15฿)
		expect(
			unitPrice({
				menuItem: dish,
				special: false,
				selectedOptions: [
					{ groupId: 'g1', groupName: 'ท็อปปิ้ง', choiceId: 'c1', name: 'ไข่ดาว', price: 10 },
					{ groupId: 'g1', groupName: 'ท็อปปิ้ง', choiceId: 'c2', name: 'ไข่เจียว', price: 15 }
				]
			})
		).toBe(75);
		// Special size + ไข่ดาว (10฿)
		expect(
			unitPrice({
				menuItem: dish,
				special: true,
				selectedOptions: [
					{ groupId: 'g1', groupName: 'ท็อปปิ้ง', choiceId: 'c1', name: 'ไข่ดาว', price: 10 }
				]
			})
		).toBe(70);
	});

	it('formats lineName with size and selected options', () => {
		expect(lineName({ menuItem: dish })).toBe('ข้าวกะเพราหมูกรอบ');
		expect(lineName({ menuItem: dish, special: true })).toBe('ข้าวกะเพราหมูกรอบ (พิเศษ)');
		expect(
			lineName({
				menuItem: dish,
				special: true,
				selectedOptions: [
					{ groupId: 'g1', groupName: 'ท็อปปิ้ง', choiceId: 'c1', name: 'ไข่ดาว', price: 10 },
					{ groupId: 'g2', groupName: 'ความเผ็ด', choiceId: 'c3', name: 'เผ็ดน้อย', price: 0 }
				]
			})
		).toBe('ข้าวกะเพราหมูกรอบ (พิเศษ) (+ไข่ดาว, เผ็ดน้อย)');
	});
});

