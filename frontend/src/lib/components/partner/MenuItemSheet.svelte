<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import Sheet from '$lib/components/Sheet.svelte';
	import SmartImage from '$lib/components/SmartImage.svelte';
	import type { MenuItem, MenuOptionChoice, MenuOptionGroup, Store } from '$lib/types';
	import { partnerOps, type StoreOps } from '$lib/storeOps';
	import { toast } from '$lib/stores/toast.svelte';
	import { friendlyError } from '$lib/supabase';
	import { uid } from '$lib/utils';

	/** item: a dish to edit; null = add a new one; undefined = closed */
	let { store, item, onclose, ops = partnerOps }: { store: Store; item: MenuItem | null | undefined; onclose: () => void; ops?: StoreOps } = $props();

	const MAX_PHOTO_BYTES = 25 * 1024 * 1024;
	const categories = $derived([...new Set(store.menuItems.map((m) => m.category).filter(Boolean))]);

	let name = $state('');
	let category = $state('');
	let price = $state<number | null>(null);
	let specialPrice = $state<number | null>(null);
	let description = $state('');
	let available = $state(true);
	let options = $state<MenuOptionGroup[]>([]);
	let photoFile = $state<File | null | undefined>(undefined);
	let preview = $state<string | null>(null);
	let manualUrl = $state('');
	let showUrlInput = $state(false);
	let saving = $state(false);
	let confirmRemove = $state(false);
	let error = $state('');
	let openedFor = $state<object | null>(null);
	let dropdownOpen = $state(false);

	// Fill the form each time the sheet opens for a new/different dish.
	// We track the item REFERENCE (not just the id) so that after a save replaces the
	// array item with a fresh object, reopening the sheet picks up the updated data.
	$effect(() => {
		// While closed, do nothing and reset the sentinel so the next open always re-inits.
		if (item === undefined) {
			openedFor = null;
			dropdownOpen = false;
			return;
		}
		// Use the object reference as the sentinel – a replaced (saved) object is ≠ the old one.
		if ((item as object) === openedFor) return;
		openedFor = item as object;
		dropdownOpen = false;
		name = item?.name ?? '';
		category = item?.category ?? categories[0] ?? '';
		price = item?.price ?? null;
		specialPrice = item?.specialPrice ?? null;
		description = item?.description ?? '';
		available = item?.isAvailable ?? true;
		options = item?.options ? JSON.parse(JSON.stringify(item.options)) : [];
		photoFile = undefined;
		preview = null;
		manualUrl = item?.imageUrl ?? '';
		showUrlInput = false;
		error = '';
		confirmRemove = false;
	});

	const shownPhoto = $derived(photoFile === null ? '' : (preview ?? (manualUrl.trim() || item?.imageUrl || '')));
	const problems = $derived.by(() => {
		if (!name.trim()) return 'ใส่ชื่อเมนู';
		if (!category.trim()) return 'ใส่หมวดหมู่';
		if (!price || price < 1 || price > 2000) return 'ราคาต้องอยู่ระหว่าง 1-2,000 บาท';
		if (specialPrice !== null && (specialPrice <= price || specialPrice > 2000)) return 'ราคาพิเศษต้องมากกว่าราคาธรรมดา (ไม่เกิน 2,000 บาท)';
		return '';
	});

	function pickPhoto(e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		if (file.size > MAX_PHOTO_BYTES) {
			toast.show('รูปใหญ่เกินไป (ไม่เกิน 25 MB)', 'error');
			return;
		}
		photoFile = file;
		preview = URL.createObjectURL(file);
	}

	function addOptionGroup(name = 'ท็อปปิ้ง', required = false, maxChoices = 5, initialChoices?: { name: string; price: number }[]) {
		const newGroup: MenuOptionGroup = {
			id: uid('opt'),
			name,
			required,
			maxChoices,
			choices: initialChoices
				? initialChoices.map((c) => ({ id: uid('ch'), name: c.name, price: c.price }))
				: [{ id: uid('ch'), name: '', price: 0 }]
		};
		options = [...options, newGroup];
	}

	function removeOptionGroup(index: number) {
		options = options.filter((_, i) => i !== index);
	}

	function addChoice(groupIndex: number) {
		options[groupIndex].choices = [...options[groupIndex].choices, { id: uid('ch'), name: '', price: 0 }];
	}

	function removeChoice(groupIndex: number, choiceIndex: number) {
		options[groupIndex].choices = options[groupIndex].choices.filter((_, i) => i !== choiceIndex);
	}

	interface DropdownOptionItem {
		id: string;
		label: string;
		subtext?: string;
		group: MenuOptionGroup;
	}

	const defaultPresets: DropdownOptionItem[] = [
		{
			id: 'preset-toppings',
			label: 'ไข่ดาว / ไข่เจียว',
			subtext: 'ไข่ดาว +10฿, ไข่เจียว +15฿',
			group: {
				id: 'opt-toppings',
				name: 'ท็อปปิ้งเพิ่มเติม',
				required: false,
				maxChoices: 5,
				choices: [
					{ id: 'ch-1', name: 'ไข่ดาว', price: 10 },
					{ id: 'ch-2', name: 'ไข่เจียว', price: 15 },
					{ id: 'ch-3', name: 'เพิ่มข้าว', price: 10 }
				]
			}
		},
		{
			id: 'preset-spicy',
			label: 'ระดับความเผ็ด',
			subtext: 'ไม่เผ็ด, น้อย, ปกติ, มาก',
			group: {
				id: 'opt-spicy',
				name: 'ระดับความเผ็ด',
				required: true,
				maxChoices: 1,
				choices: [
					{ id: 'ch-1', name: 'ไม่เผ็ด', price: 0 },
					{ id: 'ch-2', name: 'เผ็ดน้อย', price: 0 },
					{ id: 'ch-3', name: 'เผ็ดปกติ', price: 0 },
					{ id: 'ch-4', name: 'เผ็ดมาก', price: 0 }
				]
			}
		},
		{
			id: 'preset-sweet',
			label: 'ระดับความหวาน',
			subtext: '0%, 25%, 50%, 100%',
			group: {
				id: 'opt-sweet',
				name: 'ระดับความหวาน',
				required: true,
				maxChoices: 1,
				choices: [
					{ id: 'ch-1', name: 'หวาน 0%', price: 0 },
					{ id: 'ch-2', name: 'หวาน 25% (หวานน้อย)', price: 0 },
					{ id: 'ch-3', name: 'หวาน 50%', price: 0 },
					{ id: 'ch-4', name: 'หวาน 100% (ปกติ)', price: 0 }
				]
			}
		},
		{
			id: 'preset-meat',
			label: 'เลือกเนื้อสัตว์',
			subtext: 'หมู, ไก่, หมูกรอบ, ทะเล',
			group: {
				id: 'opt-meat',
				name: 'เลือกเนื้อสัตว์',
				required: true,
				maxChoices: 1,
				choices: [
					{ id: 'ch-1', name: 'หมูสับ', price: 0 },
					{ id: 'ch-2', name: 'ไก่', price: 0 },
					{ id: 'ch-3', name: 'หมูกรอบ', price: 10 },
					{ id: 'ch-4', name: 'ทะเล', price: 20 }
				]
			}
		}
	];

	let customPresetsVersion = $state(0);
	const dropdownItems = $derived.by<DropdownOptionItem[]>(() => {
		void customPresetsVersion;
		const items: DropdownOptionItem[] = [];
		const seenLabels = new Set<string>();

		function addItem(label: string, subtext: string, group: MenuOptionGroup) {
			const key = label.trim().toLowerCase();
			if (!key || seenLabels.has(key)) return;
			seenLabels.add(key);
			items.push({ id: group.id || uid('opt'), label: label.trim(), subtext, group });
		}

		// 1. Gather all option groups and individual choices from dishes in this store
		for (const m of store.menuItems) {
			for (const g of m.options ?? []) {
				if (!g.choices || g.choices.length === 0) continue;
				const choiceNames = g.choices.map((c) => c.name.trim()).filter(Boolean);
				if (choiceNames.length === 0) continue;

				const isGeneric = g.name.trim() === 'ตัวเลือกใหม่' || g.name.trim() === 'ท็อปปิ้ง';
				const groupLabel = isGeneric && choiceNames.length === 1 ? choiceNames[0] : g.name.trim();
				const subtext = g.choices.length === 1
					? `${g.choices[0].price > 0 ? `+${g.choices[0].price} ฿` : 'ฟรี'}`
					: `${g.choices.length} อย่าง (${choiceNames.slice(0, 3).join(', ')}${choiceNames.length > 3 ? '...' : ''})`;
				addItem(groupLabel, subtext, g);

				if (g.choices.length > 1) {
					for (const c of g.choices) {
						if (!c.name.trim()) continue;
						const singleGroup: MenuOptionGroup = {
							id: uid('opt'),
							name: c.name.trim(),
							required: false,
							maxChoices: 1,
							choices: [{ id: uid('ch'), name: c.name.trim(), price: c.price || 0 }]
						};
						addItem(c.name.trim(), c.price > 0 ? `+${c.price} ฿` : 'ฟรี', singleGroup);
					}
				}
			}
		}

		// 2. Also check presets saved in localStorage for this store
		if (typeof localStorage !== 'undefined') {
			try {
				const saved = localStorage.getItem(`gm_store_opts_${store.id}`);
				if (saved) {
					const list = JSON.parse(saved) as MenuOptionGroup[];
					for (const g of list) {
						if (!g.choices || g.choices.length === 0) continue;
						const choiceNames = g.choices.map((c) => c.name.trim()).filter(Boolean);
						if (choiceNames.length === 0) continue;
						const isGeneric = g.name.trim() === 'ตัวเลือกใหม่' || g.name.trim() === 'ท็อปปิ้ง';
						const groupLabel = isGeneric && choiceNames.length === 1 ? choiceNames[0] : g.name.trim();
						const subtext = g.choices.length === 1
							? `${g.choices[0].price > 0 ? `+${g.choices[0].price} ฿` : 'ฟรี'}`
							: `${g.choices.length} อย่าง (${choiceNames.slice(0, 3).join(', ')}${choiceNames.length > 3 ? '...' : ''})`;
						addItem(groupLabel, subtext, g);
					}
				}
			} catch {
				// ignore
			}
		}

		return items;
	});

	function selectDropdownItem(item: DropdownOptionItem) {
		const newGroup: MenuOptionGroup = {
			id: uid('opt'),
			name: item.group.name,
			required: item.group.required,
			maxChoices: item.group.maxChoices,
			choices: item.group.choices.map((c) => ({
				id: uid('ch'),
				name: c.name,
				price: c.price
			}))
		};
		options = [...options, newGroup];
		dropdownOpen = false;
		toast.show(`เพิ่ม "${item.label}" แล้ว`, 'success');
	}

	function saveGroupAsPreset(group: MenuOptionGroup) {
		const cleanName = group.name.trim();
		const cleanChoices = group.choices.filter((c) => c.name.trim().length > 0);
		if (!cleanName || cleanChoices.length === 0) {
			toast.show('กรุณาตั้งชื่อกลุ่มและใส่ตัวเลือกก่อนบันทึก', 'info');
			return;
		}
		if (typeof localStorage !== 'undefined') {
			try {
				const key = `gm_store_opts_${store.id}`;
				const existing = JSON.parse(localStorage.getItem(key) ?? '[]') as MenuOptionGroup[];
				const map = new Map<string, MenuOptionGroup>();
				for (const g of existing) if (g.name?.trim()) map.set(g.name.trim().toLowerCase(), g);
				map.set(cleanName.toLowerCase(), {
					...group,
					name: cleanName,
					choices: cleanChoices.map((c) => ({ ...c, name: c.name.trim(), price: Math.max(0, Number(c.price) || 0) }))
				});
				localStorage.setItem(key, JSON.stringify([...map.values()]));
				customPresetsVersion++;
				toast.show(`บันทึกหมวด "${cleanName}" ไว้ใช้กับเมนูอื่นในร้านแล้ว`, 'success');
			} catch {
				// ignore
			}
		}
	}

	async function save() {
		if (problems) {
			error = problems;
			return;
		}
		saving = true;
		error = '';
		try {
			const finalUrl = manualUrl.trim() || (item?.imageUrl ?? '');
			const cleanOptions: MenuOptionGroup[] = options
				.map((g) => ({
					...g,
					name: g.name.trim(),
					choices: g.choices
						.map((c) => ({ ...c, name: c.name.trim(), price: Math.max(0, Number(c.price) || 0) }))
						.filter((c) => c.name.length > 0)
				}))
				.filter((g) => g.name.length > 0 && g.choices.length > 0);

			// Automatically remember these option groups for this store
			if (typeof localStorage !== 'undefined' && cleanOptions.length > 0) {
				try {
					const key = `gm_store_opts_${store.id}`;
					const existing = JSON.parse(localStorage.getItem(key) ?? '[]') as MenuOptionGroup[];
					const map = new Map<string, MenuOptionGroup>();
					for (const g of existing) if (g.name?.trim()) map.set(g.name.trim().toLowerCase(), g);
					for (const g of cleanOptions) if (g.name?.trim()) map.set(g.name.trim().toLowerCase(), g);
					localStorage.setItem(key, JSON.stringify([...map.values()]));
					customPresetsVersion++;
				} catch {
					// ignore
				}
			}

			await ops.saveMenuItem(store.id, {
				id: item?.id,
				name: name.trim(),
				category: category.trim(),
				price: price!,
				specialPrice: specialPrice ?? undefined,
				description: description.trim(),
				imageUrl: finalUrl,
				photoFile: manualUrl.trim() ? undefined : photoFile,
				isAvailable: available,
				options: cleanOptions
			});
			toast.show(item ? `บันทึก ${name.trim()} แล้ว` : `เพิ่ม ${name.trim()} ในเมนูแล้ว`, 'success');
			onclose();
		} catch (err) {
			error = friendlyError(err);
		} finally {
			saving = false;
		}
	}

	async function remove() {
		if (!item) return;
		saving = true;
		try {
			await ops.removeMenuItem(store.id, item.id);
			toast.show(`ลบ ${item.name} ออกจากเมนูแล้ว`, 'info');
			onclose();
		} catch (err) {
			error = friendlyError(err);
		} finally {
			saving = false;
		}
	}

	const field = 'w-full rounded-xl bg-slate-100 px-3.5 py-3 text-sm outline-none focus:ring-2 focus:ring-brand';
