<script lang="ts">
	import { untrack } from 'svelte';
	import AppBar from '$lib/components/AppBar.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import PartnerBadge from '$lib/components/PartnerBadge.svelte';
	import PartnerMenu from '$lib/components/partner/PartnerMenu.svelte';
	import PartnerOverview from '$lib/components/partner/PartnerOverview.svelte';
	import StoreInfoForm from '$lib/components/partner/StoreInfoForm.svelte';
	import StorefrontForm from '$lib/components/partner/StorefrontForm.svelte';
	import Sheet from '$lib/components/Sheet.svelte';
	import SmartImage from '$lib/components/SmartImage.svelte';
	import type { PromoKind, Promotion } from '$lib/types';
	import { auth } from '$lib/stores/auth.svelte';
	import { catalog } from '$lib/stores/catalog.svelte';
	import { nav } from '$lib/stores/nav.svelte';
	import { storeView } from '$lib/stores/storeView.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { describeBenefit } from '$lib/pricing';
	import { friendlyError } from '$lib/supabase';

	const TABS = [
		{ id: 'overview', label: 'ภาพรวม' },
		{ id: 'menu', label: 'เมนู' },
		{ id: 'shop', label: 'หน้าร้านและโปร' }
	] as const;
	let tab = $state<(typeof TABS)[number]['id']>('overview');

	const store = $derived(auth.user?.partnerStoreId ? catalog.byId(auth.user.partnerStoreId) : undefined);
	$effect(() => {
		const id = auth.user?.partnerStoreId;
		if (auth.isPartner && id) untrack(() => { void catalog.loadPartnerStore(id); });
	});

	function retryStore() {
		if (auth.isPartner && auth.user?.partnerStoreId) void catalog.loadPartnerStore(auth.user.partnerStoreId);
	}

	// ---------- Promotions ----------
	interface Draft {
		id?: string;
		kind: PromoKind;
		title: string;
		description: string;
		minQty: number;
		discount: number;
		freeDelivery: boolean;
		endsOn: string; // yyyy-mm-dd, '' = no end
		active: boolean;
	}

	const blankDraft = (): Draft => ({ kind: 'DEAL', title: '', description: '', minQty: 1, discount: 10, freeDelivery: false, endsOn: '', active: true });

	let draft = $state<Draft | null>(null);
	let savingPromo = $state(false);
	let confirmDelete = $state<Promotion | null>(null);

	const draftErrors = $derived.by(() => {
		if (!draft) return {};
		return {
			title: draft.title.trim().length < 3 ? 'ตั้งชื่อโปรอย่างน้อย 3 ตัวอักษร' : '',
			benefit: !(draft.discount > 0) ? 'ใส่ส่วนลดเป็นบาท' : '',
			discount: draft.discount < 0 || draft.discount > 200 ? 'ส่วนลด 0-200 บาท' : '',
			minQty: draft.minQty < 1 || draft.minQty > 20 ? 'จำนวนขั้นต่ำ 1-20 ชิ้น' : ''
		};
	});
	const draftValid = $derived(!!draft && Object.values(draftErrors).every((e) => !e));

	function edit(p: Promotion) {
		draft = {
			id: p.id,
			kind: p.kind,
			title: p.title,
			description: p.description,
			minQty: p.minQty,
			discount: p.discount,
			freeDelivery: p.freeDelivery,
			endsOn: p.endsAt ? p.endsAt.slice(0, 10) : '',
			active: p.active
		};
	}

	async function savePromo() {
		if (!store || !draft || !draftValid || savingPromo) return;
		savingPromo = true;
		try {
			const saved = await catalog.savePromotion({
				id: draft.id,
				storeId: store.id,
				title: draft.title.trim(),
				description: draft.description.trim(),
				minQty: Math.round(draft.minQty),
				discount: Math.round(draft.discount || 0),
				// Stores make their own deals only: a discount on the food, never free delivery (the database refuses both)
				kind: 'DEAL',
				freeDelivery: false,
				// End of the chosen day, Bangkok time
				endsAt: draft.endsOn ? new Date(`${draft.endsOn}T23:59:59+07:00`).toISOString() : undefined,
				active: draft.active
			});
			draft = null;
			toast.show('บันทึกโปรแล้ว ลูกค้าเห็นทันที', 'success');
		} catch (err) {
			toast.show(friendlyError(err), 'error');
		} finally {
			savingPromo = false;
		}
	}

	async function toggle(p: Promotion) {
		if (!store) return;
		try {
			await catalog.savePromotion({ ...p, active: !p.active });
		} catch (err) {
			toast.show(friendlyError(err), 'error');
		}
	}

	async function remove(p: Promotion) {
		if (!store) return;
		confirmDelete = null;
		try {
			await catalog.deletePromotion(store.id, p.id);
			toast.show('ลบโปรแล้ว', 'success');
		} catch (err) {
			toast.show(friendlyError(err), 'error');
		}
	}

	function statusOf(p: Promotion): { label: string; class: string } {
		if (p.endsAt && new Date(p.endsAt).getTime() < Date.now()) return { label: 'หมดเวลาแล้ว', class: 'bg-slate-100 text-slate-500' };
		if (!p.approved) return { label: 'รอ Goose Man อนุมัติ', class: 'bg-amber-50 text-amber-700' };
		if (!p.active) return { label: 'ปิดอยู่', class: 'bg-slate-100 text-slate-500' };
		return { label: 'แสดงในแอป', class: 'bg-fresh-50 text-fresh-700' };
	}
