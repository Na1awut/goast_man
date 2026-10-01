// The team editing any store from the console: the same screens as the
// partner's (menu, details, storefront), sent through the admin_* functions.
import type { Store } from '$lib/types';
import type { StoreOps } from '$lib/storeOps';
import type { AdminApi } from './api';

/** `current` is the store as loaded; `reload` fetches it again after each change */
export function teamOps(api: AdminApi, current: () => Store | null, reload: () => Promise<void>): StoreOps {
	return {
		async saveMenuItem(storeId, d) {
			const imageUrl = d.photoFile ? await api.uploadStoreImage(storeId, d.photoFile, 'menu') : d.photoFile === null ? '' : d.imageUrl;
			await api.saveMenuItem(storeId, {
				id: d.id,
				name: d.name,
				category: d.category,
				price: d.price,
				specialPrice: d.specialPrice,
				description: d.description,
				imageUrl,
				isAvailable: d.isAvailable,
				options: d.options
			});
			await reload();
		},
		async removeMenuItem(storeId, itemId) {
			await api.removeMenuItem(storeId, itemId);
			await reload();
		},
		async setItemAvailable(_storeId, itemId, available) {
			await api.setItemAvailable(itemId, available);
			await reload();
		},
		async updateStoreInfo(storeId, info) {
			await api.updateStoreInfo(storeId, info);
			await reload();
		},
		async updateStorefront(storeId, d) {
			const now = current();
			// undefined = unchanged, null = removed, File = upload and use (same as the partner's storefront)
			const resolve = async (file: File | null | undefined, url: string | undefined, kind: 'banner' | 'logo' | 'photo') =>
				file === undefined ? url : file === null ? undefined : api.uploadStoreImage(storeId, file, kind);
			const [bannerUrl, logoUrl, imageUrl] = await Promise.all([
				resolve(d.bannerFile, now?.bannerUrl, 'banner'),
				resolve(d.logoFile, now?.logoUrl, 'logo'),
				resolve(d.photoFile, now?.imageUrl, 'photo')
			]);
			await api.updateStorefront(storeId, { tagline: d.tagline, fastLaneMinutes: d.fastLaneMinutes, bannerUrl, logoUrl, imageUrl });
			await reload();
		}
	};
}
