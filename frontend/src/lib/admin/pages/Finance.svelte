<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import PromptPayQr from '$lib/components/PromptPayQr.svelte';
	import { promptPayPayload } from '$lib/payments';
	import { initialOf } from '$lib/utils';
	import { adminError } from '../api';
	import { consoleState as c } from '../console.svelte';
	import { baht, clock, dateTime, phone } from '../format';
	import type { MoneyEntry, RefundDue, RiderPayout } from '../types';
	import CopyButton from '../ui/CopyButton.svelte';
	import Empty from '../ui/Empty.svelte';
	import Modal from '../ui/Modal.svelte';
	import Tabs from '../ui/Tabs.svelte';

	type Tab = 'payouts' | 'refunds' | 'history';
	let tab = $state<Tab>('payouts');
	let payouts = $state<RiderPayout[] | null>(null);
	let refunds = $state<RefundDue[] | null>(null);
	let history = $state<MoneyEntry[] | null>(null);
	let error = $state('');
	let expanded = $state<string | null>(null);

	$effect(() => {
		void c.tick;
		Promise.all([c.api!.payouts(), c.api!.refundsDue(), c.api!.moneyHistory()])
			.then(([p, r, h]) => {
				payouts = p;
				refunds = r;
				history = h;
				error = '';
			})
			.catch((err) => (error = adminError(err)));
	});

	const totalOwed = $derived(payouts?.reduce((n, p) => n + p.owed, 0) ?? 0);
	const totalJobs = $derived(payouts?.reduce((n, p) => n + p.jobs, 0) ?? 0);

	let paying = $state<RiderPayout | null>(null);
	let refunding = $state<RefundDue | null>(null);
	let ref = $state('');
	let busy = $state(false);
	let dialogError = $state('');

	async function run(action: () => Promise<unknown>, success: string) {
		busy = true;
		dialogError = '';
		try {
			await action();
			paying = null;
			refunding = null;
			ref = '';
			c.done(success);
		} catch (err) {
			dialogError = adminError(err);
		} finally {
			busy = false;
		}
	}

	function exportCsv() {
		if (!history?.length) return;
		const rows = [['วันที่', 'ประเภท', 'ผู้รับ', 'ยอด', 'จำนวนงาน', 'เลขอ้างอิง', 'บันทึกโดย'], ...history.map((h) => [dateTime(h.at), h.kind === 'PAYOUT' ? 'โอนคนหิ้ว' : 'คืนเงินผู้ซื้อ', h.recipient, String(h.amount), String(h.jobs), h.ref ?? '', h.by ?? ''])];
		const csv = '﻿' + rows.map((r) => r.map((v) => `"${v.replaceAll('"', '""')}"`).join(',')).join('\n');
		const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
		Object.assign(document.createElement('a'), { href: url, download: `gooseman-money-${c.day}.csv` }).click();
		URL.revokeObjectURL(url);
	}
</script>

