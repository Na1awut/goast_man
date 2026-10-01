<script lang="ts">
	// Staff & Admin Banner Manager: Add, edit, reorder, and toggle home banners.
	// When multiple active banners exist, customer HomeScreen automatically switches to a carousel.
	import Icon from '$lib/components/Icon.svelte';
	import SmartImage from '$lib/components/SmartImage.svelte';
	import { consoleState as c } from '../console.svelte';
	import { adminError } from '../api';
	import type { HomeBanner } from '$lib/types';
	import { banners, DEFAULT_BANNER } from '$lib/stores/banners.svelte';
	import { fileToDataUrl } from '$lib/image';
	import { toast } from '$lib/stores/toast.svelte';
	import Empty from '../ui/Empty.svelte';
	import Modal from '../ui/Modal.svelte';
	import Toggle from '../ui/Toggle.svelte';

	let list = $state<HomeBanner[] | null>(null);
	let loading = $state(true);
	let error = $state('');

	// Load banners from API
	async function load() {
		if (!c.api) return;
		try {
			loading = true;
			const data = await c.api.homeBanners();
			list = data && data.length > 0 ? data : [DEFAULT_BANNER];
			error = '';
		} catch (err) {
			error = adminError(err);
			list = banners.list.length > 0 ? banners.list : [DEFAULT_BANNER];
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		void c.tick;
		if (c.api) void load();
	});

	// Reordering
	let reordering = $state(false);
	async function moveItem(index: number, direction: 'up' | 'down') {
		if (!list || reordering) return;
		const targetIndex = direction === 'up' ? index - 1 : index + 1;
		if (targetIndex < 0 || targetIndex >= list.length) return;

		reordering = true;
		const nextList = [...list];
		const itemA = nextList[index];
		const itemB = nextList[targetIndex];

		nextList[index] = itemB;
		nextList[targetIndex] = itemA;

		// Reassign sort numbers
		const reindexed = nextList.map((item, i) => ({ ...item, sort: i + 1 }));
		list = reindexed;

		try {
			await Promise.all([
				c.api?.saveHomeBanner(reindexed[index]),
				c.api?.saveHomeBanner(reindexed[targetIndex])
			]);
			await banners.load();
			c.done('จัดลำดับแบนเนอร์เรียบร้อย');
		} catch (err) {
			toast.show(adminError(err), 'error');
			void load();
		} finally {
			reordering = false;
		}
	}

	// Active toggle
	async function toggleBanner(banner: HomeBanner, nextActive: boolean) {
		const prev = banner.active;
		banner.active = nextActive;
		try {
			await c.api?.saveHomeBanner({ ...banner, active: nextActive });
			await banners.load();
			c.done(nextActive ? 'เปิดใช้งานแบนเนอร์แล้ว' : 'ปิดใช้งานแบนเนอร์แล้ว');
		} catch (err) {
			banner.active = prev;
			toast.show(adminError(err), 'error');
		}
	}

	// Delete
	let deleteTarget = $state<HomeBanner | null>(null);
	let deleting = $state(false);
	async function confirmDelete() {
		if (!deleteTarget || !c.api) return;
		deleting = true;
		try {
			await c.api.deleteHomeBanner(deleteTarget.id);
			list = (list || []).filter((b) => b.id !== deleteTarget!.id);
			if (list.length === 0) {
				list = [DEFAULT_BANNER];
			}
			await banners.load();
			c.done('ลบแบนเนอร์เรียบร้อย');
			deleteTarget = null;
		} catch (err) {
			toast.show(adminError(err), 'error');
		} finally {
			deleting = false;
		}
	}

	// Create / Edit modal state
	let modalOpen = $state(false);
	let isEditing = $state(false);
	let modalBusy = $state(false);
	let modalError = $state('');

	let draftId = $state('');
	let draftImageUrl = $state('');
	let draftTitle = $state('');
	let draftSubtitle = $state('');
	let draftButtonText = $state('ฝากหิ้วเลย');
	let draftActionType = $state<'STORES' | 'CUSTOM_ORDER' | 'ORDERS' | 'CUSTOM'>('STORES');
	let draftCustomLink = $state('');
	let draftActive = $state(true);
	let draftSort = $state(0);

	function openCreate() {
		isEditing = false;
		draftId = `banner-${Date.now()}`;
		draftImageUrl = '';
		draftTitle = '';
		draftSubtitle = '';
		draftButtonText = 'ฝากหิ้วเลย';
		draftActionType = 'STORES';
		draftCustomLink = '';
		draftActive = true;
		draftSort = (list?.length || 0) + 1;
		modalError = '';
		modalOpen = true;
	}

	function openEdit(b: HomeBanner) {
		isEditing = true;
		draftId = b.id;
		draftImageUrl = b.imageUrl;
		draftTitle = b.title;
		draftSubtitle = b.subtitle || '';
		draftButtonText = b.buttonText || 'ฝากหิ้วเลย';
		const link = b.linkUrl || 'STORES';
		if (link === 'STORES' || link === 'CUSTOM_ORDER' || link === 'ORDERS') {
			draftActionType = link;
			draftCustomLink = '';
		} else {
			draftActionType = 'CUSTOM';
			draftCustomLink = link;
		}
		draftActive = b.active;
		draftSort = b.sort;
		modalError = '';
		modalOpen = true;
	}

	let fileInputEl = $state<HTMLInputElement | null>(null);
	let imageProcessing = $state(false);

	async function handleImageFile(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		imageProcessing = true;
		try {
			// Compress image to a high quality ~1200px data url for instant reliable storage
			const dataUrl = await fileToDataUrl(file, 1400, 0.85);
			draftImageUrl = dataUrl;
		} catch (err) {
			modalError = 'ไม่สามารถอ่านไฟล์รูปภาพได้ กรุณาลองใหม่อีกครั้ง';
		} finally {
			imageProcessing = false;
			input.value = '';
		}
	}

	const draftFinalLink = $derived(
		draftActionType === 'CUSTOM' ? draftCustomLink.trim() : draftActionType
	);

	const draftErrors = $derived.by(() => {
		if (!draftImageUrl.trim()) return 'กรุณาใส่รูปภาพหรืออัปโหลดรูปภาพ';
		if (!draftTitle.trim()) return 'กรุณาใส่ข้อความหัวข้อแบนเนอร์';
		return '';
	});

	async function saveBanner() {
		if (draftErrors) {
			modalError = draftErrors;
			return;
		}
		modalBusy = true;
		modalError = '';

		const payload: HomeBanner = {
			id: draftId,
			imageUrl: draftImageUrl.trim(),
			title: draftTitle.trim(),
			subtitle: draftSubtitle.trim() || undefined,
			buttonText: draftButtonText.trim() || 'ฝากหิ้วเลย',
			linkUrl: draftFinalLink || 'STORES',
			active: draftActive,
			sort: draftSort
		};

		try {
			await c.api?.saveHomeBanner(payload);
			modalOpen = false;
			await load();
			await banners.load();
			c.done(isEditing ? 'บันทึกการแก้ไขแบนเนอร์แล้ว' : 'เพิ่มแบนเนอร์ใหม่แล้ว');
		} catch (err) {
			modalError = adminError(err);
		} finally {
			modalBusy = false;
		}
	}

	const activeCount = $derived((list || []).filter((b) => b.active).length);
