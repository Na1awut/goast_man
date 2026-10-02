import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STORE_CATALOGUE } from '$lib/data/stores';

vi.mock('$lib/supabase', () => ({ isLive: true, friendlyError: () => 'เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง' }));
vi.mock('$lib/api/live', () => ({
	fetchCatalog: vi.fn(), fetchStore: vi.fn(), setMyStoreOpen: vi.fn()
}));
import * as api from '$lib/api/live';
import { catalog } from './catalog.svelte';

const hiddenShop = () => structuredClone({ ...STORE_CATALOGUE[0], hidden: true });

beforeEach(() => {
	vi.clearAllMocks();
	catalog.resetPartnerStore();
	catalog.stores = [];
});

describe('merchant catalogue', () => {
	it('loads a hidden shop for its owner without adding it to buyer lists', async () => {
		const shop = hiddenShop();
		vi.mocked(api.fetchCatalog).mockResolvedValue([shop]);
		vi.mocked(api.fetchStore).mockResolvedValue(shop);
		await catalog.load();
		expect(catalog.stores).toEqual([]);
		await catalog.loadPartnerStore(shop.id);
		expect(catalog.byId(shop.id)?.id).toBe(shop.id);
		expect(catalog.stores).toEqual([]);
		// The database answers with the new status, and that is what the store shows
		vi.mocked(api.setMyStoreOpen).mockResolvedValue({ is_open: false, source: 'OVERRIDE', schedule: null, schedule_open: null, next_change: null, lock: null, override: null, rev: 1, now: new Date().toISOString() });
		const status = await catalog.setStoreOpen(shop.id, false);
		expect(api.setMyStoreOpen).toHaveBeenCalledWith(false, { hours: undefined, rev: undefined });
		expect(status.is_open).toBe(false);
		expect(catalog.partnerStore?.isOpen).toBe(false);
	});

	it('finishes loading after an error and succeeds on retry', async () => {
		vi.mocked(api.fetchStore).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(hiddenShop());
		await catalog.loadPartnerStore(STORE_CATALOGUE[0].id);
		expect(catalog.partnerLoading).toBe(false);
		expect(catalog.partnerError).toBeTruthy();
		await catalog.loadPartnerStore(STORE_CATALOGUE[0].id);
		expect(catalog.partnerError).toBeNull();
		expect(catalog.partnerStore).not.toBeNull();
	});

	it('does not restore a previous owner’s data after logout', async () => {
		let resolve!: (shop: ReturnType<typeof hiddenShop>) => void;
		vi.mocked(api.fetchStore).mockReturnValue(new Promise((r) => { resolve = r; }));
		const pending = catalog.loadPartnerStore(STORE_CATALOGUE[0].id);
		catalog.resetPartnerStore();
		resolve(hiddenShop());
		await pending;
		expect(catalog.partnerStore).toBeNull();
		expect(catalog.partnerLoading).toBe(false);
	});
});
