<script lang="ts">
	// Open / closed for one store, for the shop owner (dashboard) and the team (console).
	// It never decides anything: it shows the database's status (and why), asks for
	// changes, and shows the answer. A team lock beats the owner; a hand switch ends
	// at the next schedule change; the schedule runs the store otherwise.
	import { onMount } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Sheet from '$lib/components/Sheet.svelte';
	import StoreHoursEditor from '$lib/components/StoreHoursEditor.svelte';
	import { formatWhen } from '$lib/operatingHours';
	import type { OpenApi } from '$lib/storeOpenApi';
	import { toast } from '$lib/stores/toast.svelte';
	import type { OperatingHours, StoreOpenStatus } from '$lib/types';

	let {
		who,
		api,
		storeName = '',
		explain,
		onchange
	}: {
		who: 'owner' | 'team';
		api: OpenApi;
		storeName?: string;
		/** Turns a thrown error into words (the owner's and the console's wording differ) */
		explain: (err: unknown) => string;
		onchange?: (status: StoreOpenStatus) => void;
	} = $props();

	let st = $state<StoreOpenStatus | null>(null);
	let loadError = $state('');
	let busy = $state(false);
	let savingHours = $state(false);
	let now = $state(Date.now());
	type Dialog = 'close' | 'openExtra' | null;
	let dialog = $state<Dialog>(null);

	async function load() {
		try {
			st = await api.status();
			loadError = '';
			onchange?.(st);
		} catch (err) {
			loadError = explain(err);
		}
	}

	onMount(() => {
		void load();
		// Another screen (the team, the schedule itself) may change the store at any moment: keep looking
		const poll = setInterval(() => {
			now = Date.now();
			if (!busy) void load();
		}, 15_000);
		const visible = () => document.visibilityState === 'visible' && void load();
		document.addEventListener('visibilitychange', visible);
		return () => {
			clearInterval(poll);
			document.removeEventListener('visibilitychange', visible);
		};
	});

	/** Run a change; whatever happens, end on the database's latest word */
	async function run(action: () => Promise<StoreOpenStatus>, success: string) {
		if (busy) return;
		busy = true;
		try {
			st = await action();
			onchange?.(st);
			toast.show(success, 'success');
			dialog = null;
		} catch (err) {
			toast.show(explain(err), 'error', { duration: 6000 });
			await load();
		} finally {
			busy = false;
		}
	}

	const when = (iso: string | null | undefined) => (iso ? formatWhen(iso, new Date(now)) : '');
	const locked = $derived(st?.source === 'TEAM_LOCK');
	const scheduled = $derived(!!st?.schedule?.enabled);
	const hiddenStore = $derived(st?.source === 'HIDDEN');

	const headline = $derived(st?.is_open ? 'เปิดรับออเดอร์จากแอป' : locked ? (who === 'owner' ? 'ทีมงานปิดร้านชั่วคราว' : 'ล็อกปิดร้านอยู่') : hiddenStore ? 'ร้านยังไม่แสดงในแอป' : 'ปิดรับออเดอร์อยู่');
	const detail = $derived.by(() => {
		if (!st) return '';
		const o = st.override;
		if (locked && st.lock) {
			const until = st.lock.until ? ` · จนถึง ${when(st.lock.until)}` : ' · จนกว่าทีมงานจะปลดล็อก';
			const by = who === 'team' && st.lock.by ? ` · โดย ${st.lock.by}` : '';
			return `${st.lock.reason || 'ไม่ได้ระบุเหตุผล'}${until}${by}`;
		}
		if (hiddenStore) return who === 'owner' ? 'ทีมงานจะตรวจแล้วเปิดให้ลูกค้าเห็น' : 'กด "แสดงร้านในแอป" เมื่อพร้อม';
		if (st.is_open) {
			if (o?.value === 'OPEN' && o.until) return `เปิดพิเศษนอกเวลา ถึง ${when(o.until)}${o.by === 'TEAM' ? ' (ทีมงานเปิดให้)' : ''}`;
			if (scheduled && st.next_change) return `ตามเวลาอัตโนมัติ · ปิดรับ ${when(st.next_change)}`;
			return who === 'owner' ? 'แตะเพื่อปิดชั่วคราว เช่น ของหมดหรือคิวยาว' : 'ร้านเปิดรับออเดอร์ตามปกติ';
		}
		if (o?.value === 'CLOSED' && o.until) return `ปิดชั่วคราว ถึง ${when(o.until)} แล้วกลับไปตามเวลา`;
		if (scheduled && st.next_change && st.source === 'SCHEDULE') return `นอกเวลาทำการ · จะเปิดรับ ${when(st.next_change)}`;
		return who === 'owner' ? 'นักศึกษาสั่งจากร้านนี้ไม่ได้ แตะเพื่อเปิด' : 'นักศึกษาสั่งจากร้านนี้ไม่ได้';
	});

	// ---- actions ----
	function tapSwitch() {
		if (!st || busy || locked || hiddenStore) return;
		if (st.is_open) dialog = 'close';
		else if (who === 'owner' && scheduled && st.schedule_open === false) dialog = 'openExtra';
		else void run(() => api.setOpen(true, { rev: st!.rev }), 'เปิดรับออเดอร์แล้ว');
	}

	let extraHours = $state(4);
	const closeNote = $derived(who === 'owner' ? 'นักศึกษาจะสั่งจากร้านนี้ไม่ได้ ออเดอร์ที่รับไปแล้วยังทำต่อตามปกติ' : 'ร้านจะเปิดเองไม่ได้ จนกว่าทีมงานจะปลดล็อก');

	// Team lock: why, and for how long
	const REASONS = ['ติดต่อร้านไม่ได้', 'ร้านแจ้งพักชั่วคราว', 'ของหมด / ปิดก่อนเวลา', 'มีปัญหากับออเดอร์'];
	const UNTILS: { label: string; hours: number | null }[] = [
		{ label: 'จนกว่าจะปลดล็อก', hours: null },
		{ label: '1 ชม.', hours: 1 },
		{ label: '3 ชม.', hours: 3 },
		{ label: 'พรุ่งนี้เช้า (06:00)', hours: -1 }
	];
	let reason = $state('');
	let untilChoice = $state<number | null>(null);
	$effect(() => {
		if (dialog === 'close') {
			reason = '';
			untilChoice = null;
		}
	});
	function untilIso(h: number | null): string | null {
		if (h === null) return null;
		if (h > 0) return new Date(Date.now() + h * 3600_000).toISOString();
		// Tomorrow 06:00 Bangkok
		const bkk = new Date(Date.now() + 7 * 3600_000);
		return new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), bkk.getUTCDate() + 1, 6, 0) - 7 * 3600_000).toISOString();
	}

	function confirmClose() {
		if (!st) return;
		if (who === 'team') {
			void run(() => api.setOpen(false, { reason: reason.trim(), until: untilIso(untilChoice), rev: st!.rev }), 'ล็อกปิดร้านแล้ว');
		} else {
			void run(() => api.setOpen(false, { rev: st!.rev }), 'ปิดรับออเดอร์ชั่วคราวแล้ว');
		}
	}

	async function saveHours(hours: OperatingHours) {
		if (!st) return;
		savingHours = true;
		try {
			await run(() => api.saveHours(hours, st!.rev), hours.enabled ? 'บันทึกเวลาเปิด-ปิดแล้ว ระบบจะเปิดปิดร้านให้ตามเวลานี้' : 'ปิดระบบตั้งเวลาแล้ว ร้านคงสถานะตอนนี้ไว้');
		} finally {
			savingHours = false;
		}
	}
