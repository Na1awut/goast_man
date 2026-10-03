// Every t('...') in the code has an English entry, with the same {placeholders}, and the English is not left as Thai.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { en } from './i18n/en';

const ROOT = join(__dirname);
// Thai letters and marks; the baht sign (U+0E3F) sits inside the Thai block but is not Thai text
const THAI = /[฀-฾เ-๿]/;
// What the code wraps in t(): Thai text, or the baht sign that ends a price
const SOURCE_TEXT = /[฀-๿]/;

function files(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) return files(p);
		return /\.(svelte|ts)$/.test(name) && !/\.test\.ts$/.test(name) && name !== 'i18n.ts' && !p.includes(join('i18n', 'en.ts')) ? [p] : [];
	});
}

function unquote(lit: string): string {
	const q = lit[0];
	return lit
		.slice(1, -1)
		.replace(/\\(.)/g, (_, c: string) => (c === 'n' ? '\n' : c))
		.replace(q === "'" ? /\\'/g : /\\"/g, q);
}

/** [file, key] for every t('...') / t("...") with a literal first argument that contains Thai */
function usedKeys(): [string, string][] {
	const out: [string, string][] = [];
	const call = /(?<![\w$.])t\(\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g;
	for (const f of files(ROOT)) {
		const src = readFileSync(f, 'utf8');
		for (const m of src.matchAll(call)) {
			const key = unquote(m[1]);
			if (SOURCE_TEXT.test(key)) out.push([f.slice(ROOT.length + 1), key]);
		}
	}
	return out;
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('English translations', () => {
	const used = usedKeys();

	it('finds the translated screens (the scan itself works)', () => {
		expect(used.length).toBeGreaterThan(500);
	});

	it('every Thai text passed to t() has an English entry', () => {
		const missing = used.filter(([, k]) => !(k in en)).map(([f, k]) => `${f}: ${k}`);
		expect(missing).toEqual([]);
	});

	it('English keeps the same {placeholders} as the Thai', () => {
		const bad = Object.entries(en).filter(([k, v]) => placeholders(k).join() !== placeholders(v).join()).map(([k]) => k);
		expect(bad).toEqual([]);
	});

	it('no English entry is still Thai', () => {
		const thai = Object.entries(en).filter(([, v]) => THAI.test(v)).map(([k]) => k);
		expect(thai).toEqual([]);
	});

	it('no entry is unused (so the list does not grow stale)', () => {
		const usedSet = new Set(used.map(([, k]) => k));
		// Texts that reach t() from data, not from a literal: store categories, zone names, DB system chat lines
		const fromData = /^(KFC|CB1|Green Canteen|ทั้งหมด|หอ|โรงอาหาร|ร้านค้า|โซน|อาคาร|ไก่ทอด|ของว่าง|ข้าว|เครื่องดื่ม|บะหมี่|ผลไม้|อาหาร|สมุนไพร|เพิ่ม|อิตาเลี่ยน|ลูกชิ้น|ก๋วยเตี๋ยว|น้ำ|นมสด|ผสม|เบเกอรี่|ทานเล่น|ขนมปัง|เมนูเนื้อ|ไอศกรีม|ติดต่อเรา|คณะ|สถาบัน|บัณฑิต|สร้างออเดอร์แล้ว กำลังหาเพื่อนรับหิ้ว|ได้รับชำระเงินแล้ว กำลังหาเพื่อนรับหิ้ว|โหมดทดสอบ: ชำระ)/;
		const stale = Object.keys(en).filter((k) => !usedSet.has(k) && !fromData.test(k));
		expect(stale).toEqual([]);
	});
});
