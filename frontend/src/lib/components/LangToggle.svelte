<script lang="ts">
	// Thai / English switch for the buyer app. Always labelled in both languages, so someone who
	// cannot read the current one can still find it. Switching reloads the page (see lib/i18n.ts).
	import { lang, setLang, type Lang } from '$lib/i18n';

	let { class: className = '' }: { class?: string } = $props();

	const options: { id: Lang; label: string; name: string }[] = [
		{ id: 'th', label: 'ไทย', name: 'ภาษาไทย' },
		{ id: 'en', label: 'EN', name: 'English' }
	];
</script>

<div class="inline-flex rounded-full border border-slate-200 bg-white p-0.5 text-xs font-semibold shadow-sm {className}" role="group" aria-label="ภาษา / Language">
	{#each options as o (o.id)}
		<button
			type="button"
			lang={o.id}
			aria-pressed={lang === o.id}
			aria-label={o.name}
			onclick={() => setLang(o.id)}
			class="min-h-9 min-w-11 rounded-full px-3 transition-colors {lang === o.id ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-50'}"
		>{o.label}</button>
	{/each}
</div>
