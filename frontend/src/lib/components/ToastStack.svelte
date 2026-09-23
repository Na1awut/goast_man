<script lang="ts">
	import { fly } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { toast, type ToastTone } from '$lib/stores/toast.svelte';
	import Icon, { type IconName } from './Icon.svelte';

	const tone: Record<ToastTone, { icon: IconName; class: string }> = {
		info: { icon: 'info', class: 'text-slate-500' },
		success: { icon: 'check-circle', class: 'text-fresh' },
		warning: { icon: 'alert', class: 'text-amber-500' },
		error: { icon: 'x-circle', class: 'text-red-500' }
	};
</script>

<!--
	Toasts float over the top bar but never intercept taps (pointer-events: none),
	so a back button underneath always works. They dismiss themselves.
-->
<div
	class="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.5rem)] z-[70] flex flex-col items-center gap-2 px-4"
	role="status"
	aria-live="polite"
>
	{#each toast.toasts as t (t.id)}
		<div
			animate:flip={{ duration: 200 }}
			in:fly={{ y: -12, duration: 200 }}
			out:fly={{ y: -8, duration: 150 }}
			class="flex w-full max-w-sm items-start gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-sm text-slate-800 shadow-lg shadow-slate-900/10"
		>
			<Icon name={tone[t.tone].icon} class="mt-0.5 h-5 w-5 {tone[t.tone].class}" />
			<span class="flex-1 leading-snug">{t.message}</span>
		</div>
	{/each}
</div>
