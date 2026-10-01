<script lang="ts">
	import { slide } from 'svelte/transition';
	import AnimatedNumber from '$lib/components/AnimatedNumber.svelte';
	import AppBar from '$lib/components/AppBar.svelte';
	import Goose from '$lib/components/Goose.svelte';
	import BottomBar from '$lib/components/BottomBar.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import FloorPicker from '$lib/components/FloorPicker.svelte';
	import QtyStepper from '$lib/components/QtyStepper.svelte';
	import { DROPOFF_POINTS } from '$lib/data/locations';
	import { promptPayEnabled } from '$lib/payments';
	import { isLive } from '$lib/supabase';
	import { describeQuote, lineName, MAX_ORDER_ITEMS, unitPrice } from '$lib/pricing';
	import { flags } from '$lib/stores/flags.svelte';
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

	// The rain fee may have been switched on since the app opened
	$effect(() => {
		void flags.load();
	});

	let promoInput = $state('');
	let promoError = $state('');
	let checkingPromo = $state(false);

	/** The database's reason, in the buyer's words; unknown reasons read as "code not found" */
	function promoErrorText(err: unknown, input: string): string {
		const msg = err instanceof Error ? err.message : String(err);
		if (msg.includes('PROMO_NOT_STARTED')) return 'โค้ดนี้ยังไม่เริ่มใช้ได้';
		if (msg.includes('PROMO_USES_UP')) return 'โค้ดนี้ถูกใช้ครบจำนวนแล้ว';
		return `ไม่พบโค้ด ${input.trim().toUpperCase()}`;
	}

	async function applyPromo(input = promoInput) {
		if (!input.trim()) {
			promoError = 'กรอกโค้ดส่วนลดก่อน';
			return;
		}
		checkingPromo = true;
		promoError = '';
		try {
			const applied = await cart.checkCode(input);
			if (applied.kind === 'FREE_DELIVERY' && checkout.feeAfterPromotion === 0) {
				promoError = 'ออเดอร์นี้ฟรีค่าหิ้วจากโปรของร้านอยู่แล้ว';
				return;
			}
			cart.promo = applied;
			haptic([10, 40, 10]);
			promoInput = '';
			toast.show(`ใช้โค้ด ${applied.code} แล้ว (${applied.kind === 'FREE_DELIVERY' ? `ฟรีค่าหิ้ว ${checkout.feeAfterPromotion} ฿` : `ลด ${applied.amount} ฿`})`, 'success');
		} catch (err) {
			promoError = promoErrorText(err, input);
		} finally {
			checkingPromo = false;
		}
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
		if (!isLive) {
			checkout.startPayment();
			nav.go('PAYMENT');
			return;
		}
		try {
			// Live PromptPay: order is created unpaid, then paid by slip on PAYMENT screen
			if (await checkout.place()) nav.reset('PAYMENT');
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
				<FloorPicker />
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
				<h2 class="flex items-center gap-2 text-sm font-semibold text-slate-900"><Icon name="store" class="h-4 w-4 text-slate-500" /> <span class="min-w-0 flex-1 truncate">{store.name}</span> <span class="shrink-0 text-xs font-normal tabular-nums {cart.full ? 'text-brand-700' : 'text-slate-500'}">{cart.totalItems}/{MAX_ORDER_ITEMS} ชิ้น</span></h2>
				{#if cart.overLimit}
					<p class="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">คนหิ้วถือได้สูงสุด {MAX_ORDER_ITEMS} ชิ้น ลดให้เหลือ {MAX_ORDER_ITEMS} ชิ้นก่อนสั่ง</p>
				{:else if cart.full}
					<p class="mt-2 text-xs text-slate-500">ครบ {MAX_ORDER_ITEMS} ชิ้นแล้ว (คนหิ้วถือได้เท่านี้)</p>
				{/if}
				<ul class="mt-2 divide-y divide-slate-100">
					{#each cart.items as item (item.menuItem.id + (item.special ? ':special' : '') + (item.selectedOptions?.map(o => o.choiceId).join(',') ?? ''))}
						<li class="flex items-center gap-3 py-3" transition:slide={{ duration: 180 }}>
							<div class="min-w-0 flex-1">
								<p class="text-sm font-medium text-slate-900">{lineName(item)}</p>
								{#if item.selectedOptions?.length}
									<p class="text-xs text-slate-500">
										{item.selectedOptions.map((o) => `${o.name}${o.price > 0 ? ` (+${o.price}฿)` : ''}`).join(', ')}
									</p>
								{/if}
								<p class="text-xs text-slate-500 tabular-nums">{formatBaht(unitPrice(item) * item.quantity)}</p>
							</div>
							<QtyStepper qty={item.quantity} label={lineName(item)} onadd={() => { cart.add(item.menuItem, store, !!item.special, item.selectedOptions); haptic(); }} onremove={() => { cart.decrement(item.menuItem.id, !!item.special, item.selectedOptions); haptic(6); }} />
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
						{cart.promo.code} ลด {checkout.codeDiscount} บาท
						<button type="button" onclick={() => (cart.promo = null)} aria-label="ยกเลิกโค้ด {cart.promo.code}" class="text-fresh-700/70 hover:text-fresh-700"><Icon name="x-circle" class="h-4 w-4" /></button>
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
							placeholder="ใส่โค้ดส่วนลดจากทีม Goose Man"
							aria-label="โค้ดส่วนลด"
							aria-invalid={!!promoError}
							autocapitalize="characters"
							disabled={checkingPromo}
							class="min-w-0 flex-1 rounded-xl bg-slate-100 px-3.5 py-3 text-sm uppercase outline-none placeholder:normal-case placeholder:text-slate-400 focus:ring-2 disabled:opacity-60 {promoError ? 'ring-2 ring-red-300' : 'focus:ring-brand'}"
						/>
						<button type="submit" disabled={checkingPromo} class="shrink-0 rounded-xl bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60">{checkingPromo ? 'กำลังตรวจสอบ...' : 'ใช้โค้ด'}</button>
					</form>
					{#if promoError}<p class="text-xs text-red-600">{promoError}</p>{/if}
				{/if}
			</section>

			<!-- Totals -->
			<section class="space-y-2 rounded-2xl border border-slate-100 bg-white p-4 text-sm">
				<div class="flex justify-between text-slate-600"><span>ค่าอาหารรวม</span><span class="text-slate-900 tabular-nums">{formatBaht(cart.subtotal)}</span></div>
				<div class="flex justify-between gap-3 text-slate-600">
					<span class="min-w-0">
						ค่าหิ้วน้ำใจ (เพื่อน นศ. ส่งให้)
						<span class="block text-xs text-slate-500">{describeQuote(cart.deliveryQuote, campus.floor)}</span>
					</span>
					<span class="shrink-0 text-slate-900 tabular-nums">{formatBaht(checkout.deliveryFee)}</span>
				</div>
				{#if cart.deliveryQuote.rain}
					<p class="flex items-center gap-1.5 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">ช่วงฝนตก ค่าหิ้วเพิ่ม {cart.deliveryQuote.rain} บาท ให้เพื่อนที่ฝ่าฝนมาส่ง</p>
				{/if}
				{#if checkout.codeDiscount > 0}
					<div class="flex justify-between text-slate-600"><span>ส่วนลดจากโค้ด [{cart.promo?.code}]</span><span class="font-medium text-fresh-700 tabular-nums">-{formatBaht(checkout.codeDiscount)}</span></div>
				{/if}
				{#if cart.partnerDiscount > 0 && cart.appliedPromotion}
					<div class="flex justify-between gap-3 text-slate-600"><span class="min-w-0 truncate">{cart.appliedPromotion.promotion.kind === 'CO_PROMO' ? 'โปรร่วม' : 'โปรร้าน'}: {cart.appliedPromotion.promotion.title}</span><span class="font-medium text-fresh-700 tabular-nums">-{formatBaht(cart.partnerDiscount)}</span></div>
				{/if}
				{#if checkout.tip > 0}
					<div class="flex justify-between text-slate-600" transition:slide={{ duration: 180 }}><span>ทิปให้เพื่อน (ปัดเศษ)</span><span class="text-slate-900 tabular-nums">{formatBaht(checkout.tip)}</span></div>
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
				<div class="mt-2.5 flex items-center gap-3 rounded-xl bg-slate-50 p-3.5">
					<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-brand">
						<span class="h-2.5 w-2.5 rounded-full bg-brand"></span>
					</span>
					<div>
						<span class="block text-sm font-medium text-slate-900">สแกน PromptPay QR Code</span>
						<span class="block text-xs text-slate-500">เงินพักในระบบจนกว่าจะยืนยัน OTP เมื่อได้รับของครบ</span>
					</div>
				</div>
			</section>

			<!-- Round-up tip: asked last, right before paying -->
			{#if checkout.tipOffer > 0}
				<button
					type="button"
					role="switch"
					aria-checked={checkout.roundUp}
					onclick={() => (checkout.roundUp = !checkout.roundUp)}
					class="flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors {checkout.roundUp ? 'border-brand bg-brand-50' : 'border-slate-100 bg-white'}"
				>
					<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl {checkout.roundUp ? 'bg-brand text-white' : 'bg-brand-50 text-brand'}"><Icon name="heart" class="h-5 w-5" /></span>
					<span class="min-w-0 flex-1">
						<span class="block text-sm font-semibold text-slate-900">ปัดเป็น {formatBaht(checkout.baseTotal + checkout.tipOffer)} ไหม?</span>
						<span class="block text-xs text-slate-600">ส่วนต่าง {checkout.tipOffer} บาทเป็นทิปให้เพื่อนที่หิ้ว</span>
					</span>
					<span class="relative h-6 w-10 shrink-0 rounded-full transition-colors {checkout.roundUp ? 'bg-brand' : 'bg-slate-200'}" aria-hidden="true">
						<span class="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all {checkout.roundUp ? 'left-[18px]' : 'left-0.5'}"></span>
					</span>
				</button>
			{/if}
		</div>

		<BottomBar>
			<button type="button" onclick={placeOrder} disabled={checkout.placing || cart.overLimit} class="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-4 text-sm font-semibold text-white active:bg-brand-600 disabled:opacity-80">
				{#if checkout.placing}<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span> กำลังส่งออเดอร์...{:else}สั่งอาหารและหาเพื่อนหิ้ว ({formatBaht(checkout.total)}){/if}
			</button>
		</BottomBar>
	{/if}
</div>
