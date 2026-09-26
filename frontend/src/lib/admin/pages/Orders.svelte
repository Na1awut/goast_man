<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import { STORE_CATALOGUE } from '$lib/data/stores';
	import { adminError } from '../api';
	import { consoleState as c } from '../console.svelte';
	import { ago, baht, clock } from '../format';
	import { ORDER_TABS } from '../labels';
	import type { OrdersPage, OrdersTab, Payment } from '../types';
	import AttentionChip from '../ui/AttentionChip.svelte';
	import Empty from '../ui/Empty.svelte';
	import StagePill from '../ui/StagePill.svelte';
	import Tabs from '../ui/Tabs.svelte';
	import OrderDetail from './OrderDetail.svelte';

	const PAGE = 50;

	// Wide screens show the detail beside the list; smaller ones give it the whole page
	let wide = $state(false);
	$effect(() => {
		const mq = matchMedia('(min-width: 1280px)');
		wide = mq.matches;
		const onchange = () => (wide = mq.matches);
		mq.addEventListener('change', onchange);
		return () => mq.removeEventListener('change', onchange);
	});

	let tab = $state<OrdersTab>('attention');
	let store = $state<string>('');
	let payment = $state<Payment | ''>('');
	let limit = $state(PAGE);
	let data = $state<OrdersPage | null>(null);
	let error = $state('');

	// A search from the top bar looks at every order of the day
	$effect(() => {
		if (c.search) tab = 'all';
	});

	$effect(() => {
		void c.tick;
		const q = { tab, day: c.day, store: store || null, payment: (payment || null) as Payment | null, search: c.search, limit };
		c.api
			?.orders(q)
			.then((d) => {
				data = d;
				error = '';
			})
			.catch((err) => (error = adminError(err)));
	});

	const tabs = $derived(ORDER_TABS.map((t) => ({ ...t, count: data?.counts[t.id] })));
	const filters = $derived((store ? 1 : 0) + (payment ? 1 : 0));
	const shortStore = (name: string) => name.replace(/\s*\(.*\)\s*/g, ' ').trim();
	const stores = STORE_CATALOGUE.map((s) => ({ id: s.id, name: s.name }));

	function setTab(t: OrdersTab) {
		tab = t;
		limit = PAGE;
	}
	function clearFilters() {
		store = '';
		payment = '';
		c.search = '';
	}
	const select = 'h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-brand';
</script>

