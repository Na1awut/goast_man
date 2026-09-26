<script lang="ts">
	import type { Snippet } from 'svelte';
	import head from '$lib/assets/goose-head-1.webp';

	let { title, body = '', goose = true, children }: { title: string; body?: string; goose?: boolean; children?: Snippet } = $props();
</script>

<div class="flex flex-col items-center px-6 py-10 text-center">
	{#if goose}<img src={head} alt="" width="480" height="480" class="mb-3 h-20 w-20" />{/if}
	<p class="text-sm font-semibold text-slate-900">{title}</p>
	{#if body}<p class="mt-1 max-w-sm text-sm text-slate-500">{body}</p>{/if}
	{@render children?.()}
</div>
