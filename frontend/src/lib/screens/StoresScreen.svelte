<script lang="ts">
	import AppBar from '$lib/components/AppBar.svelte';
	import Goose from '$lib/components/Goose.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { nav } from '$lib/stores/nav.svelte';
	import PartnerBadge from '$lib/components/PartnerBadge.svelte';
	import PromoLine from '$lib/components/PromoLine.svelte';
	import SmartImage from '$lib/components/SmartImage.svelte';
	import StoreLogo from '$lib/components/StoreLogo.svelte';
	import { hasReviews, livePromotions, searchStores, STORE_TYPES, STORE_ZONES, STORE_ZONE_TYPE, ZONE_NAMES } from '$lib/data/stores';
	import type { StoreType } from '$lib/types';
	import { catalog } from '$lib/stores/catalog.svelte';
	import { cart } from '$lib/stores/cart.svelte';
	import { storeView } from '$lib/stores/storeView.svelte';
	import { isWithinHours } from '$lib/operatingHours';

	const results = $derived(searchStores(catalog.stores, storeView.query, storeView.zone, storeView.type));
	const zones = $derived(STORE_ZONES.filter((z) => z.id === 'all' || (
		(storeView.type === 'all' || STORE_ZONE_TYPE[z.id] === storeView.type)
		&& (z.id === storeView.zone || catalog.stores.some((s) => s.zone === z.id))
	)));
	const hasFilters = $derived(storeView.type !== 'all' || storeView.zone !== 'all');

	let searchInput = $state<HTMLInputElement>();
	$effect(() => {
		if (searchInput && storeView.focusSearch) {
			storeView.focusSearch = false;
			searchInput.focus();
		}
	});
</script>

