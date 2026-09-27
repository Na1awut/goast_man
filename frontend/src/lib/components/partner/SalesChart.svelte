<script lang="ts">
	import { formatBaht } from '$lib/utils';

	/** One bar per day, oldest first; the last one is today */
	let { days }: { days: { day: string; sales: number; orders: number }[] } = $props();

	const WEEKDAY = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
	const max = $derived(Math.max(...days.map((d) => d.sales), 0));
	/** The day under the finger or pointer; defaults to today */
	let selected = $state<number | null>(null);
	const shown = $derived(selected ?? days.length - 1);
	const dayOf = (iso: string) => new Date(`${iso}T12:00:00+07:00`);
	const label = (iso: string) => `${WEEKDAY[dayOf(iso).getDay()]} ${dayOf(iso).getDate()}`;
	const fullLabel = (iso: string) => dayOf(iso).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' });
	/** 7 days: every label. 30 days: every 5th, counted back from today */
	const showTick = (i: number) => days.length <= 7 || (days.length - 1 - i) % 5 === 0;
</script>

<div>
	<!-- Readout for the chosen day: the value lives here, not on every bar -->
	<div class="mb-3 flex items-baseline justify-between gap-3" aria-live="polite">
		<p class="text-sm text-slate-600">{shown === days.length - 1 ? 'วันนี้' : fullLabel(days[shown].day)}</p>
		<p class="text-sm tabular-nums text-slate-600"><span class="text-base font-semibold text-slate-900">{formatBaht(days[shown].sales)}</span> · {days[shown].orders} ออเดอร์</p>
	</div>

	<div class="relative" role="img" aria-label="กราฟยอดขาย {days.length} วันล่าสุด สูงสุดวันละ {formatBaht(max)}">
		<p class="absolute -top-1 left-0 text-[10px] text-slate-400 tabular-nums">{formatBaht(max)}</p>
		<div class="absolute top-2 right-0 left-0 border-t border-dashed border-slate-200" aria-hidden="true"></div>
		<div class="flex h-36 items-end gap-[2px] border-b border-slate-200 pt-4" aria-hidden="true">
			{#each days as d, i (d.day)}
				<button
					type="button"
					tabindex="-1"
					aria-label="{fullLabel(d.day)} {formatBaht(d.sales)}"
					onpointerenter={() => (selected = i)}
					onpointerleave={() => (selected = null)}
					onclick={() => (selected = i)}
					class="flex h-full flex-1 items-end justify-center"
				>
					<span
						class="w-full max-w-7 rounded-t-[4px] transition-colors {i === shown ? 'bg-brand-600' : i === days.length - 1 ? 'bg-brand' : 'bg-brand-200'}"
						style="height: {max ? (d.sales / max) * 100 : 0}%; min-height: {d.sales ? 2 : 0}px"
					></span>
				</button>
			{/each}
		</div>
		<div class="mt-1 flex gap-[2px]" aria-hidden="true">
			{#each days as d, i (d.day)}
				<span class="flex-1 text-center text-[10px] whitespace-nowrap {i === days.length - 1 ? 'font-semibold text-slate-700' : 'text-slate-400'}">{showTick(i) ? (i === days.length - 1 ? 'วันนี้' : label(d.day)) : ''}</span>
			{/each}
		</div>
	</div>

	<table class="sr-only">
		<caption>ยอดขายรายวัน</caption>
		<thead><tr><th>วัน</th><th>ยอดขาย</th><th>ออเดอร์</th></tr></thead>
		<tbody>
			{#each days as d (d.day)}<tr><td>{fullLabel(d.day)}</td><td>{formatBaht(d.sales)}</td><td>{d.orders}</td></tr>{/each}
		</tbody>
	</table>
</div>
