<script lang="ts">
	import type { Snippet } from 'svelte';
	import { nav } from '$lib/stores/nav.svelte';
	import Icon from './Icon.svelte';

	let {
		title,
		onback = () => nav.back(),
		showBack = true,
		action,
		children
	}: {
		title: string;
		onback?: () => void;
		showBack?: boolean;
		action?: Snippet;
		/** Optional row under the title, e.g. a progress stepper */
		children?: Snippet;
	} = $props();
</script>

<header class="sticky top-0 z-40 border-b border-slate-100 bg-white pt-[env(safe-area-inset-top)]">
	<div class="relative flex h-14 items-center justify-center px-14">
		{#if showBack}
			<button
				type="button"
				onclick={onback}
				aria-label="ย้อนกลับ"
				class="absolute left-2 flex h-10 w-10 items-center justify-center rounded-full text-slate-800 transition-colors hover:bg-slate-100 active:bg-slate-200"
			>
				<Icon name="chevron-left" class="h-6 w-6" />
			</button>
		{/if}
		<h1 class="truncate text-base font-semibold text-slate-900">{title}</h1>
		{#if action}
			<div class="absolute right-3 flex items-center">{@render action()}</div>
		{/if}
	</div>
	{#if children}{@render children()}{/if}
</header>
