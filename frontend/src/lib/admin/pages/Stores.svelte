<script lang="ts">
	import { assets } from '$app/paths';
	import Icon from '$lib/components/Icon.svelte';
	import { ZONE_NAMES } from '$lib/data/stores';
	import { adminError } from '../api';
	import { consoleState as c } from '../console.svelte';
	import type { AdminStore, NewStore } from '../types';
	import Empty from '../ui/Empty.svelte';
	import Modal from '../ui/Modal.svelte';
	import Tabs from '../ui/Tabs.svelte';
	import Toggle from '../ui/Toggle.svelte';
	import StoreEditor from './StoreEditor.svelte';

	let stores = $state<AdminStore[] | null>(null);
	let error = $state('');
	let query = $state('');
	let filter = $state<'all' | 'open' | 'closed' | 'hidden'>('all');

	$effect(() => {
		void c.tick;
		void c.storeId; // back from the editor: refresh the list
		c.api
			?.stores()
			.then((s) => {
				stores = s;
				error = '';
			})
			.catch((err) => (error = adminError(err)));
	});

	const matches = (s: AdminStore) => {
		if (filter === 'hidden') return s.hidden;
		if (s.hidden) return filter === 'all';
		return filter === 'all' || (filter === 'open') === s.is_open;
	};
	const shown = $derived((stores ?? []).filter((s) => matches(s) && (!query.trim() || s.name.toLowerCase().includes(query.trim().toLowerCase()))));
	const img = (u: string | null) => (!u ? '' : /^(https?:|data:|blob:|\/)/.test(u) ? u : `${assets}/${u}`);

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

	// New store: starts hidden and closed, the team fills it in, then shows it
	const ZONES = Object.entries(ZONE_NAMES) as [NewStore['zone'], string][];
	let creating = $state(false);
	let draft = $state<NewStore>({ name: '', category: '', zone: 'kfc-main', lock: '', description: '', queueMinutes: 10 });
	const draftOk = $derived(!!draft.name.trim() && !!draft.category.trim() && draft.queueMinutes >= 0 && draft.queueMinutes <= 120);

	async function create() {
		busy = true;
		dialogError = '';
		try {
			const id = await c.api!.createStore(draft);
			creating = false;
			c.done(`สร้างร้าน ${draft.name.trim()} แล้ว (ยังซ่อนจากแอป)`);
			c.go('stores', id);
		} catch (err) {
			dialogError = adminError(err);
		} finally {
			busy = false;
		}
	}

	const field = 'h-11 w-full rounded-xl bg-slate-100 px-3.5 outline-none focus:ring-2 focus:ring-brand';
</script>

