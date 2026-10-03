<script lang="ts">
	import { t } from '$lib/i18n';
	// Live PromptPay: the order already exists (unpaid, hidden from riders). The
	// buyer transfers the server's total to the team and uploads the slip. The slip
	// is queued at once ("กำลังตรวจสลิป"); verify-slip checks it with SlipOK in the
	// background and the order goes to riders. This screen follows the check.
	import { untrack } from 'svelte';
	import * as api from '$lib/api/live';
	import { awaitingPayment, promptPayName, promptPayPayload } from '$lib/payments';
	import { nav } from '$lib/stores/nav.svelte';
	import { orders } from '$lib/stores/orders.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { isTestEnv } from '$lib/sim';
	import { friendlyError } from '$lib/supabase';
	import AppBar from './AppBar.svelte';
	import BottomBar from './BottomBar.svelte';
	import Icon from './Icon.svelte';
	import PromptPayQr from './PromptPayQr.svelte';

	const order = $derived(orders.current);
	const payable = $derived(!!order && awaitingPayment(order));

	let checking = $state(false);
	let slipInput = $state<HTMLInputElement>();

	// The slip queue: what the check has made of the latest slip
	let slip = $state<api.SlipStatus | null>(null);
	const waiting = $derived(slip?.status === 'QUEUED' || slip?.status === 'CHECKING');
	const underReview = $derived(slip?.status === 'NEEDS_REVIEW');
	const rejected = $derived(slip?.status === 'REJECTED');
	let lastKick = 0;

	async function onPaid() {
		if (!order) return;
		await orders.reload(order.id);
		toast.show(t('ตรวจสลิปผ่านแล้ว กำลังหาเพื่อนรับหิ้ว'), 'success');
		nav.reset('TRACKING', ['HOME', 'ORDERS']);
	}

	async function refreshSlip() {
		const id = order?.id;
		if (!id) return;
		try {
			slip = await api.fetchSlipStatus(id);
		} catch {
			return;
		}
		if (slip?.status === 'PAID') await onPaid();
		// A slip still waiting after 20 s: ask the function to run it again (safe to repeat)
		else if (slip?.status === 'QUEUED' && Date.now() - new Date(slip.created_at).getTime() > 20_000 && Date.now() - lastKick > 20_000) {
			lastKick = Date.now();
			void api.kickSlip(slip.id);
		}
	}

	$effect(() => {
		if (!order?.id) return;
		untrack(() => void refreshSlip());
		const timer = setInterval(() => {
			if (slip?.status === 'QUEUED' || slip?.status === 'CHECKING' || slip?.status === 'NEEDS_REVIEW') void refreshSlip();
		}, 3000);
		return () => clearInterval(timer);
	});

	// QR test mode: pay without a transfer. Test site only; the real database refuses it too (migration 20261101)
	let testMode = $state(false);
	let refreshingRiders = $state(false);

	$effect(() => {
		api.fetchAppFlags().then(
			(f) => (testMode = isTestEnv && f.payment_test_mode),
			() => (testMode = false)
		);
		void api.fetchRidersOnline().then(
			(n) => (orders.onlineRiders = n),
			() => {}
		);
	});

	async function checkRiders() {
		if (refreshingRiders) return;
		refreshingRiders = true;
		try {
			const count = await api.fetchRidersOnline();
			orders.onlineRiders = count;
			if (count > 0) {
				toast.show(t('มีคนหิ้วเปิดรับงานแล้ว ({count} คน) สร้าง QR Code เรียบร้อย', { count }), 'success');
			} else {
				toast.show(t('ยังไม่มีคนหิ้วเปิดรับงานในขณะนี้'), 'info');
			}
		} catch {
			toast.show(t('ตรวจสอบสถานะไม่สำเร็จ ลองใหม่อีกครั้ง'), 'error');
		} finally {
			refreshingRiders = false;
		}
	}

	async function payTest() {
		if (!order || checking) return;
		checking = true;
		try {
			await api.payOrderTest(order.id);
			await orders.reload(order.id);
			toast.show(t('ชำระแบบทดสอบแล้ว กำลังหาเพื่อนรับหิ้ว'), 'success');
			nav.reset('TRACKING', ['HOME', 'ORDERS']);
		} catch (err) {
			toast.show(friendlyError(err), 'error', { duration: 6000 });
			if (String(err).includes('TEST_MODE_OFF')) testMode = false;
		} finally {
			checking = false;
		}
	}

	async function onSlip(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file || !order || checking) return;
		checking = true;
		try {
			await api.verifySlip(order.id, file);
			toast.show(t('สร้างออเดอร์แล้ว รับสลิปแล้ว กำลังตรวจสลิป'), 'success');
			await refreshSlip();
		} catch (err) {
			toast.show(friendlyError(err), 'error', { duration: 6000 });
		} finally {
			checking = false;
			input.value = '';
		}
	}

	async function cancelOrder() {
		if (!order) return;
		await orders.cancel(order.id);
		nav.reset('ORDERS');
	}
