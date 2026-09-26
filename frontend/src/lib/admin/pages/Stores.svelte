<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { assets } from '$app/paths';
	import Icon from '$lib/components/Icon.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { adminError } from '../api';
	import { consoleState as c } from '../console.svelte';
	import type { AdminMenuItem, AdminStore } from '../types';
	import Empty from '../ui/Empty.svelte';
	import Modal from '../ui/Modal.svelte';
	import Tabs from '../ui/Tabs.svelte';
	import Toggle from '../ui/Toggle.svelte';

	let stores = $state<AdminStore[] | null>(null);
	let error = $state('');
	let query = $state('');
	let filter = $state<'all' | 'open' | 'closed'>('all');

	$effect(() => {
		void c.tick;
		c.api
			?.stores()
			.then((s) => {
				stores = s;
				error = '';
			})
			.catch((err) => (error = adminError(err)));
	});

	const shown = $derived(
		(stores ?? []).filter((s) => (filter === 'all' || (filter === 'open') === s.is_open) && (!query.trim() || s.name.toLowerCase().includes(query.trim().toLowerCase())))
	);
	const img = (u: string | null) => (!u ? '' : /^(https?:|data:|\/)/.test(u) ? u : `${assets}/${u}`);

	// Closing needs a confirmation; opening is immediate
	let closing = $state<AdminStore | null>(null);
	let busy = $state(false);
	let dialogError = $state('');

	async function setOpen(s: AdminStore, open: boolean) {
		if (!open) {
			closing = s;
			dialogError = '';
			return;
		}
		await c.act(() => c.api!.setStoreOpen(s.id, true), `เปิดรับออเดอร์ร้าน ${s.name} แล้ว`);
	}
	async function confirmClose() {
		if (!closing) return;
		busy = true;
		try {
			await c.api!.setStoreOpen(closing.id, false);
			c.done(`ปิดรับออเดอร์ร้าน ${closing.name} แล้ว`);
			closing = null;
		} catch (err) {
			dialogError = adminError(err);
		} finally {
			busy = false;
		}
	}

	// Menu panel
	let menuStore = $state<AdminStore | null>(null);
	let menu = $state<AdminMenuItem[] | null>(null);
	let menuQuery = $state('');
	let menuFilter = $state<'all' | 'on' | 'off'>('all');

	async function openMenu(s: AdminStore) {
		menuStore = s;
		menu = null;
		menuQuery = '';
		menuFilter = 'all';
		try {
			menu = await c.api!.storeMenu(s.id);
		} catch (err) {
			toast.show(adminError(err), 'error');
			menuStore = null;
		}
	}

	async function setItem(item: AdminMenuItem, available: boolean) {
		const was = item.is_available;
		item.is_available = available;
		try {
			await c.api!.setItemAvailable(item.id, available);
			c.done(available ? `เปิดเมนู "${item.name}" แล้ว` : `ปิดเมนู "${item.name}" แล้ว (หมด)`);
		} catch (err) {
			item.is_available = was;
			toast.show(adminError(err), 'error');
		}
	}

	const sections = $derived.by(() => {
		const q = menuQuery.trim().toLowerCase();
		const items = (menu ?? []).filter((m) => (menuFilter === 'all' || (menuFilter === 'on') === m.is_available) && (!q || m.name.toLowerCase().includes(q)));
		const groups = new Map<string, AdminMenuItem[]>();
		for (const m of items) groups.set(m.category || 'อื่นๆ', [...(groups.get(m.category || 'อื่นๆ') ?? []), m]);
		return [...groups.entries()];
	});
	const price = (m: AdminMenuItem) => (m.special_price ? `ธรรมดา ${m.price} · พิเศษ ${m.special_price}` : `${m.price}`);

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && menuStore && !closing) menuStore = null;
	}
</script>

<svelte:window {onkeydown} />

