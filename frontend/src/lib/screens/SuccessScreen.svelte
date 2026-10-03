<script lang="ts">
	import { t } from '$lib/i18n';
	import BottomBar from '$lib/components/BottomBar.svelte';
	import gooseDelivered from '$lib/assets/goose-delivered.webp';
	import Icon from '$lib/components/Icon.svelte';
	import { nav } from '$lib/stores/nav.svelte';
	import { orders } from '$lib/stores/orders.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { formatBaht } from '$lib/utils';

	const TAGS = [t('ส่งไวมาก'), t('อาหารยังร้อน'), t('พูดจาสุภาพ'), t('ตรงเวลา')];
	const RATING_WORDS = ['', t('ยังไม่ประทับใจ'), t('พอใช้'), t('โอเคเลย'), t('ดีมาก'), t('หิ้วดีที่สุด')];

	const order = $derived(orders.current);

	let rating = $state(0);
	let tags = $state<string[]>([]);

	function toggleTag(tag: string) {
		tags = tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
	}

	function finish() {
		if (order) orders.rate(order.id, rating, tags);
		if (rating > 0) toast.show(t('ขอบคุณสำหรับรีวิว'), 'success');
		nav.reset('HOME');
	}
</script>

<div class="flex min-h-dvh flex-1 flex-col bg-canvas">
	<div class="flex-1 space-y-4 px-4 pt-[calc(2.5rem+env(safe-area-inset-top))] pb-6">
		<div class="text-center">
			<!-- The strong goose with the delivered bag: the order made it -->
			<div class="relative mx-auto w-52">
				<img src={gooseDelivered} alt="" width="540" height="575" class="goose-hop block h-auto w-full select-none" draggable="false" />
				<span class="absolute bottom-3 left-2 flex h-11 w-11 items-center justify-center rounded-full bg-fresh text-white ring-4 ring-canvas">
					<Icon name="check" class="check-draw h-6 w-6" strokeWidth={3} />
				</span>
			</div>
			<h1 class="mt-4 text-xl font-bold text-slate-900">{t('ส่งมอบอาหารสำเร็จแล้ว')}</h1>
			<p class="mt-1 text-sm text-slate-500">{order?.rider ? t('{name}หิ้วมาถึงมือแล้ว ไม่ต้องเดินตากแดดเอง', { name: order.rider.name }) : t('ถึงมือแล้ว ไม่ต้องเดินตากแดดเอง')}</p>
		</div>

		{#if order}
			<section class="space-y-2 rounded-2xl border border-slate-100 bg-white p-4 text-sm">
				<div class="flex justify-between gap-4 text-slate-500"><span class="shrink-0">{t('เส้นทาง')}</span><span class="truncate text-right text-slate-900">{order.pickupName} → {order.dropoffName}</span></div>
				<div class="flex justify-between text-slate-500"><span>{t('ค่าอาหาร')}</span><span class="text-slate-900 tabular-nums">{formatBaht(order.foodTotal)}</span></div>
				<div class="flex justify-between text-slate-500"><span>{t('ค่าหิ้วน้ำใจ')}</span><span class="text-slate-900 tabular-nums">{formatBaht(order.deliveryFee)}</span></div>
				{#if order.codeDiscount + order.partnerDiscount > 0}
					<div class="flex justify-between text-slate-500"><span>{t('ส่วนลด')}</span><span class="text-fresh-700 tabular-nums">-{formatBaht(order.codeDiscount + order.partnerDiscount)}</span></div>
				{/if}
				{#if order.tip}
					<div class="flex justify-between text-slate-500"><span>{t('ทิปให้เพื่อน (ปัดเศษ)')}</span><span class="text-slate-900 tabular-nums">{formatBaht(order.tip)}</span></div>
				{/if}
				<div class="flex items-center justify-between border-t border-slate-100 pt-2">
					<span class="text-slate-500">{t('รวมชำระ')}</span>
					<span class="text-lg font-bold text-brand tabular-nums">{formatBaht(order.totalPrice)}</span>
				</div>
				<p class="flex items-center gap-1.5 text-xs text-fresh-700">
					<Icon name="check-circle" class="h-4 w-4" />
					{order.paymentMethod === 'PROMPTPAY' ? t('จ่ายผ่าน PromptPay เรียบร้อย') : t('ชำระเงินสดกับเพื่อนแล้ว')}
				</p>
			</section>
		{/if}

		<section class="rounded-2xl border border-slate-100 bg-white p-4 text-center">
			<h2 class="text-sm font-semibold text-slate-900">{t('ให้คะแนนเพื่อนคนหิ้ว{v}', { v: order?.rider ? ` (${order.rider.name})` : '' })}</h2>
			<div class="mt-3 flex justify-center gap-2" role="radiogroup" aria-label={t('คะแนน')}>
				{#each [1, 2, 3, 4, 5] as star (star)}
					<button type="button" role="radio" aria-checked={rating === star} aria-label={t('{star} ดาว', { star })} onclick={(e) => { rating = star; e.currentTarget.animate([{ transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }); }} class="p-1 {rating >= star ? 'text-beak' : 'text-beak/60'}">
						<Icon name="star" class="h-8 w-8" filled={rating >= star} strokeWidth={1.6} />
					</button>
				{/each}
			</div>
			<p class="mt-1 h-5 text-xs text-slate-500" aria-live="polite">{RATING_WORDS[rating]}</p>
			<div class="mt-2 flex flex-wrap justify-center gap-2">
				{#each TAGS as tag (tag)}
					{@const on = tags.includes(tag)}
					<button type="button" aria-pressed={on} onclick={() => toggleTag(tag)} class="rounded-full border px-3.5 py-1.5 text-xs transition-colors {on ? 'border-brand bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600'}">
						{tag}
					</button>
				{/each}
			</div>
		</section>

	</div>

	<BottomBar>
		<button type="button" onclick={finish} class="w-full rounded-2xl bg-brand py-4 text-sm font-semibold text-white active:bg-brand-600">{t('เสร็จสิ้น กลับสู่หน้าหลัก')}</button>
	</BottomBar>
</div>
