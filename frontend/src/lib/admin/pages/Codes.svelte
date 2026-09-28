<script lang="ts">
	// App discount codes (ADMIN creates and switches them, STAFF can see the list).
	// These are the app's own money — separate from a store's DEAL, which the store pays.
	import Icon from '$lib/components/Icon.svelte';
	import { adminError } from '../api';
	import { bangkokInputToIso, bangkokLocalInput, dateTime, thaiDate } from '../format';
	import { consoleState as c } from '../console.svelte';
	import type { AdminPromoCode, NewPromoCode } from '../types';
	import Empty from '../ui/Empty.svelte';
	import Modal from '../ui/Modal.svelte';
	import Toggle from '../ui/Toggle.svelte';

	let codes = $state<AdminPromoCode[] | null>(null);
	let error = $state('');

	$effect(() => {
		void c.tick;
		c.api
			?.promoCodes()
			.then((r) => {
				codes = r;
				error = '';
			})
			.catch((err) => (error = adminError(err)));
	});

	type Status = 'scheduled' | 'live' | 'done' | 'off';
	const statusOf = (p: AdminPromoCode): Status => {
		if (!p.active) return 'off';
		if (Date.parse(p.starts_at) > Date.now()) return 'scheduled';
		if (p.uses >= p.max_uses) return 'done';
		return 'live';
	};
	const STATUS: Record<Status, { label: string; pill: string }> = {
		scheduled: { label: 'ยังไม่เริ่ม', pill: 'bg-amber-50 text-amber-700' },
		live: { label: 'ใช้งานอยู่', pill: 'bg-fresh-50 text-fresh-700' },
		done: { label: 'ใช้ครบแล้ว', pill: 'bg-slate-100 text-slate-600' },
		off: { label: 'ปิดอยู่', pill: 'bg-slate-100 text-slate-500' }
	};
	const benefit = (p: AdminPromoCode) => (p.kind === 'FREE_DELIVERY' ? 'ฟรีค่าหิ้ว' : `ลด ${p.amount} ฿`);

	// ---------- Create ----------
	let creating = $state(false);
	let busy = $state(false);
	let dialogError = $state('');
	const blankDraft = (): NewPromoCode => ({ code: '', kind: 'AMOUNT', amount: 15, startsAt: null, maxUses: 100 });
	let draft = $state<NewPromoCode>(blankDraft());
	/** datetime-local field; '' = release right away */
	let startsAtLocal = $state('');

	const draftErrors = $derived.by(() => {
		const code = draft.code.trim().toUpperCase();
		return {
			code: !/^[A-Z0-9]{3,20}$/.test(code) ? 'โค้ด 3-20 ตัว ใช้ได้เฉพาะ A-Z และ 0-9' : '',
			amount: draft.kind === 'AMOUNT' && !(draft.amount && draft.amount >= 1 && draft.amount <= 500) ? 'ส่วนลด 1-500 บาท' : '',
			maxUses: !(draft.maxUses >= 1 && draft.maxUses <= 100_000) ? 'จำนวนครั้ง 1-100,000' : ''
		};
	});
	const draftOk = $derived(Object.values(draftErrors).every((e) => !e));

	function openCreate() {
		draft = blankDraft();
		startsAtLocal = '';
		dialogError = '';
		creating = true;
	}

	async function create() {
		if (!draftOk) return;
		busy = true;
		dialogError = '';
		try {
			const code = await c.api!.createPromoCode({
				...draft,
				code: draft.code.trim().toUpperCase(),
				amount: draft.kind === 'AMOUNT' ? draft.amount : null,
				startsAt: bangkokInputToIso(startsAtLocal)
			});
			creating = false;
			c.done(`สร้างโค้ด ${code} แล้ว`);
		} catch (err) {
			dialogError = adminError(err);
		} finally {
			busy = false;
		}
	}

	const field = 'h-11 w-full rounded-xl bg-slate-100 px-3.5 outline-none focus:ring-2 focus:ring-brand';
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between gap-3">
		<p class="text-xs text-slate-500">โค้ดของแอป ลดเงินให้ทันทีหรือฟรีค่าหิ้ว แยกจากโปรของร้าน (ร้านจ่ายเอง) · {c.isAdmin ? 'กำหนดวันปล่อยและจำนวนครั้งที่ใช้ได้เอง' : 'STAFF ดูได้อย่างเดียว สร้างและปิดโค้ดทำได้เฉพาะ ADMIN'}</p>
		{#if c.isAdmin}
			<button type="button" onclick={openCreate} class="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-600">
				<Icon name="plus" class="h-4 w-4" />สร้างโค้ด
			</button>
		{/if}
	</div>

	{#if error && !codes}
		<div class="rounded-2xl border border-slate-100 bg-white"><Empty title="โหลดโค้ดไม่สำเร็จ" body={error} /></div>
	{:else if !codes}
		<div class="h-48 animate-pulse rounded-2xl bg-white"></div>
	{:else if codes.length === 0}
		<div class="rounded-2xl border border-slate-100 bg-white"><Empty title="ยังไม่มีโค้ดส่วนลด" body="สร้างโค้ดแรก แล้วบอกลูกค้าให้มาใส่ตอนสั่ง" goose={false} /></div>
	{:else}
		<div class="rounded-2xl border border-slate-100 bg-white">
			<ul class="divide-y divide-slate-100">
				{#each codes as p (p.code)}
					{@const status = statusOf(p)}
					<li class="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
						<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand"><Icon name="ticket" class="h-5 w-5" /></span>
						<div class="min-w-0 flex-1">
							<p class="flex flex-wrap items-center gap-2">
								<span class="font-mono text-sm font-semibold tracking-wide">{p.code}</span>
								<span class="rounded-full px-2 py-0.5 text-[11px] font-medium {STATUS[status].pill}">{STATUS[status].label}</span>
							</p>
							<p class="truncate text-xs text-slate-500">
								{benefit(p)} · ใช้ไปแล้ว {p.uses}/{p.max_uses} ครั้ง ·
								{status === 'scheduled' ? `ปล่อย ${dateTime(p.starts_at)}` : `เริ่มใช้ได้ ${dateTime(p.starts_at)}`}
							</p>
							<p class="truncate text-[11px] text-slate-400">สร้างโดย {p.created_by || 'ทีมงาน'} · {thaiDate(p.created_at)}</p>
						</div>
						{#if c.isAdmin}
							<Toggle
								checked={p.active}
								label="เปิดโค้ด {p.code}"
								onchange={(v) => c.act(() => c.api!.setPromoCodeActive(p.code, v), v ? `เปิดโค้ด ${p.code} แล้ว` : `ปิดโค้ด ${p.code} แล้ว`)}
							/>
						{/if}
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>

<Modal open={creating} title="สร้างโค้ดส่วนลด" onclose={() => (creating = false)} confirmLabel="สร้างโค้ด" {busy} disabled={!draftOk} error={dialogError} onconfirm={create}>
	<div class="space-y-4">
		<label class="block">
			<span class="mb-1 block font-medium text-slate-900">โค้ด</span>
			<input bind:value={draft.code} maxlength="20" placeholder="เช่น WELCOME15" class="{field} font-mono uppercase placeholder:font-sans placeholder:normal-case" />
			{#if draft.code.trim() && draftErrors.code}<p class="mt-1 text-xs text-red-600">{draftErrors.code}</p>{/if}
		</label>

		<fieldset class="block">
			<legend class="mb-1 font-medium text-slate-900">ส่วนลด</legend>
			<div class="grid grid-cols-2 gap-2">
				<button type="button" onclick={() => (draft.kind = 'AMOUNT')} class="h-11 rounded-xl border text-sm font-medium {draft.kind === 'AMOUNT' ? 'border-brand bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600'}">ลดเงิน (บาท)</button>
				<button type="button" onclick={() => (draft.kind = 'FREE_DELIVERY')} class="h-11 rounded-xl border text-sm font-medium {draft.kind === 'FREE_DELIVERY' ? 'border-brand bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600'}">ฟรีค่าหิ้ว</button>
			</div>
		</fieldset>

		{#if draft.kind === 'AMOUNT'}
			<label class="block">
				<span class="mb-1 block font-medium text-slate-900">ลดกี่บาท</span>
				<input type="number" inputmode="numeric" min="1" max="500" bind:value={draft.amount} class={field} />
				{#if draftErrors.amount}<p class="mt-1 text-xs text-red-600">{draftErrors.amount}</p>{/if}
			</label>
		{/if}

		<label class="block">
			<span class="mb-1 block font-medium text-slate-900">จะปล่อยโค้ดตอนไหน</span>
			<input type="datetime-local" bind:value={startsAtLocal} min={bangkokLocalInput()} class={field} />
			<p class="mt-1 text-xs text-slate-500">เว้นว่าง = ใช้ได้ทันที ตั้งไว้ล่วงหน้าได้ถ้าจะปล่อยพร้อมกิจกรรม</p>
		</label>

		<label class="block">
			<span class="mb-1 block font-medium text-slate-900">ใช้ได้ทั้งหมดกี่ครั้ง</span>
			<input type="number" inputmode="numeric" min="1" max="100000" bind:value={draft.maxUses} class={field} />
			{#if draftErrors.maxUses}<p class="mt-1 text-xs text-red-600">{draftErrors.maxUses}</p>{/if}
			<p class="mt-1 text-xs text-slate-500">นับรวมทุกคนที่ใช้โค้ดนี้ ไม่ใช่ต่อคน · ออเดอร์ที่ยกเลิกไม่นับ</p>
		</label>
	</div>
</Modal>
