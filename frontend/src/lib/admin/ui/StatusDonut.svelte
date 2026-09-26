<script lang="ts">
	import { STAGE, STAGE_ORDER } from '../labels';
	import type { Stage } from '../types';

	let { counts }: { counts: Record<Stage, number> } = $props();

	const total = $derived(STAGE_ORDER.reduce((n, s) => n + (counts[s] ?? 0), 0));
	const R = 58;
	const C = 2 * Math.PI * R;
	const segments = $derived.by(() => {
		let offset = 0;
		return STAGE_ORDER.map((s) => {
			const len = total ? ((counts[s] ?? 0) / total) * C : 0;
			const seg = { stage: s, len, offset };
			offset += len;
			return seg;
		}).filter((s) => s.len > 0);
	});
	const pct = (n: number) => (total ? `${((n / total) * 100).toFixed(1)}%` : '0%');
</script>

<div class="@container">
<div class="flex flex-col items-center gap-5 @[26rem]:flex-row">
	<div class="relative h-40 w-40 shrink-0">
		<svg viewBox="0 0 160 160" class="h-full w-full -rotate-90" aria-hidden="true">
			<circle cx="80" cy="80" r={R} fill="none" class="stroke-slate-100" stroke-width="22" />
			{#each segments as seg (seg.stage)}
				<circle cx="80" cy="80" r={R} fill="none" stroke={STAGE[seg.stage].color} stroke-width="22" stroke-dasharray="{Math.max(0, seg.len - 1.5)} {C}" stroke-dashoffset={-seg.offset} />
			{/each}
		</svg>
		<div class="absolute inset-0 flex flex-col items-center justify-center">
			<span class="text-2xl font-bold text-slate-900 tabular-nums">{total}</span>
			<span class="text-xs text-slate-500">ออเดอร์ทั้งหมด</span>
		</div>
	</div>
	<ul class="w-full min-w-0 space-y-2 text-sm">
		{#each STAGE_ORDER as s (s)}
			<li class="flex items-center gap-2.5">
				<span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background: {STAGE[s].color}"></span>
				<span class="min-w-0 flex-1 truncate text-slate-700">{STAGE[s].label}</span>
				<span class="w-8 text-right font-semibold text-slate-900 tabular-nums">{counts[s] ?? 0}</span>
				<span class="w-12 text-right text-xs text-slate-500 tabular-nums">{pct(counts[s] ?? 0)}</span>
			</li>
		{/each}
	</ul>
</div>
</div>