</script>

{#if loadError && !st}
	<div class="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
		<Icon name="alert" class="h-5 w-5 shrink-0 text-amber-600" />
		<p class="min-w-0 flex-1 text-sm text-amber-900">{loadError}</p>
		<button type="button" onclick={load} class="shrink-0 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-amber-900 ring-1 ring-amber-200">ลองใหม่</button>
	</div>
{:else if !st}
	<div class="h-20 animate-pulse rounded-2xl bg-slate-100" aria-label="กำลังโหลดสถานะร้าน"></div>
{:else}
	<div class="space-y-3">
		<!-- The switch -->
		<button
			type="button"
			role="switch"
			aria-checked={st.is_open}
			aria-label="เปิดรับออเดอร์ร้าน {storeName}"
			disabled={busy || locked || hiddenStore}
			onclick={tapSwitch}
			class="flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-colors disabled:cursor-default {st.is_open ? 'bg-fresh-700 text-white' : locked ? 'border border-red-200 bg-red-50' : 'border border-slate-200 bg-white'} {busy ? 'opacity-70' : ''}"
		>
			<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl {st.is_open ? 'bg-white/15' : locked ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}">
				<Icon name={locked ? 'lock' : 'store'} class="h-5 w-5" />
			</span>
			<span class="min-w-0 flex-1">
				<span class="block text-sm font-semibold {st.is_open ? '' : locked ? 'text-red-900' : 'text-slate-900'}">{headline}</span>
				<span class="block text-xs {st.is_open ? 'text-white/85' : locked ? 'text-red-800' : 'text-slate-500'}">{detail}</span>
			</span>
			{#if !locked && !hiddenStore}
				<span class="relative h-7 w-12 shrink-0 rounded-full {st.is_open ? 'bg-white/30' : 'bg-slate-200'}" aria-hidden="true">
					<span class="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all {st.is_open ? 'left-6' : 'left-1'}"></span>
				</span>
			{/if}
		</button>

		{#if locked && who === 'owner'}
			<p class="px-1 text-xs text-slate-600">ร้านเปิดเองไม่ได้ในช่วงนี้ ติดต่อทีม Goose Man เพื่อเปิดอีกครั้ง ออเดอร์ที่รับไปแล้วยังทำต่อได้ตามปกติ</p>
		{/if}

		<!-- Secondary actions -->
		<div class="flex flex-wrap items-center gap-x-4 gap-y-1 px-1">
			{#if locked && who === 'team' && api.release}
				<button type="button" disabled={busy} onclick={() => run(() => api.release!(st!.rev), 'ปลดล็อกแล้ว ร้านกลับไปตามสถานะเดิม')} class="min-h-9 text-sm font-semibold text-brand hover:underline disabled:opacity-50">ปลดล็อกร้าน</button>
			{/if}
			{#if scheduled && (st.source === 'OVERRIDE' || (locked && who === 'team')) && !hiddenStore}
				<button type="button" disabled={busy} onclick={() => run(() => api.followSchedule(st!.rev), 'ให้ร้านเปิด-ปิดตามเวลาแล้ว')} class="min-h-9 text-sm text-brand hover:underline disabled:opacity-50">
					{who === 'owner' ? 'กลับไปเปิด-ปิดตามเวลา' : 'ปลดล็อกและให้เปิด-ปิดตามเวลา'}
				</button>
			{/if}
		</div>

		<StoreHoursEditor hours={st.schedule} saving={savingHours || busy} idPrefix="{who}-hours" onsave={saveHours} />
	</div>
{/if}

<!-- Close: confirm (owner) / lock with a reason (team) -->
<Sheet open={dialog === 'close'} title={who === 'team' ? 'ล็อกปิดร้านชั่วคราว' : 'ปิดรับออเดอร์ชั่วคราว?'} onclose={() => (dialog = null)}>
	<p class="text-sm text-slate-600">{closeNote}</p>
	{#if who === 'team'}
		<label class="mt-4 block">
			<span class="mb-1 block text-xs font-medium text-slate-700">เหตุผล (ร้านเห็นข้อความนี้)</span>
			<input bind:value={reason} maxlength="200" placeholder="เช่น ติดต่อร้านไม่ได้" class="h-11 w-full rounded-xl bg-slate-100 px-3.5 text-sm outline-none focus:ring-2 focus:ring-brand" />
		</label>
		<div class="mt-2 flex flex-wrap gap-1.5">
			{#each REASONS as r (r)}
				<button type="button" onclick={() => (reason = r)} class="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 active:bg-brand-50">{r}</button>
			{/each}
		</div>
		<fieldset class="mt-4">
			<legend class="mb-1.5 text-xs font-medium text-slate-700">ปิดนานแค่ไหน</legend>
			<div class="grid grid-cols-2 gap-2">
				{#each UNTILS as u (u.label)}
					<label class="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border px-3 text-sm {untilChoice === u.hours ? 'border-brand bg-brand-50' : 'border-slate-200'}">
						<input type="radio" name="lock-until" value={u.hours} bind:group={untilChoice} class="accent-brand" />{u.label}
					</label>
				{/each}
			</div>
		</fieldset>
	{/if}
	<div class="mt-5 flex gap-3">
		<button type="button" onclick={() => (dialog = null)} class="min-h-12 flex-1 rounded-xl border border-slate-200 text-sm font-medium text-slate-700">ยกเลิก</button>
		<button type="button" disabled={busy} onclick={confirmClose} class="min-h-12 flex-1 rounded-xl bg-red-600 text-sm font-semibold text-white active:bg-red-700 disabled:opacity-60">{who === 'team' ? 'ล็อกปิดร้าน' : 'ปิดรับออเดอร์'}</button>
	</div>
</Sheet>

<!-- Open outside the schedule: for how long -->
<Sheet open={dialog === 'openExtra'} title="เปิดรับออเดอร์นอกเวลา" onclose={() => (dialog = null)}>
	<p class="text-sm text-slate-600">ตอนนี้อยู่นอกเวลาทำการ เปิดรับออเดอร์เพิ่มได้ตามเวลาที่เลือก แล้วร้านจะปิดเองและกลับไปตามเวลาปกติ</p>
	<div class="mt-4 grid grid-cols-4 gap-2" role="group" aria-label="เปิดนานแค่ไหน">
		{#each [1, 2, 4, 8] as h (h)}
			<button type="button" aria-pressed={extraHours === h} onclick={() => (extraHours = h)} class="min-h-12 rounded-xl border text-sm font-semibold {extraHours === h ? 'border-brand bg-brand-50 text-brand' : 'border-slate-200 text-slate-700'}">{h} ชม.</button>
		{/each}
	</div>
	<p class="mt-2 text-xs text-slate-500">เปิดถึง {formatWhen(new Date(now + extraHours * 3600_000), new Date(now))}</p>
	<div class="mt-5 flex gap-3">
		<button type="button" onclick={() => (dialog = null)} class="min-h-12 flex-1 rounded-xl border border-slate-200 text-sm font-medium text-slate-700">ยกเลิก</button>
		<button type="button" disabled={busy} onclick={() => run(() => api.setOpen(true, { hours: extraHours, rev: st?.rev }), 'เปิดรับออเดอร์นอกเวลาแล้ว')} class="min-h-12 flex-1 rounded-xl bg-brand text-sm font-semibold text-white active:bg-brand-600 disabled:opacity-60">เปิดรับออเดอร์</button>
	</div>
</Sheet>
