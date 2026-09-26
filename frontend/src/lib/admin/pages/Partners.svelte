<script lang="ts">
	import { assets } from '$app/paths';
	import Icon from '$lib/components/Icon.svelte';
	import { STORE_CATALOGUE } from '$lib/data/stores';
	import { adminError } from '../api';
	import { consoleState as c } from '../console.svelte';
	import { ago, thaiDate } from '../format';
	import { PROMO_STATE } from '../labels';
	import type { AdminPromo, Partners } from '../types';
	import Empty from '../ui/Empty.svelte';
	import Modal from '../ui/Modal.svelte';
	import Tabs from '../ui/Tabs.svelte';
	import Toggle from '../ui/Toggle.svelte';

	type Tab = 'pending' | 'promos' | 'partners';
	let tab = $state<Tab>('pending');
	let promos = $state<AdminPromo[] | null>(null);
	let partners = $state<Partners | null>(null);
	let error = $state('');

	$effect(() => {
		void c.tick;
		Promise.all([c.api!.promotions(), c.api!.partners()])
			.then(([p, pa]) => {
				promos = p;
				partners = pa;
				error = '';
			})
			.catch((err) => (error = adminError(err)));
	});

	const pending = $derived((promos ?? []).filter((p) => p.state === 'PENDING'));
	const others = $derived((promos ?? []).filter((p) => p.state !== 'PENDING'));
	const img = (u: string) => (!u ? '' : /^(https?:|data:|\/)/.test(u) ? u : `${assets}/${u}`);
	const benefit = (p: AdminPromo) => [p.discount ? `ลด ${p.discount} ฿` : '', p.free_delivery ? 'ฟรีค่าหิ้ว' : ''].filter(Boolean).join(' + ');
	const condition = (p: AdminPromo) => (p.min_qty > 1 ? `เมื่อสั่ง ${p.min_qty} ชิ้นขึ้นไป` : 'ทุกออเดอร์');

	let rejecting = $state<AdminPromo | null>(null);
	let inviting = $state(false);
	let note = $state('');
	let email = $state('');
	let storeId = $state('');
	let busy = $state(false);
	let dialogError = $state('');
	const freeStores = $derived(STORE_CATALOGUE.filter((s) => !partners?.partners.some((p) => p.store_id === s.id)));

	async function run(action: () => Promise<unknown>, success: string) {
		busy = true;
		dialogError = '';
		try {
			await action();
			rejecting = null;
			inviting = false;
			c.done(success);
		} catch (err) {
			dialogError = adminError(err);
		} finally {
			busy = false;
		}
	}
</script>

