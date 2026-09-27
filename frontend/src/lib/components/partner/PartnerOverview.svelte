<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Sheet from '$lib/components/Sheet.svelte';
	import type { OrderStatus, Store } from '$lib/types';
	import { catalog } from '$lib/stores/catalog.svelte';
	import { partnerDashboard as pd } from '$lib/stores/partnerDashboard.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { friendlyError, isLive } from '$lib/supabase';
	import { formatBaht, formatRelativeDate } from '$lib/utils';
	import SalesChart from './SalesChart.svelte';

	let { store }: { store: Store } = $props();

	onMount(() => pd.start(store));
	onDestroy(() => pd.stop());

	const d = $derived(pd.data);
	const rangeSales = $derived(d ? d.days.reduce((n, x) => n + x.sales, 0) : 0);
	const rangeOrders = $derived(d ? d.days.reduce((n, x) => n + x.orders, 0) : 0);

	let confirmClose = $state(false);
	let switching = $state(false);

	async function setOpen(open: boolean) {
		switching = true;
		try {
			await catalog.setStoreOpen(store.id, open);
			if (pd.data) pd.data.isOpen = open;
			toast.show(open ? 'เปิดรับออเดอร์จากแอปแล้ว' : 'ปิดรับออเดอร์ชั่วคราวแล้ว นักศึกษาจะสั่งจากร้านนี้ไม่ได้', open ? 'success' : 'info');
			confirmClose = false;
		} catch (err) {
			toast.show(friendlyError(err), 'error');
		} finally {
			switching = false;
		}
	}

	const minutesSince = (iso: string) => Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60_000));
	function liveStatus(status: OrderStatus, rider: string | null): { text: string; cls: string } {
		if (status === 'DELIVERING') return { text: `${rider ?? 'คนหิ้ว'} รับไปแล้ว`, cls: 'bg-fresh-50 text-fresh-700' };
		if (status === 'ACCEPTED') return { text: `${rider ?? 'คนหิ้ว'} กำลังมารับ`, cls: 'bg-brand-50 text-brand-700' };
		return { text: 'รอคนหิ้วรับงาน', cls: 'bg-amber-50 text-amber-800' };
	}
</script>

