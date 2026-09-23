<script lang="ts">
	import AppBar from '$lib/components/AppBar.svelte';
	import Goose from '$lib/components/Goose.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { nav } from '$lib/stores/nav.svelte';
	import SmartImage from '$lib/components/SmartImage.svelte';
	import { searchStores, STORE_ZONES, ZONE_NAMES } from '$lib/data/stores';
	import { cart } from '$lib/stores/cart.svelte';
	import { storeView } from '$lib/stores/storeView.svelte';

	const results = $derived(searchStores(storeView.query, storeView.zone));

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

		<div class="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="tablist" aria-label="โซนอาหาร">
			{#each STORE_ZONES as zone (zone.id)}
				{@const active = storeView.zone === zone.id}
				<button
					type="button"
					role="tab"
					aria-selected={active}
					onclick={() => (storeView.zone = zone.id)}
					class="shrink-0 rounded-full px-4 py-2 text-sm whitespace-nowrap transition-colors {active ? 'bg-brand font-medium text-white' : 'border border-slate-200 bg-white text-slate-600'}"
				>
					{zone.label}
				</button>
			{/each}
		</div>

		<p class="text-xs text-slate-500" aria-live="polite">{results.length} ร้าน</p>

		{#if results.length === 0}
			<div class="rounded-2xl border border-slate-100 bg-white px-6 py-12 text-center">
				<Goose pose="wait" class="mx-auto mb-3 w-24" />
				<p class="text-sm font-medium text-slate-800">ไม่เจอ “{storeView.query}” ในร้านพาร์ทเนอร์</p>
				<p class="mt-1 text-xs text-slate-500">ร้านไหนก็ฝากเพื่อนซื้อให้ได้ ไม่ต้องเป็นร้านในแอป</p>
				<button type="button" onclick={() => nav.go('CUSTOM_ORDER')} class="mt-4 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white">ฝากเพื่อนซื้อแทน</button>
			</div>
		{:else}
			<ul class="space-y-3">
				{#each results as { store, matchedItems } (store.id)}
					<li>
						<button type="button" onclick={() => storeView.open(store.id)} class="flex w-full gap-3 rounded-2xl border border-slate-100 bg-white p-3 text-left">
							<SmartImage src={store.imageUrl} alt={store.name} class="h-24 w-24 shrink-0 rounded-xl" />
							<div class="flex min-w-0 flex-1 flex-col">
								<p class="truncate text-sm font-semibold text-slate-900">{store.name}</p>
								<p class="truncate text-xs text-slate-500">{store.category} · {ZONE_NAMES[store.zone]}</p>
								<p class="mt-1 flex items-center gap-1 text-xs text-slate-600">
									<Icon name="star" class="h-3.5 w-3.5 text-beak" filled strokeWidth={0} />
									{store.rating} <span class="text-slate-400">({store.reviewsCount})</span>
									<span class="text-slate-300">·</span>
									<Icon name="clock" class="h-3.5 w-3.5 text-slate-400" /> ~{store.queueMinutes} นาที
								</p>
								<div class="mt-auto flex items-center gap-2 pt-1.5">
									{#if matchedItems.length}
										<span class="truncate text-xs text-brand">พบ: {matchedItems.join(', ')}</span>
									{:else if store.deal}
										<span class="truncate rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">{store.deal.label}</span>
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