</script>

<div class="flex flex-1 flex-col">
	<AppBar title={t('ชำระเงิน (PromptPay)')} onback={() => nav.reset('TRACKING', ['HOME', 'ORDERS'])} />

	{#if !order || !payable}
		<div class="flex flex-1 flex-col items-center justify-center px-8 text-center">
			<p class="text-sm font-medium text-slate-800">{order && order.paidAt ? t('ออเดอร์นี้ชำระแล้ว') : t('ไม่มีรายการที่รอชำระ')}</p>
			<button type="button" onclick={() => nav.reset(order ? 'TRACKING' : 'STORES')} class="mt-4 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white">
				{order ? t('ดูสถานะออเดอร์') : t('กลับไปเลือกร้าน')}
			</button>
		</div>
	{:else}
		<div class="flex-1 space-y-4 px-4 pt-4 pb-6">
			{#if testMode}
				<section class="rounded-2xl border border-amber-200 bg-amber-50 p-4" aria-label={t('โหมดทดสอบ')}>
					<p class="flex items-center gap-2 text-sm font-semibold text-amber-900"><Icon name="alert" class="h-4 w-4" />{t('โหมดทดสอบเปิดอยู่')}</p>
					<p class="mt-1 text-sm text-amber-900">{t('ทีมเปิดให้ลองสั่งโดยไม่ต้องโอนเงินจริง กด "จ่ายแบบทดสอบ" ออเดอร์จะไปหาเพื่อนรับหิ้วเหมือนจ่ายแล้ว')}</p>
					<button type="button" onclick={payTest} disabled={checking} class="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white text-sm font-semibold text-amber-900 active:bg-amber-100 disabled:opacity-60">
						{#if checking}<span class="h-4 w-4 animate-spin rounded-full border-2 border-amber-300 border-t-amber-900"></span>{/if}
						{t('จ่ายแบบทดสอบ ({totalPrice} ฿ ไม่โอนจริง)', { totalPrice: order.totalPrice })}
					</button>
				</section>
			{/if}
			{#if waiting}
				<section class="rounded-2xl border border-sky-200 bg-sky-50 p-4" role="status" aria-live="polite">
					<p class="flex items-center gap-2 text-sm font-semibold text-sky-900"><span class="h-4 w-4 animate-spin rounded-full border-2 border-sky-200 border-t-sky-700"></span>{t('สร้างออเดอร์แล้ว กำลังตรวจสลิป')}</p>
					<p class="mt-1 text-sm text-sky-900">{#if slip && slip.ahead > 0}{t('ตอนนี้มีคนส่งสลิปพร้อมกันเยอะ คุณอยู่คิวที่ {v}', { v: slip.ahead + 1 })} {:else}{t('รับสลิปแล้ว')} {/if}{t('ไม่ต้องโอนซ้ำ ปิดหน้านี้ได้ ระบบตรวจให้เอง ผ่านแล้วเพื่อนจะเห็นงานนี้ทันที')}</p>
				</section>
			{:else if underReview}
				<section class="rounded-2xl border border-amber-200 bg-amber-50 p-4" role="status" aria-live="polite">
					<p class="flex items-center gap-2 text-sm font-semibold text-amber-900"><Icon name="alert" class="h-4 w-4" />{t('ทีมงานกำลังตรวจสลิปให้')}</p>
					<p class="mt-1 text-sm text-amber-900">{t('ระบบตรวจอัตโนมัติไม่ได้ ทีมงานจะเทียบกับบัญชีธนาคารให้ ไม่ต้องโอนซ้ำ ผ่านแล้วเพื่อนจะเห็นงานนี้ทันที')}</p>
				</section>
			{:else if rejected && slip}
				<section class="rounded-2xl border border-red-200 bg-red-50 p-4" role="alert">
					<p class="flex items-center gap-2 text-sm font-semibold text-red-900"><Icon name="alert" class="h-4 w-4" />{t('สลิปนี้ยังไม่ผ่าน')}</p>
					<p class="mt-1 text-sm text-red-800">{friendlyError(new Error(slip.error ?? 'SLIP_INVALID'))}</p>
					<p class="mt-1 text-xs text-red-700">{slip.attempts_left > 0 ? t('แนบใหม่ได้อีก {attempts_left} ครั้ง', { attempts_left: slip.attempts_left }) : t('ส่งครบ 5 ครั้งแล้ว ติดต่อทีมงานให้ช่วยตรวจ')}</p>
				</section>
			{/if}
			<section class="rounded-2xl border border-slate-100 bg-white px-5 py-6 text-center">
				<span class="inline-flex items-center gap-1.5 rounded-md bg-promptpay px-3 py-1.5 text-xs font-semibold text-white">
					<span class="flex -space-x-1"><span class="h-2.5 w-2.5 rounded-full bg-sky-400"></span><span class="h-2.5 w-2.5 rounded-full bg-amber-400"></span></span>
					PromptPay
				</span>
				{#if orders.onlineRiders === 0 && !testMode}
					<div class="mt-4 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
						<div class="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
							<Icon name="alert" class="h-6 w-6" />
						</div>
						<p class="text-base font-bold text-red-900">{t('ไม่สามารถสร้าง QR Code ได้')}</p>
						<p class="mt-1 text-xs text-red-700">{t('ขณะนี้ไม่มีคนหิ้วเปิดรับงานในระบบ (0 คน) เพื่อป้องกันการโอนเงินโดยไม่มีคนส่ง ระบบจึงระงับการสร้าง QR Code ชำระเงินชั่วคราว')}</p>
						<p class="mt-2 text-[11px] text-slate-500">{t('ระบบจะสร้าง QR Code ให้ทันทีเมื่อมีคนหิ้วเปิดรับงาน')}</p>
						<button
							type="button"
							onclick={checkRiders}
							disabled={refreshingRiders}
							class="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm active:bg-slate-50 disabled:opacity-60"
						>
							<Icon name="refresh" class="h-3.5 w-3.5 {refreshingRiders ? 'animate-spin' : ''}" />
							{refreshingRiders ? t('กำลังตรวจสอบ...') : t('ตรวจสอบสถานะคนหิ้วอีกครั้ง')}
						</button>
					</div>
				{:else}
					<div class="mt-4">
						<PromptPayQr payload={promptPayPayload(order.totalPrice)} filename={`gooseman-${order.orderCode.replace('#', '')}.png`} />
					</div>
					{#if promptPayName}<p class="mt-3 text-xs text-slate-500">{t('โอนเข้า {promptPayName}', { promptPayName })}</p>{/if}
				{/if}
				<p class="mt-3 text-xs font-medium text-slate-500">{t('ยอดที่ต้องชำระ · {orderCode}', { orderCode: order.orderCode })}</p>
				<p class="text-3xl font-bold text-brand tabular-nums">{t('{v} ฿', { v: order.totalPrice.toFixed(2) })}</p>
			</section>

			<section class="rounded-2xl border border-dashed border-slate-300 p-4">
				<h2 class="text-sm font-semibold text-slate-900">{t('ขั้นตอนการชำระเงิน')}</h2>
				<ol class="mt-3 space-y-2.5 text-sm text-slate-600">
					{#each [t('สแกน QR ด้วยแอปธนาคาร ยอดเงินจะขึ้นให้เอง'), t('โอนเสร็จ กด "แนบสลิป" แล้วเลือกรูปสลิป'), t('ระบบตรวจสลิปอัตโนมัติ ผ่านแล้วเพื่อนจะเห็นงานนี้ทันที')] as step, i (step)}
						<li class="flex gap-3">
							<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand">{i + 1}</span>
							{step}
						</li>
					{/each}
				</ol>
				<p class="mt-3 text-xs text-slate-500">{t('ยังไม่มีเพื่อนเห็นออเดอร์นี้จนกว่าจะตรวจสลิปผ่าน')}</p>
			</section>

			<button type="button" onclick={cancelOrder} disabled={checking} class="mx-auto block text-sm text-slate-500 underline underline-offset-2">{t('ยกเลิกออเดอร์นี้')}</button>
		</div>

		<BottomBar>
			<button
				type="button"
				onclick={() => slipInput?.click()}
				disabled={checking || waiting || underReview || (rejected && (slip?.attempts_left ?? 0) <= 0) || (orders.onlineRiders === 0 && !testMode)}
				class="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-4 text-sm font-semibold text-white active:bg-brand-600 disabled:opacity-60 disabled:cursor-not-allowed"
			>
				{#if checking || waiting}
					<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span> {checking ? t('กำลังส่งสลิป...') : t('กำลังตรวจสลิป...')}
				{:else if underReview}
					{t('ทีมงานกำลังตรวจสลิปให้')}
				{:else if orders.onlineRiders === 0 && !testMode}
					{t('ไม่มีคนหิ้วเปิดรับงาน (ระงับชำระเงินชั่วคราว)')}
				{:else}
					<Icon name="upload" class="h-4 w-4" /> {t('แนบสลิปการโอน ({totalPrice} ฿)', { totalPrice: order.totalPrice })}
				{/if}
			</button>
			<input bind:this={slipInput} type="file" accept="image/*" class="sr-only" onchange={onSlip} aria-label={t('เลือกรูปสลิปการโอน')} />
		</BottomBar>
	{/if}
</div>
