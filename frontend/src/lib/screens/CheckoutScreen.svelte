<script lang="ts">
	import { slide } from 'svelte/transition';
	import AnimatedNumber from '$lib/components/AnimatedNumber.svelte';
	import AppBar from '$lib/components/AppBar.svelte';
	import Goose from '$lib/components/Goose.svelte';
	import BottomBar from '$lib/components/BottomBar.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import QtyStepper from '$lib/components/QtyStepper.svelte';
	import { DROPOFF_POINTS } from '$lib/data/locations';
	import { lineName, normalizePromo, PROMO_CODES, unitPrice } from '$lib/pricing';
	import { formatPhone } from '$lib/profile';
	import { auth } from '$lib/stores/auth.svelte';
	import { campus } from '$lib/stores/campus.svelte';
	import { cart } from '$lib/stores/cart.svelte';
	import { checkout } from '$lib/stores/checkout.svelte';
	import { nav } from '$lib/stores/nav.svelte';
	import { profileGate } from '$lib/stores/profileGate.svelte';
	import { storeView } from '$lib/stores/storeView.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { haptic } from '$lib/feedback';
	import { OrderError } from '$lib/stores/orders.svelte';
	import { formatBaht } from '$lib/utils';

	const saved = $derived(checkout.codeDiscount + cart.partnerDiscount);

	let promoInput = $state('');
	let promoError = $state('');

	function applyPromo(input = promoInput) {
		if (!input.trim()) {
			promoError = 'กรอกโค้ดส่วนลดก่อน';
			return;
		}
		const code = normalizePromo(input);
		if (!code) {
			promoError = `ไม่พบโค้ด ${input.trim().toUpperCase()}`;
			return;
		}
		if (code === 'GOOSEFREE' && checkout.feeAfterPromotion === 0) {
			promoError = 'ออเดอร์นี้ฟรีค่าหิ้วจากโปรของร้านอยู่แล้ว';
			return;
		}
		cart.promo = code;
		haptic([10, 40, 10]);
		promoInput = '';
		promoError = '';
		toast.show(`ใช้โค้ด ${code} แล้ว (${PROMO_CODES[code].describe(checkout.feeAfterPromotion)})`, 'success');
	}

	function selectDropoff(e: Event) {
		const point = DROPOFF_POINTS.find((p) => p.id === (e.currentTarget as HTMLSelectElement).value);
		if (point) campus.select(point);
	}

	function addMore(storeId: string) {
		storeView.selectedId = storeId;
		if (nav.history.at(-1) === 'STORE_DETAIL') nav.back();
		else nav.go('STORE_DETAIL');
	}

	async function placeOrder() {
		// First order: ask for the buyer's details once, then come back here
		if (!profileGate.ensure()) return;
		if (checkout.payment === 'PROMPTPAY') {
			checkout.startPayment();
			nav.go('PAYMENT');
			return;
		}
		try {
			if (await checkout.place()) nav.reset('TRACKING');
		} catch (err) {
			toast.show(err instanceof OrderError ? err.message : 'สั่งไม่สำเร็จ ลองใหม่อีกครั้ง', 'error', { duration: 5000 });
		}
	}
</script>

