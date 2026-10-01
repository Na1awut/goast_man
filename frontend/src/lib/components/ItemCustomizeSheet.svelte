<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import Sheet from '$lib/components/Sheet.svelte';
	import SmartImage from '$lib/components/SmartImage.svelte';
	import type { MenuItem, SelectedOptionChoice, Store } from '$lib/types';
	import { cart } from '$lib/stores/cart.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { flyToCart, haptic } from '$lib/feedback';
	import { formatBaht } from '$lib/utils';

	let {
		open,
		item,
		store,
		onclose
	}: {
		open: boolean;
		item: MenuItem | null;
		store: Store | null;
		onclose: () => void;
	} = $props();

	let special = $state(false);
	let selectedMap = $state<Record<string, string[]>>({});
	let quantity = $state(1);

	$effect(() => {
		if (!item || !open) return;
		special = false;
		quantity = 1;
		const initMap: Record<string, string[]> = {};
		for (const g of item.options ?? []) {
			initMap[g.id] = [];
		}
		selectedMap = initMap;
	});

	function toggleChoice(groupId: string, choiceId: string, maxChoices = 1) {
		const current = selectedMap[groupId] ?? [];
		if (maxChoices === 1) {
			if (current.includes(choiceId)) {
				selectedMap[groupId] = [];
			} else {
				selectedMap[groupId] = [choiceId];
			}
		} else {
			if (current.includes(choiceId)) {
				selectedMap[groupId] = current.filter((id) => id !== choiceId);
			} else {
				if (current.length >= maxChoices) {
					toast.show(`เลือกได้สูงสุด ${maxChoices} อย่าง`, 'info');
					return;
				}
				selectedMap[groupId] = [...current, choiceId];
			}
		}
		haptic(5);
	}

	const selectedOptions = $derived.by<SelectedOptionChoice[]>(() => {
		if (!item?.options) return [];
		const res: SelectedOptionChoice[] = [];
		for (const group of item.options) {
			const pickedIds = selectedMap[group.id] ?? [];
			for (const choice of group.choices) {
				if (pickedIds.includes(choice.id)) {
					res.push({
						groupId: group.id,
						groupName: group.name,
						choiceId: choice.id,
						name: choice.name,
						price: choice.price
					});
				}
			}
		}
		return res;
	});

	const basePrice = $derived(special && item?.specialPrice ? item.specialPrice : (item?.price ?? 0));
	const optionsExtra = $derived(selectedOptions.reduce((sum, opt) => sum + (opt.price || 0), 0));
	const unitTotal = $derived(basePrice + optionsExtra);
	const lineTotal = $derived(unitTotal * quantity);

	const missingRequired = $derived.by(() => {
		if (!item?.options) return [];
		const missing: string[] = [];
		for (const g of item.options) {
			if (g.required) {
				const picked = selectedMap[g.id] ?? [];
				if (picked.length === 0) missing.push(g.name);
			}
		}
		return missing;
	});

	const canAdd = $derived(missingRequired.length === 0);

	function handleAddToCart(e: MouseEvent) {
		if (!item || !store || !canAdd) return;
		const buttonEl = e.currentTarget as HTMLElement;
		const success = cart.add(item, store, special, selectedOptions, quantity);
		if (success) {
			haptic();
			flyToCart(buttonEl);
			toast.show(`เพิ่ม ${item.name} ลงตะกร้าแล้ว`, 'success');
			onclose();
		}
	}
</script>