<div class="space-y-4">
	<div class="flex flex-wrap items-center gap-3">
		<label class="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-slate-500 focus-within:ring-2 focus-within:ring-brand sm:max-w-sm">
			<Icon name="search" class="h-[18px] w-[18px]" />
			<input bind:value={query} type="search" placeholder="ค้นหาร้าน" class="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none" />
		</label>
		<Tabs
			label="กรองร้าน"
			value={filter}
			onchange={(f) => (filter = f)}
			tabs={[
				{ id: 'all', label: 'ทั้งหมด', count: stores?.length },
				{ id: 'open', label: 'เปิดอยู่', count: stores?.filter((s) => s.is_open).length },
				{ id: 'closed', label: 'ปิดอยู่', count: stores?.filter((s) => !s.is_open).length }
			]}
		/>
	</div>

	{#if error && !stores}
		<div class="rounded-2xl border border-slate-100 bg-white"><Empty title="โหลดร้านไม่สำเร็จ" body={error} /></div>
	{:else if !stores}
		<div class="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{#each Array(6) as _, i (i)}<div class="h-28 animate-pulse rounded-2xl bg-white"></div>{/each}</div>
	{:else if shown.length === 0}
		<div class="rounded-2xl border border-slate-100 bg-white"><Empty title="ไม่พบร้าน" goose={false} /></div>
	{:else}
		<div class="grid gap-3 sm:gap-4 md:grid-cols-2 2xl:grid-cols-3">
			{#each shown as s (s.id)}
				<article class="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 sm:p-4 {s.is_open ? '' : 'bg-slate-50'}">
					<button type="button" onclick={() => openMenu(s)} class="flex min-w-0 flex-1 items-center gap-3 text-left">
						<img src={img(s.logo_url || s.image_url)} alt="" class="h-16 w-16 shrink-0 rounded-xl object-cover {s.is_open ? '' : 'grayscale'}" loading="lazy" />
						<div class="min-w-0">
							<p class="truncate font-semibold">{s.name}</p>
							<p class="truncate text-xs text-slate-500">{s.lock} · {s.category}</p>
							<p class="mt-1 flex flex-wrap gap-x-3 text-xs">
								<span class="text-slate-600">ออเดอร์วันนี้ <span class="font-semibold tabular-nums">{s.orders_today}</span></span>
								{#if s.items_off}<span class="font-medium text-amber-700">เมนูหมด {s.items_off}</span>{/if}
								{#if !s.is_open}<span class="font-medium text-red-600">ปิดรับออเดอร์</span>{/if}
							</p>
						</div>
					</button>
					<div class="flex shrink-0 flex-col items-center gap-1">
						<Toggle checked={s.is_open} label="เปิดรับออเดอร์ร้าน {s.name}" onchange={(v) => setOpen(s, v)} />
						<span class="text-[11px] text-slate-500">{s.is_open ? 'เปิด' : 'ปิด'}</span>
					</div>
				</article>
			{/each}
		</div>
	{/if}
</div>

<Modal open={!!closing} title="ปิดรับออเดอร์ร้าน {closing?.name ?? ''}?" onclose={() => (closing = null)} confirmLabel="ปิดร้าน" danger {busy} error={dialogError} onconfirm={confirmClose}>
	<p>ผู้ซื้อจะสั่งร้านนี้ไม่ได้จนกว่าจะเปิดอีกครั้ง ออเดอร์ที่สั่งไปแล้วยังดำเนินต่อตามปกติ</p>
</Modal>

{#if menuStore}
	{@const st = menuStore}
	<div class="fixed inset-0 z-[55] flex justify-end">
		<button type="button" aria-label="ปิดเมนูร้าน" class="absolute inset-0 hidden bg-slate-900/30 md:block" onclick={() => (menuStore = null)} transition:fade={{ duration: 150 }}></button>
		<div role="dialog" aria-modal="true" aria-label="เมนูร้าน {st.name}" class="relative flex h-full w-full flex-col bg-white shadow-2xl md:max-w-lg" transition:fly={{ x: 60, duration: 200 }}>
			<header class="flex items-center gap-3 border-b border-slate-100 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 sm:px-5">
				<button type="button" onclick={() => (menuStore = null)} aria-label="ปิด" class="-ml-1 flex h-10 w-10 items-center justify-center rounded-xl hover:bg-slate-100"><Icon name="chevron-left" class="h-5 w-5" /></button>
				<img src={img(st.logo_url || st.image_url)} alt="" class="h-10 w-10 rounded-lg object-cover" />
				<div class="min-w-0 flex-1"><p class="truncate font-semibold">{st.name}</p><p class="text-xs text-slate-500">{st.is_open ? 'เปิดรับออเดอร์' : 'ปิดรับออเดอร์อยู่'}</p></div>
				<Toggle checked={stores?.find((x) => x.id === st.id)?.is_open ?? st.is_open} label="เปิดรับออเดอร์" onchange={(v) => setOpen(stores?.find((x) => x.id === st.id) ?? st, v)} />
			</header>
			<div class="space-y-3 border-b border-slate-100 px-4 py-3 sm:px-5">
				<label class="flex h-11 items-center gap-2 rounded-xl bg-slate-100 px-3.5 text-slate-500 focus-within:ring-2 focus-within:ring-brand">
					<Icon name="search" class="h-[18px] w-[18px]" />
					<input bind:value={menuQuery} type="search" placeholder="ค้นหาเมนู" class="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none" />
				</label>
				<Tabs label="กรองเมนู" value={menuFilter} onchange={(f) => (menuFilter = f)} tabs={[{ id: 'all', label: 'ทั้งหมด' }, { id: 'on', label: 'มีขาย' }, { id: 'off', label: 'หมด' }]} />
			</div>
			<div class="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
				{#if !menu}
					<div class="space-y-2 p-5">{#each Array(8) as _, i (i)}<div class="h-12 animate-pulse rounded-lg bg-slate-100"></div>{/each}</div>
				{:else if sections.length === 0}
					<Empty title="ไม่พบเมนู" goose={false} />
				{:else}
					{#each sections as [category, items] (category)}
						<h3 class="sticky top-0 z-10 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600 sm:px-5">{category}</h3>
						<ul class="divide-y divide-slate-100">
							{#each items as m (m.id)}
								<li class="flex items-center gap-3 px-4 py-3 sm:px-5">
									<div class="min-w-0 flex-1">
										<p class="truncate text-sm {m.is_available ? 'text-slate-900' : 'text-slate-400 line-through'}">{m.name}</p>
										<p class="text-xs text-slate-500 tabular-nums">฿{price(m)}{#if !m.is_available}<span class="ml-2 rounded bg-slate-200 px-1.5 font-medium text-slate-600 no-underline">หมด</span>{/if}</p>
									</div>
									<Toggle checked={m.is_available} label="มีขาย {m.name}" onchange={(v) => setItem(m, v)} />
								</li>
							{/each}
						</ul>
					{/each}
				{/if}
			</div>
		</div>
	</div>
{/if}
