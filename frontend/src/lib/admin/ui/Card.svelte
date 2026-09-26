<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';

	let {
		title,
		subtitle,
		linkLabel,
		onlink,
		actions,
		children,
		class: className = ''
	}: { title?: string; subtitle?: string; linkLabel?: string; onlink?: () => void; actions?: Snippet; children: Snippet; class?: string } = $props();
</script>

<section class="min-w-0 rounded-2xl border border-slate-100 bg-white p-4 sm:p-5 {className}">
	{#if title}
		<header class="mb-4 flex items-start justify-between gap-3">
			<div class="min-w-0">
				<h2 class="text-base font-semibold text-slate-900 sm:text-lg">{title}</h2>
				{#if subtitle}<p class="text-sm text-slate-500">{subtitle}</p>{/if}
			</div>
			{#if linkLabel && onlink}
				<button type="button" onclick={onlink} class="flex shrink-0 items-center gap-1 text-sm font-medium text-brand hover:text-brand-700">
					{linkLabel}<Icon name="arrow-right" class="h-4 w-4" />
				</button>
			{/if}
			{@render actions?.()}
		</header>
	{/if}
	{@render children()}
</section>