{#if c.orderId && !wide}
	<OrderDetail id={c.orderId} fullPage onclose={() => c.go('orders')} />
{:else}
<div class="grid gap-4 {c.orderId ? 'grid-cols-[minmax(0,1fr)_440px]' : ''}">
	<div class="min-w-0 space-y-4">
		<Tabs label="กรองออเดอร์" {tabs} value={tab} onchange={setTab} />

		<div class="flex flex-wrap items-center gap-2">
			<select bind:value={store} aria-label="ร้าน" class="{select} max-w-full sm:max-w-64">
				<option value="">ทุกร้าน</option>
				{#each stores as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
			</select>
			<select bind:value={payment} aria-label="วิธีจ่าย" class={select}>
				<option value="">ทุกวิธีจ่าย</option>
				<option value="CASH">เงินสด</option>
				<option value="PROMPTPAY">PromptPay</option>
			</select>
			{#if c.search}
				<span class="inline-flex h-10 items-center gap-1 rounded-xl bg-brand-50 pr-1 pl-3 text-sm text-brand-700">
					ค้นหา "{c.search}"
					<button type="button" onclick={() => (c.search = '')} aria-label="ล้างคำค้นหา" class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-brand-100"><Icon name="x" class="h-4 w-4" /></button>
				</span>
			{/if}
			{#if filters || c.search}<button type="button" onclick={clearFilters} class="h-10 px-2 text-sm font-medium text-brand">ล้างตัวกรอง</button>{/if}
			{#if tab === 'attention'}<p class="w-full text-xs text-slate-500 sm:ml-auto sm:w-auto">แท็บนี้ดูทุกวัน ปัญหาไม่หายไปตอนเที่ยงคืน</p>{/if}
		</div>

		<div class="min-w-0 rounded-2xl border border-slate-100 bg-white">
			{#if error && !data}
				<Empty title="โหลดออเดอร์ไม่สำเร็จ" body={error}><button type="button" onclick={() => c.refresh()} class="mt-4 h-10 rounded-xl bg-brand px-4 text-sm font-semibold text-white">ลองอีกครั้ง</button></Empty>
			{:else if !data}
				<div class="space-y-2 p-4">{#each Array(6) as _, i (i)}<div class="h-12 animate-pulse rounded-lg bg-slate-100"></div>{/each}</div>
			{:else if data.rows.length === 0}
				{#if tab === 'attention' && !filters && !c.search}
					<Empty title="ไม่มีออเดอร์ที่ต้องจัดการ" body="ระบบจะขึ้นที่นี่ทันทีที่มีออเดอร์ค้าง ไม่มีคนรับ รอชำระนาน หรือ OTP ถูกล็อก" />
				{:else}
					<Empty title="ไม่พบออเดอร์ตามตัวกรองนี้" goose={false}><button type="button" onclick={clearFilters} class="mt-3 text-sm font-medium text-brand">ล้างตัวกรอง</button></Empty>
				{/if}
			{:else}
				<table class="hidden w-full text-left text-sm lg:table">
					<thead class="text-xs text-slate-500">
						<tr class="border-b border-slate-100">
							<th class="py-3 pr-3 pl-5 font-medium">เวลา</th><th class="py-3 pr-3 font-medium">รหัส</th><th class="py-3 pr-3 font-medium">สถานะ</th>
							<th class="py-3 pr-3 font-medium">ร้าน → จุดส่ง</th><th class="py-3 pr-3 font-medium">ผู้ซื้อ / คนหิ้ว</th><th class="py-3 pr-5 text-right font-medium">ยอด</th>
						</tr>
					</thead>
					<tbody>
						{#each data.rows as r (r.id)}
							{@const selected = c.orderId === r.id}
							<tr class="cursor-pointer border-b border-slate-50 last:border-0 {selected ? 'bg-brand-50' : 'hover:bg-slate-50'}" onclick={() => c.go('orders', r.id)}>
								<td class="py-3 pr-3 pl-5 align-top">
									<p class="tabular-nums">{clock(r.created_at)}</p>
									<p class="text-xs text-slate-500">{ago(r.created_at)}</p>
								</td>
								<td class="py-3 pr-3 align-top">
									<a href="#/orders/{r.id}" class="font-semibold text-brand tabular-nums">{r.code}</a>
									{#if r.attention[0]}<p class="mt-1"><AttentionChip attention={r.attention[0]} /></p>{/if}
								</td>
								<td class="py-3 pr-3 align-top"><StagePill stage={r.stage} /></td>
								<td class="max-w-64 py-3 pr-3 align-top">
									<p class="truncate">{shortStore(r.pickup)}</p>
									<p class="truncate text-xs text-slate-500">→ {r.dropoff}</p>
								</td>
								<td class="py-3 pr-3 align-top"><p>{r.customer ?? '—'}</p><p class="text-xs text-slate-500">{r.rider ?? 'ยังไม่มีคนรับ'}</p></td>
								<td class="py-3 pr-5 text-right align-top">
									<p class="font-semibold tabular-nums">{baht(r.total)}</p>
									<p class="text-xs text-slate-500">{r.payment === 'CASH' ? 'เงินสด' : 'PromptPay'}</p>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>

				<ul class="divide-y divide-slate-100 lg:hidden">
					{#each data.rows as r (r.id)}
						<li>
							<a href="#/orders/{r.id}" class="block px-4 py-3.5 active:bg-slate-50">
								<div class="flex items-center gap-2">
									<span class="font-semibold text-brand tabular-nums">{r.code}</span>
									<StagePill stage={r.stage} />
									<span class="ml-auto font-semibold tabular-nums">{baht(r.total)}</span>
								</div>
								{#if r.attention[0]}<p class="mt-1.5"><AttentionChip attention={r.attention[0]} /></p>{/if}
								<p class="mt-1.5 truncate text-sm text-slate-700">{shortStore(r.pickup)} → {r.dropoff}</p>
								<p class="mt-0.5 text-xs text-slate-500">{clock(r.created_at)} · ผู้ซื้อ {r.customer ?? '—'} · {r.rider ? `คนหิ้ว ${r.rider}` : 'ยังไม่มีคนรับ'} · {r.payment === 'CASH' ? 'เงินสด' : 'PromptPay'}</p>
							</a>
						</li>
					{/each}
				</ul>

				{#if data.total > data.rows.length}
					<div class="border-t border-slate-100 p-3 text-center">
						<button type="button" onclick={() => (limit += PAGE)} class="h-10 rounded-xl px-4 text-sm font-medium text-brand hover:bg-brand-50">โหลดเพิ่ม ({data.total - data.rows.length})</button>
					</div>
				{/if}
			{/if}
		</div>
	</div>

	{#if c.orderId}
		<aside class="sticky top-[88px] h-[calc(100dvh-112px)]">
			<OrderDetail id={c.orderId} onclose={() => c.go('orders')} />
		</aside>
	{/if}
</div>
{/if}
