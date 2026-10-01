import { describe, expect, it } from 'vitest';
import type { HomeBanner } from './types';
import { DEFAULT_BANNER } from './stores/banners.svelte';

describe('Home Banners', () => {
	it('provides a valid DEFAULT_BANNER with default fields', () => {
		expect(DEFAULT_BANNER).toBeDefined();
		expect(DEFAULT_BANNER.id).toBe('default-1');
		expect(DEFAULT_BANNER.title).toBeTruthy();
		expect(DEFAULT_BANNER.active).toBe(true);
		expect(DEFAULT_BANNER.imageUrl).toBeTruthy();
		expect(DEFAULT_BANNER.buttonText).toBe('ฝากหิ้วเลย');
	});

	it('filters active banners and sorts them by sort order', () => {
		const sampleBanners: HomeBanner[] = [
			{
				id: 'b-3',
				imageUrl: 'https://example.com/3.jpg',
				title: 'Banner 3',
				active: true,
				sort: 3
			},
			{
				id: 'b-1',
				imageUrl: 'https://example.com/1.jpg',
				title: 'Banner 1',
				active: true,
				sort: 1
			},
			{
				id: 'b-hidden',
				imageUrl: 'https://example.com/hidden.jpg',
				title: 'Banner Hidden',
				active: false,
				sort: 0
			},
			{
				id: 'b-2',
				imageUrl: 'https://example.com/2.jpg',
				title: 'Banner 2',
				active: true,
				sort: 2
			}
		];

		const activeSorted = sampleBanners
			.filter((b) => b.active)
			.sort((a, b) => a.sort - b.sort);

		expect(activeSorted).toHaveLength(3);
		expect(activeSorted[0].id).toBe('b-1');
		expect(activeSorted[1].id).toBe('b-2');
		expect(activeSorted[2].id).toBe('b-3');
		expect(activeSorted.find((b) => b.id === 'b-hidden')).toBeUndefined();
	});

	it('determines slide bar mode when more than 1 banner is active', () => {
		const singleBanner: HomeBanner[] = [
			{ id: 'b-1', imageUrl: 'img1.png', title: 'Single', active: true, sort: 1 }
		];
		const multipleBanners: HomeBanner[] = [
			{ id: 'b-1', imageUrl: 'img1.png', title: 'First', active: true, sort: 1 },
			{ id: 'b-2', imageUrl: 'img2.png', title: 'Second', active: true, sort: 2 }
		];

		const isSingleCarousel = singleBanner.filter((b) => b.active).length > 1;
		const isMultipleCarousel = multipleBanners.filter((b) => b.active).length > 1;

		expect(isSingleCarousel).toBe(false);
		expect(isMultipleCarousel).toBe(true);
	});
});