<div class="flex flex-1 flex-col">
	<AppBar title="สรุปคำสั่งซื้อ" />

	{#if cart.isEmpty || !cart.store}
		<div class="flex flex-1 flex-col items-center justify-center px-8 text-center">
			<Goose pose="wait" class="mb-3 w-28" />
			<p class="text-sm font-medium text-slate-800">ถุงยังว่างอยู่</p>
			<p class="mt-1 text-xs text-slate-500">เลือกเมนูจากร้านพาร์ทเนอร์ แล้วน้องห่านจะหิ้วไปให้</p>
			<button type="button" onclick={() => nav.reset('STORES')} class="mt-5 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white">ดูร้านค้า</button>
		</div>
	{:else}
		{@const store = cart.store}
		<div class="flex-1 space-y-3 px-4 pt-4 pb-6">
			<!-- Buyer: details that stay with the account, not edited per order -->
			{#if auth.needsProfile}
				<button type="button" onclick={() => profileGate.ensure()} class="flex w-full items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50 p-4 text-left">
					<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand"><Icon name="user" class="h-5 w-5" /></span>
					<span class="min-w-0 flex-1">
						<span class="block text-sm font-semibold text-slate-900">กรอกข้อมูลผู้สั่ง (ครั้งเดียว)</span>
						<span class="block text-xs text-slate-600">ชื่อเล่นและเบอร์ให้คนหิ้วติดต่อ ครั้งต่อไปไม่ต้องกรอกอีก</span>
					</span>
					<Icon name="chevron-right" class="h-4 w-4 shrink-0 text-slate-400" />
				</button>
			{:else if auth.user}
				<section class="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4" aria-label="ผู้สั่ง">
					<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><Icon name="user" class="h-5 w-5" /></span>
					<span class="min-w-0 flex-1">
						<span class="block truncate text-sm font-semibold text-slate-900">{auth.user.nickname} · <span class="font-normal tabular-nums">{formatPhone(auth.user.phoneNumber)}</span></span>
						<span class="block truncate text-xs text-slate-500">{auth.user.faculty || auth.user.email}</span>
					</span>
					<span class="flex shrink-0 items-center gap-1 text-[11px] text-slate-400"><Icon name="lock" class="h-3.5 w-3.5" /> ผูกกับบัญชี</span>
				</section>
			{/if}

			<!-- Drop-off -->
			<section class="space-y-3 rounded-2xl border border-slate-100 bg-white p-4">
				<h2 class="flex items-center gap-2 text-sm font-semibold text-slate-900"><Icon name="pin" class="h-4 w-4 text-brand" /> จุดส่งมอบอาหารใน มจธ.</h2>
				<label class="relative block">
					<span class="sr-only">จุดส่งมอบ</span>
					<select value={campus.dropoff.id} onchange={selectDropoff} class="w-full appearance-none rounded-xl bg-slate-100 py-3 pr-10 pl-3.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand">
						{#each DROPOFF_POINTS as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
					</select>
					<Icon name="chevron-down" class="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
				</label>
				<label class="block">
					<span class="mb-1 block text-xs text-slate-500">หมายเหตุถึงคนหิ้ว</span>
					<input
						type="text"
						bind:value={checkout.note}
						maxlength="120"
						placeholder="เช่น นั่งโต๊ะม้าหินอ่อน ใส่เสื้อสีขาว"
						class="w-full rounded-xl bg-slate-100 px-3.5 py-3 text-sm outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-brand"
					/>
				</label>
			</section>

			<!-- Items -->
			<section class="rounded-2xl border border-slate-100 bg-white p-4">
				<h2 class="flex items-center gap-2 text-sm font-semibold text-slate-900"><Icon name="store" class="h-4 w-4 text-slate-500" /> {store.name}</h2>
				<ul class="mt-2 divide-y divide-slate-100">
					{#each cart.items as item (item.menuItem.id + (item.special ? ':special' : ''))}
						<li class="flex items-center gap-3 py-3" transition:slide={{ duration: 180 }}>
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm text-slate-900">{lineName(item)}</p>
								<p class="text-xs text-slate-500 tabular-nums">{formatBaht(unitPrice(item) * item.quantity)}</p>
							</div>
							<QtyStepper qty={item.quantity} label={lineName(item)} onadd={() => { cart.add(item.menuItem, store, !!item.special); haptic(); }} onremove={() => { cart.decrement(item.menuItem.id, !!item.special); haptic(6); }} />
						</li>
					{/each}
				</ul>
				<button type="button" onclick={() => addMore(store.id)} class="mt-1 flex items-center gap-1 text-sm font-medium text-brand">
					<Icon name="plus" class="h-4 w-4" /> สั่งเพิ่มจากร้านนี้
				</button>
			</section>

			<!-- Promo -->
			<section class="space-y-3 rounded-2xl border border-slate-100 bg-white p-4">
				<h2 class="flex items-center gap-2 text-sm font-semibold text-slate-900"><Icon name="ticket" class="h-4 w-4 text-brand" /> โค้ดส่วนลด</h2>
				{#if cart.promo}
					<span class="inline-flex items-center gap-2 rounded-lg bg-fresh-50 px-3 py-1.5 text-sm font-medium text-fresh-700">
						{cart.promo} ลด {checkout.codeDiscount} บาท
						<button type="button" onclick={() => (cart.promo = null)} aria-label="ยกเลิกโค้ด {cart.promo}" class="text-fresh-700/70 hover:text-fresh-700"><Icon name="x-circle" class="h-4 w-4" /></button>
					</span>
				{:else}
					<form
						class="flex gap-2"
						onsubmit={(e) => {
							e.preventDefault();
							applyPromo();
						}}
					>
						<input
							type="text"
							bind:value={promoInput}
							oninput={() => (promoError = '')}
							placeholder="ใส่โค้ดส่วนลด (เช่น GOOSEFREE)"
							aria-label="โค้ดส่วนลด"
							aria-invalid={!!promoError}
							autocapitalize="characters"
							class="min-w-0 flex-1 rounded-xl bg-slate-100 px-3.5 py-3 text-sm uppercase outline-none placeholder:normal-case placeholder:text-slate-400 focus:ring-2 {promoError ? 'ring-2 ring-red-300' : 'focus:ring-brand'}"
						/>
						<button type="submit" class="shrink-0 rounded-xl bg-brand px-4 text-sm font-semibold text-white">ใช้โค้ด</button>
					</form>
					{#if promoError}<p class="text-xs text-red-600">{promoError}</p>{/if}
					<p class="text-xs text-slate-500">
						โค้ดที่ใช้ได้:
						{#each Object.keys(PROMO_CODES) as code, i (code)}
							{#if i > 0},{/if}
							<button type="button" onclick={() => applyPromo(code)} class="font-medium text-brand underline-offset-2 hover:underline">{code}</button>
						{/each}
					</p>
				{/if}
			</section>

			<!-- Totals -->
			<section class="space-y-2 rounded-2xl border border-slate-100 bg-white p-4 text-sm">
				<div class="flex justify-between text-slate-600"><span>ค่าอาหารรวม</span><span class="text-slate-900 tabular-nums">{formatBaht(cart.subtotal)}</span></div>
				<div class="flex justify-between text-slate-600"><span>ค่าหิ้วน้ำใจ (เพื่อน นศ. ส่งให้)</span><span class="text-slate-900 tabular-nums">{formatBaht(checkout.deliveryFee)}</span></div>
				{#if checkout.codeDiscount > 0}
					<div class="flex justify-between text-slate-600"><span>ส่วนลดจากโค้ด [{cart.promo}]</span><span class="font-medium text-fresh-700 tabular-nums">-{formatBaht(checkout.codeDiscount)}</span></div>
				{/if}
				{#if cart.partnerDiscount > 0 && cart.appliedPromotion}
					<div class="flex justify-between gap-3 text-slate-600"><span class="min-w-0 truncate">{cart.appliedPromotion.promotion.kind === 'CO_PROMO' ? 'โปรร่วม' : 'โปรร้าน'}: {cart.appliedPromotion.promotion.title}</span><span class="font-medium text-fresh-700 tabular-nums">-{formatBaht(cart.partnerDiscount)}</span></div>
				{/if}
				<div class="flex items-center justify-between border-t border-slate-100 pt-3">
					<span class="font-semibold text-slate-900">ยอดชำระสุทธิ</span>
					<AnimatedNumber value={checkout.total} class="text-xl font-bold text-brand" />
				</div>
				{#if saved > 0}
					<p class="flex items-center gap-1.5 rounded-lg bg-fresh-50 px-3 py-2 text-xs font-medium text-fresh-700" transition:slide={{ duration: 180 }}>
						<Icon name="tag" class="h-3.5 w-3.5" /> ออเดอร์นี้ประหยัดไป {saved} บาท
					</p>
				{/if}
			</section>

			<!-- Payment -->
			<section class="rounded-2xl border border-slate-100 bg-white p-4">
				<h2 id="pay-label" class="text-sm font-semibold text-slate-900">วิธีชำระเงิน</h2>
				<div class="mt-1 divide-y divide-slate-100" role="radiogroup" aria-labelledby="pay-label">
					{#each [
						{ id: 'PROMPTPAY' as const, label: 'สแกน PromptPay QR Code', sub: 'แนะนำ · เงินพักในระบบจนกว่าจะยืนยัน OTP' },
						{ id: 'CASH' as const, label: 'เงินสดปลายทาง', sub: 'ส่งมอบให้เพื่อนตอนรับของ' }
					] as pm (pm.id)}
						{@const selected = checkout.payment === pm.id}
						<button type="button" role="radio" aria-checked={selected} onclick={() => (checkout.payment = pm.id)} class="flex w-full items-center gap-3 py-3 text-left">
							<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 {selected ? 'border-brand' : 'border-slate-300'}">
								{#if selected}<span class="h-2.5 w-2.5 rounded-full bg-brand"></span>{/if}
							</span>
							<span>
								<span class="block text-sm font-medium text-slate-900">{pm.label}</span>
								<span class="block text-xs text-slate-500">{pm.sub}</span>
							</span>
						</button>
					{/each}
				</div>
			</section>
		</div>

		<BottomBar>
			<button type="button" onclick={placeOrder} disabled={checkout.placing} class="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-4 text-sm font-semibold text-white active:bg-brand-600 disabled:opacity-80">
				{#if checkout.placing}<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span> กำลังส่งออเดอร์...{:else}สั่งอาหารและหาเพื่อนหิ้ว ({formatBaht(checkout.total)}){/if}
			</button>
		</BottomBar>
	{/if}
</div>