</script>

<div class="flex flex-1 flex-col">
	<AppBar title="จัดการร้านของฉัน" onback={() => nav.reset('PROFILE')} />

	{#if !store}
		<div class="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-12 text-center" aria-live="polite">
			<Icon name="store" class="h-10 w-10 text-brand" />
			<p class="text-sm font-medium text-slate-800">{catalog.partnerLoading ? 'กำลังโหลดร้านของคุณ...' : catalog.partnerError ?? 'บัญชีนี้ยังไม่ได้ผูกกับร้าน Partner'}</p>
			{#if !catalog.partnerLoading}
				{#if auth.isPartner}
					<button type="button" onclick={retryStore} class="min-h-11 rounded-xl bg-brand px-5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">ลองโหลดร้านอีกครั้ง</button>
				{:else}<p class="text-xs text-slate-600">ติดต่อทีม Goose Man เพื่อเปิดบัญชีร้านค้า</p>{/if}
				<button type="button" onclick={() => nav.reset('PROFILE')} class="min-h-11 text-sm font-medium text-brand-700">กลับไปโปรไฟล์</button>
			{/if}
		</div>
	{:else}
		<div class="space-y-6 px-4 pt-4 pb-10">
			{#if store.hidden}<p class="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">ร้านนี้ยังไม่แสดงให้ลูกค้าเห็น คุณจัดการข้อมูลและเมนูได้ ติดต่อทีม Goose Man เมื่อต้องการแสดงร้านในแอป</p>{/if}
			<!-- Identity -->
			<div class="flex items-center justify-between gap-3">
				<div class="min-w-0">
					<p class="truncate text-lg font-semibold text-slate-900">{store.name}</p>
					<PartnerBadge compact />
				</div>
				<button type="button" onclick={() => storeView.open(store.id)} class="shrink-0 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm text-slate-700">ดูหน้าร้าน</button>
			</div>

			<div class="grid grid-cols-3 rounded-xl bg-slate-100 p-1 text-sm" role="tablist" aria-label="จัดการร้าน">
				{#each TABS as t (t.id)}
					<button type="button" role="tab" aria-selected={tab === t.id} onclick={() => (tab = t.id)} class="rounded-lg py-2 {tab === t.id ? 'bg-white font-semibold text-slate-900 shadow-sm' : 'text-slate-500'}">{t.label}</button>
				{/each}
			</div>

			{#if tab === 'overview'}
				<PartnerOverview {store} />
			{:else if tab === 'menu'}
				<PartnerMenu {store} />
			{:else}
			<StoreInfoForm {store} />

			<StorefrontForm {store} />

			<!-- Promotions -->
			<section class="space-y-3" aria-labelledby="promo-title">
				<div class="flex items-center justify-between">
					<div>
						<h2 id="promo-title" class="text-base font-semibold text-slate-900">โปรโมชัน</h2>
						<p class="text-xs text-slate-500">ลูกค้าได้โปรที่คุ้มที่สุดอัตโนมัติ 1 โปรต่อออเดอร์</p>
					</div>
					<button type="button" onclick={() => (draft = blankDraft())} class="flex shrink-0 items-center gap-1 rounded-full bg-brand px-3.5 py-2 text-sm font-semibold text-white">
						<Icon name="plus" class="h-4 w-4" /> สร้างโปร
					</button>
				</div>

				{#if store.promotions.length === 0}
					<p class="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">ยังไม่มีโปรโมชัน ลองสร้างโปรแรกของร้าน</p>
				{:else}
					<ul class="space-y-2">
						{#each store.promotions as p (p.id)}
							{@const status = statusOf(p)}
							<li class="rounded-2xl border border-slate-100 bg-white p-4">
								<div class="flex items-start justify-between gap-3">
									<div class="min-w-0">
										<p class="text-[11px] font-medium {p.kind === 'CO_PROMO' ? 'text-brand' : 'text-slate-500'}">{p.kind === 'CO_PROMO' ? 'โปรร่วม (เลิกใช้แล้ว)' : 'โปรของร้าน'}</p>
										<p class="text-sm font-semibold text-slate-900">{p.title}</p>
										<p class="text-xs text-slate-600">{describeBenefit(p)}</p>
									</div>
									<span class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium {status.class}">{status.label}</span>
								</div>
								<div class="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
									<label class="flex flex-1 cursor-pointer items-center gap-2 text-sm text-slate-700">
										<input type="checkbox" checked={p.active} onchange={() => toggle(p)} class="h-4 w-4 accent-brand" />
										เปิดใช้งาน
									</label>
									<button type="button" onclick={() => edit(p)} class="rounded-lg px-3 py-1.5 text-sm text-brand hover:bg-brand-50">แก้ไข</button>
									<button type="button" onclick={() => (confirmDelete = p)} class="rounded-lg px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">ลบ</button>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
			{/if}
		</div>
	{/if}
</div>

<!-- Create / edit promotion -->
<Sheet open={draft !== null} title={draft?.id ? 'แก้ไขโปรโมชัน' : 'สร้างโปรโมชัน'} onclose={() => (draft = null)}>
	{#if draft}
		<form
			class="space-y-4 pb-2"
			onsubmit={(e) => {
				e.preventDefault();
				savePromo();
			}}
		>
			<p class="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">โปรของร้านขึ้นในแอปทันที และร้านเป็นคนออกส่วนลด: คนหิ้วจะจ่ายที่หน้าร้านในราคาที่ลดแล้ว · ลดได้เฉพาะค่าอาหาร (ค่าหิ้วเป็นของคนหิ้ว)</p>

			<label class="block">
				<span class="mb-1 block text-sm font-medium text-slate-900">ชื่อโปร</span>
				<input type="text" bind:value={draft.title} maxlength="80" placeholder="เช่น สั่ง 2 กล่อง ลด 10 บาท" class="w-full rounded-xl bg-slate-100 px-3.5 py-3 text-sm outline-none focus:ring-2 focus:ring-brand" />
				{#if draftErrors.title && draft.title}<span class="mt-1 block text-xs text-red-600">{draftErrors.title}</span>{/if}
			</label>
			<label class="block">
				<span class="mb-1 block text-sm font-medium text-slate-900">รายละเอียด <span class="font-normal text-slate-400">(ไม่บังคับ)</span></span>
				<input type="text" bind:value={draft.description} maxlength="200" class="w-full rounded-xl bg-slate-100 px-3.5 py-3 text-sm outline-none focus:ring-2 focus:ring-brand" />
			</label>

			<div class="grid grid-cols-2 gap-3">
				<label class="block">
					<span class="mb-1 block text-sm font-medium text-slate-900">ลด (บาท)</span>
					<input type="number" inputmode="numeric" min="0" max="200" bind:value={draft.discount} class="w-full rounded-xl bg-slate-100 px-3.5 py-3 text-sm outline-none focus:ring-2 focus:ring-brand" />
				</label>
				<label class="block">
					<span class="mb-1 block text-sm font-medium text-slate-900">สั่งขั้นต่ำ (ชิ้น)</span>
					<input type="number" inputmode="numeric" min="1" max="20" bind:value={draft.minQty} class="w-full rounded-xl bg-slate-100 px-3.5 py-3 text-sm outline-none focus:ring-2 focus:ring-brand" />
				</label>
			</div>
			<label class="block">
				<span class="mb-1 block text-sm font-medium text-slate-900">สิ้นสุดวันที่ <span class="font-normal text-slate-400">(ไม่บังคับ)</span></span>
				<input type="date" bind:value={draft.endsOn} min={new Date().toISOString().slice(0, 10)} class="w-full rounded-xl bg-slate-100 px-3.5 py-3 text-sm outline-none focus:ring-2 focus:ring-brand" />
			</label>

			{#each [draftErrors.benefit, draftErrors.discount, draftErrors.minQty].filter(Boolean) as message (message)}
				<p class="text-xs text-red-600">{message}</p>
			{/each}

			<p class="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">ลูกค้าจะเห็น: {describeBenefit(draft)}</p>

			<button type="submit" disabled={!draftValid || savingPromo} class="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-sm font-semibold text-white disabled:opacity-50">
				{#if savingPromo}<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>{/if}
				บันทึกโปร
			</button>
		</form>
	{/if}
</Sheet>

<Sheet open={confirmDelete !== null} title="ลบโปรโมชันนี้?" onclose={() => (confirmDelete = null)}>
	{#if confirmDelete}
		{@const target = confirmDelete}
		<p class="text-sm text-slate-600">"{target.title}" จะหายไปจากแอปทันที และกู้คืนไม่ได้</p>
		<div class="mt-5 grid grid-cols-2 gap-3">
			<button type="button" onclick={() => (confirmDelete = null)} class="rounded-xl bg-slate-100 py-3 text-sm font-medium text-slate-700">ยกเลิก</button>
			<button type="button" onclick={() => remove(target)} class="rounded-xl bg-red-600 py-3 text-sm font-medium text-white">ลบโปร</button>
		</div>
	{/if}
</Sheet>
