<script lang="ts">
	import { assets } from '$app/paths';
	import Icon from '$lib/components/Icon.svelte';
	import PartnerMenu from '$lib/components/partner/PartnerMenu.svelte';
	import StoreInfoForm from '$lib/components/partner/StoreInfoForm.svelte';
	import StorefrontForm from '$lib/components/partner/StorefrontForm.svelte';
	import type { Store } from '$lib/types';
	import { adminError } from '../api';
	import { consoleState as c } from '../console.svelte';
	import { teamOps } from '../storeOps';
	import type { AdminStore } from '../types';
	import Empty from '../ui/Empty.svelte';
	import Modal from '../ui/Modal.svelte';
	import Tabs from '../ui/Tabs.svelte';
	import Toggle from '../ui/Toggle.svelte';

	let { storeId }: { storeId: string } = $props();

	let store = $state<Store | null>(null);
	let meta = $state<AdminStore | null>(null);
	let error = $state('');
	let tab = $state<'info' | 'menu'>('info');

	async function load() {
		try {
			const [s, list] = await Promise.all([c.api!.storeForEdit(storeId), c.api!.stores()]);
			store = s;
			meta = list.find((x) => x.id === storeId) ?? null;
			error = '';
		} catch (err) {
			error = adminError(err);
		}
	}
	$effect(() => {
		void storeId;
		void load();
	});

	const ops = $derived(teamOps(c.api!, () => store, load));
	const img = (u: string | undefined | null) => (!u ? '' : /^(https?:|data:|blob:|\/)/.test(u) ? u : `${assets}/${u}`);

	let busy = $state(false);
	let dialogError = $state('');
	let confirmClear = $state(false);
	let confirmDelete = $state(false);

	// Into the recycle bin, then back to the list (the store is gone from it)
	async function deleteStore() {
		busy = true;
		dialogError = '';
		try {
			const name = store?.name ?? 'ร้าน';
			await c.api!.deleteStore(storeId);
			confirmDelete = false;
			c.done(`ย้าย ${name} ไปถังขยะแล้ว · กู้คืนได้ภายใน 60 วัน`);
			c.go('stores');
		} catch (err) {
			dialogError = adminError(err);
		} finally {
			busy = false;
		}
	}
	let inviting = $state(false);
	let inviteEmail = $state('');

	async function run(action: () => Promise<unknown>, success: string) {
		busy = true;
		dialogError = '';
		try {
			await action();
			confirmClear = false;
			inviting = false;
			c.done(success);
			await load();
		} catch (err) {
			dialogError = adminError(err);
		} finally {
			busy = false;
		}
	}

	const missing = $derived.by(() => {
		if (!store) return [];
		const m: string[] = [];
		if (!store.imageUrl) m.push('รูปร้าน');
		return m;
	});
</script>

