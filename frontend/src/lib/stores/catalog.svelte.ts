// The store catalogue every screen reads (Svelte 5 runes).
// Demo mode: the in-memory MOCK_STORES. Live mode: Supabase, reloaded on demand.
import type { Promotion, Store } from '$lib/types';
import { findStore, livePromotions, MOCK_STORES, sortForBrowsing } from '$lib/data/stores';
import * as api from '$lib/api/live';
import { friendlyError, isLive } from '$lib/supabase';
import { uid } from '$lib/utils';
import { toast } from './toast.svelte';

export interface StorefrontDraft {
	tagline: string;
	fastLaneMinutes?: number;
	/** A new banner picked by the partner; `null` removes the current one */
	bannerFile?: File | null;
}

class CatalogStore {
	stores = $state<Store[]>(isLive ? [] : MOCK_STORES);
	loading = $state(isLive);
	error = $state<string | null>(null);

	browsing = $derived(sortForBrowsing(this.stores));
	/** Joint Goose Man × store promotions that are live right now */
	coPromotions = $derived(
		this.stores.flatMap((store) =>
			livePromotions(store)
				.filter((p) => p.kind === 'CO_PROMO')
				.map((promotion) => ({ store, promotion }))
		)
	);

	byId(id: string): Store | undefined {
		return findStore(this.stores, id);
	}

	async load() {
		if (!isLive) return;
		this.loading = true;
		this.error = null;
		try {
			this.stores = await api.fetchCatalog();
		} catch (err) {
			// No silent fallback to demo data: a live app must not show made-up stores
			this.error = friendlyError(err);
		} finally {
			this.loading = false;
		}
	}

	async #reloadStore(storeId: string) {
		const fresh = await api.fetchStore(storeId);
		this.stores = this.stores.map((s) => (s.id === storeId ? fresh : s));
	}

	#patch(storeId: string, fn: (store: Store) => void) {
		const store = this.stores.find((s) => s.id === storeId);
		if (store) fn(store);
	}

	// ---------- Partner actions ----------

	async updateStorefront(storeId: string, draft: StorefrontDraft) {
		if (isLive) {
			const current = this.byId(storeId);
			let bannerUrl = current?.bannerUrl;
			if (draft.bannerFile) bannerUrl = await api.uploadBanner(storeId, draft.bannerFile);
			if (draft.bannerFile === null) bannerUrl = undefined;
			await api.updateStorefront(draft.tagline, bannerUrl, draft.fastLaneMinutes);
			await this.#reloadStore(storeId);
			return;
		}
		this.#patch(storeId, (store) => {
			store.tagline = draft.tagline.trim() || undefined;
			store.fastLaneMinutes = draft.fastLaneMinutes;
			if (draft.bannerFile) store.bannerUrl = URL.createObjectURL(draft.bannerFile);
			if (draft.bannerFile === null) store.bannerUrl = undefined;
		});
	}

	async savePromotion(draft: api.PromotionDraft): Promise<Promotion> {
		if (isLive) {
			const saved = await api.savePromotion(draft);
			await this.#reloadStore(draft.storeId);
			return saved;
		}
		// Demo: same approval rule as the database trigger
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
					toast.show(`[เดโม] ทีม Goose Man อนุมัติโปรร่วม "${p.title}" แล้ว`, 'success', { notify: true });
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
