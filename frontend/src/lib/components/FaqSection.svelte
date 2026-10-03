<script lang="ts">
	// A visible Q&A list. The FAQPage structured data of the same page is built from the same array
	// (lib/seo.ts), so what search and AI systems read is exactly what people see.
	let { items, heading = 'คำถามที่พบบ่อย', id = 'faq' }: { items: { q: string; a: string }[]; heading?: string; id?: string } = $props();
</script>

<section aria-labelledby={id}>
	<h2 {id} class="text-xl font-bold">{heading}</h2>
	<dl class="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white">
		{#each items as f (f.q)}
			<div class="px-4 py-3.5">
				<dt class="font-semibold">{f.q}</dt>
				<dd class="mt-1 text-slate-600">{f.a}</dd>
			</div>
		{/each}
	</dl>
</section>
