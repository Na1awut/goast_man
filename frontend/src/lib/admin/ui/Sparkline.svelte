<script lang="ts">
	// A small trend line from real values (15-minute slots). Nothing is drawn
	// without at least two points: no fake trends.
	let { values, class: className = 'h-10 w-24' }: { values: number[]; class?: string } = $props();

	const W = 96;
	const H = 36;
	const points = $derived.by(() => {
		if (values.length < 2) return '';
		const max = Math.max(...values, 1);
		return values.map((v, i) => `${((i / (values.length - 1)) * W).toFixed(1)},${(H - 3 - (v / max) * (H - 6)).toFixed(1)}`).join(' ');
	});
</script>

{#if points}
	<svg class="hidden shrink-0 sm:block {className}" viewBox="0 0 {W} {H}" preserveAspectRatio="none" aria-hidden="true">
		<polygon points="0,{H} {points} {W},{H}" class="fill-brand/10" />
		<polyline {points} fill="none" class="stroke-brand" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
	</svg>
{/if}
