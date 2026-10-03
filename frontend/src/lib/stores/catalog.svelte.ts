// The store catalogue every screen reads (Svelte 5 runes).
// Demo mode: the in-memory STORE_CATALOGUE. Live mode: Supabase, reloaded on demand.
import type { MenuItem, OperatingHours, Promotion, Store, StoreOpenStatus } from '$lib/types';
import { findStore, livePromotions, STORE_CATALOGUE, sortForBrowsing } from '$lib/data/stores';
import * as api from '$lib/api/live';
import * as demoOpen from '$lib/storeOpenDemo';
import { friendlyError, isLive } from '$lib/supabase';
import { uid } from '$lib/utils';
import { toast } from './toast.svelte';
import { t } from '$lib/i18n';

export interface StorefrontDraft {
	tagline: string;
	fastLaneMinutes?: number;
	/** A new banner picked by the partner; `null` removes the current one */
	bannerFile?: File | null;
	bannerUrl?: string | null;
	/** A new logo; `null` removes it (screens then show the name's first letter) */
	logoFile?: File | null;
	logoUrl?: string | null;
	/** A new store photo for lists and cards. A store always keeps a photo, so it can only be replaced */
	photoFile?: File;
	imageUrl?: string | null;
}

class CatalogStore {
	stores = $state<Store[]>(isLive ? [] : STORE_CATALOGUE);
	loading = $state(isLive);
	error = $state<string | null>(null);
	/** Owner-only data stays separate from the catalogue shown to buyers. */
	partnerStore = $state<Store | null>(null);
	partnerLoading = $state(false);
	partnerError = $state<string | null>(null);
	#partnerRequest = 0;

	browsing = $derived(sortForBrowsing(this.stores));
	/** Store deals that are live right now, across every store (home page) */
	storeDeals = $derived(
		this.stores.flatMap((store) =>
			livePromotions(store)
				.filter((p) => p.kind === 'DEAL')
				.map((promotion) => ({ store, promotion }))
		)
	);

	#stopWatching: (() => void) | null = null;

	constructor() {
		if (!isLive && typeof localStorage !== 'undefined') {
			for (const store of this.stores) {
				try {
					const raw = localStorage.getItem('gm_store_hours_' + store.id);
					if (raw) store.operatingHours = JSON.parse(raw);
				} catch {}
			}
		}
		// Demo: nobody runs the database's clock job, so tick here
		if (!isLive && typeof window !== 'undefined') {
			setInterval(() => demoOpen.refreshAll(this.#everyStore()), 30_000);
		}
	}

	#everyStore(): Store[] {
		return this.partnerStore && !this.stores.some((s) => s.id === this.partnerStore!.id) ? [...this.stores, this.partnerStore] : this.stores;
	}

	/**
	 * Live: hear every store's open flag / hours / visibility change as it happens
	 * (the database flips stores on schedule, the team locks them, owners switch them).
	 * Call once the user is signed in; safe to call again.
	 */
	watch() {
		if (!isLive || this.#stopWatching) return;
		this.#stopWatching = api.subscribeStores((row) => {
			const fields = api.storeLiveFields(row);
			const known = this.stores.some((s) => s.id === row.id);
			if (fields.hidden) {
				this.stores = this.stores.filter((s) => s.id !== row.id);
			} else if (known) {
				this.#patch(row.id, (store) => Object.assign(store, fields));
			} else {
				// A store that just became visible: fetch it whole
				void this.#reloadStore(row.id).catch(() => {});
			}
		});
	}

	unwatch() {
		this.#stopWatching?.();
		this.#stopWatching = null;
	}

	/** Reload the catalogue without the loading skeleton (after the connection comes back) */
	async refresh() {
		if (!isLive) return;
		try {
			this.stores = (await api.fetchCatalog()).filter((s) => !s.hidden);
			this.error = null;
		} catch {
			// Keep what is on screen; the next event or reconnect tries again
		}
	}

	byId(id: string): Store | undefined {
		return this.partnerStore?.id === id ? this.partnerStore : findStore(this.stores, id);
	}

