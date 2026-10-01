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
	let openedFor = $state<string | null>(null);

	// Fill the form each time the sheet opens for a different dish
	$effect(() => {
		const key = item === undefined ? null : (item?.id ?? 'new');
		if (key === openedFor) return;
		openedFor = key;
		if (item === undefined) return;
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

	function applyPreset(presetKey: 'toppings' | 'spicy' | 'sweet' | 'meat') {
		if (presetKey === 'toppings') {
			addOptionGroup('ท็อปปิ้งเพิ่มเติม', false, 5, [
				{ name: 'ไข่ดาว', price: 10 },
				{ name: 'ไข่เจียว', price: 15 },
				{ name: 'เพิ่มข้าว', price: 10 }
			]);
		} else if (presetKey === 'spicy') {
			addOptionGroup('ระดับความเผ็ด', true, 1, [
				{ name: 'ไม่เผ็ด', price: 0 },
				{ name: 'เผ็ดน้อย', price: 0 },
				{ name: 'เผ็ดปกติ', price: 0 },
				{ name: 'เผ็ดมาก', price: 0 }
			]);
		} else if (presetKey === 'sweet') {
			addOptionGroup('ระดับความหวาน', true, 1, [
				{ name: 'หวาน 0%', price: 0 },
				{ name: 'หวาน 25% (หวานน้อย)', price: 0 },
				{ name: 'หวาน 50%', price: 0 },
				{ name: 'หวาน 100% (ปกติ)', price: 0 }
			]);
		} else if (presetKey === 'meat') {
			addOptionGroup('เลือกเนื้อสัตว์', true, 1, [
				{ name: 'หมูสับ', price: 0 },
				{ name: 'ไก่', price: 0 },
				{ name: 'หมูกรอบ', price: 10 },
				{ name: 'ทะเล', price: 20 }
			]);
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
			<div class="flex items-center justify-between">
				<div>
					<h3 class="text-sm font-semibold text-slate-900">ตัวเลือก & ท็อปปิ้ง</h3>
					<p class="text-xs text-slate-500">เช่น ไข่ดาว, ไข่เจียว, ความหวาน, ความเผ็ด</p>
				</div>
				<button
					type="button"
					onclick={() => addOptionGroup('ตัวเลือกใหม่', false, 1)}
					class="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-brand shadow-xs border border-slate-200 hover:bg-slate-50"
				>
					<Icon name="plus" class="h-3.5 w-3.5" /> เพิ่มกลุ่ม
				</button>
			</div>

			<!-- Quick Preset Buttons -->
			<div class="flex flex-wrap items-center gap-1.5 pt-1">
				<span class="text-[11px] text-slate-400">ปุ่มลัด:</span>
				<button
					type="button"
					onclick={() => applyPreset('toppings')}
					class="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600 hover:border-brand hover:text-brand"
				>
					🍳 ไข่ดาว/เจียว
				</button>
				<button
					type="button"
					onclick={() => applyPreset('spicy')}
					class="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600 hover:border-brand hover:text-brand"
				>
					🌶️ ความเผ็ด
				</button>
				<button
					type="button"
					onclick={() => applyPreset('sweet')}
					class="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600 hover:border-brand hover:text-brand"
				>
					🧋 ความหวาน
				</button>
				<button
					type="button"
					onclick={() => applyPreset('meat')}
					class="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600 hover:border-brand hover:text-brand"
				>
					🥩 เนื้อสัตว์
				</button>
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
