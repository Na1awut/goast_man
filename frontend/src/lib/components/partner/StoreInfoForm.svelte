<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import SmartImage from '$lib/components/SmartImage.svelte';
	import type { Store } from '$lib/types';
	import { partnerOps, type StoreOps } from '$lib/storeOps';
	import { toast } from '$lib/stores/toast.svelte';
	import { friendlyError } from '$lib/supabase';

	let { store, ops = partnerOps }: { store: Store; ops?: StoreOps } = $props();

	const MAX_BYTES = 25 * 1024 * 1024;

	let name = $state('');
	let category = $state('');
	let description = $state('');
	let queue = $state<number | null>(null);
	let logoFile = $state<File | undefined>(undefined);
	let photoFile = $state<File | undefined>(undefined);
	let logoPreview = $state<string | null>(null);
	let photoPreview = $state<string | null>(null);
	let manualLogoUrl = $state('');
	let manualPhotoUrl = $state('');
	let showLogoUrlInput = $state(false);
	let showPhotoUrlInput = $state(false);
	let saving = $state(false);
	let error = $state('');
	let loadedFor = $state<string | null>(null);

	// Fill once per store, not on every catalogue refresh
	$effect(() => {
		if (loadedFor === store.id) return;
		loadedFor = store.id;
		name = store.name;
		category = store.category;
		description = store.description;
		queue = store.queueMinutes;
		manualLogoUrl = store.logoUrl ?? '';
		manualPhotoUrl = store.imageUrl ?? '';
	});

	const shownLogo = $derived(logoPreview ?? (manualLogoUrl.trim() || store.logoUrl));
	const shownPhoto = $derived(photoPreview ?? (manualPhotoUrl.trim() || store.imageUrl));

	function pick(e: Event, kind: 'logo' | 'photo') {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		if (file.size > MAX_BYTES) {
			toast.show('รูปใหญ่เกินไป (ไม่เกิน 25 MB)', 'error');
			return;
		}
		if (kind === 'logo') {
			logoFile = file;
			logoPreview = URL.createObjectURL(file);
			manualLogoUrl = '';
		} else {
			photoFile = file;
			photoPreview = URL.createObjectURL(file);
			manualPhotoUrl = '';
		}
	}

	async function save() {
		error = '';
		if (!name.trim()) return (error = 'ใส่ชื่อร้าน');
		if (!category.trim()) return (error = 'ใส่ประเภทร้าน เช่น ข้าวมันไก่, เครื่องดื่ม');
		if (queue === null || queue < 0 || queue > 120) return (error = 'เวลาคิวต้องอยู่ระหว่าง 0-120 นาที');
		saving = true;
		try {
			await ops.updateStoreInfo(store.id, { name, category, description, queueMinutes: queue });
			const hasLogo = logoFile || manualLogoUrl.trim() !== (store.logoUrl ?? '');
			const hasPhoto = photoFile || manualPhotoUrl.trim() !== (store.imageUrl ?? '');
			if (hasLogo || hasPhoto) {
				await ops.updateStorefront(store.id, {
					tagline: store.tagline ?? '',
					fastLaneMinutes: store.fastLaneMinutes,
					bannerFile: undefined,
					logoFile: manualLogoUrl.trim() ? undefined : logoFile,
					logoUrl: manualLogoUrl.trim() || undefined,
					photoFile: manualPhotoUrl.trim() ? undefined : photoFile,
					imageUrl: manualPhotoUrl.trim() || undefined
				});
			}
			logoFile = photoFile = undefined;
			logoPreview = photoPreview = null;
			toast.show('บันทึกข้อมูลร้านแล้ว', 'success');
		} catch (err) {
			error = friendlyError(err);
		} finally {
			saving = false;
		}
	}

	const field = 'w-full rounded-xl bg-slate-100 px-3.5 py-3 text-sm outline-none focus:ring-2 focus:ring-brand';
</script>

