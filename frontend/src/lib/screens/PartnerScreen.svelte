<script lang="ts">
	import AppBar from '$lib/components/AppBar.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import PartnerBadge from '$lib/components/PartnerBadge.svelte';
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

	const MAX_BANNER_BYTES = 3 * 1024 * 1024;

	const store = $derived(auth.user?.partnerStoreId ? catalog.byId(auth.user.partnerStoreId) : undefined);

	// ---------- Storefront ----------
	let tagline = $state('');
	let fastLane = $state<number | null>(null);
	let bannerFile = $state<File | null | undefined>(undefined); // undefined = unchanged, null = remove
	let bannerPreview = $state<string | null>(null);
	let savingFront = $state(false);
	let loadedFor = $state<string | null>(null);

	// Fill the form once per store, not on every catalogue refresh
	$effect(() => {
		if (store && loadedFor !== store.id) {
			loadedFor = store.id;
			tagline = store.tagline ?? '';
			fastLane = store.fastLaneMinutes ?? null;
		}
	});

	const shownBanner = $derived(bannerFile === null ? store?.imageUrl : (bannerPreview ?? store?.bannerUrl ?? store?.imageUrl));
	const fastLaneError = $derived(fastLane !== null && (fastLane < 1 || fastLane > 60) ? 'ใส่ 1-60 นาที หรือเว้นว่างเพื่อปิด' : '');

	function pickBanner(e: Event) {
		const el = e.currentTarget as HTMLInputElement;
		const file = el.files?.[0];
		el.value = '';
		if (!file) return;
		if (!file.type.startsWith('image/')) return toast.show('เลือกไฟล์รูปภาพเท่านั้น', 'error');
		if (file.size > MAX_BANNER_BYTES) return toast.show('รูปใหญ่เกิน 3 MB ลองย่อรูปก่อน', 'error');
		bannerFile = file;
		bannerPreview = URL.createObjectURL(file);
	}

	function removeBanner() {
		bannerFile = null;
		bannerPreview = null;
	}

	async function saveStorefront() {
		if (!store || savingFront || fastLaneError) return;
		savingFront = true;
		try {
			await catalog.updateStorefront(store.id, { tagline, fastLaneMinutes: fastLane ?? undefined, bannerFile });
			bannerFile = undefined;
			bannerPreview = null;
			toast.show('บันทึกหน้าร้านแล้ว ลูกค้าเห็นทันที', 'success');
		} catch (err) {
			toast.show(friendlyError(err), 'error');
		} finally {
			savingFront = false;
		}
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
			benefit: !(draft.discount > 0) && !draft.freeDelivery ? 'ต้องมีส่วนลด หรือฟรีค่าหิ้ว อย่างน้อยหนึ่งอย่าง' : '',
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
				kind: draft.kind,
				title: draft.title.trim(),
				description: draft.description.trim(),
				minQty: Math.round(draft.minQty),
				discount: Math.round(draft.discount || 0),
				freeDelivery: draft.freeDelivery,
				// End of the chosen day, Bangkok time
				endsAt: draft.endsOn ? new Date(`${draft.endsOn}T23:59:59+07:00`).toISOString() : undefined,
				active: draft.active
			});
			draft = null;
			toast.show(saved.approved ? 'บันทึกโปรแล้ว ลูกค้าเห็นทันที' : 'ส่งโปรร่วมให้ทีม Goose Man ตรวจแล้ว จะขึ้นในแอปเมื่ออนุมัติ', 'success');
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
		<div class="flex flex-1 flex-col items-center justify-center px-8 text-center">
			<p class="text-sm font-medium text-slate-800">{catalog.loading ? 'กำลังโหลดร้าน...' : 'บัญชีนี้ยังไม่ได้ผูกกับร้าน Partner'}</p>
			{#if !catalog.loading}<p class="mt-1 text-xs text-slate-500">ติดต่อทีม Goose Man เพื่อเปิดบัญชีร้านค้า</p>{/if}
		</div>
	{:else}
		<div class="space-y-6 px-4 pt-4 pb-10">
			<!-- Identity -->
			<div class="flex items-center justify-between gap-3">
				<div class="min-w-0">
					<p class="truncate text-lg font-semibold text-slate-900">{store.name}</p>
					<PartnerBadge compact />
				</div>
				<button type="button" onclick={() => storeView.open(store.id)} class="shrink-0 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm text-slate-700">ดูหน้าร้าน</button>
			</div>

			<!-- Storefront -->
			<section class="space-y-4 rounded-2xl border border-slate-100 bg-white p-4" aria-labelledby="front-title">
				<div>
					<h2 id="front-title" class="text-base font-semibold text-slate-900">หน้าร้านในแอป</h2>
					<p class="text-xs text-slate-500">แบนเนอร์และคำโปรยแสดงบนหน้าร้านของคุณให้นักศึกษาเห็น</p>
				</div>

				<div class="space-y-2">
					<div class="relative overflow-hidden rounded-xl">
						<SmartImage src={shownBanner ?? ''} alt="ตัวอย่างแบนเนอร์หน้าร้าน" class="aspect-[16/7] w-full" />
						{#if !bannerPreview && !store.bannerUrl}
							<span class="absolute bottom-2 left-2 rounded-md bg-black/55 px-2 py-0.5 text-[11px] text-white">ยังใช้รูปร้านเดิม</span>
						{/if}
					</div>
					<div class="flex gap-2">
						<label class="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-brand py-2.5 text-sm font-medium text-brand active:bg-brand-50">
							<Icon name="upload" class="h-4 w-4" /> {store.bannerUrl || bannerPreview ? 'เปลี่ยนแบนเนอร์' : 'อัปโหลดแบนเนอร์'}
							<input type="file" accept="image/png,image/jpeg,image/webp" class="sr-only" onchange={pickBanner} />
						</label>
						{#if store.bannerUrl || bannerPreview}
							<button type="button" onclick={removeBanner} class="rounded-xl border border-slate-200 px-4 text-sm text-slate-600">ลบ</button>
						{/if}
					</div>
					<p class="text-[11px] text-slate-500">แนะนำรูปแนวนอน 1600×700 ขึ้นไป ไม่เกิน 3 MB</p>
				</div>

				<label class="block">
					<span class="mb-1 flex justify-between text-sm font-medium text-slate-900">คำโปรยร้าน <span class="text-xs font-normal text-slate-400 tabular-nums">{tagline.length}/80</span></span>
					<input type="text" bind:value={tagline} maxlength="80" placeholder="เช่น ต้มสดทุกเช้า น้ำจิ้มสูตรบ้าน" class="w-full rounded-xl bg-slate-100 px-3.5 py-3 text-sm outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-brand" />
				</label>

				<label class="block">
					<span class="mb-1 block text-sm font-medium text-slate-900">Fast lane สำหรับออเดอร์ผ่านแอป (นาที)</span>
					<input
						type="number"
						inputmode="numeric"
						min="1"
						max="60"
						bind:value={fastLane}
						placeholder="เว้นว่าง = ไม่เปิด Fast lane"
						aria-invalid={!!fastLaneError}
						class="w-full rounded-xl bg-slate-100 px-3.5 py-3 text-sm outline-none placeholder:text-slate-400 focus:ring-2 {fastLaneError ? 'ring-2 ring-red-300' : 'focus:ring-brand'}"
					/>
					<span class="mt-1 block text-[11px] {fastLaneError ? 'text-red-600' : 'text-slate-500'}">
						{fastLaneError || `ร้านทำออเดอร์จากแอปก่อน คิวหน้าร้านตอนนี้ ~${store.queueMinutes} นาที`}
					</span>
				</label>

				<button type="button" onclick={saveStorefront} disabled={savingFront || !!fastLaneError} class="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white disabled:opacity-60">
					{#if savingFront}<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>{/if}
					บันทึกหน้าร้าน
				</button>
			</section>

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
										<p class="text-[11px] font-medium {p.kind === 'CO_PROMO' ? 'text-brand' : 'text-slate-500'}">{p.kind === 'CO_PROMO' ? 'โปรร่วมกับ Goose Man' : 'โปรของร้าน'}</p>
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
			<fieldset class="grid grid-cols-2 gap-2">
				<legend class="mb-1.5 text-sm font-medium text-slate-900">ประเภท</legend>
				{#each [
					{ id: 'DEAL' as const, label: 'โปรของร้าน', sub: 'ขึ้นในแอปทันที' },
					{ id: 'CO_PROMO' as const, label: 'โปรร่วม Goose Man', sub: 'ทีมตรวจก่อนขึ้น' }
				] as k (k.id)}
					<label class="cursor-pointer rounded-xl border p-3 {draft.kind === k.id ? 'border-brand bg-brand-50' : 'border-slate-200'}">
						<input type="radio" name="kind" value={k.id} bind:group={draft.kind} class="sr-only" />
						<span class="block text-sm font-medium text-slate-900">{k.label}</span>
						<span class="block text-[11px] text-slate-500">{k.sub}</span>
					</label>
				{/each}
			</fieldset>
			{#if draft.kind === 'CO_PROMO'}
				<p class="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">โปรร่วมจะขึ้นในส่วน "โปรร่วมกับ Goose Man" บนหน้าแรกของแอป หลังทีมอนุมัติ ถ้าแก้เงื่อนไขภายหลังต้องรออนุมัติใหม่</p>
			{/if}

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
			<label class="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
				<input type="checkbox" bind:checked={draft.freeDelivery} class="h-4 w-4 accent-brand" /> ฟรีค่าหิ้วให้ลูกค้าด้วย
			</label>
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
				{draft.kind === 'CO_PROMO' ? 'ส่งให้ทีม Goose Man ตรวจ' : 'บันทึกโปร'}
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
