<script lang="ts">
	import type { Snippet } from 'svelte';

	// Sticky action bar pinned to the bottom of task screens (no tab bar there).
	let { children }: { children: Snippet } = $props();
</script>

<div class="sticky bottom-0 z-30 mt-auto border-t border-slate-100 bg-white px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
	{@render children()}
</div>
