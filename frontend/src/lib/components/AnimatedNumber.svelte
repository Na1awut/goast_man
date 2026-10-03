<script lang="ts">
	import { dateLocale } from '$lib/i18n';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { prefersReducedMotion } from '$lib/utils';

	// Money that counts to its new value, so a discount is seen being applied.
	let { value, suffix = ' ฿', class: className = '' }: { value: number; suffix?: string; class?: string } = $props();

	const reduce = prefersReducedMotion();
	const tween = Tween.of(() => value, { duration: reduce ? 0 : 320, easing: cubicOut });
	const shown = $derived(Math.round(tween.current));
</script>

<span class="tabular-nums {className}" aria-live="polite" aria-atomic="true">
	<span class="sr-only">{value.toLocaleString(dateLocale)}{suffix}</span>
	<span aria-hidden="true">{shown.toLocaleString(dateLocale)}{suffix}</span>
</span>
