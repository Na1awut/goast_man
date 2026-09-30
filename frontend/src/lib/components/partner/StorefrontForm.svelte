<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import SmartImage from '$lib/components/SmartImage.svelte';
	import type { Store } from '$lib/types';
	import { toast } from '$lib/stores/toast.svelte';
	import { partnerOps, type StoreOps } from '$lib/storeOps';
	import { friendlyError } from '$lib/supabase';

	/** ops: where the change goes (the partner's own store by default, or the team's console) */
	let { store, ops = partnerOps }: { store: Store; ops?: StoreOps } = $props();

	const MAX_BANNER_BYTES = 25 * 1024 * 1024;

	let tagline = $state('');
	let fastLane = $state<number | null>(null);
	let bannerFile = $state<File | null | undefined>(undefined); // undefined = unchanged, null = remove
	let bannerPreview = $state<string | null>(null);
	let manualBannerUrl = $state('');
	let showBannerUrlInput = $state(false);
	let savingFront = $state(false);
	let loadedFor = $state<string | null>(null);

	// Fill the form once per store, not on every catalogue refresh
	$effect(() => {
		if (store && loadedFor !== store.id) {
			loadedFor = store.id;
			tagline = store.tagline ?? '';
			fastLane = store.fastLaneMinutes ?? null;
			manualBannerUrl = store.bannerUrl ?? '';
		}
	});

	const shownBanner = $derived(bannerFile === null ? store.imageUrl : (bannerPreview ?? (manualBannerUrl.trim() || store.bannerUrl || store.imageUrl)));
	const fastLaneError = $derived(fastLane !== null && (fastLane < 1 || fastLane > 60) ? 'ใส่ 1-60 นาที หรือเว้นว่างเพื่อปิด' : '');

	function pickBanner(e: Event) {
		const el = e.currentTarget as HTMLInputElement;
		const file = el.files?.[0];
		el.value = '';
		if (!file) return;
		if (!file.type.startsWith('image/')) return toast.show('เลือกไฟล์รูปภาพเท่านั้น', 'error');
		if (file.size > MAX_BANNER_BYTES) return toast.show('รูปใหญ่เกิน 25 MB ลองย่อรูปก่อน', 'error');
		bannerFile = file;
		bannerPreview = URL.createObjectURL(file);
		manualBannerUrl = '';
	}

	function removeBanner() {
		bannerFile = null;
		bannerPreview = null;
		manualBannerUrl = '';
	}

	async function saveStorefront() {
		if (savingFront || fastLaneError) return;
		savingFront = true;
		try {
			await ops.updateStorefront(store.id, {
				tagline,
				fastLaneMinutes: fastLane ?? undefined,
				bannerFile: manualBannerUrl.trim() ? undefined : bannerFile,
				bannerUrl: manualBannerUrl.trim() || undefined
			});
			bannerFile = undefined;
			bannerPreview = null;
			toast.show('บันทึกหน้าร้านแล้ว ลูกค้าเห็นทันที', 'success');
		} catch (err) {
			toast.show(friendlyError(err), 'error');
		} finally {
			savingFront = false;
		}
	}
</script>

		<section class="space-y-4 rounded-2xl border border-slate-100 bg-white p-4" aria-labelledby="front-title">
		<div>
			<h2 id="front-title" class="text-base font-semibold text-slate-900">หน้าร้านในแอป</h2>
			<p class="text-xs text-slate-500">แบนเนอร์และคำโปรยแสดงบนหน้าร้านของคุณให้นักศึกษาเห็น</p>
		</div>

		<div class="space-y-2">
			<div class="relative overflow-hidden rounded-xl">
				<SmartImage src={shownBanner ?? ''} alt="ตัวอย่างแบนเนอร์หน้าร้าน" class="aspect-[16/7] w-full" />
				{#if !bannerPreview && !manualBannerUrl && !store.bannerUrl}
					<span class="absolute bottom-2 left-2 rounded-md bg-black/55 px-2 py-0.5 text-[11px] text-white">ยังใช้รูปร้านเดิม</span>
				{/if}
			</div>
			<div class="flex flex-wrap gap-2">
				<label class="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-brand py-2.5 text-sm font-medium text-brand active:bg-brand-50">
					<Icon name="upload" class="h-4 w-4" /> {store.bannerUrl || bannerPreview || manualBannerUrl ? 'เปลี่ยนแบนเนอร์' : 'อัปโหลดแบนเนอร์'}
					<input type="file" accept="image/*" class="sr-only" onchange={pickBanner} />
				</label>
				<button type="button" onclick={() => (showBannerUrlInput = !showBannerUrlInput)} class="rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
					<Icon name="link" class="mr-1 inline h-3.5 w-3.5" />{showBannerUrlInput ? 'ปิดลิงก์' : 'หรือใส่ลิงก์รูป (URL)'}
				</button>
				{#if store.bannerUrl || bannerPreview || manualBannerUrl}
					<button type="button" onclick={removeBanner} class="rounded-xl border border-slate-200 px-4 text-sm text-slate-600">ลบ</button>
				{/if}
			</div>

			{#if showBannerUrlInput}
				<div class="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
					<label class="block">
						<span class="mb-1 block text-xs font-medium text-slate-700">ลิงก์แบนเนอร์หน้าร้าน (URL)</span>
						<input type="url" bind:value={manualBannerUrl} placeholder="เช่น https://images.unsplash.com/..." class="w-full rounded-lg bg-white px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-brand" />
						<span class="mt-1 block text-[10px] text-slate-400">ใส่ลิงก์รูปแนวนอนจากเว็บได้โดยตรง</span>
					</label>
				</div>
			{/if}

			<p class="text-[11px] text-slate-500">เลือกรูปแนวนอนจากเครื่อง (ย่อขนาดอัตโนมัติ ไม่เกิน 25 MB) หรือใส่ลิงก์ URL ได้เลย</p>
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