	async loadPartnerStore(storeId: string) {
		const request = ++this.#partnerRequest;
		if (this.partnerStore?.id !== storeId) this.partnerStore = null;
		this.partnerLoading = true;
		this.partnerError = null;
		try {
			const store = isLive ? await api.fetchStore(storeId) : findStore(this.stores, storeId);
			if (request !== this.#partnerRequest) return;
			if (!store) throw new Error('STORE_NOT_FOUND');
			if (!isLive && typeof localStorage !== 'undefined') {
				try {
					const raw = localStorage.getItem('gm_store_hours_' + storeId);
					if (raw) store.operatingHours = JSON.parse(raw);
				} catch {}
			}
			this.partnerStore = store;
		} catch (err) {
			if (request !== this.#partnerRequest) return;
			this.partnerStore = null;
			this.partnerError = err instanceof Error && err.message === 'STORE_NOT_FOUND'
				? t('ไม่พบร้านที่เชื่อมกับบัญชีนี้ ติดต่อทีม Goose Man เพื่อตรวจสอบร้าน')
				: friendlyError(err);
		} finally {
			if (request === this.#partnerRequest) this.partnerLoading = false;
		}
	}

	resetPartnerStore() {
		this.#partnerRequest++;
		this.partnerStore = null;
		this.partnerLoading = false;
		this.partnerError = null;
	}

	async load() {
		if (!isLive) return;
		this.loading = true;
		this.error = null;
		try {
			// The database hides these from buyers; a team member signed in here can still read them, so drop them too
			this.stores = (await api.fetchCatalog()).filter((s) => !s.hidden);
		} catch (err) {
			// No silent fallback to demo data: a live app must not show made-up stores
			this.error = friendlyError(err);
		} finally {
			this.loading = false;
		}
	}

	async #reloadStore(storeId: string) {
		const fresh = await api.fetchStore(storeId);
		if (this.partnerStore?.id === storeId) this.partnerStore = fresh;
		this.stores = this.stores.map((s) => (s.id === storeId ? fresh : s)).filter((s) => !s.hidden);
	}

	#patch(storeId: string, fn: (store: Store) => void) {
		const stores = new Set([
			findStore(this.stores, storeId),
			this.partnerStore?.id === storeId ? this.partnerStore : undefined
		]);
		for (const store of stores) if (store) fn(store);
	}

	/** Demo mode only: let the demo shop owner's store act as a partner in this browser */
	markDemoPartner(storeId: string) {
		if (isLive) return;
		this.#patch(storeId, (store) => (store.isPartner = true));
	}

	// ---------- Partner actions ----------

	/** Why the owner's store is open or closed right now (live: the database's answer) */
	async openStatus(storeId: string): Promise<StoreOpenStatus> {
		if (isLive) return this.#adopt(storeId, await api.fetchMyStoreOpenStatus());
		const store = this.byId(storeId);
		if (!store) throw new Error('STORE_NOT_FOUND');
		store.isOpen = demoOpen.decide(store);
		return demoOpen.statusOf(store, false);
	}

	/**
	 * The owner presses open or closed. The database decides what that means (a team lock refuses it,
	 * with a schedule it lasts until the next change) and answers with the new status, which is what we show.
	 * Throws STORE_LOCKED / STORE_STATE_CHANGED etc.
	 */
	async setStoreOpen(storeId: string, open: boolean, opts: { hours?: number; rev?: number; name?: string } = {}): Promise<StoreOpenStatus> {
		if (isLive) return this.#adopt(storeId, await api.setMyStoreOpen(open, { hours: opts.hours, rev: opts.rev }));
		const store = this.#demoStore(storeId);
		return this.#demoSaved(store, demoOpen.ownerSetOpen(store, open, opts.name ?? t('ร้านค้า'), opts.hours, opts.rev));
	}

	/** Drop the hand switch: the schedule runs the store again */
	async followSchedule(storeId: string, rev?: number): Promise<StoreOpenStatus> {
		if (isLive) return this.#adopt(storeId, await api.followMySchedule(rev));
		const store = this.#demoStore(storeId);
		return this.#demoSaved(store, demoOpen.ownerFollowSchedule(store, rev));
	}

	/** Save the weekly schedule */
	async saveOperatingHours(storeId: string, hours: OperatingHours, opts: { rev?: number; name?: string } = {}): Promise<StoreOpenStatus> {
		if (isLive) return this.#adopt(storeId, await api.setMyOperatingHours(hours, opts.rev));
		const store = this.#demoStore(storeId);
		const status = demoOpen.saveHours(store, hours, 'OWNER', opts.name ?? t('ร้านค้า'), opts.rev);
		if (typeof localStorage !== 'undefined') {
			try {
				localStorage.setItem('gm_store_hours_' + storeId, JSON.stringify(store.operatingHours));
			} catch {}
		}
		return this.#demoSaved(store, status);
	}

	#demoStore(storeId: string): Store {
		const store = this.byId(storeId);
		if (!store) throw new Error('STORE_NOT_FOUND');
		return store;
	}