<Sheet {open} title={item?.name ?? 'เลือกตัวเลือก'} {onclose}>
	{#if item}
		<div class="space-y-4 pb-3">
			<!-- Header / Item summary -->
			<div class="flex items-start gap-3">
				{#if item.imageUrl}
					<SmartImage src={item.imageUrl} alt={item.name} class="h-20 w-20 shrink-0 rounded-2xl" />
				{/if}
				<div class="min-w-0 flex-1">
					<h3 class="text-base font-bold text-slate-900">{item.name}</h3>
					{#if item.description}
						<p class="mt-0.5 text-xs text-slate-500 line-clamp-2">{item.description}</p>
					{/if}
					<p class="mt-1 text-sm font-semibold text-brand tabular-nums">
						เริ่มต้น {formatBaht(item.price)}
					</p>
				</div>
			</div>

			<!-- Size selection (if dish has special price) -->
			{#if item.specialPrice}
				<section class="rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5 space-y-2">
					<div class="flex items-center justify-between">
						<span class="text-xs font-semibold text-slate-900">ขนาด</span>
						<span class="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">จำเป็น</span>
					</div>
					<div class="grid grid-cols-2 gap-2">
						<button
							type="button"
							onclick={() => { special = false; haptic(5); }}
							class="flex items-center justify-between rounded-xl border p-2.5 text-left text-xs transition-colors {special ? 'border-slate-200 bg-white text-slate-700' : 'border-brand bg-brand-50 font-semibold text-brand-700 ring-1 ring-brand'}"
						>
							<span>ธรรมดา</span>
							<span class="tabular-nums">{formatBaht(item.price)}</span>
						</button>
						<button
							type="button"
							onclick={() => { special = true; haptic(5); }}
							class="flex items-center justify-between rounded-xl border p-2.5 text-left text-xs transition-colors {special ? 'border-brand bg-brand-50 font-semibold text-brand-700 ring-1 ring-brand' : 'border-slate-200 bg-white text-slate-700'}"
						>
							<span>พิเศษ</span>
							<span class="tabular-nums">{formatBaht(item.specialPrice)}</span>
						</button>
					</div>
				</section>
			{/if}

			<!-- Option groups -->
			{#if item.options?.length}
				{#each item.options as group (group.id)}
					{@const isSingle = (group.maxChoices ?? 1) === 1}
					{@const picked = selectedMap[group.id] ?? []}
					<section class="rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5 space-y-2">
						<div class="flex items-center justify-between">
							<span class="text-xs font-semibold text-slate-900">{group.name}</span>
							<div class="flex items-center gap-1.5">
								<span class="text-[11px] text-slate-400">
									{isSingle ? 'เลือกได้ 1 อย่าง' : `เลือกได้สูงสุด ${group.maxChoices ?? 5} อย่าง`}
								</span>
								{#if group.required}
									<span class="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">จำเป็น</span>
								{:else}
									<span class="text-[10px] text-slate-400">(ไม่บังคับ)</span>
								{/if}
							</div>
						</div>

						<ul class="divide-y divide-slate-100 rounded-xl bg-white border border-slate-100">
							{#each group.choices as choice (choice.id)}
								{@const checked = picked.includes(choice.id)}
								<li>
									<button
										type="button"
										onclick={() => toggleChoice(group.id, choice.id, group.maxChoices ?? 1)}
										class="flex w-full items-center justify-between p-3 text-left text-xs transition-colors hover:bg-slate-50 active:bg-slate-100"
									>
										<div class="flex items-center gap-2.5">
											<span
												class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all {checked ? 'border-brand bg-brand text-white shadow-xs' : 'border-slate-300 bg-white'}"
											>
												{#if checked}
													<Icon name="check" class="h-3.5 w-3.5" strokeWidth={3} />
												{/if}
											</span>
											<span class="font-medium {checked ? 'text-slate-900 font-semibold' : 'text-slate-700'}">{choice.name}</span>
										</div>
										<span class="tabular-nums {choice.price > 0 ? 'text-slate-900 font-medium' : 'text-slate-400'}">
											{choice.price > 0 ? `+${formatBaht(choice.price)}` : 'ฟรี'}
										</span>
									</button>
								</li>
							{/each}
						</ul>
					</section>
				{/each}
			{/if}

			<!-- Quantity stepper -->
			<div class="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-3.5">
				<span class="text-sm font-semibold text-slate-900">จำนวน</span>
				<div class="flex items-center gap-3">
					<button
						type="button"
						onclick={() => { if (quantity > 1) { quantity -= 1; haptic(5); } }}
						disabled={quantity <= 1}
						class="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 disabled:opacity-40"
					>
						<Icon name="minus" class="h-4 w-4" />
					</button>
					<span class="w-6 text-center text-sm font-bold tabular-nums text-slate-900">{quantity}</span>
					<button
						type="button"
						onclick={() => { quantity += 1; haptic(5); }}
						class="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-white"
					>
						<Icon name="plus" class="h-4 w-4" />
					</button>
				</div>
			</div>

			<!-- Add to cart CTA -->
			<div class="pt-1">
				{#if !canAdd}
					<p class="mb-2 text-center text-xs text-red-500">
						กรุณาเลือก {missingRequired.join(', ')} ก่อนเพิ่มลงตะกร้า
					</p>
				{/if}
				<button
					type="button"
					onclick={handleAddToCart}
					disabled={!canAdd}
					class="flex w-full items-center justify-between rounded-2xl bg-brand px-5 py-3.5 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgb(250_70_22/0.45)] active:bg-brand-600 disabled:opacity-50"
				>
					<span>เพิ่มลงตะกร้า</span>
					<span class="tabular-nums font-bold">{formatBaht(lineTotal)}</span>
				</button>
			</div>
		</div>
	{/if}
</Sheet>
