<script lang="ts">
	// The weekly opening hours form, shared by the shop owner's dashboard and the
	// team console. It only edits and hands the result to `onsave`; the database
	// is what opens and closes the store from these hours.
	import Icon from '$lib/components/Icon.svelte';
	import TimePicker24 from '$lib/components/TimePicker24.svelte';
	import { describeSchedule, formatDaysText } from '$lib/operatingHours';
	import type { OperatingHours } from '$lib/types';

	let {
		hours,
		saving = false,
		idPrefix = 'hours',
		onsave
	}: {
		hours?: OperatingHours | null;
		saving?: boolean;
		idPrefix?: string;
		onsave: (hours: OperatingHours) => void | Promise<void>;
	} = $props();

	const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
	const PRESETS = [
		{ open: '08:00', close: '17:00', label: '08:00 - 17:00 (กลางวัน)' },
		{ open: '07:00', close: '15:00', label: '07:00 - 15:00 (รอบเช้า)' },
		{ open: '10:00', close: '20:00', label: '10:00 - 20:00 (ทั้งวัน)' },
		{ open: '16:00', close: '23:00', label: '16:00 - 23:00 (รอบเย็น)' },
		{ open: '18:00', close: '02:00', label: '18:00 - 02:00 (รอบดึก)' }
	];

	let enabled = $state(false);
	let openTime = $state('08:00');
	let closeTime = $state('17:00');
	let days = $state<number[]>(ALL_DAYS);

	const shape = (h?: OperatingHours | null) => ({
		enabled: h?.enabled ?? false,
		openTime: h?.openTime ?? '08:00',
		closeTime: h?.closeTime ?? '17:00',
		days: h?.days?.length ? [...h.days].sort().join(',') : ALL_DAYS.join(',')
	});
	const savedKey = $derived(JSON.stringify(shape(hours)));

	// Follow the saved hours, including a change made on the other side (the team's edit shows up for the owner and back)
	let loadedKey = '';
	$effect(() => {
		if (savedKey === loadedKey) return;
		loadedKey = savedKey;
		const s = shape(hours);
		enabled = s.enabled;
		openTime = s.openTime;
		closeTime = s.closeTime;
		days = s.days.split(',').map(Number);
	});

	const draft = $derived<OperatingHours>({ enabled, openTime, closeTime, days: days.length === 7 ? undefined : [...days].sort() });
	const changed = $derived(JSON.stringify(shape(draft)) !== savedKey);
	const info = $derived(describeSchedule(draft));
	const sameTimes = $derived(enabled && openTime === closeTime);
	const noDays = $derived(enabled && days.length === 0);
	const problem = $derived(sameTimes ? 'เวลาเปิดกับเวลาปิดต้องไม่เท่ากัน' : noDays ? 'เลือกวันทำการอย่างน้อย 1 วัน' : '');

	const toggleDay = (d: number) => (days = days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort());

	async function save() {
		if (problem || saving) return;
		await onsave(draft);
	}
</script>

