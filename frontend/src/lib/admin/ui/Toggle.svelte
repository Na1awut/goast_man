<script lang="ts">
	let { checked, label, onchange, disabled = false }: { checked: boolean; label: string; onchange: (next: boolean) => void; disabled?: boolean } = $props();
</script>

<button
	type="button"
	role="switch"
	aria-checked={checked}
	aria-label={label}
	{disabled}
	onclick={() => onchange(!checked)}
	class="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50 {checked ? 'bg-fresh' : 'bg-slate-300'}"
>
	<span class="inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform {checked ? 'translate-x-6' : 'translate-x-1'}"></span>
</button>
