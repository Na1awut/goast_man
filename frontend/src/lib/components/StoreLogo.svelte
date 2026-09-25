<script lang="ts">
	import type { Store } from '$lib/types';
	import { initialOf } from '$lib/utils';

	// A partner's own logo, or the store name's first letter when there is none
	// (or the image fails to load), so a card never shows a broken glyph.
	let { store, class: className = 'h-10 w-10 text-base' }: { store: Pick<Store, 'name' | 'logoUrl'>; class?: string } = $props();

	let failedSrc = $state<string | null>(null);
	const showImage = $derived(!!store.logoUrl && failedSrc !== store.logoUrl);
</script>

<span class="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white font-semibold text-brand-700 ring-1 ring-black/5 {className}">
	{#if showImage}
		<img src={store.logoUrl} alt="โลโก้ร้าน {store.name}" class="h-full w-full object-cover" loading="lazy" decoding="async" onerror={() => (failedSrc = store.logoUrl ?? null)} />
	{:else}
		<span aria-hidden="true">{initialOf(store.name)}</span>
	{/if}
</span>
