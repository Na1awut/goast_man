<script lang="ts">
	import { fade, slide } from 'svelte/transition';
	import AppBar from '$lib/components/AppBar.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import Goose from '$lib/components/Goose.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import RouteStrip from '$lib/components/RouteStrip.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { nav } from '$lib/stores/nav.svelte';
	import { orders } from '$lib/stores/orders.svelte';
	import { isLive } from '$lib/supabase';
	import { awaitingPayment } from '$lib/payments';
	import { lineName, unitPrice } from '$lib/pricing';
	import { formatBaht, formatTime } from '$lib/utils';

	const order = $derived(orders.current);
	const unpaid = $derived(!!order && awaitingPayment(order));

	type StepState = 'done' | 'active' | 'todo';

	const steps = $derived.by(() => {
		if (!order) return [];
		const rank = { PENDING: 0, ACCEPTED: 1, DELIVERING: 2, COMPLETED: 4, CANCELLED: -1 }[order.status];
		const defs = [
			{ title: 'สร้างออเดอร์สำเร็จ', sub: awaitingPayment(order) ? 'รอชำระเงิน PromptPay' : 'กำลังหาเพื่อนที่อยู่ใกล้ร้าน', time: order.createdAt },
			{ title: 'เพื่อนรับงานหิ้ว', sub: order.rider ? `${order.rider.name} กำลังต่อคิวที่ร้าน` : '', time: order.acceptedAt },
			{ title: 'ซื้อเสร็จ กำลังเดินมาส่ง', sub: 'คาดว่าจะถึงใน ~8 นาที', time: order.deliveringAt },
			{ title: 'ส่งมอบสำเร็จ', sub: '', time: order.completedAt }
		];
		return defs.map((d, i) => {
			const state: StepState = order.status === 'CANCELLED' ? (i === 0 ? 'done' : 'todo') : i < rank ? 'done' : i === rank ? 'active' : 'todo';
			return { ...d, state };
		});
	});

	let confirming = $state(false);
	let otpLarge = $state(false);

	function onkeydown(e: KeyboardEvent) {
		if (otpLarge && e.key === 'Escape') otpLarge = false;
	}

	function simulateOtp() {
		if (!order || confirming) return;
		confirming = true;
		const { id, otpCode } = order;
		// Simulate the runner typing the OTP on their device
		setTimeout(() => {
			confirming = false;
			if (orders.confirmDelivery(id, otpCode)) nav.reset('SUCCESS', ['HOME']);
		}, 1100);
	}

	function back() {
		if (nav.history.at(-1) === 'ORDERS') nav.back();
		else nav.reset('ORDERS');
	}
</script>

<svelte:window {onkeydown} />

