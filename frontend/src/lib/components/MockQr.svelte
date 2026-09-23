<script lang="ts">
	// Deterministic QR-looking pattern (demo only — not a scannable EMVCo payload).
	// Swap for a real PromptPay payload + QR encoder once payments go live.
	let { seed, size = 176 }: { seed: string; size?: number } = $props();

	const N = 25;

	function hash(str: string): number {
		let h = 2166136261;
		for (let i = 0; i < str.length; i++) {
			h ^= str.charCodeAt(i);
			h = Math.imul(h, 16777619);
		}
		return h >>> 0;
	}

	function inFinder(x: number, y: number) {
		const corners = [
			[0, 0],
			[N - 7, 0],
			[0, N - 7]
		];
		return corners.some(([cx, cy]) => x >= cx - 1 && x <= cx + 7 && y >= cy - 1 && y <= cy + 7);
	}

	const cells = $derived.by(() => {
		let state = hash(seed) || 1;
		const rand = () => {
			state ^= state << 13;
			state ^= state >>> 17;
			state ^= state << 5;
			return (state >>> 0) / 4294967296;
		};
		const out: [number, number][] = [];
		for (let y = 0; y < N; y++) {
			for (let x = 0; x < N; x++) {
				if (!inFinder(x, y) && rand() > 0.52) out.push([x, y]);
			}
		}
		return out;
	});

	const finders = [
		[0, 0],
		[N - 7, 0],
		[0, N - 7]
	];
</script>

<svg width={size} height={size} viewBox="-1 -1 {N + 2} {N + 2}" role="img" aria-label="PromptPay QR (จำลอง)" shape-rendering="crispEdges">
	<rect x="-1" y="-1" width={N + 2} height={N + 2} fill="#fff" />
	{#each cells as [x, y] (`${x}-${y}`)}
		<rect {x} {y} width="1" height="1" fill="#0f172a" />
	{/each}
	{#each finders as [x, y] (`${x}-${y}`)}
		<rect {x} {y} width="7" height="7" fill="#0f172a" />
		<rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" />
		<rect x={x + 2} y={y + 2} width="3" height="3" fill="#113767" />
	{/each}
	<rect x="10" y="10" width="5" height="5" rx="1" fill="#fff" />
	<rect x="10.8" y="10.8" width="3.4" height="3.4" rx="0.8" fill="#FA4616" />
</svg>
