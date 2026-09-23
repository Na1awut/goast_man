<script lang="ts">
	import Icon from './Icon.svelte';

	// Image with a shimmer while loading and a neutral icon if the remote photo
	// fails, so a flaky network never shows a broken-image glyph.
	let { src, alt, class: className = '' }: { src: string; alt: string; class?: string } = $props();

	// Keyed by src so a changed image restarts the loading state without an effect
	let loadedSrc = $state<string | null>(null);
	let failedSrc = $state<string | null>(null);
	const status = $derived(failedSrc === src ? 'error' : loadedSrc === src ? 'loaded' : 'loading');
</script>

<div class="relative overflow-hidden bg-slate-100 {className}">
	{#if status === 'error'}
		<div class="absolute inset-0 flex items-center justify-center text-slate-300"><Icon name="utensils" class="h-8 w-8" /></div>
	{:else}
		{#if status === 'loading'}<div class="skeleton absolute inset-0"></div>{/if}
		<img
			{src}
			{alt}
			loading="lazy"
			decoding="async"
			onload={() => (loadedSrc = src)}
			onerror={() => (failedSrc = src)}
			class="h-full w-full object-cover transition-opacity duration-300 {status === 'loaded' ? 'opacity-100' : 'opacity-0'}"
		/>
	{/if}
</div>
