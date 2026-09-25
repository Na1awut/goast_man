<script lang="ts">
	import { fly } from 'svelte/transition';
	import Icon from '$lib/components/Icon.svelte';
	import PartnerBadge from '$lib/components/PartnerBadge.svelte';
	import QtyStepper from '$lib/components/QtyStepper.svelte';
	import SmartImage from '$lib/components/SmartImage.svelte';
	import StoreLogo from '$lib/components/StoreLogo.svelte';
	import { livePromotions, ZONE_NAMES } from '$lib/data/stores';
	import { cart } from '$lib/stores/cart.svelte';
	import { nav } from '$lib/stores/nav.svelte';
	import { storeView } from '$lib/stores/storeView.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { flyToCart, haptic } from '$lib/feedback';
	import { describeBenefit } from '$lib/pricing';
	import { formatBaht } from '$lib/utils';

	const POPULAR = 'เมนูยอดฮิต';

	const store = $derived(storeView.selected);
	const cartIsThisStore = $derived(!!store && cart.store?.id === store.id);
	const favorite = $derived(!!store && storeView.favorites.includes(store.id));
	const menu = $derived(store?.menuItems ?? []);
	const categories = $derived([POPULAR, ...new Set(menu.map((m) => m.category))]);

	let category = $state<string | null>(null);
	const items = $derived(
		category === null ? menu : category === POPULAR ? menu.filter((m) => m.isPopular) : menu.filter((m) => m.category === category)
	);

	// Joint promotions first: they are the reason to order through the app
	const promotions = $derived(
		store ? [...livePromotions(store)].sort((a, b) => Number(b.kind === 'CO_PROMO') - Number(a.kind === 'CO_PROMO')) : []
	);
	const qtyInCart = $derived(cartIsThisStore ? cart.totalItems : 0);

	async function share() {
		if (!store) return;
		const data = { title: store.name, text: `${store.name} — สั่งผ่าน Goose Man` };
		try {
			if (navigator.share) await navigator.share(data);
			else {
				await navigator.clipboard.writeText(`${data.text} ${location.href}`);
				toast.show('คัดลอกลิงก์ร้านแล้ว', 'success');
			}
		} catch {
			// user dismissed the share sheet
		}
	}

	function toggleFavorite() {
		if (!store) return;
		const message = favorite ? 'นำออกจากร้านโปรดแล้ว' : 'บันทึกเป็นร้านโปรดแล้ว';
		storeView.toggleFavorite(store.id);
		toast.show(message, 'success');
	}
</script>