<section class="space-y-4 rounded-2xl border border-slate-100 bg-white p-4" aria-labelledby="info-title">
	<div>
		<h2 id="info-title" class="text-base font-semibold text-slate-900">ข้อมูลร้าน</h2>
		<p class="text-xs text-slate-500">ชื่อ รูป และรายละเอียดที่นักศึกษาเห็นในรายการร้าน</p>
	</div>

	<div class="grid grid-cols-[auto_1fr] gap-3">
		<div class="space-y-1.5 text-center">
			<div class="h-20 w-20 overflow-hidden rounded-2xl bg-slate-100">
				{#if shownLogo}
					<SmartImage src={shownLogo} alt="โลโก้ร้าน" class="h-20 w-20" />
				{:else}
					<span class="flex h-full w-full items-center justify-center text-slate-400"><Icon name="store" class="h-6 w-6" /></span>
				{/if}
			</div>
			<div class="flex flex-col items-center gap-1">
				<label class="cursor-pointer text-xs font-medium text-brand">
					{shownLogo ? 'เปลี่ยนโลโก้' : 'ใส่โลโก้'}
					<input type="file" accept="image/*" class="sr-only" onchange={(e) => pick(e, 'logo')} />
				</label>
				<button type="button" onclick={() => (showLogoUrlInput = !showLogoUrlInput)} class="text-[10px] text-slate-500 underline">
					{showLogoUrlInput ? 'ปิดลิงก์' : 'ใส่ลิงก์ URL'}
				</button>
			</div>
		</div>
		<div class="space-y-1.5">
			<div class="h-20 overflow-hidden rounded-2xl bg-slate-100">
				{#if shownPhoto}
					<SmartImage src={shownPhoto} alt="รูปร้าน" class="h-20 w-full" />
				{:else}
					<span class="flex h-full w-full items-center justify-center text-slate-400"><Icon name="store" class="h-6 w-6" /></span>
				{/if}
			</div>
			<div class="flex items-center gap-2">
				<label class="cursor-pointer text-xs font-medium text-brand">
					{shownPhoto ? 'เปลี่ยนรูปร้าน' : 'ใส่รูปร้าน'}
					<input type="file" accept="image/*" class="sr-only" onchange={(e) => pick(e, 'photo')} />
				</label>
				<button type="button" onclick={() => (showPhotoUrlInput = !showPhotoUrlInput)} class="text-xs text-slate-500 underline">
					{showPhotoUrlInput ? 'ปิดลิงก์' : 'หรือใส่ลิงก์รูป (URL)'}
				</button>
			</div>
		</div>
	</div>

	{#if showLogoUrlInput}
		<div class="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
			<label class="block">
				<span class="mb-1 block text-xs font-medium text-slate-700">ลิงก์โลโก้ร้าน (URL)</span>
				<input type="url" bind:value={manualLogoUrl} placeholder="เช่น https://..." class="w-full rounded-lg bg-white px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-brand" />
			</label>
		</div>
	{/if}

	{#if showPhotoUrlInput}
		<div class="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
			<label class="block">
				<span class="mb-1 block text-xs font-medium text-slate-700">ลิงก์รูปร้านค้า (URL)</span>
				<input type="url" bind:value={manualPhotoUrl} placeholder="เช่น https://..." class="w-full rounded-lg bg-white px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-brand" />
				<span class="mt-1 block text-[10px] text-slate-400">ใส่ลิงก์รูปภาพโดยตรงจากเว็บได้เลย (เหมือนร้านอื่น)</span>
			</label>
		</div>
	{/if}

	<label class="block">
		<span class="mb-1 block text-sm font-medium text-slate-900">ชื่อร้าน</span>
		<input type="text" bind:value={name} maxlength="60" class={field} />
	</label>
	<label class="block">
		<span class="mb-1 block text-sm font-medium text-slate-900">ประเภทร้าน</span>
		<input type="text" bind:value={category} maxlength="40" placeholder="เช่น ข้าวมันไก่ ฮาลาล" class={field} />
	</label>
	<label class="block">
		<span class="mb-1 flex justify-between text-sm font-medium text-slate-900">รายละเอียดร้าน <span class="text-xs font-normal text-slate-400 tabular-nums">{description.length}/200</span></span>
		<textarea bind:value={description} rows="2" maxlength="200" placeholder="เช่น ค่ากล่อง 5 บาท, เปิด 7:00-14:00" class={field}></textarea>
	</label>
	<label class="block">
		<span class="mb-1 block text-sm font-medium text-slate-900">คิวปกติประมาณ (นาที)</span>
		<input type="number" inputmode="numeric" min="0" max="120" bind:value={queue} class={field} />
		<span class="mt-1 block text-[11px] text-slate-500">ใช้คำนวณเวลาที่คนหิ้วต้องรออาหาร</span>
	</label>

	{#if error}<p class="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>{/if}

	<button type="button" onclick={save} disabled={saving} class="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white disabled:opacity-60">
		{#if saving}<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>{/if}
		บันทึกข้อมูลร้าน
	</button>
</section>