<div class="space-y-4">
	<Tabs
		label="Partner และโปร"
		value={tab}
		onchange={(t) => (tab = t)}
		tabs={[
			{ id: 'pending', label: 'โปรรออนุมัติ', count: pending.length },
			{ id: 'promos', label: 'โปรทั้งหมด', count: others.length },
			{ id: 'partners', label: 'ร้าน Partner', count: partners?.partners.length }
		]}
	/>
	{#if !c.isAdmin}<p class="text-xs text-slate-500">STAFF ดูได้อย่างเดียว การอนุมัติโปรและเชิญร้านทำได้เฉพาะ ADMIN</p>{/if}

	{#if error && !promos}
		<div class="rounded-2xl border border-slate-100 bg-white"><Empty title="โหลดข้อมูลไม่สำเร็จ" body={error} /></div>
	{:else if !promos || !partners}
		<div class="h-48 animate-pulse rounded-2xl bg-white"></div>
	{:else if tab === 'pending'}
		{#if pending.length === 0}
			<div class="rounded-2xl border border-slate-100 bg-white"><Empty title="ไม่มีโปรรออนุมัติ" body="โปรร่วมที่ร้าน Partner ส่งมาจะขึ้นที่นี่" /></div>
		{:else}
			<div class="grid gap-4 lg:grid-cols-2">
				{#each pending as p (p.id)}
					<article class="rounded-2xl border border-slate-100 bg-white p-5">
						<div class="flex items-center gap-3">
							<img src={img(p.store_image)} alt="" class="h-12 w-12 rounded-xl object-cover" />
							<div class="min-w-0"><p class="truncate font-semibold">{p.store}</p><p class="text-xs text-slate-500">โปรร่วม Goose Man · ส่งมา {ago(p.created_at)}</p></div>
						</div>
						<div class="mt-4 rounded-xl bg-brand-50 p-4">
							<p class="text-lg font-bold text-slate-900">{p.title}</p>
							<p class="mt-1 text-sm text-brand-700">{benefit(p)} · {condition(p)}</p>
							<p class="mt-1 text-xs text-slate-600">{p.ends_at ? `หมดเขต ${thaiDate(p.ends_at)}` : 'ไม่มีวันหมดเขต'}</p>
							{#if p.description}<p class="mt-2 text-sm text-slate-700">{p.description}</p>{/if}
						</div>
						{#if c.isAdmin}
							<div class="mt-4 flex gap-2">
								<button type="button" onclick={() => { rejecting = p; note = ''; dialogError = ''; }} class="h-11 flex-1 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">ไม่อนุมัติ</button>
								<button type="button" onclick={() => c.act(() => c.api!.reviewPromo(p.id, true, ''), `อนุมัติโปร "${p.title}" แล้ว`)} class="h-11 flex-1 rounded-xl bg-brand text-sm font-semibold text-white hover:bg-brand-600">อนุมัติ</button>
							</div>
						{/if}
					</article>
				{/each}
			</div>
		{/if}
	{:else if tab === 'promos'}
		<div class="rounded-2xl border border-slate-100 bg-white">
			{#if others.length === 0}
				<Empty title="ยังไม่มีโปร" goose={false} />
			{:else}
				<ul class="divide-y divide-slate-100">
					{#each others as p (p.id)}
						<li class="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
							<img src={img(p.store_image)} alt="" class="h-10 w-10 shrink-0 rounded-lg object-cover" />
							<div class="min-w-0 flex-1">
								<p class="flex flex-wrap items-center gap-2"><span class="font-semibold">{p.title}</span><span class="rounded-full px-2 py-0.5 text-[11px] font-medium {PROMO_STATE[p.state].pill}">{PROMO_STATE[p.state].label}</span></p>
								<p class="truncate text-xs text-slate-500">{p.store} · {p.kind === 'CO_PROMO' ? 'โปรร่วม' : 'โปรร้าน'} · {benefit(p)} · {condition(p)} · ใช้ไป {p.uses} ออเดอร์</p>
								{#if p.review_note}<p class="text-xs text-red-600">เหตุผลที่ไม่อนุมัติ: {p.review_note}</p>{/if}
							</div>
							{#if c.isAdmin && p.state !== 'ENDED' && p.state !== 'REJECTED'}
								<Toggle checked={p.active} label="เปิดโปร {p.title}" onchange={(v) => c.act(() => c.api!.setPromoActive(p.id, v), v ? `เปิดโปร "${p.title}" แล้ว` : `ปิดโปร "${p.title}" แล้ว`)} />
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{:else}
		<div class="space-y-4">
			{#if c.isAdmin}
				<div class="flex justify-end">
					<button type="button" onclick={() => { inviting = true; email = ''; storeId = freeStores[0]?.id ?? ''; dialogError = ''; }} class="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-600"><Icon name="mail" class="h-4 w-4" />เชิญร้าน</button>
				</div>
			{/if}
			<div class="rounded-2xl border border-slate-100 bg-white">
				{#if partners.partners.length === 0 && partners.invites.length === 0}
					<Empty title="ยังไม่มีร้าน Partner" body="เชิญเจ้าของร้านด้วยอีเมล เขาจะได้หน้าจัดการร้านเมื่อ login ครั้งแรก" />
				{:else}
					<ul class="divide-y divide-slate-100">
						{#each partners.partners as p (p.store_id)}
							<li class="flex items-center gap-3 px-4 py-3.5 sm:px-5">
								<div class="min-w-0 flex-1"><p class="truncate font-semibold">{p.store}</p><p class="truncate text-xs text-slate-500">{p.owner_name} · {p.owner_email} · เข้าร่วม {thaiDate(p.joined_at)}</p></div>
								<span class="shrink-0 rounded-full bg-fresh-50 px-2.5 py-1 text-xs font-medium text-fresh-700">เข้าร่วมแล้ว</span>
							</li>
						{/each}
						{#each partners.invites as inv (inv.email)}
							<li class="flex items-center gap-3 px-4 py-3.5 sm:px-5">
								<div class="min-w-0 flex-1"><p class="truncate font-semibold">{inv.store}</p><p class="truncate text-xs text-slate-500">{inv.email} · เชิญ {ago(inv.invited_at)}</p></div>
								<span class="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">รอเจ้าของร้าน login</span>
								{#if c.isAdmin}<button type="button" onclick={() => c.act(() => c.api!.cancelInvite(inv.email), `ยกเลิกคำเชิญ ${inv.email} แล้ว`)} class="h-9 shrink-0 rounded-lg px-3 text-sm text-red-600 hover:bg-red-50">ยกเลิกคำเชิญ</button>{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>
	{/if}
</div>

<Modal open={!!rejecting} title="ไม่อนุมัติโปร &quot;{rejecting?.title ?? ''}&quot;" onclose={() => (rejecting = null)} confirmLabel="ไม่อนุมัติ" danger {busy} disabled={!note.trim()} error={dialogError}
	onconfirm={() => run(() => c.api!.reviewPromo(rejecting!.id, false, note), `ส่งโปร "${rejecting!.title}" กลับให้ร้านแล้ว`)}>
	<p>ร้านจะเห็นเหตุผลนี้ แก้ไขแล้วส่งมาให้ตรวจใหม่ได้</p>
	<label class="mt-4 block">
		<span class="mb-1 block font-medium text-slate-900">เหตุผล</span>
		<textarea bind:value={note} rows="2" maxlength="200" class="w-full rounded-xl bg-slate-100 px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-brand"></textarea>
	</label>
</Modal>

<Modal open={inviting} title="เชิญร้าน Partner" onclose={() => (inviting = false)} confirmLabel="ส่งคำเชิญ" {busy} disabled={!email.trim() || !storeId} error={dialogError}
	onconfirm={() => run(() => c.api!.invitePartner(email, storeId), `เชิญ ${email.trim()} แล้ว`)}>
	<label class="block">
		<span class="mb-1 block font-medium text-slate-900">ร้าน</span>
		<select bind:value={storeId} class="h-11 w-full rounded-xl bg-slate-100 px-3 outline-none focus:ring-2 focus:ring-brand">
			{#each freeStores as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
		</select>
	</label>
	<label class="mt-4 block">
		<span class="mb-1 block font-medium text-slate-900">อีเมลเจ้าของร้าน</span>
		<input bind:value={email} type="email" placeholder="owner@gmail.com" class="h-11 w-full rounded-xl bg-slate-100 px-3.5 outline-none focus:ring-2 focus:ring-brand" />
	</label>
	<p class="mt-3 text-xs text-slate-500">เจ้าของร้านกด "เข้าสู่ระบบร้านค้า" ในแอปด้วยอีเมลนี้ ระบบจะผูกบัญชีกับร้านให้เอง</p>
</Modal>
