<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import Icon from './Icon.svelte';

	let {
		open,
		title,
		onclose,
		children
	}: { open: boolean; title: string; onclose: () => void; children: Snippet } = $props();

	function onkeydown(e: KeyboardEvent) {
		if (open && e.key === 'Escape') onclose();
	}
</script>

<svelte:window {onkeydown} />

{#if open}
	<div class="fixed inset-0 z-50 flex items-end justify-center">
		<button type="button" aria-label="ปิด" class="absolute inset-0 bg-slate-900/40" onclick={onclose} transition:fade={{ duration: 150 }}></button>
		<div
			role="dialog"
			aria-modal="true"
			aria-label={title}
			class="relative w-full max-w-md rounded-t-3xl bg-white px-5 pt-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
			transition:fly={{ y: 320, duration: 250, opacity: 1 }}
		>
			<div class="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200"></div>
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-base font-semibold text-slate-900">{title}</h2>
				<button type="button" onclick={onclose} aria-label="ปิด" class="-mr-2 flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
					<Icon name="x" />
				</button>
			</div>
			<div class="max-h-[65dvh] overflow-y-auto overscroll-contain">
				{@render children()}
			</div>
		</div>
	</div>
{/if}
