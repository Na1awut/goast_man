<script lang="ts">
	import Icon from './Icon.svelte';

	// Verified partner mark. `compact` for dense list rows.
	let { compact = false }: { compact?: boolean } = $props();
</script>

{#if compact}
	<span class="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-fresh-700" title="ร้านค้าพาร์ทเนอร์ Goose Man">
		<Icon name="shield" class="h-3.5 w-3.5" /> Partner
	</span>
{:else}
	<span class="inline-flex items-center gap-1 rounded-full bg-fresh px-2.5 py-1 text-xs font-medium text-white">
		<Icon name="shield" class="h-3.5 w-3.5" /> ร้านค้าพาร์ทเนอร์ มจธ.
	</span>
{/if}
