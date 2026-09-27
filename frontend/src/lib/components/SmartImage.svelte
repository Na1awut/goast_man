<script lang="ts">
	import { assets } from '$app/paths';
	import Icon from './Icon.svelte';

	// Image with a shimmer while loading and a neutral icon if the remote photo
	// fails, so a flaky network never shows a broken-image glyph.
	// `pending`: stores go live before their photos exist, so an empty photo shows
	// an hourglass ("กำลังดำเนินการ" where there is room) instead of a blank frame.
	let { src: raw, alt, pending = false, class: className = '' }: { src: string | null | undefined; alt: string; pending?: boolean; class?: string } = $props();

	// Bundled photos are stored as "stores/kfc-05.webp": resolve from the site root, so they also load under /admin/
	const src = $derived(!raw || /^(https?:|data:|blob:|\/)/.test(raw) ? raw : `${assets}/${raw}`);

	// Keyed by src so a changed image restarts the loading state without an effect
	let loadedSrc = $state<string | null>(null);
	let failedSrc = $state<string | null>(null);
	const status = $derived(!src ? 'none' : failedSrc === src ? 'error' : loadedSrc === src ? 'loaded' : 'loading');
</script>

<div class="relative overflow-hidden {status === 'none' && pending ? 'bg-brand-50' : 'bg-slate-100'} {className}">
	{#if status === 'none' && pending}
		<div class="@container absolute inset-0 flex flex-col items-center justify-center gap-1 text-brand-300" role="img" aria-label="{alt ? `${alt}: ` : ''}รูปกำลังดำเนินการ">
			<Icon name="hourglass" class="h-6 w-6" />
			<span class="hidden text-[11px] font-medium text-brand-700 @min-[5.5rem]:block">กำลังดำเนินการ</span>
		</div>
	{:else if status === 'none' || status === 'error'}
		<div class="absolute inset-0 flex items-center justify-center text-slate-300"><Icon name="utensils" class="h-8 w-8" /></div>
	{:else}
		{#if status === 'loading'}<div class="skeleton absolute inset-0"></div>{/if}
		<img
			{src}
			{alt}
			loading="lazy"
			decoding="async"
			onload={() => (loadedSrc = src ?? null)}
			onerror={() => (failedSrc = src ?? null)}
			class="h-full w-full object-cover transition-opacity duration-300 {status === 'loaded' ? 'opacity-100' : 'opacity-0'}"
		/>
	{/if}
</div>
