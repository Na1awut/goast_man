<script lang="ts">
	// Orders (bars, left axis) and sales (line, right axis) per 15-minute slot.
	import { baht, bangkokToday } from '../format';
	import type { Slot } from '../types';

	let { slots, day }: { slots: Slot[]; day: string } = $props();

	let width = $state(640);
	let hover = $state<number | null>(null);

	const H = 250;
	const PAD = { top: 18, right: 46, bottom: 30, left: 34 };

	const niceMax = (v: number, steps: number) => {
		if (v <= 0) return steps;
		const raw = v / steps;
		const mag = 10 ** Math.floor(Math.log10(raw));
		const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
		return step * steps;
	};

	const maxOrders = $derived(niceMax(Math.max(...slots.map((s) => s.orders), 0), 4));
	const maxGmv = $derived(niceMax(Math.max(...slots.map((s) => s.gmv), 0), 4));
	const plotW = $derived(Math.max(10, width - PAD.left - PAD.right));
	const plotH = H - PAD.top - PAD.bottom;
	const band = $derived(plotW / Math.max(1, slots.length));
	const x = (i: number) => PAD.left + band * i + band / 2;
	const yOrders = (v: number) => PAD.top + plotH - (v / maxOrders) * plotH;
	const yGmv = (v: number) => PAD.top + plotH - (v / maxGmv) * plotH;

	/** The slot "now" falls in, highlighted like the design's current bar */
	const current = $derived.by(() => {
		if (day !== bangkokToday()) return -1;
		const t = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
		return slots.findLastIndex((s) => s.at <= t);
	});

	const line = $derived(slots.map((s, i) => `${x(i).toFixed(1)},${yGmv(s.gmv).toFixed(1)}`).join(' '));
	const labelEvery = $derived(Math.max(1, Math.ceil(slots.length / Math.max(2, Math.floor(plotW / 52)))));

	function onmove(e: PointerEvent) {
		const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
		const i = Math.floor((e.clientX - rect.left - PAD.left) / band);
		hover = i >= 0 && i < slots.length ? i : null;
	}
</script>

<div class="relative" bind:clientWidth={width}>
	<svg {width} height={H} role="img" aria-label="กราฟจำนวนออเดอร์และยอดขายทุก 15 นาที" onpointermove={onmove} onpointerleave={() => (hover = null)}>
		{#each [0, 1, 2, 3, 4] as g (g)}
			{@const y = PAD.top + (plotH / 4) * g}
			<line x1={PAD.left} x2={PAD.left + plotW} y1={y} y2={y} class="stroke-slate-100" />
			<text x={PAD.left - 8} y={y + 4} text-anchor="end" class="fill-slate-400 text-[11px] tabular-nums">{Math.round(maxOrders - (maxOrders / 4) * g)}</text>
			<text x={PAD.left + plotW + 8} y={y + 4} class="fill-slate-400 text-[11px] tabular-nums">{Math.round((maxGmv - (maxGmv / 4) * g) / 100) / 10}K</text>
		{/each}

		{#each slots as s, i (s.at)}
			{@const barW = Math.max(4, Math.min(22, band * 0.56))}
			<rect
				x={x(i) - barW / 2}
				y={yOrders(s.orders)}
				width={barW}
				height={Math.max(0, PAD.top + plotH - yOrders(s.orders))}
				rx="3"
				class={i === current ? 'fill-brand/70' : hover === i ? 'fill-brand/40' : 'fill-brand-200'}
			/>
			{#if i % labelEvery === 0}
				<text x={x(i)} y={H - 8} text-anchor="middle" class="fill-slate-500 text-[11px] tabular-nums">{s.at}</text>
			{/if}
		{/each}

		{#if hover !== null}
			<line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} class="stroke-brand/50" stroke-dasharray="3 3" />
		{/if}
		<polyline points={line} fill="none" class="stroke-brand" stroke-width="2.25" stroke-linejoin="round" stroke-linecap="round" />
		{#each slots as s, i (s.at)}
			<circle cx={x(i)} cy={yGmv(s.gmv)} r={hover === i || i === current ? 4.5 : 2.75} class="fill-white stroke-brand" stroke-width="2" />
		{/each}
	</svg>

	{#if hover !== null}
		{@const s = slots[hover]}
		<div
			class="pointer-events-none absolute top-2 z-10 w-36 rounded-xl border border-slate-100 bg-white px-3 py-2 text-xs shadow-lg shadow-slate-900/10"
			style="left: {Math.min(Math.max(0, x(hover) - 72), width - 148)}px"
		>
			<p class="font-medium text-slate-900 tabular-nums">{s.at}</p>
			<p class="mt-1 flex items-center justify-between gap-2 text-slate-600"><span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-brand-200"></span>ออเดอร์</span><span class="font-semibold text-slate-900 tabular-nums">{s.orders}</span></p>
			<p class="flex items-center justify-between gap-2 text-slate-600"><span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-brand"></span>ยอดขาย</span><span class="font-semibold text-slate-900 tabular-nums">{baht(s.gmv)}</span></p>
		</div>
	{/if}
</div>
