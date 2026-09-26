<script lang="ts">
	import { STAGE } from '../labels';
	import type { Stage } from '../types';

	let { stage }: { stage: Stage } = $props();
	const meta = $derived(STAGE[stage]);
</script>

<span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap {meta.pill}">
	<span class="h-1.5 w-1.5 rounded-full {meta.dot} {stage === 'DELIVERING' ? 'animate-pulse' : ''}"></span>
	{meta.label}
</span>