<div class="space-y-4">
	{#if !isLive}
		<p class="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600"><Icon name="info" class="h-4 w-4 shrink-0" />โหมดเดโม: ตัวเลขในหน้านี้เป็นตัวอย่าง</p>
	{/if}

	<!-- Open / closed -->
	<button
		type="button"
		role="switch"
		aria-checked={store.isOpen}
		disabled={switching}
		onclick={() => (store.isOpen ? (confirmClose = true) : setOpen(true))}
		class="flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-colors disabled:opacity-70 {store.isOpen ? 'bg-fresh-700 text-white' : 'border border-slate-200 bg-white'}"
	>
		<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl {store.isOpen ? 'bg-white/15' : 'bg-slate-100 text-slate-500'}"><Icon name="store" class="h-5 w-5" /></span>
		<span class="min-w-0 flex-1">
			<span class="block text-sm font-semibold {store.isOpen ? '' : 'text-slate-900'}">{store.isOpen ? 'เปิดรับออเดอร์จากแอป' : 'ปิดรับออเดอร์อยู่'}</span>
			<span class="block text-xs {store.isOpen ? 'text-white/85' : 'text-slate-500'}">{store.isOpen ? 'แตะเพื่อปิดชั่วคราว เช่น ของหมดหรือคิวยาว' : 'นักศึกษาสั่งจากร้านนี้ไม่ได้ แตะเพื่อเปิด'}</span>
		</span>
		<span class="relative h-7 w-12 shrink-0 rounded-full {store.isOpen ? 'bg-white/30' : 'bg-slate-200'}" aria-hidden="true">
			<span class="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all {store.isOpen ? 'left-6' : 'left-1'}"></span>
		</span>
	</button>

	{#if pd.error && !d}
		<p class="rounded-2xl border border-slate-100 bg-white px-4 py-6 text-center text-sm text-slate-600">{pd.error}</p>
	{:else if !d}
		<div class="grid grid-cols-2 gap-3">{#each Array(4) as _, i (i)}<div class="h-20 animate-pulse rounded-2xl bg-slate-100"></div>{/each}</div>
	{:else}
		<!-- Today -->
		<section class="grid grid-cols-2 gap-3" aria-label="วันนี้">
			<div class="col-span-2 rounded-2xl bg-brand p-4 text-white">
				<p class="text-sm text-white/85">ยอดขายวันนี้</p>
				<p class="mt-0.5 text-3xl font-semibold tabular-nums">{formatBaht(d.today.sales)}</p>
				<p class="mt-1 text-xs text-white/85">{d.today.orders} ออเดอร์ส่งสำเร็จ · {d.today.items} จาน{d.today.discounts ? ` · ส่วนลดโปรร้าน ${formatBaht(d.today.discounts)}` : ''}</p>
			</div>
			<div class="rounded-2xl border border-slate-100 bg-white p-4">
				<p class="text-xs text-slate-500">กำลังมา</p>
				<p class="text-xl font-semibold text-slate-900 tabular-nums">{d.today.onTheWay}</p>
			</div>
			<div class="rounded-2xl border border-slate-100 bg-white p-4">
				<p class="text-xs text-slate-500">ยกเลิกวันนี้</p>
				<p class="text-xl font-semibold text-slate-900 tabular-nums">{d.today.cancelled}</p>
			</div>
		</section>

		<!-- On the way -->
		<section class="rounded-2xl border border-slate-100 bg-white" aria-labelledby="live-title">
			<div class="flex items-baseline justify-between px-4 pt-4">
				<h2 id="live-title" class="text-base font-semibold text-slate-900">ออเดอร์ที่กำลังมา</h2>
				<span class="text-xs text-slate-500">อัปเดตทุก 30 วินาที</span>
			</div>
			{#if d.live.length === 0}
				<p class="px-4 pt-2 pb-4 text-sm text-slate-500">ตอนนี้ยังไม่มีออเดอร์ที่รอทำ</p>
			{:else}
				<ul class="divide-y divide-slate-100">
					{#each d.live as o (o.id)}
						{@const st = liveStatus(o.status, o.rider)}
						<li class="px-4 py-3">
							<div class="flex items-center justify-between gap-2">
								<p class="text-base font-semibold text-slate-900">{o.code}</p>
								<span class="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium {st.cls}">{st.text}</span>
							</div>
							<p class="mt-1 text-sm text-slate-800">{o.items.map((i) => `${i.name} ×${i.quantity}`).join(', ')}</p>
							{#if o.note}<p class="mt-1 flex gap-1 text-xs text-slate-600"><Icon name="note" class="h-3.5 w-3.5 shrink-0" />{o.note}</p>{/if}
							<p class="mt-1 text-xs text-slate-500">สั่ง {minutesSince(o.createdAt)} นาทีที่แล้ว · {formatBaht(o.foodTotal)}</p>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<!-- Sales over time -->
		<section class="rounded-2xl border border-slate-100 bg-white p-4" aria-labelledby="sales-title">
			<div class="mb-3 flex items-center justify-between gap-3">
				<div>
					<h2 id="sales-title" class="text-base font-semibold text-slate-900">ยอดขายรายวัน</h2>
					<p class="text-xs text-slate-500 tabular-nums">{d.days.length} วัน · {formatBaht(rangeSales)} · {rangeOrders} ออเดอร์</p>
				</div>
				<div class="flex rounded-full bg-slate-100 p-0.5 text-xs" role="group" aria-label="ช่วงเวลา">
					{#each [7, 30] as const as n (n)}
						<button type="button" aria-pressed={pd.days === n} onclick={() => pd.setDays(n, store)} class="rounded-full px-3 py-1.5 {pd.days === n ? 'bg-white font-semibold text-slate-900 shadow-sm' : 'text-slate-500'}">{n} วัน</button>
					{/each}
				</div>
			</div>
			<SalesChart days={d.days} />
		</section>

		<!-- This month -->
		<section class="grid grid-cols-3 divide-x divide-slate-100 rounded-2xl border border-slate-100 bg-white py-4 text-center" aria-label="เดือนนี้">
			<div class="px-2"><p class="text-base font-semibold text-slate-900 tabular-nums">{formatBaht(d.month.sales)}</p><p class="text-xs text-slate-500">ยอดขายเดือนนี้</p></div>
			<div class="px-2"><p class="text-base font-semibold text-slate-900 tabular-nums">{d.month.orders}</p><p class="text-xs text-slate-500">ออเดอร์</p></div>
			<div class="px-2"><p class="text-base font-semibold text-slate-900 tabular-nums">{d.month.orders ? formatBaht(Math.round(d.month.sales / d.month.orders)) : '—'}</p><p class="text-xs text-slate-500">เฉลี่ยต่อออเดอร์</p></div>
		</section>

		<!-- Best sellers -->
		{#if d.topItems.length}
			<section class="rounded-2xl border border-slate-100 bg-white p-4" aria-labelledby="top-title">
				<h2 id="top-title" class="mb-2 text-base font-semibold text-slate-900">เมนูขายดี 30 วัน</h2>
				<ol class="space-y-2">
					{#each d.topItems as t, i (t.name)}
						<li class="flex items-center gap-3 text-sm">
							<span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">{i + 1}</span>
							<span class="min-w-0 flex-1 truncate text-slate-800">{t.name}</span>
							<span class="shrink-0 text-slate-500 tabular-nums">{t.qty} จาน</span>
							<span class="w-16 shrink-0 text-right font-medium text-slate-900 tabular-nums">{formatBaht(t.sales)}</span>
						</li>
					{/each}
				</ol>
			</section>
		{/if}

		<!-- Latest -->
		<section class="rounded-2xl border border-slate-100 bg-white" aria-labelledby="recent-title">
			<h2 id="recent-title" class="px-4 pt-4 text-base font-semibold text-slate-900">ออเดอร์ที่ส่งสำเร็จล่าสุด</h2>
			{#if d.recent.length === 0}
				<p class="px-4 pt-2 pb-4 text-sm text-slate-500">ยังไม่มีออเดอร์ที่ส่งสำเร็จ</p>
			{:else}
				<ul class="divide-y divide-slate-100">
					{#each d.recent as r (r.id)}
						<li class="flex items-start gap-3 px-4 py-3 text-sm">
							<div class="min-w-0 flex-1">
								<p class="font-medium text-slate-900">{r.code} <span class="font-normal text-slate-500">· {formatRelativeDate(r.completedAt)}</span></p>
								<p class="truncate text-xs text-slate-500">{r.items}</p>
							</div>
							<p class="shrink-0 font-semibold text-slate-900 tabular-nums">{formatBaht(r.foodTotal)}</p>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<p class="px-1 text-xs leading-relaxed text-slate-500">ยอดขาย = ราคาเมนูของออเดอร์ที่ส่งสำเร็จ (คนหิ้วจ่ายที่หน้าร้าน) ไม่รวมค่าหิ้วและทิปซึ่งเป็นของคนหิ้ว · ร้านไม่เห็นชื่อหรือเบอร์ของผู้สั่ง</p>
	{/if}
</div>

<Sheet open={confirmClose} title="ปิดรับออเดอร์" onclose={() => (confirmClose = false)}>
	<h2 class="text-lg font-semibold text-slate-900">ปิดรับออเดอร์ชั่วคราว?</h2>
	<p class="mt-1 text-sm text-slate-600">นักศึกษาจะสั่งจากร้านนี้ไม่ได้จนกว่าจะเปิดใหม่ ออเดอร์ที่สั่งเข้ามาแล้ว{d?.live.length ? ` (${d.live.length} ออเดอร์)` : ''}ยังต้องทำต่อ</p>
	<div class="mt-5 grid grid-cols-2 gap-3">
		<button type="button" onclick={() => (confirmClose = false)} class="rounded-xl bg-slate-100 py-3 text-sm font-medium text-slate-700">ยังไม่ปิด</button>
		<button type="button" onclick={() => setOpen(false)} disabled={switching} class="rounded-xl bg-red-600 py-3 text-sm font-medium text-white disabled:opacity-60">ปิดรับออเดอร์</button>
	</div>
</Sheet>
