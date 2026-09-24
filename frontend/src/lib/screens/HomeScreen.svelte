<script lang="ts">
	import banner from '$lib/assets/banner.webp';
	import GooseMark from '$lib/components/GooseMark.svelte';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import PartnerBadge from '$lib/components/PartnerBadge.svelte';
	import PromoLine from '$lib/components/PromoLine.svelte';
	import SmartImage from '$lib/components/SmartImage.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { DROPOFF_POINTS, PICKUP_HUBS } from '$lib/data/locations';
	import { livePromotions } from '$lib/data/stores';
	import { describeBenefit, STORE_DELIVERY_FEE } from '$lib/pricing';
	import type { PickupHub, StoreZone } from '$lib/types';
	import { auth } from '$lib/stores/auth.svelte';
	import { campus } from '$lib/stores/campus.svelte';
	import { cart } from '$lib/stores/cart.svelte';
	import { catalog } from '$lib/stores/catalog.svelte';
	import { nav } from '$lib/stores/nav.svelte';
	import { customDraft, orders } from '$lib/stores/orders.svelte';
	import { storeView } from '$lib/stores/storeView.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { formatBaht, formatRelativeDate } from '$lib/utils';

	/** Greeting in the product's voice, following the campus day */
	function greetingFor(hour: number): string {
		if (hour < 11) return 'เช้านี้กินอะไรดี';
		if (hour < 14) return 'เที่ยงแดดแรง ให้เพื่อนหิ้วดีกว่า';
		if (hour < 17) return 'บ่ายนี้หิวรึยัง';
		return 'มื้อเย็นให้ห่านหิ้วไปหอ';
	}
	const greeting = greetingFor(new Date().getHours());

	const activeOrder = $derived(orders.active[0]);

	// --- Where to buy: canteens open the partner list, the rest become a free-form request
	const PICKUP_ZONE: Partial<Record<string, StoreZone>> = { 'canteen-male': 'canteen-male', 'green-canteen': 'green-canteen' };
	const PICKUP_ICON: Record<string, IconName> = { 'canteen-male': 'utensils', 'green-canteen': 'utensils', '7eleven-dorm': 'cart', soi45: 'store' };
	const TILE_LABEL: Record<string, string> = { '7eleven-dorm': 'เซเว่น หอใน' };
	const pickupSub = (hub: PickupHub) => {
		const zone = PICKUP_ZONE[hub.id];
		if (!zone) return 'ฝากซื้อ';
		return catalog.loading ? '…' : `${catalog.stores.filter((s) => s.zone === zone).length} ร้าน`;
	};

	function choosePickup(hub: PickupHub) {
		const zone = PICKUP_ZONE[hub.id];
		if (zone) {
			storeView.zone = zone;
			nav.go('STORES');
		} else {
			customDraft.pickupId = hub.id;
			nav.go('CUSTOM_ORDER');
		}
	}

	// --- Frequent drop-offs as a compact chip row
	const frequent: { id: string; label: string; icon: IconName }[] = [
		{ id: 'lx-1', label: 'อาคาร LX', icon: 'home' },
		{ id: 'cb2', label: 'CB2 / CB3', icon: 'book' },
		{ id: 'sit', label: 'อาคาร SIT', icon: 'cpu' },
		{ id: 'dorm-s5', label: 'หอพักนักศึกษา', icon: 'key' }
	];

	function chooseDropoff(id: string) {
		const point = DROPOFF_POINTS.find((p) => p.id === id);
		if (point && point.id !== campus.dropoff.id) {
			campus.select(point);
			toast.show(`ส่งไปที่ ${point.name}`, 'success');
		}
	}

	// --- Order again: the latest finished partner-store order that still has line items
	const lastOrder = $derived(orders.completed.find((o) => o.kind === 'STORE' && o.storeId && o.items?.length));
	const lastStore = $derived(lastOrder?.storeId ? catalog.byId(lastOrder.storeId) : undefined);

	function orderAgain() {
		if (!lastOrder?.items || !lastStore) return;
		const added = cart.reorder(
			lastStore,
			lastOrder.items.map((i) => ({ menuItemId: i.menuItem.id, quantity: i.quantity }))
		);
		if (added === 0) {
			toast.show('เมนูจากออเดอร์นี้หมดแล้ว ลองดูเมนูอื่นในร้าน', 'warning');
			storeView.open(lastStore.id);
			return;
		}
		nav.go('CHECKOUT');
	}

	// --- Store lists
	/** Each store's own best deal (joint promotions have their own section above) */
	const deals = $derived(
		catalog.browsing.flatMap((store) => {
			const deal = livePromotions(store).find((p) => p.kind === 'DEAL');
			return deal ? [{ store, deal }] : [];
		})
	);
	const popular = $derived([...catalog.stores].sort((a, b) => b.rating - a.rating).slice(0, 4));


	function openSearch() {
		storeView.focusSearch = true;
		nav.go('STORES');
	}