	/** Demo: keep the other copy of the same store (partner view vs catalogue) in step */
	#demoSaved(store: Store, status: StoreOpenStatus): StoreOpenStatus {
		this.#patch(store.id, (s) => {
			s.isOpen = status.is_open;
			s.operatingHours = store.operatingHours;
		});
		return status;
	}

	/** A status from the database is also the truth about the store's flag and hours */
	#adopt(storeId: string, status: StoreOpenStatus): StoreOpenStatus {
		this.#patch(storeId, (store) => {
			store.isOpen = status.is_open;
			store.operatingHours = status.schedule ?? undefined;
		});
		return status;
	}

	/** The partner marks a dish sold out (or back on) */
	async setItemAvailable(storeId: string, itemId: string, available: boolean) {
		if (isLive) await api.setMyItemAvailable(itemId, available);
		this.#patch(storeId, (store) => {
			const item = store.menuItems.find((m) => m.id === itemId);
			if (item) item.isAvailable = available;
		});
	}

	async updateStorefront(storeId: string, draft: StorefrontDraft) {
		if (isLive) {
			const current = this.byId(storeId);
			const resolve = async (
				url: string | null | undefined,
				file: File | null | undefined,
				now: string | undefined,
				kind: 'banner' | 'logo' | 'photo'
			) => {
				if (url !== undefined) return url ? url.trim() : undefined;
				if (file === null) return undefined;
				if (file) return api.uploadStoreImage(storeId, file, kind);
				return now;
			};
			const [bannerUrl, logoUrl, imageUrl] = await Promise.all([
				resolve(draft.bannerUrl, draft.bannerFile, current?.bannerUrl, 'banner'),
				resolve(draft.logoUrl, draft.logoFile, current?.logoUrl, 'logo'),
				resolve(draft.imageUrl, draft.photoFile, current?.imageUrl, 'photo')
			]);
			await api.updateStorefront({ tagline: draft.tagline, fastLaneMinutes: draft.fastLaneMinutes, bannerUrl, logoUrl, imageUrl });
			await this.#reloadStore(storeId);
			return;
		}
		this.#patch(storeId, (store) => {
			store.tagline = draft.tagline.trim() || undefined;
			store.fastLaneMinutes = draft.fastLaneMinutes;
			if (draft.bannerFile) store.bannerUrl = URL.createObjectURL(draft.bannerFile);
			if (draft.bannerFile === null) store.bannerUrl = undefined;
			if (draft.logoFile) store.logoUrl = URL.createObjectURL(draft.logoFile);
			if (draft.logoFile === null) store.logoUrl = undefined;
			if (draft.photoFile) store.imageUrl = URL.createObjectURL(draft.photoFile);
		});
	}

	/**
	 * Add (no id) or change a dish. photoFile: File = upload and use, null = no
	 * photo, undefined = keep the current one.
	 */
	async saveMenuItem(storeId: string, draft: Omit<api.MenuItemArgs, 'imageUrl'> & { imageUrl: string; photoFile?: File | null }) {
		if (isLive) {
			const imageUrl = draft.photoFile ? await api.uploadStoreImage(storeId, draft.photoFile, 'menu') : draft.photoFile === null ? '' : draft.imageUrl;
			await api.saveMenuItem({ ...draft, imageUrl });
			await this.#reloadStore(storeId);
			return;
		}
		this.#patch(storeId, (store) => {
			const imageUrl = draft.photoFile ? URL.createObjectURL(draft.photoFile) : draft.photoFile === null ? '' : draft.imageUrl;
			const fields = {
				name: draft.name.trim(),
				category: draft.category.trim(),
				price: draft.price,
				specialPrice: draft.specialPrice,
				description: draft.description.trim(),
				imageUrl,
				isAvailable: draft.isAvailable,
				options: draft.options ?? []
			};
			const idx = draft.id ? store.menuItems.findIndex((m) => m.id === draft.id) : -1;
			if (idx >= 0) {
				// Replace the whole item (not Object.assign) so Svelte 5's reactive proxy
				// sees a new object and re-exposes options to any $effect readers.
				store.menuItems[idx] = { ...store.menuItems[idx], ...fields };
			} else {
				store.menuItems.push({ id: uid(storeId), storeId, isPopular: false, ...fields } as MenuItem);
			}
		});
	}

	async removeMenuItem(storeId: string, itemId: string) {
		if (isLive) await api.removeMenuItem(itemId);
		this.#patch(storeId, (store) => (store.menuItems = store.menuItems.filter((m) => m.id !== itemId)));
	}

	async updateStoreInfo(storeId: string, info: { name: string; category: string; description: string; queueMinutes: number }) {
		if (isLive) {
			await api.updateStoreInfo(info);
			await this.#reloadStore(storeId);
			return;
		}
		this.#patch(storeId, (store) => {
			store.name = info.name.trim();
			store.category = info.category.trim();
			store.description = info.description.trim();
			store.queueMinutes = info.queueMinutes;
		});
	}

	async savePromotion(draft: api.PromotionDraft): Promise<Promotion> {
		if (isLive) {
			const saved = await api.savePromotion(draft);
			await this.#reloadStore(draft.storeId);
			return saved;
		}
		// Demo: same rules as the database trigger
		if (draft.kind !== 'DEAL') throw new Error('STORE_DEALS_ONLY');
		if (draft.freeDelivery) throw new Error('FREE_DELIVERY_NEEDS_TEAM');
		const existing = draft.id ? this.byId(draft.storeId)?.promotions.find((p) => p.id === draft.id) : undefined;
		const termsChanged =
			!existing ||
			existing.title !== draft.title ||
			existing.description !== draft.description ||
			existing.minQty !== draft.minQty ||
			existing.discount !== draft.discount ||
			existing.freeDelivery !== draft.freeDelivery ||
			existing.kind !== draft.kind;
		const saved: Promotion = {
			...draft,
			id: draft.id ?? uid('promo'),
			approved: draft.kind === 'DEAL' ? true : termsChanged ? false : (existing?.approved ?? false)
		};
		this.#patch(draft.storeId, (store) => {
			const i = store.promotions.findIndex((p) => p.id === saved.id);
			if (i >= 0) store.promotions[i] = saved;
			else store.promotions.push(saved);
		});
		if (saved.kind === 'CO_PROMO' && !saved.approved) this.#demoApprove(saved);
		return saved;
	}

	/** Demo stand-in for the Goose Man team reviewing a joint promotion */
	#demoApprove(promotion: Promotion) {
		setTimeout(() => {
			this.#patch(promotion.storeId, (store) => {
				const p = store.promotions.find((x) => x.id === promotion.id);
				if (p && !p.approved) {
					p.approved = true;
					toast.show(t('[เดโม] ทีม Goose Man อนุมัติโปรร่วม "{title}" แล้ว', { title: p.title }), 'success', { notify: true });
				}
			});
		}, 2500);
	}

	async deletePromotion(storeId: string, id: string) {
		if (isLive) {
			await api.deletePromotion(id);
			await this.#reloadStore(storeId);
			return;
		}
		this.#patch(storeId, (store) => {
			store.promotions = store.promotions.filter((p) => p.id !== id);
		});
	}
}

export const catalog = new CatalogStore();
