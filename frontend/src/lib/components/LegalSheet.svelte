<script lang="ts">
	import { LEGAL, type LegalPage } from '$lib/data/legal';
	import Sheet from './Sheet.svelte';

	let { page, onclose }: { page: LegalPage | null; onclose: () => void } = $props();
</script>

<Sheet open={page !== null} title={page ? LEGAL[page].title : ''} {onclose}>
	{#if page}
		<div class="space-y-4 pb-2">
			{#each LEGAL[page].sections as section, i (i)}
				<section>
					{#if section.heading}<h3 class="mb-1.5 text-sm font-semibold text-slate-900">{section.heading}</h3>{/if}
					<ul class="list-disc space-y-1.5 pl-5 text-sm text-slate-700 marker:text-brand">
						{#each section.items as line (line)}<li>{line}</li>{/each}
					</ul>
				</section>
			{/each}
		</div>
	{/if}
</Sheet>
