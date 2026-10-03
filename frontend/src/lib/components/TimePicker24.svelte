<script lang="ts">
	import { t } from '$lib/i18n';
	let {
		value = $bindable('08:00'),
		label,
		id
	}: {
		value: string;
		label?: string;
		id?: string;
	} = $props();

	const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
	const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

	// Parse initial value (e.g. "08:00")
	let hour = $state((value || '08:00').split(':')[0] || '08');
	let minute = $state((value || '08:00').split(':')[1] || '00');

	// Synchronize when value changes externally (e.g. from preset buttons)
	$effect(() => {
		const [h, m] = (value || '08:00').split(':');
		if (h && h !== hour) hour = h.padStart(2, '0');
		if (m && m !== minute) minute = m.padStart(2, '0');
	});

	function update(newHour: string, newMinute: string) {
		hour = newHour;
		minute = newMinute;
		value = `${newHour}:${newMinute}`;
	}
</script>

<div class="space-y-1.5">
	{#if label}
		<span class="block text-xs font-medium text-slate-700">{label}</span>
	{/if}
	<div class="flex h-11 items-center rounded-xl border border-slate-200 bg-white px-2.5 shadow-xs transition-colors focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
		<select
			id={id ? `${id}-hour` : undefined}
			value={hour}
			onchange={(e) => update(e.currentTarget.value, minute)}
			class="flex-1 cursor-pointer appearance-none bg-transparent py-2 text-center text-sm font-semibold text-slate-900 outline-none"
			aria-label={t('{v}ชั่วโมง (00-23)', { v: label ? `${label} ` : '' })}
		>
			{#each HOURS as h}
				<option value={h}>{h}</option>
			{/each}
		</select>
		<span class="px-0.5 text-base font-bold text-slate-400 select-none">:</span>
		<select
			id={id ? `${id}-minute` : undefined}
			value={minute}
			onchange={(e) => update(hour, e.currentTarget.value)}
			class="flex-1 cursor-pointer appearance-none bg-transparent py-2 text-center text-sm font-semibold text-slate-900 outline-none"
			aria-label={t('{v}นาที (00-59)', { v: label ? `${label} ` : '' })}
		>
			{#each MINUTES as m}
				<option value={m}>{m}</option>
			{/each}
		</select>
		<span class="pl-1 text-xs font-medium text-slate-500 select-none">{t('น.')}</span>
	</div>
</div>