<div class="flex flex-1 flex-col">
	<AppBar title="ร้านค้าทั้งหมด" showBack={false} />

	<div class="space-y-4 px-4 pt-4 pb-8">
		<label class="relative block">
			<span class="sr-only">ค้นหาร้านค้าและเมนู</span>
			<Icon name="search" class="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-slate-400" />
			<input
				type="search"
				bind:this={searchInput}
				bind:value={storeView.query}
				placeholder="ค้นหาร้าน หรือเมนู เช่น กะเพรา"
				class="w-full rounded-xl border border-slate-200 bg-white py-3 pr-4 pl-11 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-brand"
			/>
		</label>

		<div class="grid grid-cols-[0.85fr_1.15fr] gap-3">
			<label class="min-w-0 space-y-1.5">
				<span class="block text-xs font-medium text-slate-600">ประเภทร้าน</span>
				<span class="relative block">
					<select value={storeView.type} onchange={(e) => storeView.selectType(e.currentTarget.value as StoreType | 'all')} class="h-11 w-full min-w-0 appearance-none rounded-xl border border-slate-200 bg-white pr-8 pl-3 text-sm text-slate-900 outline-none focus:border-brand focus-visible:ring-2 focus-visible:ring-brand/20">
						{#each STORE_TYPES as type (type.id)}<option value={type.id}>{type.label}</option>{/each}
					</select>
					<Icon name="chevron-down" class="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
				</span>
			</label>
			<label class="min-w-0 space-y-1.5">
				<span class="block text-xs font-medium text-slate-600">โซน / อาคาร</span>
				<span class="relative block">
					<select bind:value={storeView.zone} class="h-11 w-full min-w-0 appearance-none rounded-xl border border-slate-200 bg-white pr-8 pl-3 text-sm text-slate-900 outline-none focus:border-brand focus-visible:ring-2 focus-visible:ring-brand/20">
						{#each zones as zone (zone.id)}<option value={zone.id}>{zone.label}</option>{/each}
					</select>
					<Icon name="chevron-down" class="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
				</span>
			</label>
		</div>

		<div class="flex min-h-6 items-center justify-between gap-3">
			<p class="text-xs text-slate-500" aria-live="polite">{catalog.loading ? 'กำลังโหลดร้าน...' : `${results.length} ร้าน`}</p>
			{#if hasFilters}<button type="button" onclick={() => storeView.clearFilters()} class="-my-2 min-h-11 text-xs font-medium text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">ล้างตัวกรอง</button>{/if}
		</div>

		{#if catalog.error}
			<div class="rounded-2xl border border-slate-100 bg-white px-6 py-10 text-center">
				<p class="text-sm font-medium text-slate-800">{catalog.error}</p>
				<button type="button" onclick={() => catalog.load()} class="mt-4 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white">ลองอีกครั้ง</button>
			</div>
		{:else if catalog.loading}
			<ul class="space-y-3" aria-hidden="true">
				{#each [0, 1, 2] as i (i)}
					<li class="flex gap-3 rounded-2xl border border-slate-100 bg-white p-3">
						<div class="skeleton h-24 w-24 rounded-xl"></div>
						<div class="flex-1 space-y-2 pt-1"><div class="skeleton h-4 w-2/3 rounded"></div><div class="skeleton h-3 w-1/2 rounded"></div></div>
					</li>
				{/each}
			</ul>
		{:else if results.length === 0}
			<div class="rounded-2xl border border-slate-100 bg-white px-6 py-12 text-center">
				<Goose pose="wait" class="mx-auto mb-3 w-24" />
				<p class="text-sm font-medium text-slate-800">{storeView.query.trim() ? `ไม่เจอ “${storeView.query}” ในร้านค้า` : 'ยังไม่มีร้านในหมวดนี้'}</p>
				<p class="mt-1 text-xs text-slate-500">ร้านไหนก็ฝากเพื่อนซื้อให้ได้ ไม่ต้องเป็นร้านในแอป</p>
				<button type="button" onclick={() => nav.go('CUSTOM_ORDER')} class="mt-4 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white">ฝากเพื่อนซื้อแทน</button>
			</div>
		{:else}
			<ul class="space-y-3">
				{#each results as { store, matchedItems } (store.id)}
					<li>
						<button type="button" onclick={() => storeView.open(store.id)} class="flex w-full gap-3 rounded-2xl border border-slate-100 bg-white p-3 text-left">
							<span class="relative h-24 w-24 shrink-0">
								<SmartImage src={store.imageUrl} alt={store.name} pending class="h-full w-full rounded-xl" />
								{#if store.isPartner}<StoreLogo {store} class="absolute -right-1.5 -bottom-1.5 h-8 w-8 text-xs ring-2 ring-white" />{/if}
							</span>
							<div class="flex min-w-0 flex-1 flex-col">
								<p class="flex items-center gap-1.5">
									<span class="truncate text-sm font-semibold text-slate-900">{store.name}</span>
									{#if store.isPartner}<PartnerBadge compact />{/if}
									{#if !store.isOpen || (store.operatingHours?.enabled && !isWithinHours(store.operatingHours))}
										<span class="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">ปิดรับ</span>
									{/if}
								</p>
								<p class="truncate text-xs text-slate-500">{store.category} · {ZONE_NAMES[store.zone]}</p>
								<p class="mt-1 flex items-center gap-1 text-xs text-slate-600">
									{#if hasReviews(store)}
										<Icon name="star" class="h-3.5 w-3.5 text-beak" filled strokeWidth={0} />
										{store.rating} <span class="text-slate-400">({store.reviewsCount})</span>
									{:else}
										<span class="text-fresh-700">ร้านใหม่ในแอป</span>
									{/if}
									<span class="text-slate-300">·</span>
									<Icon name="clock" class="h-3.5 w-3.5 text-slate-400" /> ~{store.queueMinutes} นาที
								</p>
								<div class="mt-auto flex items-center gap-2 pt-1.5">
									{#if matchedItems.length}
										<span class="truncate text-xs text-brand">พบ: {matchedItems.join(', ')}</span>
									{:else if livePromotions(store)[0]}
										<PromoLine promotion={livePromotions(store)[0]} class="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700" />
									{/if}
									{#if cart.store?.id === store.id}
										<span class="ml-auto flex shrink-0 items-center gap-1 text-xs font-medium text-brand"><Icon name="cart" class="h-3.5 w-3.5" />{cart.totalItems}</span>
									{/if}
								</div>
							</div>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