<div class="space-y-4">
	<button type="button" onclick={() => c.go('stores')} class="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900">
		<Icon name="chevron-left" class="h-4 w-4" />ร้านค้าทั้งหมด
	</button>

	{#if error && !store}
		<div class="rounded-2xl border border-slate-100 bg-white"><Empty title="เปิดร้านนี้ไม่ได้" body={error} /></div>
	{:else if !store}
		<div class="h-40 animate-pulse rounded-2xl bg-white"></div>
	{:else}
		<!-- Store at a glance, and the switches the team uses most -->
		<section class="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 sm:p-5">
			<div class="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
				{#if store.logoUrl || store.imageUrl}<img src={img(store.logoUrl || store.imageUrl)} alt="" class="h-16 w-16 object-cover" />{:else}<span class="flex h-full w-full items-center justify-center text-slate-400"><Icon name="store" class="h-6 w-6" /></span>{/if}
			</div>
			<div class="min-w-0 flex-1">
				<h2 class="truncate text-lg font-bold">{store.name}</h2>
				<p class="text-sm text-slate-500">{store.id}{store.lock ? ` · ล็อก ${store.lock}` : ''} · {store.category} · {store.menuItems.length} เมนู</p>
				<p class="mt-1 text-xs">
					{#if meta?.owner_email}
						<span class="text-fresh-700">ร้านดูแลเอง: {meta.owner_email}</span>
					{:else if meta?.invite_email}
						<span class="text-amber-700">เชิญ {meta.invite_email} แล้ว รอร้าน login</span>
					{:else}
						<span class="text-slate-500">ยังไม่มีเมลร้าน ทีมดูแลไปก่อน</span>
						{#if c.isAdmin}<button type="button" onclick={() => { inviting = true; inviteEmail = ''; dialogError = ''; }} class="ml-2 font-medium text-brand">เชิญร้าน</button>{/if}
					{/if}
				</p>
			</div>
			<div class="flex basis-full justify-end gap-5 sm:basis-auto">
				<div class="flex flex-col items-center gap-1">
					<Toggle checked={!(meta?.hidden ?? false)} label="แสดงร้านในแอป" onchange={(v) => c.act(async () => { await c.api!.setStoreHidden(storeId, !v); await load(); }, v ? `แสดง ${store!.name} ในแอปแล้ว` : `ซ่อน ${store!.name} จากแอปแล้ว`)} />
					<span class="text-[11px] text-slate-500">{meta?.hidden ? 'ซ่อนจากแอป' : 'แสดงในแอป'}</span>
				</div>
				<div class="flex flex-col items-center gap-1">
					<Toggle checked={store.isOpen} label="เปิดรับออเดอร์" onchange={(v) => c.act(async () => { await c.api!.setStoreOpen(storeId, v); await load(); }, v ? `เปิดรับออเดอร์ ${store!.name} แล้ว` : `ปิดรับออเดอร์ ${store!.name} แล้ว`)} />
					<span class="text-[11px] text-slate-500">{store.isOpen ? 'รับออเดอร์' : 'ปิดรับ'}</span>
				</div>
			</div>
			{#if meta?.hidden && !store.menuItems.length}
				<p class="w-full rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">ยังไม่มีเมนู · ใส่เมนูแล้วค่อยกด "แสดงในแอป" (รูปใส่ทีหลังได้)</p>
			{/if}
			{#if missing.length && store.menuItems.length}
				<p class="w-full rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">ยังไม่มีรูปร้าน ลูกค้าจะเห็นนาฬิกาทราย "กำลังดำเนินการ" แทนรูป · ใส่รูปเมื่อพร้อม</p>
			{/if}
		</section>

		<Tabs label="แก้ไขร้าน" value={tab} onchange={(t) => (tab = t)} tabs={[{ id: 'info', label: 'ข้อมูลและหน้าร้าน' }, { id: 'menu', label: 'เมนู', count: store.menuItems.length }]} />

		<div class="mx-auto max-w-2xl space-y-4">
			{#if tab === 'info'}
				<StoreInfoForm {store} {ops} />
				<StorefrontForm {store} {ops} />
			{:else}
				<PartnerMenu {store} {ops} />
				{#if c.isAdmin && store.menuItems.length}
					<button type="button" onclick={() => { confirmClear = true; dialogError = ''; }} class="w-full rounded-xl border border-red-200 py-3 text-sm font-medium text-red-600 hover:bg-red-50">ล้างเมนูทั้งร้าน ({store.menuItems.length} เมนู)</button>
				{/if}
			{/if}
		</div>

		{#if c.isAdmin}
			<section class="mx-auto flex max-w-2xl flex-wrap items-center gap-3 border-t border-slate-200 pt-5">
				<div class="min-w-0 flex-1">
					<p class="text-sm font-medium text-slate-900">ลบร้านนี้</p>
					<p class="text-xs text-slate-500">ร้านหายจากแอปทันที และรออยู่ในถังขยะ 60 วัน กู้คืนได้ก่อนนั้น</p>
				</div>
				<button type="button" onclick={() => { confirmDelete = true; dialogError = ''; }} class="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 px-4 text-sm font-medium text-red-600 hover:bg-red-50">
					<Icon name="trash" class="h-4 w-4" />ลบร้าน
				</button>
			</section>
		{/if}
	{/if}
</div>

<Modal open={confirmClear} title="ล้างเมนูทั้งร้าน {store?.name ?? ''}?" onclose={() => (confirmClear = false)} confirmLabel="ล้างเมนู" danger {busy} error={dialogError}
	onconfirm={() => run(() => c.api!.clearMenu(storeId), `ล้างเมนู ${store?.name ?? ''} แล้ว`)}>
	<p>ทั้ง {store?.menuItems.length ?? 0} เมนูจะหายจากร้าน (ออเดอร์เก่ายังอยู่ครบ) ใช้ตอนเอาเมนู mockup ออกเพื่อใส่ของจริง ย้อนกลับไม่ได้</p>
</Modal>

<Modal open={confirmDelete} title="ลบร้าน {store?.name ?? ''}?" onclose={() => (confirmDelete = false)} confirmLabel="ย้ายไปถังขยะ" danger {busy} error={dialogError}
	onconfirm={() => deleteStore()}>
	<p>ร้านจะหายจากแอปทันที ทั้งฝั่งลูกค้าและรายชื่อร้านของทีม{meta?.owner_email ? ' และเจ้าของร้านจะเข้าจัดการร้านไม่ได้จนกว่าจะกู้คืน' : ''}</p>
	<p class="mt-2">ร้านจะรออยู่ใน <strong>ร้านค้า → ถังขยะ</strong> 60 วัน กู้คืนได้ก่อนนั้น พอครบ 60 วันร้านและเมนูจะถูกลบถาวร ส่วนออเดอร์เก่ายังเก็บไว้ครบ</p>
</Modal>

<Modal open={inviting} title="เชิญร้าน {store?.name ?? ''}" onclose={() => (inviting = false)} confirmLabel="ส่งคำเชิญ" {busy} disabled={!inviteEmail.trim()} error={dialogError}
	onconfirm={() => run(() => c.api!.invitePartner(inviteEmail, storeId), `เชิญ ${inviteEmail.trim()} แล้ว`)}>
	<label class="block">
		<span class="mb-1 block font-medium text-slate-900">อีเมล Google ของเจ้าของร้าน</span>
		<input bind:value={inviteEmail} type="email" autocomplete="off" placeholder="เช่น ร้านป้าแดง@gmail.com" class="h-11 w-full rounded-xl bg-slate-100 px-3.5 outline-none focus:ring-2 focus:ring-brand" />
	</label>
	<p class="mt-2 text-xs text-slate-500">ร้าน login ที่ goose-man.tech → "เข้าสู่ระบบร้านค้า" ด้วยอีเมลนี้ แล้วจะจัดการร้านเองได้ ทีมยังแก้ร้านได้เหมือนเดิม · อีเมลต้องยังไม่เคย login Goose Man มาก่อน</p>
</Modal>