</script>

<div class="space-y-4">
	<!-- Top Bar / Subheader -->
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<p class="text-sm text-slate-500">
				แบนเนอร์หน้าแรกของแอป Goose Man
				{#if activeCount > 1}
					<span class="ml-1 inline-flex items-center gap-1 font-medium text-brand">
						(เปิดใช้งาน {activeCount} อัน · ระบบเปิดเป็น Slide Bar อัตโนมัติ)
					</span>
				{:else if activeCount === 1}
					<span class="ml-1 inline-flex items-center gap-1 text-slate-500">
						(เปิดใช้งาน 1 อัน · แสดงเป็นการ์ดเดี่ยว)
					</span>
				{:else}
					<span class="ml-1 inline-flex items-center gap-1 font-medium text-amber-600">
						(ยังไม่มีแบนเนอร์ที่เปิดใช้งาน ระบบจะใช้แบนเนอร์ค่าเริ่มต้น)
					</span>
				{/if}
			</p>
		</div>
		<button
			type="button"
			onclick={openCreate}
			class="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-brand-600 active:bg-brand-700"
		>
			<Icon name="plus" class="h-4 w-4" />
			<span>เพิ่มแบนเนอร์</span>
		</button>
	</div>

	{#if error}
		<div class="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
			<Icon name="alert" class="h-5 w-5 shrink-0 text-amber-600" />
			<span class="flex-1">{error}</span>
			<button type="button" onclick={load} class="rounded-lg bg-white px-3 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
				ลองใหม่
			</button>
		</div>
	{/if}

	<!-- Banner List -->
	{#if loading && !list}
		<div class="space-y-3">
			{#each [0, 1] as i (i)}
				<div class="skeleton h-32 w-full rounded-2xl"></div>
			{/each}
		</div>
	{:else if !list || list.length === 0}
		<Empty icon="image" message="ยังไม่มีแบนเนอร์" hint="กด 'เพิ่มแบนเนอร์' ด้านบนเพื่อสร้างแบนเนอร์ใหม่" />
	{:else}
		<div class="space-y-3">
			{#each list as item, index (item.id)}
				<div
					class="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-2xs transition-shadow sm:flex-row sm:items-center sm:gap-5 hover:border-slate-200"
				>
					<!-- Reorder Arrows -->
					<div class="flex items-center gap-1 self-start sm:flex-col sm:self-center">
						<button
							type="button"
							disabled={index === 0 || reordering}
							onclick={() => moveItem(index, 'up')}
							aria-label="เลื่อนขึ้น"
							class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-20"
						>
							<Icon name="chevron-up" class="h-4 w-4" />
						</button>
						<span class="w-6 text-center text-xs font-semibold text-slate-400 tabular-nums">
							{index + 1}
						</span>
						<button
							type="button"
							disabled={index === list.length - 1 || reordering}
							onclick={() => moveItem(index, 'down')}
							aria-label="เลื่อนลง"
							class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-20"
						>
							<Icon name="chevron-down" class="h-4 w-4" />
						</button>
					</div>

					<!-- Image Preview -->
					<div class="relative w-full shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 sm:w-56">
						<SmartImage
							src={item.imageUrl}
							alt={item.title}
							class="aspect-[2658/984] w-full object-cover"
							pending
						/>
						{#if !item.active}
							<div class="absolute inset-0 flex items-center justify-center bg-slate-900/40 text-xs font-medium text-white backdrop-blur-[1px]">
								ปิดใช้งาน
							</div>
						{/if}
					</div>

					<!-- Details & Info -->
					<div class="min-w-0 flex-1 space-y-1.5">
						<div class="flex flex-wrap items-center gap-2">
							<h3 class="text-base font-semibold text-slate-900">{item.title}</h3>
							{#if item.active}
								<span class="inline-flex items-center rounded-full bg-fresh-50 px-2 py-0.5 text-xs font-medium text-fresh-700">
									เปิดใช้งาน
								</span>
							{:else}
								<span class="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
									ปิดอยู่
								</span>
							{/if}
						</div>

						{#if item.subtitle}
							<p class="text-sm text-slate-500">{item.subtitle}</p>
						{/if}

						<div class="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-slate-500">
							<span class="inline-flex items-center gap-1 font-medium text-slate-700">
								<Icon name="tag" class="h-3.5 w-3.5 text-brand" />
								ปุ่ม: "{item.buttonText || 'ฝากหิ้วเลย'}"
							</span>
							<span class="text-slate-300">·</span>
							<span class="inline-flex items-center gap-1">
								<Icon name="arrow-right" class="h-3.5 w-3.5 text-slate-400" />
								{#if !item.linkUrl || item.linkUrl === 'STORES'}
									ปลายทาง: หน้าร้านค้า (STORES)
								{:else if item.linkUrl === 'CUSTOM_ORDER'}
									ปลายทาง: ฝากซื้ออิสระ (CUSTOM_ORDER)
								{:else if item.linkUrl === 'ORDERS'}
									ปลายทาง: รายการสั่งซื้อ (ORDERS)
								{:else}
									ปลายทาง: {item.linkUrl}
								{/if}
							</span>
						</div>
					</div>

					<!-- Actions -->
					<div class="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 sm:border-0 sm:pt-0">
						<div class="flex items-center gap-2">
							<span class="text-xs text-slate-500 sm:hidden">เปิดใช้งาน:</span>
							<Toggle
								checked={item.active}
								label="เปิดใช้งาน {item.title}"
								onchange={(val) => toggleBanner(item, val)}
							/>
						</div>

						<div class="flex items-center gap-1">
							<button
								type="button"
								onclick={() => openEdit(item)}
								aria-label="แก้ไข"
								class="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800"
							>
								<Icon name="edit" class="h-4 w-4" />
							</button>
							<button
								type="button"
								onclick={() => (deleteTarget = item)}
								aria-label="ลบ"
								class="flex h-9 w-9 items-center justify-center rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-700"
							>
								<Icon name="trash" class="h-4 w-4" />
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Create / Edit Banner Modal -->
<Modal
	open={modalOpen}
	title={isEditing ? 'แก้ไขแบนเนอร์' : 'เพิ่มแบนเนอร์ใหม่'}
	confirmLabel={isEditing ? 'บันทึกการแก้ไข' : 'สร้างแบนเนอร์'}
	busy={modalBusy}
	disabled={!!draftErrors}
	error={modalError}
	onclose={() => (modalOpen = false)}
	onconfirm={saveBanner}
>
	<div class="space-y-4">
		<!-- Image Input / Upload -->
		<div>
			<label class="block text-xs font-semibold text-slate-700">รูปภาพแบนเนอร์ *</label>
			<p class="mt-0.5 text-xs text-slate-500">แนะนำสัดส่วนแนวนอน กว้าง:สูง ประมาณ 2.7:1 (เช่น 1200x444 หรือ 2658x984 px)</p>

			<div class="mt-2 space-y-2">
				<!-- Live Preview Area -->
				<div class="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
					{#if draftImageUrl}
						<img
							src={draftImageUrl}
							alt="พรีวิวแบนเนอร์"
							class="aspect-[2658/984] w-full object-cover"
						/>
						<button
							type="button"
							onclick={() => (draftImageUrl = '')}
							class="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
							aria-label="เปลี่ยนรูป"
						>
							<Icon name="x" class="h-3.5 w-3.5" />
						</button>
					{:else}
						<div class="flex aspect-[2658/984] w-full flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 p-4 text-center">
							<Icon name="image" class="h-8 w-8 text-slate-300" />
							<span class="text-xs text-slate-400">ยังไม่ได้เลือกรูปภาพแบนเนอร์</span>
						</div>
					{/if}
				</div>

				<!-- Upload Button & Direct URL Input -->
				<div class="flex flex-col gap-2 sm:flex-row">
					<input
						bind:this={fileInputEl}
						type="file"
						accept="image/*"
						class="hidden"
						onchange={handleImageFile}
					/>
					<button
						type="button"
						onclick={() => fileInputEl?.click()}
						disabled={imageProcessing}
						class="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
					>
						<Icon name="camera" class="h-4 w-4 text-slate-500" />
						<span>{imageProcessing ? 'กำลังอ่านไฟล์...' : 'เลือกรูปจากเครื่องคอมฯ'}</span>
					</button>

					<div class="flex flex-2 items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 focus-within:ring-2 focus-within:ring-brand">
						<Icon name="link" class="h-3.5 w-3.5 text-slate-400" />
						<input
							type="text"
							bind:value={draftImageUrl}
							placeholder="หรือวาง URL รูปภาพ (https://...)"
							class="w-full bg-transparent text-xs text-slate-900 outline-none placeholder:text-slate-400"
						/>
					</div>
				</div>
			</div>
		</div>

		<!-- Title Input -->
		<div>
			<label class="block text-xs font-semibold text-slate-700">หัวข้อแบนเนอร์ *</label>
			<input
				type="text"
				bind:value={draftTitle}
				placeholder="เช่น ขี้เกียจเดินฝ่าแดด? ให้ห่านบางมดหิ้วให้"
				class="mt-1 h-11 w-full rounded-xl bg-slate-100 px-3.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand"
			/>
		</div>

		<!-- Subtitle Input -->
		<div>
			<label class="block text-xs font-semibold text-slate-700">คำอธิบายย่อย (Subtitle)</label>
			<input
				type="text"
				bind:value={draftSubtitle}
				placeholder="เช่น ค่าหิ้วเริ่มต้นเพียง 15.- หรือ ส่งตรงถึงหน้าหอ"
				class="mt-1 h-11 w-full rounded-xl bg-slate-100 px-3.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand"
			/>
		</div>

		<!-- Button Text Input -->
		<div>
			<label class="block text-xs font-semibold text-slate-700">ข้อความบนปุ่มกด</label>
			<input
				type="text"
				bind:value={draftButtonText}
				placeholder="เช่น ฝากหิ้วเลย, สั่งเลย, ดูร้านค้า"
				class="mt-1 h-11 w-full rounded-xl bg-slate-100 px-3.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand"
			/>
		</div>

		<!-- Target Link Preset -->
		<div>
			<label class="block text-xs font-semibold text-slate-700">เมื่อกดแบนเนอร์ ให้เปิดไปที่ไหน</label>
			<div class="mt-1.5 grid grid-cols-2 gap-2">
				<button
					type="button"
					onclick={() => (draftActionType = 'STORES')}
					class="flex items-center gap-2 rounded-xl border p-2.5 text-left text-xs transition-colors {draftActionType === 'STORES'
						? 'border-brand bg-brand-50 font-semibold text-brand-700'
						: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}"
				>
					<Icon name="store" class="h-4 w-4" />
					<span>หน้าร้านค้า (STORES)</span>
				</button>

				<button
					type="button"
					onclick={() => (draftActionType = 'CUSTOM_ORDER')}
					class="flex items-center gap-2 rounded-xl border p-2.5 text-left text-xs transition-colors {draftActionType === 'CUSTOM_ORDER'
						? 'border-brand bg-brand-50 font-semibold text-brand-700'
						: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}"
				>
					<Icon name="cart" class="h-4 w-4" />
					<span>ฝากซื้ออิสระ (CUSTOM_ORDER)</span>
				</button>

				<button
					type="button"
					onclick={() => (draftActionType = 'ORDERS')}
					class="flex items-center gap-2 rounded-xl border p-2.5 text-left text-xs transition-colors {draftActionType === 'ORDERS'
						? 'border-brand bg-brand-50 font-semibold text-brand-700'
						: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}"
				>
					<Icon name="receipt" class="h-4 w-4" />
					<span>รายการสั่งซื้อ (ORDERS)</span>
				</button>

				<button
					type="button"
					onclick={() => (draftActionType = 'CUSTOM')}
					class="flex items-center gap-2 rounded-xl border p-2.5 text-left text-xs transition-colors {draftActionType === 'CUSTOM'
						? 'border-brand bg-brand-50 font-semibold text-brand-700'
						: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}"
				>
					<Icon name="link" class="h-4 w-4" />
					<span>ลิงก์กำหนดเอง / รหัสร้าน</span>
				</button>
			</div>

			{#if draftActionType === 'CUSTOM'}
				<input
					type="text"
					bind:value={draftCustomLink}
					placeholder="ใส่ URL เช่น https://... หรือ รหัสร้าน เช่น sit-coffee"
					class="mt-2 h-10 w-full rounded-xl bg-slate-100 px-3.5 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-brand"
				/>
			{/if}
		</div>

		<!-- Active Switch -->
		<div class="flex items-center justify-between rounded-xl bg-slate-50 p-3">
			<div>
				<p class="text-xs font-semibold text-slate-800">เปิดใช้งานทันที</p>
				<p class="text-[11px] text-slate-500">แสดงแบนเนอร์นี้บนหน้าแรกของแอป</p>
			</div>
			<Toggle
				checked={draftActive}
				label="เปิดใช้งานทันที"
				onchange={(v) => (draftActive = v)}
			/>
		</div>
	</div>
</Modal>

<!-- Delete Confirm Dialog -->
<Modal
	open={!!deleteTarget}
	title="ลบแบนเนอร์"
	confirmLabel="ลบแบนเนอร์"
	danger
	busy={deleting}
	onclose={() => (deleteTarget = null)}
	onconfirm={confirmDelete}
>
	<p class="text-sm text-slate-600">
		คุณแน่ใจหรือไม่ว่าต้องการลบแบนเนอร์ <strong class="text-slate-900">"{deleteTarget?.title}"</strong>?
	</p>
</Modal>
