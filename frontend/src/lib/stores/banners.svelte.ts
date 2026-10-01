// Dynamic Home Banners store (Svelte 5 runes).
// Supports Live Supabase persistence with fallback to localStorage and default image.
import type { HomeBanner } from '$lib/types';
import * as api from '$lib/api/live';
import { isLive } from '$lib/supabase';
import { fileToDataUrl } from '$lib/image';
import defaultBanner from '../../../../src/picture/web_banner_1.png';

const STORAGE_KEY = 'gooseman_home_banners';

export const DEFAULT_BANNER: HomeBanner = {
	id: 'default-1',
	imageUrl: defaultBanner,
	title: 'ขี้เกียจเดินฝ่าแดด? ให้ห่านบางมดหิ้วให้',
	subtitle: 'ค่าหิ้วเริ่มต้นเพียง 15.-',
	linkUrl: 'STORES',
	buttonText: 'ฝากหิ้วเลย',
	active: true,
	sort: 0
};

class BannersStore {
	list = $state<HomeBanner[]>([DEFAULT_BANNER]);
	loading = $state(false);
	error = $state<string | null>(null);

	activeBanners = $derived(
		this.list.filter((b) => b.active).sort((a, b) => a.sort - b.sort)
	);

	constructor() {
		this.#init();
	}

	#init() {
		if (typeof localStorage !== 'undefined') {
			try {
				const raw = localStorage.getItem(STORAGE_KEY);
				if (raw) {
					const saved = JSON.parse(raw);
					if (Array.isArray(saved) && saved.length > 0) {
						this.list = saved;
					}
				}
			} catch {}
		}
	}

	#persistLocal() {
		if (typeof localStorage !== 'undefined') {
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(this.list));
			} catch {}
		}
	}

	async load() {
		if (!isLive) {
			this.#init();
			return;
		}
		this.loading = true;
		this.error = null;
		try {
			const data = await api.fetchHomeBanners();
			if (data && data.length > 0) {
				this.list = data;
				this.#persistLocal();
			} else {
				// No DB rows yet: keep current or fallback to default
				if (this.list.length === 0) {
					this.list = [DEFAULT_BANNER];
				}
			}
		} catch (err) {
			console.warn('Could not load banners from API, keeping current', err);
			if (this.list.length === 0) {
				this.list = [DEFAULT_BANNER];
			}
		} finally {
			this.loading = false;
		}
	}

	async save(banner: HomeBanner, photoFile?: File | null): Promise<void> {
		let imageUrl = banner.imageUrl;
		if (photoFile) {
			try {
				imageUrl = await api.uploadStoreImage('home-banners', photoFile, 'banner');
			} catch {
				imageUrl = await fileToDataUrl(photoFile);
			}
		}

		const id = banner.id || `banner-${Date.now()}`;
		const toSave: HomeBanner = {
			...banner,
			id,
			imageUrl: imageUrl || DEFAULT_BANNER.imageUrl
		};

		if (isLive) {
			try {
				await api.saveHomeBanner(toSave);
			} catch (e) {
				console.warn('DB save banner error, storing locally as fallback', e);
			}
		}

		const idx = this.list.findIndex((b) => b.id === id);
		if (idx >= 0) {
			this.list[idx] = toSave;
		} else {
			this.list.push(toSave);
		}
		this.#persistLocal();
	}

	async delete(id: string): Promise<void> {
		if (isLive) {
			try {
				await api.deleteHomeBanner(id);
			} catch (e) {
				console.warn('DB delete banner error, updating locally', e);
			}
		}
		this.list = this.list.filter((b) => b.id !== id);
		if (this.list.length === 0) {
			this.list = [DEFAULT_BANNER];
		}
		this.#persistLocal();
	}

	async toggle(id: string, active: boolean): Promise<void> {
		const target = this.list.find((b) => b.id === id);
		if (!target) return;
		target.active = active;
		await this.save(target);
	}

	async reorder(newOrder: HomeBanner[]): Promise<void> {
		this.list = newOrder.map((b, i) => ({ ...b, sort: i }));
		this.#persistLocal();
		if (isLive) {
			for (const b of this.list) {
				try {
					await api.saveHomeBanner(b);
				} catch {}
			}
		}
	}
}

export const banners = new BannersStore();
