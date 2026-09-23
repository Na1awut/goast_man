<script lang="ts">
	import Icon from './Icon.svelte';

	let {
		qty,
		label,
		onadd,
		onremove,
		disabled = false
	}: { qty: number; label: string; onadd: (from: HTMLElement) => void; onremove: () => void; disabled?: boolean } = $props();
</script>

{#if disabled}
	<span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">หมดแล้ว</span>
{:else if qty > 0}
	<div class="flex items-center gap-2">
		<button
			type="button"
			onclick={onremove}
			aria-label="ลด {label}"
			class="flex h-8 w-8 items-center justify-center rounded-full border border-brand-200 text-brand transition-colors active:bg-brand-50"
		>
			<Icon name="minus" class="h-4 w-4" strokeWidth={2.5} />
		</button>
		{#key qty}<span class="tick w-5 text-center text-sm font-semibold text-slate-900 tabular-nums" aria-live="polite">{qty}</span>{/key}
		<button type="button" onclick={(e) => onadd(e.currentTarget)} aria-label="เพิ่ม {label}" class="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-white active:bg-brand-600">
			<Icon name="plus" class="h-4 w-4" strokeWidth={2.5} />
		</button>
	</div>
{:else}
	<button type="button" onclick={(e) => onadd(e.currentTarget)} aria-label="เพิ่ม {label}" class="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-white active:bg-brand-600">
		<Icon name="plus" class="h-4 w-4" strokeWidth={2.5} />
	</button>
{/if}