{#if !store}
	<div class="flex flex-1 flex-col items-center justify-center px-8 text-center">
		<p class="text-sm font-medium text-slate-800">ไม่พบร้านนี้แล้ว</p>
		<button type="button" onclick={() => nav.reset('STORES')} class="mt-4 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white">ดูร้านค้าทั้งหมด</button>
	</div>
{:else}
<div class="flex flex-1 flex-col">
	<!-- Cover: a partner's own storefront banner when set -->
	<div class="relative h-56 shrink-0">
		<SmartImage src={store.bannerUrl ?? store.imageUrl} alt={store.bannerUrl ? `แบนเนอร์ร้าน ${store.name}` : store.name} class="h-full w-full" />
		<div class="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/40 to-transparent"></div>
		<div class="absolute inset-x-0 top-0 flex items-center justify-between px-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
			<button type="button" onclick={() => nav.back()} aria-label="ย้อนกลับ" class="flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm">
				<Icon name="chevron-left" class="h-6 w-6" />
			</button>
			<div class="flex gap-2">
				<button type="button" onclick={share} aria-label="แชร์ร้าน" class="flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm">
					<Icon name="share" />
				</button>
				<button type="button" onclick={toggleFavorite} aria-label={favorite ? 'นำออกจากร้านโปรด' : 'บันทึกเป็นร้านโปรด'} aria-pressed={favorite} class="flex h-10 w-10 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm {favorite ? 'text-brand' : 'text-white'}">
					<Icon name="heart" filled={favorite} />
				</button>
			</div>
		</div>
	</div>

	<!-- Store info -->
	<section class="relative -mt-4 rounded-t-3xl bg-white px-4 pt-5 pb-4">
		<StoreLogo {store} class="-mt-14 mb-2 h-16 w-16 text-2xl shadow-sm ring-4 ring-white" />
		<h1 class="text-xl font-bold text-slate-900">{store.name}</h1>
		{#if store.tagline}<p class="mt-0.5 text-sm text-slate-600">{store.tagline}</p>{/if}
		{#if store.isPartner}
			<div class="mt-2"><PartnerBadge /></div>
		{/if}
		<p class="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
			<Icon name="pin" class="h-4 w-4" /> {ZONE_NAMES[store.zone]} {store.lock}
		</p>
		<p class="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
			<Icon name="star" class="h-4 w-4 text-beak" filled strokeWidth={0} />
			<span class="font-medium text-slate-900">{store.rating}</span>
			<span class="text-slate-400">({store.reviewsCount} รีวิว)</span>
			<span class="text-slate-300">·</span>
			คิวหน้าร้าน ~{store.queueMinutes} นาที
		</p>
		{#if store.isPartner && store.fastLaneMinutes}
			<p class="mt-2 flex items-center gap-2 rounded-xl bg-fresh-50 px-3 py-2 text-sm text-fresh-700">
				<Icon name="zap" class="h-4 w-4" />
				<span><span class="font-semibold">Fast lane</span> ออเดอร์ผ่านแอปทำก่อน ~{store.fastLaneMinutes} นาที</span>
			</p>
		{/if}
	</section>

	<div class="flex-1 space-y-4 px-4 pt-4 pb-6">
		{#if promotions.length}
			<section class="overflow-hidden rounded-2xl border border-brand-200 bg-brand-50" aria-label="โปรโมชันของร้าน">
				<h2 class="flex items-center gap-1.5 px-4 pt-3 text-sm font-semibold text-brand-700"><Icon name="zap" class="h-4 w-4" /> ดีลพิเศษเฉพาะเด็กบางมด</h2>
				<ul class="divide-y divide-brand-100">
					{#each promotions as promo (promo.id)}
						{@const applied = cart.appliedPromotion?.promotion.id === promo.id && cartIsThisStore}
						{@const missing = promo.minQty - qtyInCart}
						<li class="flex items-start gap-3 px-4 py-3">
							<div class="min-w-0 flex-1">
								{#if promo.kind === 'CO_PROMO'}
									<span class="mb-1 inline-block rounded bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-white">โปรร่วม Goose Man</span>
								{/if}
								<p class="text-sm font-medium text-slate-900">{promo.title}</p>
								<p class="text-xs text-slate-600">{promo.description || describeBenefit(promo)}</p>
							</div>
							<span class="shrink-0 pt-0.5 text-xs font-medium {applied ? 'text-fresh-700' : 'text-slate-500'}">
								{#if applied}
									<span class="flex items-center gap-1"><Icon name="check-circle" class="h-3.5 w-3.5" /> ใช้อยู่</span>
								{:else if missing > 0 && qtyInCart > 0}
									อีก {missing} ชิ้น
								{:else if promo.minQty > 1}
									สั่ง {promo.minQty} ชิ้น
								{/if}
							</span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if !cart.isEmpty && !cartIsThisStore}
			<p class="flex gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
				<Icon name="info" class="h-4 w-4" />
				<span>ตะกร้ามีของจาก {cart.store?.name} อยู่ สั่งได้ทีละร้าน ถ้าเพิ่มเมนูร้านนี้ ตะกร้าเดิมจะถูกล้าง</span>
			</p>
		{/if}

		<!-- Category chips -->
		<div class="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="tablist" aria-label="หมวดเมนู">
			{#each categories as c (c)}
				{@const active = category === c}
				<button
					type="button"
					role="tab"
					aria-selected={active}
					onclick={() => (category = active ? null : c)}
					class="shrink-0 rounded-full px-4 py-2 text-sm whitespace-nowrap transition-colors {active ? 'bg-brand font-medium text-white' : 'border border-slate-200 bg-white text-slate-600'}"
				>
					{c}
				</button>
			{/each}
		</div>

		<ul class="space-y-3">
			{#each items as item (item.id)}
				{@const qty = cartIsThisStore ? cart.qty(item.id) : 0}
				<li class="flex gap-3 rounded-2xl border bg-white p-3 {qty > 0 ? 'border-brand-200' : 'border-slate-100'} {item.isAvailable ? '' : 'opacity-60'}">
					<SmartImage src={item.imageUrl} alt={item.name} class="h-20 w-20 shrink-0 rounded-xl" />
					<div class="flex min-w-0 flex-1 flex-col">
						<h3 class="text-sm leading-snug font-semibold text-slate-900">{item.name}</h3>
						<p class="line-clamp-2 text-xs text-slate-500">{item.description}</p>
						{#if item.originalPrice}
							<span class="mt-1 w-fit rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] text-brand-700">ลด {item.originalPrice - item.price} ฿ จากหน้าร้าน {item.originalPrice} ฿</span>
						{/if}
						<div class="mt-auto flex items-end justify-between gap-2 pt-1.5">
							<span class="text-base font-semibold text-slate-900">{formatBaht(item.price)}</span>
							<QtyStepper {qty} label={item.name} disabled={!item.isAvailable} onadd={(el) => { cart.add(item, store); haptic(); flyToCart(el); }} onremove={() => { cart.decrement(item.id); haptic(6); }} />
						</div>
					</div>
				</li>
			{:else}
				<li class="py-8 text-center text-sm text-slate-500">ไม่มีเมนูในหมวดนี้</li>
			{/each}
		</ul>
	</div>

	{#if cartIsThisStore && cart.totalItems > 0}
		<div class="sticky bottom-0 z-30 px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]" transition:fly={{ y: 40, duration: 200 }}>
			<button
				type="button"
				onclick={() => nav.go('CHECKOUT')}
				data-cart-target
				class="flex w-full items-center gap-2 rounded-2xl bg-brand px-5 py-4 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgb(250_70_22/0.45)] active:bg-brand-600"
			>
				<Icon name="cart" />
				<span class="tabular-nums">{#key cart.totalItems}<span class="tick inline-block">{cart.totalItems}</span>{/key} รายการ | {formatBaht(cart.subtotal)}</span>
				<span class="ml-auto flex items-center gap-1">ดูตะกร้าสินค้า <Icon name="arrow-right" class="h-4 w-4" /></span>
			</button>
		</div>
	{/if}
</div>
{/if}