<div class="flex flex-1 flex-col">
	<AppBar title={order?.orderCode ?? 'ติดตามคำสั่งซื้อ'} onback={back}>
		{#snippet action()}
			{#if order}<StatusBadge status={order.status} />{/if}
		{/snippet}
	</AppBar>

	{#if !order}
		<div class="flex flex-1 flex-col items-center justify-center px-8 text-center">
			<p class="text-sm font-medium text-slate-800">ไม่พบคำสั่งซื้อนี้</p>
			<button type="button" onclick={() => nav.reset('ORDERS')} class="mt-4 text-sm font-medium text-brand">ดูคำสั่งซื้อทั้งหมด</button>
		</div>
	{:else}
		<div class="flex-1 space-y-3 px-4 pt-4 pb-6">
			<RouteStrip {order} />

			<!-- Timeline -->
			<section class="rounded-2xl border border-slate-100 bg-white p-4" aria-label="สถานะคำสั่งซื้อ">
				<ol>
					{#each steps as step, i (step.title)}
						<li class="relative flex gap-3 pb-5 last:pb-0">
							{#if i < steps.length - 1}
								<span
									class="absolute top-6 bottom-0 left-[11px] w-0.5 {step.state === 'done' ? 'bg-brand' : 'border-l-2 border-dashed border-slate-200 bg-transparent'}"
									aria-hidden="true"
								></span>
							{/if}
							<span class="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full
								{step.state === 'done' ? 'bg-brand text-white' : step.state === 'active' ? 'border-2 border-brand bg-white' : 'border-2 border-slate-300 bg-white'}">
								{#if step.state === 'done'}<Icon name="check" class="h-3.5 w-3.5" strokeWidth={3} />{/if}
								{#if step.state === 'active'}<span class="h-2.5 w-2.5 animate-pulse rounded-full bg-brand"></span>{/if}
							</span>
							<div class="min-w-0 flex-1">
								<div class="flex items-baseline justify-between gap-2">
									<p class="text-sm {step.state === 'active' ? 'font-semibold text-brand' : step.state === 'done' ? 'font-medium text-slate-900' : 'text-slate-400'}">{step.title}</p>
									{#if step.time && step.state !== 'todo'}<span class="shrink-0 text-xs text-slate-400 tabular-nums">{formatTime(step.time)}</span>{/if}
								</div>
								{#if step.state === 'active' && step.sub}<p class="text-xs text-slate-500">{step.sub}</p>{/if}
							</div>
						</li>
					{/each}
				</ol>
			</section>

			<!-- Rider -->
			{#if order.rider}
				{@const rider = order.rider}
				<section class="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4">
					<Avatar name={rider.fullName} />
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-semibold text-slate-900">{rider.name} <span class="font-normal text-slate-500">· {rider.fullName}</span></p>
						<p class="truncate text-xs text-slate-500">{rider.faculty}</p>
						<p class="mt-0.5 flex items-center gap-1 text-xs text-slate-600">
							<Icon name="star" class="h-3.5 w-3.5 text-beak" filled strokeWidth={0} />{rider.rating}
							<span class="text-slate-400">· {rider.jobs} งาน</span>
						</p>
					</div>
					<button type="button" onclick={() => nav.go('CHAT')} aria-label="แชทกับ {rider.name}" class="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand">
						<Icon name="message" />
					</button>
				</section>
			{:else if unpaid}
				<section class="rounded-2xl border border-brand-100 bg-brand-50 p-4">
					<p class="text-sm font-semibold text-slate-900">รอชำระเงิน {order.totalPrice} ฿</p>
					<p class="mt-0.5 text-xs text-slate-600">โอนผ่าน PromptPay แล้วแนบสลิป เพื่อนจะเห็นงานนี้หลังตรวจสลิปผ่าน</p>
					<div class="mt-3 flex items-center gap-3">
						<button type="button" onclick={() => nav.go('PAYMENT')} class="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white">ชำระเงิน</button>
						<button type="button" onclick={() => orders.cancel(order.id)} class="text-sm text-slate-500 underline underline-offset-2">ยกเลิก</button>
					</div>
				</section>
			{:else if order.status === 'PENDING'}
				<section class="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4">
					<span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500"><Icon name="search_user" /></span>
					<div class="min-w-0 flex-1">
						<p class="text-sm font-medium text-slate-900">กำลังหาเพื่อนรับหิ้ว</p>
						<p class="text-xs text-slate-500">{orders.onlineRiders !== null ? `ออนไลน์อยู่ใกล้ๆ ${orders.onlineRiders} คน` : 'เพื่อนที่อยู่ใกล้ร้านจะเห็นงานนี้ทันที'}</p>
					</div>
					<button type="button" onclick={() => orders.cancel(order.id)} class="text-sm text-slate-500 underline underline-offset-2">ยกเลิก</button>
				</section>
			{/if}

			<!-- OTP -->
			{#if order.status === 'ACCEPTED' || order.status === 'DELIVERING'}
				<section class="rounded-2xl border-2 border-dashed border-brand bg-brand-50/60 px-4 py-6 text-center" transition:slide>
					<span class="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-brand"><Icon name="key" /></span>
					<h2 class="mt-3 text-base font-semibold text-slate-900">รหัส OTP ปิดงานส่งของ</h2>
					<button
						type="button"
						onclick={() => (otpLarge = true)}
						class="mx-auto mt-4 flex justify-center gap-3 rounded-2xl p-1"
						aria-label="รหัส OTP {order.otpCode.split('').join(' ')} แตะเพื่อขยายเต็มจอ"
					>
						{#each order.otpCode.split('') as digit, i (i)}
							<span class="flex h-16 w-14 items-center justify-center rounded-xl bg-white text-3xl font-bold text-brand shadow-[0_1px_2px_rgb(15_23_42/0.08)] tabular-nums">{digit}</span>
						{/each}
					</button>
					<p class="mt-4 text-xs text-slate-600">แจ้งรหัส 4 หลักนี้ให้เพื่อนเมื่อได้รับของ</p>
					<p class="text-xs font-medium text-brand">เพื่อยืนยันและปลดล็อกเงินค่าหิ้ว</p>
					<p class="mt-2 flex items-center justify-center gap-1 text-[11px] text-slate-500"><Icon name="smartphone" class="h-3.5 w-3.5" /> แตะรหัสเพื่อขยายให้เพื่อนดู</p>
				</section>
			{/if}

			<!-- Details -->
			<section class="rounded-2xl border border-slate-100 bg-white p-4 text-sm">
				<h2 class="font-semibold text-slate-900">รายละเอียด</h2>
				<p class="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
					<span class="truncate">{order.pickupName}</span><Icon name="arrow-right" class="h-3.5 w-3.5 shrink-0" /><span class="truncate">{order.dropoffName}</span>
				</p>
				{#if order.items?.length}
					<ul class="mt-3 space-y-1.5">
						{#each order.items as item (item.menuItem.id + (item.special ? ':special' : ''))}
							<li class="flex justify-between gap-2 text-slate-700"><span class="truncate">{item.quantity}x {lineName(item)}</span><span class="shrink-0 tabular-nums">{formatBaht(unitPrice(item) * item.quantity)}</span></li>
						{/each}
					</ul>
				{:else}
					<p class="mt-3 text-slate-700">{order.itemDetails}</p>
				{/if}
				{#if order.note}<p class="mt-3 flex gap-1.5 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600"><Icon name="note" class="h-4 w-4" />{order.note}</p>{/if}
				<div class="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
					<div class="flex justify-between"><span>ค่าอาหาร{order.kind === 'CUSTOM' ? ' (ประมาณ)' : ''}</span><span class="tabular-nums">{formatBaht(order.foodTotal)}</span></div>
					<div class="flex justify-between"><span>ค่าหิ้ว</span><span class="tabular-nums">{formatBaht(order.deliveryFee)}</span></div>
					{#if order.codeDiscount + order.partnerDiscount > 0}
						<div class="flex justify-between text-fresh-700"><span>ส่วนลด</span><span class="tabular-nums">-{formatBaht(order.codeDiscount + order.partnerDiscount)}</span></div>
					{/if}
				</div>
				<div class="mt-2 flex items-center justify-between">
					<span class="text-xs text-slate-500">{order.paymentMethod === 'PROMPTPAY' ? 'PromptPay (ชำระแล้ว)' : 'เงินสดปลายทาง'}</span>
					<span class="text-base font-bold text-brand tabular-nums">{formatBaht(order.totalPrice)}</span>
				</div>
			</section>

			{#if order.rider && (order.status === 'ACCEPTED' || order.status === 'DELIVERING')}
				<a href="tel:{order.rider.phone}" class="flex w-full items-center justify-center gap-2 rounded-2xl border border-brand bg-white py-3.5 text-sm font-medium text-brand active:bg-brand-50">
					<Icon name="phone" class="h-4 w-4" /> โทรหาคนส่ง
				</a>
			{/if}

			{#if order.status === 'DELIVERING' && !isLive}
				<button
					type="button"
					onclick={simulateOtp}
					disabled={confirming}
					class="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 py-3 text-xs text-slate-500 disabled:opacity-70"
				>
					{#if confirming}
						<span class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"></span> คนหิ้วกำลังกรอก OTP...
					{:else}
						[เดโม] จำลอง: คนหิ้วกรอก OTP สำเร็จ
					{/if}
				</button>
			{:else if order.status === 'COMPLETED' && !order.rating}
				<button type="button" onclick={() => nav.go('SUCCESS')} class="w-full rounded-2xl bg-brand py-4 text-sm font-semibold text-white">ให้คะแนนเพื่อนคนหิ้ว</button>
			{/if}
		</div>
	{/if}
</div>

{#if otpLarge && order && (order.status === 'ACCEPTED' || order.status === 'DELIVERING')}
	<!-- Held up to the runner's face: big, bright, nothing else competing -->
	<div
		role="dialog"
		aria-modal="true"
		aria-label="รหัส OTP สำหรับยื่นให้คนหิ้วดู"
		class="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-white px-6"
		transition:fade={{ duration: 150 }}
	>
		<Goose pose="idle" class="w-24" />
		<p class="mt-4 text-sm text-slate-500">รหัสยืนยันรับของ {order.orderCode}</p>
		<p class="mt-2 text-[5.5rem] leading-none font-bold tracking-[0.12em] text-brand tabular-nums">{order.otpCode}</p>
		<p class="mt-4 text-sm text-slate-600">ให้{order.rider?.name ?? 'คนหิ้ว'}กรอกรหัสนี้ในเครื่อง</p>
		<button type="button" onclick={() => (otpLarge = false)} class="mt-10 rounded-2xl border border-slate-200 px-6 py-3 text-sm font-medium text-slate-700 active:bg-slate-50">ปิด</button>
	</div>
{/if}
