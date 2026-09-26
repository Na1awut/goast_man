<script lang="ts" generics="T extends string">
	let { tabs, value, onchange, label }: { tabs: { id: T; label: string; count?: number }[]; value: T; onchange: (id: T) => void; label: string } = $props();
</script>

<div class="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label={label}>
	<div class="inline-flex gap-1 rounded-xl bg-slate-100 p-1">
		{#each tabs as t (t.id)}
			{@const active = t.id === value}
			<button
				type="button"
				role="tab"
				aria-selected={active}
				onclick={() => onchange(t.id)}
				class="flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-sm whitespace-nowrap transition-colors {active ? 'bg-white font-semibold text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}"
			>
				{t.label}
				{#if t.count !== undefined}
					<span class="rounded-full px-1.5 text-xs tabular-nums {active && t.id === 'attention' && t.count > 0 ? 'bg-brand text-white' : 'bg-slate-200/70 text-slate-600'}">{t.count}</span>
				{/if}
			</button>
		{/each}
	</div>
</div>