</script>

<div class="flex flex-1 flex-col">
	<!-- Header: brand + where the food goes + inbox -->
	<header class="sticky top-0 z-40 border-b border-slate-100 bg-white pt-[env(safe-area-inset-top)]">
		<div class="flex h-16 items-center gap-3 px-4">
			<GooseMark class="h-10 w-10 border border-slate-100" />
			<button type="button" onclick={() => campus.openPicker()} class="min-w-0 flex-1 text-left" aria-label="เปลี่ยนจุดส่ง ตอนนี้ {campus.dropoff.name}">
				<span class="block text-[11px] leading-tight text-slate-500">ส่งไปที่</span>
				<span class="flex items-center gap-1 text-[15px] leading-tight font-semibold text-slate-900">
					<span class="truncate">{campus.dropoff.shortName}</span>
					<Icon name="chevron-down" class="h-4 w-4 text-brand" strokeWidth={2.5} />
				</span>
			</button>
			<button
				type="button"
				onclick={() => (toast.inboxOpen = true)}
				class="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100"
				aria-label="การแจ้งเตือน{toast.unreadCount ? ` ${toast.unreadCount} รายการใหม่` : ''}"
			>
				<Icon name="bell" />
				{#if toast.unreadCount > 0}<span class="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-brand ring-2 ring-white"></span>{/if}
			</button>
		</div>
	</header>

	<div class="space-y-7 bg-canvas px-4 pt-5 pb-8">
		<!-- Greeting + search -->
		<section class="space-y-3">
			<div>
				<h1 class="text-xl font-semibold text-slate-900">สวัสดี {auth.user?.nickname ?? ''}</h1>
				<p class="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-slate-500">
					{greeting}
					{#if orders.onlineRiders !== null}
						<span class="inline-flex items-center gap-1.5 text-slate-600">
							<span class="h-1.5 w-1.5 rounded-full bg-fresh"></span>เพื่อนพร้อมหิ้ว <span class="font-medium text-slate-900 tabular-nums">{orders.onlineRiders}</span> คน
						</span>
					{/if}
				</p>
			</div>
			<button type="button" onclick={openSearch} class="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left text-sm text-slate-400">
				<Icon name="search" class="h-5 w-5" />
				อยากกินอะไร ค้นหาร้านหรือเมนู
			</button>
		</section>

		<!-- Active order -->
		{#if activeOrder}
			<button
				type="button"
				onclick={() => {
					orders.open(activeOrder.id);
					nav.go('TRACKING');
				}}
				class="flex w-full items-center gap-3 rounded-2xl border border-brand-200 bg-white p-4 text-left"
			>
				<span class="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand">
					<Icon name="package" />
					<span class="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-brand ring-2 ring-white"></span>
				</span>
				<span class="min-w-0 flex-1">
					<span class="flex items-center gap-2">
						<span class="text-sm font-semibold text-slate-900">{activeOrder.orderCode}</span>
						<StatusBadge status={activeOrder.status} />
					</span>
					<span class="mt-0.5 block truncate text-xs text-slate-500">{activeOrder.itemDetails}</span>
				</span>
				<Icon name="chevron-right" class="h-5 w-5 text-slate-400" />
			</button>
		{/if}

		<!-- Banner -->
		<section class="overflow-hidden rounded-2xl border border-slate-100 bg-white">
			<img src={banner} alt="Goose Rider เพื่อนแท้เรื่องส่งของ ก้าวเดียวถึงมือคุณ" width="1200" height="444" class="block aspect-[2658/984] w-full object-cover" />
			<div class="flex items-center gap-3 px-4 py-3">
				<div class="min-w-0 flex-1">
					<p class="text-sm font-semibold text-slate-900">ขี้เกียจเดินฝ่าแดด? ให้ห่านบางมดหิ้วให้</p>
					<p class="text-xs text-slate-500">ค่าหิ้วเริ่มต้นเพียง {STORE_DELIVERY_FEE}.-</p>
				</div>
				<button type="button" onclick={() => nav.go('STORES')} class="flex shrink-0 items-center gap-1 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white">
					ฝากหิ้วเลย <Icon name="arrow-right" class="h-4 w-4" />
				</button>
			</div>
		</section>

		{#if catalog.error}
			<div class="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
				<Icon name="alert" class="h-5 w-5 text-amber-600" />
				<p class="min-w-0 flex-1 text-sm text-amber-900">{catalog.error}</p>
				<button type="button" onclick={() => catalog.load()} class="shrink-0 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-amber-900 ring-1 ring-amber-200">ลองใหม่</button>
			</div>
		{:else if catalog.loading}
			<div class="space-y-3" aria-label="กำลังโหลดร้านค้า">
				<div class="skeleton h-5 w-40 rounded"></div>
				<div class="flex gap-3 overflow-hidden">
					{#each [0, 1] as i (i)}<div class="skeleton h-40 w-60 shrink-0 rounded-2xl"></div>{/each}
				</div>
			</div>
		{/if}

		<!-- Joint promotions: Goose Man × partner -->
		{#if catalog.coPromotions.length}
			<section class="space-y-3" aria-labelledby="co-promo-title">
				<h2 id="co-promo-title" class="text-base font-semibold text-slate-900">โปรร่วมกับ Goose Man</h2>
				<div class="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
					{#each catalog.coPromotions as { store, promotion } (promotion.id)}
						<button type="button" onclick={() => storeView.open(store.id)} class="w-72 shrink-0 snap-start overflow-hidden rounded-2xl bg-brand text-left text-white">
							{#if promotion.bannerUrl}
								<SmartImage src={promotion.bannerUrl} alt={promotion.title} class="aspect-[2/1] w-full" />
							{:else}
								<div class="relative flex h-36 items-stretch">
									<div class="flex min-w-0 flex-1 flex-col justify-between py-4 pr-2 pl-4">
										<span class="flex min-w-0 items-center gap-1.5 text-xs font-medium text-white/90">
											<GooseMark class="h-6 w-6 shrink-0 rounded-md" />
											<span class="shrink-0">×</span>
											<span class="truncate">{store.name}</span>
										</span>
										<span class="min-w-0">
											<span class="line-clamp-2 text-lg leading-tight font-bold">{describeBenefit(promotion, false)}</span>
											<span class="mt-0.5 block truncate text-xs text-white/85">{promotion.minQty > 1 ? `เมื่อสั่ง ${promotion.minQty} ชิ้นขึ้นไป` : 'ทุกออเดอร์ผ่านแอป'}</span>
										</span>
									</div>
									<SmartImage src={store.imageUrl} alt="" class="w-28 shrink-0 [clip-path:ellipse(100%_90%_at_100%_50%)]" />
								</div>
							{/if}
							<p class="truncate bg-brand-700 px-4 py-2 text-xs text-white/90">{promotion.title}</p>
						</button>
					{/each}
				</div>
			</section>
		{/if}

		<!-- Where to buy -->
		<section class="space-y-3">
			<h2 class="text-base font-semibold text-slate-900">สั่งจากที่ไหนดี</h2>
			<div class="grid grid-cols-4 gap-2">
				{#each PICKUP_HUBS as hub (hub.id)}
					<button type="button" onclick={() => choosePickup(hub)} class="flex flex-col items-center gap-2 rounded-2xl bg-white px-1 pt-3 pb-2.5 text-center">
						<span class="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand"><Icon name={PICKUP_ICON[hub.id] ?? 'store'} /></span>
						<span class="w-full">
							<span class="line-clamp-2 min-h-[2lh] text-xs leading-tight font-medium text-slate-900">{TILE_LABEL[hub.id] ?? hub.shortName}</span>
							<span class="block text-[11px] text-slate-500">{pickupSub(hub)}</span>
						</span>
					</button>
				{/each}
			</div>
		</section>

		<!-- Frequent drop-offs -->
		<section class="space-y-3">
			<h2 class="text-base font-semibold text-slate-900">ส่งไปที่ไหนบ่อยๆ</h2>
			<div class="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
				{#each frequent as f (f.id)}
					{@const selected = campus.dropoff.id === f.id}
					<button
						type="button"
						onclick={() => chooseDropoff(f.id)}
						aria-pressed={selected}
						class="flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm whitespace-nowrap transition-colors {selected
							? 'border-brand bg-brand-50 font-medium text-brand-700'
							: 'border-slate-200 bg-white text-slate-700'}"
					>
						<Icon name={selected ? 'check' : f.icon} class="h-4 w-4 {selected ? 'text-brand' : 'text-slate-400'}" strokeWidth={selected ? 2.5 : 2} />
						{f.label}
					</button>
				{/each}
			</div>
		</section>

		<!-- Order again -->
		{#if lastOrder && lastStore}
			<section class="space-y-3">
				<h2 class="text-base font-semibold text-slate-900">สั่งอีกครั้ง</h2>
				<div class="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3">
					<SmartImage src={lastStore.imageUrl} alt={lastStore.name} class="h-14 w-14 shrink-0 rounded-xl" />
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-semibold text-slate-900">{lastStore.name}</p>
						<p class="truncate text-xs text-slate-500">{lastOrder.itemDetails}</p>
						<p class="text-[11px] text-slate-400">{formatRelativeDate(lastOrder.createdAt)} · {formatBaht(lastOrder.foodTotal)}</p>
					</div>
					<button type="button" onclick={orderAgain} class="shrink-0 rounded-full border border-brand px-3.5 py-1.5 text-sm font-medium text-brand active:bg-brand-50">สั่งซ้ำ</button>
				</div>
			</section>
		{/if}

		<!-- Deals -->
		{#if deals.length}
			<section class="space-y-3">
				<div class="flex items-baseline justify-between">
					<h2 class="text-base font-semibold text-slate-900">ดีลเฉพาะเด็กบางมด</h2>
					<button type="button" onclick={() => nav.go('STORES')} class="text-sm font-medium text-brand">ดูทั้งหมด</button>
				</div>
				<div class="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
					{#each deals as { store, deal } (store.id)}
						<button type="button" onclick={() => storeView.open(store.id)} class="w-60 shrink-0 snap-start overflow-hidden rounded-2xl border border-slate-100 bg-white text-left">
							<div class="relative">
								<SmartImage src={store.imageUrl} alt={store.name} class="h-28 w-full" />
								<span class="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-700">
									<Icon name="clock" class="h-3 w-3" /> ~{store.queueMinutes} นาที
								</span>
							</div>
							<div class="space-y-0.5 p-3">
								<p class="flex items-center gap-1.5">
									<span class="truncate text-sm font-semibold text-slate-900">{store.name}</span>
									{#if store.isPartner}<PartnerBadge compact />{/if}
								</p>
								<PromoLine promotion={deal} class="text-xs font-medium text-brand" />
							</div>
						</button>
					{/each}
				</div>
			</section>

		{/if}

		<!-- Popular -->
		{#if popular.length}
			<section class="space-y-3">
				<h2 class="text-base font-semibold text-slate-900">ร้านที่เพื่อนสั่งบ่อย</h2>
				<ul class="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100 bg-white">
					{#each popular as store, i (store.id)}
						<li>
							<button type="button" onclick={() => storeView.open(store.id)} class="flex w-full items-center gap-3 p-3 text-left active:bg-slate-50">
								<span class="w-4 text-center text-sm font-semibold text-slate-400 tabular-nums">{i + 1}</span>
								<SmartImage src={store.imageUrl} alt={store.name} class="h-12 w-12 shrink-0 rounded-lg" />
								<span class="min-w-0 flex-1">
									<span class="block truncate text-sm font-medium text-slate-900">{store.name}</span>
									<span class="flex items-center gap-1 text-xs text-slate-500">
										<Icon name="star" class="h-3.5 w-3.5 text-beak" filled strokeWidth={0} />{store.rating}
										<span class="text-slate-300">·</span>{store.category}
									</span>
								</span>
								<Icon name="chevron-right" class="h-4 w-4 text-slate-300" />
							</button>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	</div>
</div>
