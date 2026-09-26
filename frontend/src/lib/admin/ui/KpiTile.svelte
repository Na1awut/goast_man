<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import Sparkline from './Sparkline.svelte';

	let {
		label,
		value,
		icon,
		trend = [],
		tone = 'default',
		onclick,
		footer
	}: {
		label: string;
		value: string;
		icon: IconName;
		trend?: number[];
		/** alert = something to act on (red footer) */
		tone?: 'default' | 'alert';
		onclick?: () => void;
		footer?: Snippet;
	} = $props();

	const base = 'flex min-w-0 flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 text-left sm:p-5';
</script>

{#snippet inner()}
	<div class="flex items-start gap-3">
		<span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl {tone === 'alert' ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand'}">
			<Icon name={icon} class="h-5 w-5" strokeWidth={1.9} />
		</span>
		<div class="min-w-0">
			<p class="line-clamp-2 text-sm leading-snug text-slate-600 sm:truncate">{label}</p>
			<p class="text-2xl leading-tight font-bold text-slate-900 tabular-nums sm:text-[1.75rem]">{value}</p>
		</div>
	</div>
	<div class="flex min-h-10 items-end justify-between gap-2">
		<div class="min-w-0 text-xs {tone === 'alert' ? 'text-red-600' : 'text-slate-500'}">{@render footer?.()}</div>
		<Sparkline values={trend} />
	</div>
{/snippet}

{#if onclick}
	<button type="button" {onclick} class="{base} transition-colors hover:border-brand-200 focus-visible:outline-2 focus-visible:outline-brand">{@render inner()}</button>
{:else}
	<div class={base}>{@render inner()}</div>
{/if}