<section class="space-y-4 rounded-2xl border border-slate-200 bg-white p-4" aria-label="ระบบเปิด-ปิดอัตโนมัติ">
	<div class="flex items-center justify-between gap-3">
		<div class="flex items-center gap-3">
			<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><Icon name="clock" class="h-5 w-5" /></span>
			<div>
				<h3 class="text-sm font-semibold text-slate-900">เปิด-ปิดร้านอัตโนมัติตามเวลา</h3>
				<p class="text-xs text-slate-500">ระบบเปิดและปิดรับออเดอร์ให้เอง แม้ไม่ได้เปิดหน้านี้ค้างไว้</p>
			</div>
		</div>
		<button
			type="button"
			role="switch"
			aria-checked={enabled}
			aria-label="เปิดปิดระบบอัตโนมัติ"
			onclick={() => (enabled = !enabled)}
			class="relative h-7 w-12 shrink-0 rounded-full transition-colors {enabled ? 'bg-brand' : 'bg-slate-200'}"
		>
			<span class="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all {enabled ? 'left-6' : 'left-1'}"></span>
		</button>
	</div>

	{#if enabled}
		<div class="flex items-center gap-2 rounded-xl border p-3 text-xs {info.isOpenNow ? 'border-fresh-200 bg-fresh-50 text-fresh-800' : 'border-slate-200 bg-slate-100 text-slate-700'}">
			<span class="h-2 w-2 shrink-0 rounded-full {info.isOpenNow ? 'bg-fresh-600' : 'bg-slate-400'}"></span>
			<div class="min-w-0 flex-1"><span class="font-semibold">{info.label}</span> · {info.subtext}</div>
		</div>

		<div class="space-y-3.5 border-t border-slate-100 pt-1">
			<div class="grid grid-cols-2 gap-3">
				<TimePicker24 bind:value={openTime} label="เวลาเปิดร้าน" id="{idPrefix}-open" />
				<TimePicker24 bind:value={closeTime} label="เวลาปิดร้าน" id="{idPrefix}-close" />
			</div>

			<div class="space-y-1.5">
				<span class="text-xs font-medium text-slate-700">ช่วงเวลายอดนิยม</span>
				<div class="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
					{#each PRESETS as p (p.label)}
						<button type="button" onclick={() => ((openTime = p.open), (closeTime = p.close))} class="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 active:bg-brand-50">{p.label}</button>
					{/each}
				</div>
			</div>

			<div class="space-y-1.5">
				<div class="flex items-center justify-between">
					<span class="text-xs font-medium text-slate-700">วันเปิดให้บริการ</span>
					<div class="flex gap-1.5 text-xs">
						<button type="button" onclick={() => (days = ALL_DAYS)} class="rounded-md px-2 py-0.5 text-brand hover:bg-brand-50">ทุกวัน</button>
						<span class="text-slate-300">·</span>
						<button type="button" onclick={() => (days = [1, 2, 3, 4, 5])} class="rounded-md px-2 py-0.5 text-brand hover:bg-brand-50">จันทร์-ศุกร์</button>
					</div>
				</div>
				<div class="grid grid-cols-7 gap-1" role="group" aria-label="เลือกวันเปิดร้าน">
					{#each [{ day: 1, label: 'จ' }, { day: 2, label: 'อ' }, { day: 3, label: 'พ' }, { day: 4, label: 'พฤ' }, { day: 5, label: 'ศ' }, { day: 6, label: 'ส' }, { day: 0, label: 'อา' }] as d (d.day)}
						{@const selected = days.includes(d.day)}
						<button
							type="button"
							aria-pressed={selected}
							onclick={() => toggleDay(d.day)}
							class="flex h-10 items-center justify-center rounded-xl text-xs font-semibold transition-colors {selected ? 'bg-brand text-white' : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}"
						>{d.label}</button>
					{/each}
				</div>
				<p class="text-[11px] text-slate-500">เปิดบริการ: {formatDaysText(days)} ({openTime} - {closeTime} น.){openTime > closeTime ? ' · ข้ามเที่ยงคืน' : ''}</p>
			</div>
		</div>
	{:else}
		<p class="text-xs text-slate-500">เมื่อเปิดใช้งาน ร้านจะเปิดและปิดรับออเดอร์ตามเวลาที่ระบุเอง ยังกดปิดชั่วคราวได้ตลอดเมื่อของหมด และกดเปิดนอกเวลาได้เป็นครั้งคราว</p>
	{/if}

	{#if problem}<p class="text-xs text-red-600" role="alert">{problem}</p>{/if}

	{#if changed}
		<button
			type="button"
			onclick={save}
			disabled={saving || !!problem}
			class="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
		>
			{#if saving}<Icon name="refresh" class="h-4 w-4 animate-spin" /><span>กำลังบันทึก...</span>{:else}<Icon name="check" class="h-4 w-4" /><span>บันทึกเวลาเปิด-ปิด</span>{/if}
		</button>
	{/if}
</section>