<div class="space-y-4">
	<Tabs
		label="การเงิน"
		value={tab}
		onchange={(t) => (tab = t)}
		tabs={[
			{ id: 'payouts', label: 'โอนให้คนหิ้ว', count: payouts?.length },
			{ id: 'refunds', label: 'คืนเงินผู้ซื้อ', count: refunds?.length },
			{ id: 'history', label: 'ประวัติการโอน' }
		]}
	/>

	{#if error && !payouts}
		<div class="rounded-2xl border border-slate-100 bg-white"><Empty title="โหลดข้อมูลการเงินไม่สำเร็จ" body={error} /></div>
	{:else if !payouts || !refunds || !history}
		<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{#each Array(3) as _, i (i)}<div class="h-44 animate-pulse rounded-2xl bg-white"></div>{/each}</div>
	{:else if tab === 'payouts'}
		<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-2xl border border-slate-100 bg-white px-5 py-4">
			<span class="text-sm text-slate-500">ค้างโอนรวม</span>
			<span class="text-2xl font-bold tabular-nums">{baht(totalOwed)}</span>
			<span class="text-sm text-slate-500">{payouts.length} คน · {totalJobs} งาน</span>
			<span class="w-full text-xs text-slate-500">PromptPay: ค่าอาหาร + ค่าหิ้ว · เงินสด: เฉพาะส่วนลดที่ผู้ซื้อไม่ได้จ่าย (คนหิ้วเก็บเงินสดไปแล้ว)</span>
		</div>
		{#if payouts.length === 0}
			<div class="rounded-2xl border border-slate-100 bg-white"><Empty title="ไม่มียอดค้างโอน" body="ทุกคนได้เงินครบแล้ว" /></div>
		{:else}
			<div class="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
				{#each payouts as p (p.rider_id)}
					<article class="rounded-2xl border border-slate-100 bg-white p-5">
						<div class="flex items-start gap-3">
							<span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 font-semibold text-brand-700">{initialOf(p.name)}</span>
							<div class="min-w-0 flex-1">
								<p class="truncate font-semibold">{p.name}</p>
								<p class="truncate text-xs text-slate-500">{[p.faculty, p.level].filter(Boolean).join(' · ') || p.email}</p>
							</div>
						</div>
						<p class="mt-3 flex items-center gap-1 text-sm text-slate-600">PromptPay <span class="font-medium text-slate-900 tabular-nums">{phone(p.promptpay) || 'ยังไม่ได้ตั้ง'}</span>{#if p.promptpay}<CopyButton value={p.promptpay} />{/if}</p>
						<div class="mt-3 flex items-end justify-between gap-3">
							<p class="text-3xl font-bold tabular-nums">{baht(p.owed)}</p>
							<p class="text-right text-xs text-slate-500">{p.jobs} งาน<br />เก่าสุด {dateTime(p.oldest)}</p>
						</div>
						{#if expanded === p.rider_id}
							<table class="mt-3 w-full text-xs">
								<thead class="text-slate-500"><tr class="border-b border-slate-100"><th class="py-1.5 text-left font-medium">ออเดอร์</th><th class="py-1.5 text-left font-medium">จ่าย</th><th class="py-1.5 text-right font-medium">อาหาร+ค่าหิ้ว</th><th class="py-1.5 text-right font-medium">เก็บเงินสด</th><th class="py-1.5 text-right font-medium">ต้องโอน</th></tr></thead>
								<tbody>
									{#each p.orders as o (o.order_id)}
										<tr class="border-b border-slate-50">
											<td class="py-1.5"><a href="#/orders/{o.order_id}" class="font-medium text-brand">{o.code}</a><span class="block text-slate-400">{clock(o.completed_at)}</span></td>
											<td class="py-1.5">{o.payment === 'CASH' ? 'เงินสด' : 'PromptPay'}</td>
											<td class="py-1.5 text-right tabular-nums">{baht(o.food + o.fee)}</td>
											<td class="py-1.5 text-right tabular-nums">{o.cash ? baht(o.cash) : '—'}</td>
											<td class="py-1.5 text-right font-semibold tabular-nums">{baht(o.owed)}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						{/if}
						<div class="mt-4 flex gap-2">
							<button type="button" onclick={() => (expanded = expanded === p.rider_id ? null : p.rider_id)} aria-expanded={expanded === p.rider_id} class="flex h-11 flex-1 items-center justify-center gap-1 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">
								{expanded === p.rider_id ? 'ซ่อนรายการ' : 'ดูรายการ'}<Icon name="chevron-down" class="h-4 w-4 transition-transform {expanded === p.rider_id ? 'rotate-180' : ''}" />
							</button>
							<button type="button" onclick={() => { paying = p; ref = ''; dialogError = ''; }} class="h-11 flex-1 rounded-xl bg-brand text-sm font-semibold text-white hover:bg-brand-600">โอนแล้ว</button>
						</div>
					</article>
				{/each}
			</div>
		{/if}
	{:else if tab === 'refunds'}
		<div class="rounded-2xl border border-slate-100 bg-white">
			{#if refunds.length === 0}
				<Empty title="ไม่มีเงินที่ต้องคืน" body="ออเดอร์ที่ถูกยกเลิกหลังผู้ซื้อจ่าย PromptPay จะขึ้นที่นี่" />
			{:else}
				<ul class="divide-y divide-slate-100">
					{#each refunds as r (r.order_id)}
						<li class="flex flex-wrap items-center gap-3 p-4 sm:px-5">
							<div class="min-w-0 flex-1">
								<p class="flex items-center gap-2"><a href="#/orders/{r.order_id}" class="font-semibold text-brand">{r.code}</a><span class="text-lg font-bold tabular-nums">{baht(r.amount)}</span></p>
								<p class="text-sm text-slate-600">คืนให้ {r.customer} · {phone(r.phone)}</p>
								<p class="text-xs text-slate-500">ยกเลิก {dateTime(r.cancelled_at)}{r.cancelled_by ? ` โดย ${r.cancelled_by}` : ' โดยผู้ซื้อ'}{r.reason ? ` · ${r.reason}` : ''}</p>
							</div>
							<button type="button" onclick={() => { refunding = r; ref = ''; dialogError = ''; }} class="h-11 w-full rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-600 sm:w-auto">บันทึกคืนเงินแล้ว</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{:else}
		<div class="rounded-2xl border border-slate-100 bg-white">
			<div class="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
				<p class="text-sm text-slate-500">30 วันล่าสุด</p>
				<button type="button" onclick={exportCsv} disabled={!history.length} class="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-brand hover:bg-brand-50 disabled:opacity-40"><Icon name="download" class="h-4 w-4" />ดาวน์โหลด CSV</button>
			</div>
			{#if history.length === 0}
				<Empty title="ยังไม่มีประวัติการโอน" goose={false} />
			{:else}
				<table class="hidden w-full text-left text-sm md:table">
					<thead class="text-xs text-slate-500"><tr class="border-b border-slate-100"><th class="py-3 pl-5 font-medium">วันที่</th><th class="py-3 font-medium">ประเภท</th><th class="py-3 font-medium">ผู้รับ</th><th class="py-3 text-right font-medium">ยอด</th><th class="py-3 text-right font-medium">งาน</th><th class="py-3 pl-4 font-medium">อ้างอิง</th><th class="py-3 pr-5 font-medium">บันทึกโดย</th></tr></thead>
					<tbody>
						{#each history as h, i (i)}
							<tr class="border-b border-slate-50 last:border-0">
								<td class="py-3 pl-5 tabular-nums">{dateTime(h.at)}</td>
								<td class="py-3">{h.kind === 'PAYOUT' ? 'โอนคนหิ้ว' : 'คืนเงินผู้ซื้อ'}</td>
								<td class="py-3">{h.recipient}</td>
								<td class="py-3 text-right font-semibold tabular-nums">{baht(h.amount)}</td>
								<td class="py-3 text-right tabular-nums">{h.jobs}</td>
								<td class="py-3 pl-4 text-slate-600">{h.ref ?? '—'}</td>
								<td class="py-3 pr-5 text-slate-600">{h.by ?? '—'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
				<ul class="divide-y divide-slate-100 md:hidden">
					{#each history as h, i (i)}
						<li class="flex items-center gap-3 px-4 py-3">
							<div class="min-w-0 flex-1 text-sm"><p class="font-medium">{h.kind === 'PAYOUT' ? 'โอนคนหิ้ว' : 'คืนเงิน'} · {h.recipient}</p><p class="text-xs text-slate-500">{dateTime(h.at)} · {h.ref ?? 'ไม่มีเลขอ้างอิง'} · {h.by ?? ''}</p></div>
							<span class="font-semibold tabular-nums">{baht(h.amount)}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</div>

{#if paying}
	{@const p = paying}
	<Modal open title="โอนให้ {p.name}" onclose={() => (paying = null)} confirmLabel="บันทึกว่าโอนแล้ว" {busy} error={dialogError}
		onconfirm={() => run(() => c.api!.markPayout(p.rider_id, p.orders.map((o) => o.order_id), ref), `บันทึกโอนให้ ${p.name} ${baht(p.owed)} แล้ว`)}>
		<div class="text-center">
			<p class="text-3xl font-bold text-slate-900 tabular-nums">{baht(p.owed)}</p>
			<p class="text-slate-500">{p.jobs} งาน</p>
			{#if p.promptpay}
				<div class="mt-4"><PromptPayQr payload={promptPayPayload(p.owed, p.promptpay)} size={176} filename="payout-{p.name}.png" /></div>
				<p class="mt-2 flex items-center justify-center gap-1">PromptPay {phone(p.promptpay)}<CopyButton value={p.promptpay} /></p>
				<p class="mt-1 text-xs text-slate-500">สแกนด้วยแอปธนาคารของทีม ยอดขึ้นให้เอง</p>
			{:else}
				<p class="mt-4 rounded-xl bg-amber-50 p-3 text-amber-900">คนหิ้วยังไม่ได้ตั้งเลข PromptPay หรือเบอร์ในโปรไฟล์ ติดต่อเพื่อขอเลขบัญชีก่อนโอน</p>
			{/if}
		</div>
		<label class="mt-4 block">
			<span class="mb-1 block font-medium text-slate-900">เลขอ้างอิงการโอน <span class="font-normal text-slate-400">(ไม่บังคับ แต่ควรใส่)</span></span>
			<input bind:value={ref} maxlength="60" class="h-11 w-full rounded-xl bg-slate-100 px-3.5 outline-none focus:ring-2 focus:ring-brand" />
		</label>
	</Modal>
{/if}

{#if refunding}
	{@const r = refunding}
	<Modal open title="บันทึกว่าคืนเงินแล้ว" onclose={() => (refunding = null)} confirmLabel="บันทึกคืนเงินแล้ว" {busy} disabled={!ref.trim()} error={dialogError}
		onconfirm={() => run(() => c.api!.markRefunded(r.order_id, ref), `บันทึกคืนเงิน ${r.code} แล้ว`)}>
		<div class="text-center">
			<p class="text-3xl font-bold text-slate-900 tabular-nums">{baht(r.amount)}</p>
			<p class="text-slate-500">คืนให้ {r.customer} · {r.code}</p>
			{#if r.promptpay}
				<div class="mt-4"><PromptPayQr payload={promptPayPayload(r.amount, r.promptpay)} size={176} filename="refund-{r.code.replace('#', '')}.png" /></div>
				<p class="mt-2 flex items-center justify-center gap-1">PromptPay {phone(r.promptpay)}<CopyButton value={r.promptpay} /></p>
			{/if}
		</div>
		<label class="mt-4 block">
			<span class="mb-1 block font-medium text-slate-900">เลขอ้างอิงการโอน</span>
			<input bind:value={ref} maxlength="60" class="h-11 w-full rounded-xl bg-slate-100 px-3.5 outline-none focus:ring-2 focus:ring-brand" />
		</label>
	</Modal>
{/if}