</script>

<Sheet open={item !== undefined} title={item ? 'แก้ไขเมนู' : 'เพิ่มเมนู'} {onclose}>
	<form
		class="space-y-4 pb-2"
		onsubmit={(e) => {
			e.preventDefault();
			save();
		}}
	>
		<!-- Photo -->
		<div class="flex items-center gap-3">
			<div class="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
				{#if shownPhoto}
					<SmartImage src={shownPhoto} alt="รูป {name || 'เมนู'}" class="h-20 w-20" />
				{:else}
					<span class="flex h-full w-full items-center justify-center text-slate-400"><Icon name="camera" class="h-6 w-6" /></span>
				{/if}
			</div>
			<div class="min-w-0 flex-1 space-y-1.5">
				<div class="flex flex-wrap items-center gap-2">
					<label class="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-brand px-3 text-sm font-medium text-brand focus-within:ring-2 focus-within:ring-brand active:bg-brand-50">
						<Icon name="upload" class="h-4 w-4" />{shownPhoto ? 'เปลี่ยนรูป' : 'ใส่รูปเมนู'}
						<input type="file" accept="image/*" class="sr-only" onchange={pickPhoto} />
					</label>
					<button type="button" onclick={() => (showUrlInput = !showUrlInput)} class="inline-flex h-10 items-center gap-1 rounded-xl border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
						<Icon name="link" class="h-3.5 w-3.5" />{showUrlInput ? 'ซ่อนลิงก์' : 'หรือใส่ลิงก์รูป (URL)'}
					</button>
					{#if shownPhoto}
						<button type="button" onclick={() => { photoFile = null; preview = null; manualUrl = ''; }} class="inline-flex h-10 items-center gap-1.5 rounded-xl border border-red-200 px-3 text-sm font-medium text-red-600 hover:bg-red-50">
							<Icon name="image-off" class="h-4 w-4" />ลบรูป
						</button>
					{/if}
				</div>
				{#if showUrlInput}
					<div class="pt-1">
						<input
							type="url"
							bind:value={manualUrl}
							placeholder="วางลิงก์รูปภาพ เช่น https://..."
							class="w-full rounded-xl bg-slate-100 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-brand"
						/>
						<p class="mt-1 text-[10px] text-slate-400">ใส่ลิงก์รูปภาพจากเว็บ หรือฝากรูปเว็บอื่นได้ทันที (เหมือนร้านอื่น)</p>
					</div>
				{/if}
				{#if photoFile === null && item?.imageUrl}
					<p class="text-xs text-red-700">รูปจะถูกลบเมื่อกดบันทึก · <button type="button" onclick={() => (photoFile = undefined)} class="font-medium underline underline-offset-2">ไม่ลบแล้ว</button></p>
				{:else}
					<p class="text-[11px] text-slate-500">เลือกรูปจากเครื่อง (ย่อขนาดอัตโนมัติ) หรือใส่ลิงก์ URL ก็ได้</p>
				{/if}
			</div>
		</div>

		<label class="block">
			<span class="mb-1 block text-sm font-medium text-slate-900">ชื่อเมนู</span>
			<input type="text" bind:value={name} maxlength="80" placeholder="เช่น ข้าวมันไก่ทอด" class={field} />
		</label>

		<label class="block">
			<span class="mb-1 block text-sm font-medium text-slate-900">หมวดหมู่</span>
			<input type="text" bind:value={category} maxlength="40" list="menu-categories" placeholder="เช่น ข้าว, เครื่องดื่ม" class={field} />
			<datalist id="menu-categories">{#each categories as c (c)}<option value={c}></option>{/each}</datalist>
			{#if categories.length}
				<span class="mt-1.5 flex flex-wrap gap-1.5">
					{#each categories as c (c)}
						<button type="button" onclick={() => (category = c)} class="rounded-full border px-2.5 py-1 text-xs {category === c ? 'border-brand bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600'}">{c}</button>
					{/each}
				</span>
			{/if}
		</label>

		<div class="grid grid-cols-2 gap-3">
			<label class="block">
				<span class="mb-1 block text-sm font-medium text-slate-900">ราคา (บาท)</span>
				<input type="number" inputmode="numeric" min="1" max="2000" bind:value={price} class={field} />
			</label>
			<label class="block">
				<span class="mb-1 block text-sm font-medium text-slate-900">ราคาพิเศษ <span class="font-normal text-slate-400">(ถ้ามี)</span></span>
				<input type="number" inputmode="numeric" min="1" max="2000" bind:value={specialPrice} placeholder="ไม่มี" class={field} />
			</label>
		</div>

		<label class="block">
			<span class="mb-1 block text-sm font-medium text-slate-900">รายละเอียด <span class="font-normal text-slate-400">(ไม่บังคับ)</span></span>
			<input type="text" bind:value={description} maxlength="200" placeholder="เช่น เผ็ดน้อย เพิ่มไข่ดาวได้" class={field} />
		</label>

		<!-- Options & Toppings -->
		<div class="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
			<!-- Header with Left: [เพิ่มออปชั่น] (อันนี้ตามเดิม) and Right: [เลือกออปชั่น ▾] (Drop Down) -->
			<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h3 class="text-sm font-semibold text-slate-900">ตัวเลือก & ท็อปปิ้ง</h3>
					<p class="text-xs text-slate-500">เช่น ไข่ดาว, ความหวาน, ชีท, วิปครีม</p>
				</div>

				<div class="flex items-center gap-2">
					<!-- ปุ่มซ้าย: เพิ่มออปชั่น (ตามเดิม) -->
					<button
						type="button"
						onclick={() => addOptionGroup('ตัวเลือกใหม่', false, 1)}
						class="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-xs hover:border-brand hover:text-brand transition-colors active:scale-95"
					>
						<Icon name="plus" class="h-3.5 w-3.5 text-brand" />
						<span>เพิ่มออปชั่น</span>
					</button>

					<!-- ปุ่มขวา: เลือกออปชั่น (Drop Down) -->
					<div class="relative">
						<button
							type="button"
							onclick={() => (dropdownOpen = !dropdownOpen)}
							class="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50/80 px-3 py-1.5 text-xs font-semibold text-brand-800 shadow-xs hover:bg-brand-100 transition-colors active:scale-95"
							aria-expanded={dropdownOpen}
							aria-haspopup="listbox"
						>
							<span>เลือกออปชั่น</span>
							<Icon name={dropdownOpen ? 'chevron-up' : 'chevron-down'} class="h-3.5 w-3.5 text-brand" />
						</button>

						{#if dropdownOpen}
							<!-- Backdrop for closing on outside click -->
							<div
								class="fixed inset-0 z-40"
								onclick={() => (dropdownOpen = false)}
								tabindex="-1"
								role="button"
								aria-label="ปิดเมนู"
							></div>

							<!-- Drop Down Menu -->
							<div
								class="absolute right-0 top-full z-50 mt-1.5 w-64 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl ring-1 ring-slate-900/5 transition-all"
								role="listbox"
							>
								{#if dropdownItems.length > 0}
									<div class="px-2.5 py-1 text-[11px] font-semibold text-slate-400">
										สิ่งที่เคยเพิ่มไว้ในร้าน ({dropdownItems.length})
									</div>
									<div class="space-y-0.5">
										{#each dropdownItems as opt (opt.label)}
											<button
												type="button"
												onclick={() => selectDropdownItem(opt)}
												class="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs text-slate-800 hover:bg-brand-50 hover:text-brand transition-colors"
											>
												<span class="font-medium truncate">{opt.label}</span>
												{#if opt.subtext}
													<span class="ml-2 shrink-0 text-[11px] text-slate-400 tabular-nums">{opt.subtext}</span>
												{/if}
											</button>
										{/each}
									</div>
									<div class="my-1.5 border-t border-slate-100"></div>
								{/if}

								<div class="px-2.5 py-1 text-[11px] font-semibold text-slate-400">
									ตัวเลือกยอดนิยม
								</div>
								<div class="space-y-0.5">
									{#each defaultPresets as preset (preset.id)}
										<button
											type="button"
											onclick={() => selectDropdownItem(preset)}
											class="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs text-slate-800 hover:bg-brand-50 hover:text-brand transition-colors"
										>
											<span class="font-medium truncate">{preset.label}</span>
											<span class="ml-2 shrink-0 text-[11px] text-slate-400">{preset.subtext}</span>
										</button>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>

			{#if options.length === 0}
				<p class="py-2 text-center text-xs text-slate-400">ยังไม่มีตัวเลือก กดปุ่มลัดด้านบนหรือกด "เพิ่มกลุ่ม" ได้เลย</p>
			{:else}
				<div class="space-y-3 pt-1">
					{#each options as group, gIdx (group.id || gIdx)}
						<div class="rounded-xl border border-slate-200 bg-white p-3 shadow-xs space-y-2.5">
							<div class="flex items-center justify-between gap-2">
								<input
									type="text"
									bind:value={group.name}
									placeholder="ชื่อกลุ่ม เช่น ท็อปปิ้ง, ระดับความเผ็ด"
									class="flex-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-900 outline-none focus:ring-1 focus:ring-brand"
								/>
								<button
									type="button"
									onclick={() => saveGroupAsPreset(group)}
									class="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600 hover:border-brand hover:text-brand"
									title="จำหมวดนี้ไว้ใช้กับเมนูอื่นในร้าน"
								>
									<Icon name="copy" class="h-3 w-3" />
									<span class="hidden sm:inline">จำหมวดนี้</span>
								</button>
								<button
									type="button"
									onclick={() => removeOptionGroup(gIdx)}
									class="p-1 text-slate-400 hover:text-red-600"
									title="ลบกลุ่มนี้"
								>
									<Icon name="x" class="h-4 w-4" />
								</button>
							</div>

							<div class="flex flex-wrap items-center justify-between gap-2 text-xs">
								<div class="flex items-center gap-1.5">
									<label class="inline-flex items-center gap-1">
										<input
											type="radio"
											name={`type-${group.id || gIdx}`}
											checked={(group.maxChoices ?? 1) === 1}
											onchange={() => (group.maxChoices = 1)}
											class="accent-brand"
										/>
										<span class="text-slate-600">เลือกได้ 1 อย่าง</span>
									</label>
									<label class="inline-flex items-center gap-1 ml-2">
										<input
											type="radio"
											name={`type-${group.id || gIdx}`}
											checked={(group.maxChoices ?? 1) > 1}
											onchange={() => (group.maxChoices = 5)}
											class="accent-brand"
										/>
										<span class="text-slate-600">เลือกได้หลายอย่าง</span>
									</label>
								</div>
								<label class="inline-flex items-center gap-1 text-slate-600">
									<input type="checkbox" bind:checked={group.required} class="accent-brand rounded" />
									<span>จำเป็นต้องเลือก</span>
								</label>
							</div>

							<!-- Choices List -->
							<div class="space-y-1.5 pt-1">
								<span class="text-[11px] font-medium text-slate-500">รายการตัวเลือกย่อย:</span>
								{#each group.choices as choice, cIdx (choice.id || cIdx)}
									<div class="flex items-center gap-2">
										<input
											type="text"
											bind:value={choice.name}
											placeholder="เช่น ไข่ดาว, เผ็ดน้อย"
											class="flex-1 rounded-lg bg-slate-50 px-2.5 py-1 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-brand"
										/>
										<div class="flex items-center gap-1 w-24 shrink-0">
											<span class="text-[11px] text-slate-400">+</span>
											<input
												type="number"
												inputmode="numeric"
												min="0"
												max="999"
												bind:value={choice.price}
												placeholder="0"
												class="w-full rounded-lg bg-slate-50 px-2 py-1 text-right text-xs text-slate-800 outline-none focus:ring-1 focus:ring-brand"
											/>
											<span class="text-[11px] text-slate-400">฿</span>
										</div>
										<button
											type="button"
											onclick={() => removeChoice(gIdx, cIdx)}
											class="p-1 text-slate-300 hover:text-red-500"
											title="ลบตัวเลือกนี้"
										>
											<Icon name="x" class="h-3.5 w-3.5" />
										</button>
									</div>
								{/each}
								<button
									type="button"
									onclick={() => addChoice(gIdx)}
									class="mt-1 flex items-center gap-1 text-xs font-medium text-brand hover:underline"
								>
									<Icon name="plus" class="h-3 w-3" /> เพิ่มตัวเลือกในกลุ่มนี้
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<label class="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-3 text-sm">
			<span class="text-slate-900">มีขายตอนนี้</span>
			<input type="checkbox" bind:checked={available} class="h-5 w-5 accent-brand" />
		</label>

		{#if error}<p class="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>{/if}

		<!-- Stays in view while the form scrolls on a phone -->
		<div class="sticky bottom-0 bg-white pt-1 pb-1">
			<button type="submit" disabled={saving} class="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white disabled:opacity-60">
				{#if saving}<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>{/if}
				{item ? 'บันทึกเมนู' : 'เพิ่มเมนู'}
			</button>
		</div>

		{#if item}
			{#if confirmRemove}
				<div class="rounded-xl bg-red-50 p-3 text-sm text-red-800">
					<p>ลบ {item.name} ออกจากเมนู? นักศึกษาจะไม่เห็นเมนูนี้อีก (ออเดอร์เก่ายังอยู่ครบ)</p>
					<div class="mt-2 grid grid-cols-2 gap-2">
						<button type="button" onclick={() => (confirmRemove = false)} class="rounded-lg bg-white py-2 text-slate-700">ยังไม่ลบ</button>
						<button type="button" onclick={remove} disabled={saving} class="rounded-lg bg-red-600 py-2 font-medium text-white disabled:opacity-60">ลบเมนู</button>
					</div>
				</div>
			{:else}
				<button type="button" onclick={() => (confirmRemove = true)} class="w-full py-2 text-sm text-red-600">ลบเมนูนี้</button>
			{/if}
		{/if}
	</form>
</Sheet>
