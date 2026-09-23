<script lang="ts">
	import BottomBar from '$lib/components/BottomBar.svelte';
	import Goose from '$lib/components/Goose.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { nav } from '$lib/stores/nav.svelte';
	import { orders } from '$lib/stores/orders.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { formatBaht } from '$lib/utils';

	const TAGS = ['ส่งไวมาก', 'อาหารยังร้อน', 'พูดจาสุภาพ', 'ตรงเวลา'];
	const RATING_WORDS = ['', 'ยังไม่ประทับใจ', 'พอใช้', 'โอเคเลย', 'ดีมาก', 'หิ้วดีที่สุด'];
	const TIPS: { amount: number; label: string }[] = [
		{ amount: 5, label: '+5' },
		{ amount: 10, label: '+10' },
		{ amount: 0, label: 'ไม่ระบุ' }
	];

	const order = $derived(orders.current);

	let rating = $state(0);
	let tags = $state<string[]>([]);
	let tip = $state(0);

	function toggleTag(tag: string) {
		tags = tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
	}

	function finish() {
		if (order) orders.rate(order.id, rating, tags, tip);
		if (rating > 0 || tip > 0) toast.show(tip > 0 ? `ขอบคุณสำหรับรีวิวและน้ำใจ ${tip} บาท` : 'ขอบคุณสำหรับรีวิว', 'success');
		nav.reset('HOME');
	}
</script>

<div class="flex min-h-dvh flex-1 flex-col bg-canvas">
	<div class="flex-1 space-y-4 px-4 pt-[calc(2.5rem+env(safe-area-inset-top))] pb-6">
		<div class="text-center">
			<div class="relative mx-auto w-44">
				<Goose pose="hop" class="w-44" />
				<span class="absolute -right-1 bottom-2 flex h-11 w-11 items-center justify-center rounded-full bg-fresh text-white ring-4 ring-canvas">
					<Icon name="check" class="check-draw h-6 w-6" strokeWidth={3} />
				</span>
			</div>
			<h1 class="mt-4 text-xl font-bold text-slate-900">ส่งมอบอาหารสำเร็จแล้ว</h1>
			<p class="mt-1 text-sm text-slate-500">{order?.rider ? `${order.rider.name}หิ้วมาถึงมือแล้ว ไม่ต้องเดินตากแดดเอง` : 'ถึงมือแล้ว ไม่ต้องเดินตากแดดเอง'}</p>
		</div>

		{#if order}
			<section class="space-y-2 rounded-2xl border border-slate-100 bg-white p-4 text-sm">
				<div class="flex justify-between gap-4 text-slate-500"><span class="shrink-0">เส้นทาง</span><span class="truncate text-right text-slate-900">{order.pickupName} → {order.dropoffName}</span></div>
				<div class="flex justify-between text-slate-500"><span>ค่าอาหาร</span><span class="text-slate-900 tabular-nums">{formatBaht(order.foodTotal)}</span></div>
				<div class="flex justify-between text-slate-500"><span>ค่าหิ้วน้ำใจ</span><span class="text-slate-900 tabular-nums">{formatBaht(order.deliveryFee)}</span></div>
				{#if order.codeDiscount + order.partnerDiscount > 0}
					<div class="flex justify-between text-slate-500"><span>ส่วนลด</span><span class="text-fresh-700 tabular-nums">-{formatBaht(order.codeDiscount + order.partnerDiscount)}</span></div>
				{/if}
				<div class="flex items-center justify-between border-t border-slate-100 pt-2">
					<span class="text-slate-500">รวมชำระ</span>
					<span class="text-lg font-bold text-brand tabular-nums">{formatBaht(order.totalPrice + tip)}</span>
				</div>
				<p class="flex items-center gap-1.5 text-xs text-fresh-700">
					<Icon name="check-circle" class="h-4 w-4" />
					{order.paymentMethod === 'PROMPTPAY' ? 'จ่ายผ่าน PromptPay เรียบร้อย' : 'ชำระเงินสดกับเพื่อนแล้ว'}
				</p>
			</section>
		{/if}

		<section class="rounded-2xl border border-slate-100 bg-white p-4 text-center">
			<h2 class="text-sm font-semibold text-slate-900">ให้คะแนนเพื่อนคนหิ้ว{order?.rider ? ` (${order.rider.name})` : ''}</h2>
			<div class="mt-3 flex justify-center gap-2" role="radiogroup" aria-label="คะแนน">
				{#each [1, 2, 3, 4, 5] as star (star)}
					<button type="button" role="radio" aria-checked={rating === star} aria-label="{star} ดาว" onclick={(e) => { rating = star; e.currentTarget.animate([{ transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }); }} class="p-1 {rating >= star ? 'text-beak' : 'text-beak/60'}">
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

		<section>
			<h2 class="mb-2 text-sm font-semibold text-slate-900">น้ำใจเพิ่มเติม (ไม่บังคับ)</h2>
			<div class="grid grid-cols-3 gap-2" role="radiogroup" aria-label="ทิป">
				{#each TIPS as t (t.amount)}
					<button type="button" role="radio" aria-checked={tip === t.amount} onclick={() => (tip = t.amount)} class="rounded-xl border py-3 text-sm font-medium transition-colors {tip === t.amount ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-brand'}">
						{t.label}
					</button>
				{/each}
			</div>
		</section>
	</div>

	<BottomBar>
		<button type="button" onclick={finish} class="w-full rounded-2xl bg-brand py-4 text-sm font-semibold text-white active:bg-brand-600">เสร็จสิ้น กลับสู่หน้าหลัก</button>
	</BottomBar>
</div>