{#if c.storeId}
	<StoreEditor storeId={c.storeId} />
{:else}
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
					{ id: 'open', label: 'เปิดอยู่', count: stores?.filter((s) => !s.hidden && s.is_open).length },
					{ id: 'closed', label: 'ปิดอยู่', count: stores?.filter((s) => !s.hidden && !s.is_open).length },
					{ id: 'hidden', label: 'ซ่อนจากแอป', count: stores?.filter((s) => s.hidden).length }
				]}
			/>
			<button type="button" onclick={() => { creating = true; dialogError = ''; draft = { name: '', category: '', zone: 'kfc-main', lock: '', description: '', queueMinutes: 10 }; }} class="ml-auto inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-600">
				<Icon name="plus" class="h-4 w-4" />เพิ่มร้าน
			</button>
		</div>
		<p class="text-xs text-slate-500">แตะร้านเพื่อแก้ข้อมูล รูป และเมนู · ทีมแก้ได้ทุกร้าน ทั้งร้านที่ยังไม่มีเมลเจ้าของ และร้านที่ดูแลเองแล้ว</p>

		{#if error && !stores}
			<div class="rounded-2xl border border-slate-100 bg-white"><Empty title="โหลดร้านไม่สำเร็จ" body={error} /></div>
		{:else if !stores}
			<div class="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{#each Array(6) as _, i (i)}<div class="h-28 animate-pulse rounded-2xl bg-white"></div>{/each}</div>
		{:else if shown.length === 0}
			<div class="rounded-2xl border border-slate-100 bg-white"><Empty title="ไม่พบร้าน" goose={false} /></div>
		{:else}
			<div class="grid gap-3 sm:gap-4 md:grid-cols-2 2xl:grid-cols-3">
				{#each shown as s (s.id)}
					<article class="flex items-center gap-3 rounded-2xl border p-3 sm:p-4 {s.hidden ? 'border-dashed border-slate-300 bg-slate-50' : s.is_open ? 'border-slate-100 bg-white' : 'border-slate-100 bg-slate-50'}">
						<button type="button" onclick={() => c.go('stores', s.id)} aria-label="แก้ไขร้าน {s.name}" class="flex min-w-0 flex-1 items-center gap-3 text-left">
							{#if s.logo_url || s.image_url}
								<img src={img(s.logo_url || s.image_url)} alt="" class="h-16 w-16 shrink-0 rounded-xl object-cover {s.is_open && !s.hidden ? '' : 'grayscale'}" loading="lazy" />
							{:else}
								<span class="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-400"><Icon name="store" class="h-6 w-6" /></span>
							{/if}
							<div class="min-w-0">
								<p class="truncate font-semibold">{s.name}</p>
								<p class="truncate text-xs text-slate-500">{s.lock ? `ล็อก ${s.lock} · ` : ''}{s.category} · {s.items_total} เมนู</p>
								<p class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
									{#if s.hidden}<span class="font-medium text-slate-600">ซ่อนจากแอป</span>{:else}<span class="text-slate-600">ออเดอร์วันนี้ <span class="font-semibold tabular-nums">{s.orders_today}</span></span>{/if}
									{#if s.items_off}<span class="font-medium text-amber-700">เมนูหมด {s.items_off}</span>{/if}
									{#if !s.hidden && !s.is_open}<span class="font-medium text-red-600">ปิดรับออเดอร์</span>{/if}
									{#if !s.owner_email}<span class="text-slate-500">{s.invite_email ? 'รอร้าน login' : 'ยังไม่มีเมลร้าน'}</span>{/if}
								</p>
							</div>
						</button>
						{#if !s.hidden}
							<div class="flex shrink-0 flex-col items-center gap-1">
								<Toggle checked={s.is_open} label="เปิดรับออเดอร์ร้าน {s.name}" onchange={(v) => setOpen(s, v)} />
								<span class="text-[11px] text-slate-500">{s.is_open ? 'เปิด' : 'ปิด'}</span>
							</div>
						{/if}
					</article>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<Modal open={!!closing} title="ปิดรับออเดอร์ร้าน {closing?.name ?? ''}?" onclose={() => (closing = null)} confirmLabel="ปิดร้าน" danger {busy} error={dialogError} onconfirm={confirmClose}>
	<p>ผู้ซื้อจะสั่งร้านนี้ไม่ได้จนกว่าจะเปิดอีกครั้ง ออเดอร์ที่สั่งไปแล้วยังดำเนินต่อตามปกติ</p>
</Modal>

<Modal open={creating} title="เพิ่มร้าน" onclose={() => (creating = false)} confirmLabel="สร้างร้าน" {busy} disabled={!draftOk} error={dialogError} onconfirm={create}>
	<div class="space-y-4">
		<label class="block">
			<span class="mb-1 block font-medium text-slate-900">ชื่อร้าน</span>
			<input bind:value={draft.name} maxlength="60" placeholder="เช่น ร้านข้าวแกงป้าแดง" class={field} />
		</label>
		<div class="grid grid-cols-2 gap-3">
			<label class="block">
				<span class="mb-1 block font-medium text-slate-900">ประเภทร้าน</span>
				<input bind:value={draft.category} maxlength="40" placeholder="เช่น ข้าวราดแกง" class={field} />
			</label>
			<label class="block">
				<span class="mb-1 block font-medium text-slate-900">ล็อกที่ <span class="font-normal text-slate-400">(ถ้ามี)</span></span>
				<input bind:value={draft.lock} maxlength="10" placeholder="เช่น 13" class={field} />
			</label>
		</div>
		<div class="grid grid-cols-2 gap-3">
			<label class="block">
				<span class="mb-1 block font-medium text-slate-900">โรงอาหาร</span>
				<select bind:value={draft.zone} class={field}>
					{#each ZONES as [id, name] (id)}<option value={id}>{name}</option>{/each}
				</select>
			</label>
			<label class="block">
				<span class="mb-1 block font-medium text-slate-900">คิวปกติ (นาที)</span>
				<input bind:value={draft.queueMinutes} type="number" min="0" max="120" class={field} />
			</label>
		</div>
		<label class="block">
			<span class="mb-1 block font-medium text-slate-900">รายละเอียด <span class="font-normal text-slate-400">(ไม่บังคับ)</span></span>
			<input bind:value={draft.description} maxlength="200" placeholder="เช่น ค่ากล่อง 5 บาท, เปิด 7:00-14:00" class={field} />
		</label>
		<p class="text-xs text-slate-500">ร้านใหม่จะ<strong>ซ่อนจากแอป</strong>และปิดรับออเดอร์ไว้ก่อน ใส่รูปและเมนูให้ครบแล้วค่อยกดแสดง · ยังไม่ต้องมีเมลร้าน</p>
	</div>
</Modal>
