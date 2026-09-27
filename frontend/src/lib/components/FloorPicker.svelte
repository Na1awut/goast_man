<script lang="ts">
	// Which floor of the drop-off building the rider brings the food up to.
	// Above the first floor costs 1 ฿ a floor (see pricing.ts quoteDelivery).
	import { MAX_FLOOR } from '$lib/pricing';
	import { campus } from '$lib/stores/campus.svelte';
	import Icon from './Icon.svelte';

	let { class: className = '' }: { class?: string } = $props();
</script>

<div class="flex items-center gap-3 {className}">
	<div class="min-w-0 flex-1">
		<p class="text-sm font-medium text-slate-900">ส่งถึงชั้น</p>
		<p class="text-xs text-slate-500">{campus.floor === 1 ? 'ชั้น 1 ไม่มีค่าขึ้นชั้น' : `ขึ้นชั้น ${campus.floor} · ชั้นละ 1 บาท`}</p>
	</div>
	<div class="flex items-center gap-2" role="group" aria-label="ชั้นที่ส่ง">
		<button type="button" onclick={() => campus.setFloor(campus.floor - 1)} disabled={campus.floor <= 1} aria-label="ลงหนึ่งชั้น" class="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-700 active:bg-slate-100 disabled:opacity-40">
			<Icon name="minus" class="h-4 w-4" />
		</button>
		<span class="w-10 text-center text-lg font-semibold text-slate-900 tabular-nums" aria-live="polite">{campus.floor}</span>
		<button type="button" onclick={() => campus.setFloor(campus.floor + 1)} disabled={campus.floor >= MAX_FLOOR} aria-label="ขึ้นหนึ่งชั้น" class="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-white active:bg-brand-600 disabled:opacity-40">
			<Icon name="plus" class="h-4 w-4" />
		</button>
	</div>
</div>
