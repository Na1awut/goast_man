<script lang="ts">
	import { t } from '$lib/i18n';
	import AppBar from '$lib/components/AppBar.svelte';
	import BottomBar from '$lib/components/BottomBar.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import MockQr from '$lib/components/MockQr.svelte';
	import LivePayment from '$lib/components/LivePayment.svelte';
	import { isLive } from '$lib/supabase';
	import { cart } from '$lib/stores/cart.svelte';
	import { checkout } from '$lib/stores/checkout.svelte';
	import { nav } from '$lib/stores/nav.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { orders, OrderError } from '$lib/stores/orders.svelte';
	import { formatBaht } from '$lib/utils';

	const PAY_WINDOW_SECONDS = 10 * 60;

	let secondsLeft = $state(PAY_WINDOW_SECONDS);
	let verifying = $state(false);
	let qrBox = $state<HTMLDivElement>();

	const ready = $derived(!cart.isEmpty && !!checkout.reference);
	const mmss = $derived(`${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`);

	$effect(() => {
		if (!ready) return;
		const timer = setInterval(() => {
			secondsLeft -= 1;
			if (secondsLeft <= 0) {
				clearInterval(timer);
				toast.show(t('หมดเวลาชำระเงิน กรุณาทำรายการใหม่'), 'error');
				nav.back();
			}
		}, 1000);
		return () => clearInterval(timer);
	});

	function saveQr() {
		const svg = qrBox?.querySelector('svg');
		if (!svg) return;
		const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
		const url = URL.createObjectURL(blob);
		const a = Object.assign(document.createElement('a'), { href: url, download: `gooseman-${checkout.reference}.svg` });
		a.click();
		URL.revokeObjectURL(url);
		toast.show(t('บันทึก QR Code แล้ว'), 'success');
	}

	/** Simulated bank confirmation round trip, then the cart becomes an order */
	function confirmPaid() {
		if (verifying) return;
		verifying = true;
		setTimeout(async () => {
			try {
				if (await checkout.place()) nav.reset('TRACKING');
			} catch (err) {
				toast.show(err instanceof OrderError ? err.message : t('สั่งไม่สำเร็จ ลองใหม่อีกครั้ง'), 'error', { duration: 5000 });
			} finally {
				verifying = false;
			}
		}, 1200);
	}

	function onSlip(e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		toast.show(t('แนบสลิป {name} แล้ว กำลังตรวจสอบ', { name: file.name }), 'info');
		confirmPaid();
	}
</script>

<!-- Live: real QR for an order already placed, checked by slip. Demo: mock QR, the order is placed on confirm -->
{#if isLive}
	<LivePayment />
{:else}
<div class="flex flex-1 flex-col">
	<AppBar title={t('ชำระเงิน (PromptPay QR)')} />

	{#if !ready}
		<div class="flex flex-1 flex-col items-center justify-center px-8 text-center">
			<p class="text-sm font-medium text-slate-800">{t('ไม่มีรายการที่รอชำระ')}</p>
			<button type="button" onclick={() => nav.reset('STORES')} class="mt-4 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white">{t('กลับไปเลือกร้าน')}</button>
		</div>
	{:else}
		<div class="flex-1 space-y-4 px-4 pt-4 pb-6">
			<p class="mx-auto flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-sm {secondsLeft <= 60 ? 'bg-red-50 text-red-700' : 'bg-brand-50 text-slate-700'}">
				<Icon name="clock" class="h-4 w-4 text-brand" />
				{t('กรุณาชำระเงินภายใน')} <span class="font-semibold text-brand tabular-nums">{mmss}</span> {t('นาที')}
			</p>

			<section class="rounded-2xl border border-slate-100 bg-white px-5 py-6 text-center">
				<span class="inline-flex items-center gap-1.5 rounded-md bg-promptpay px-3 py-1.5 text-xs font-semibold text-white">
					<span class="flex -space-x-1"><span class="h-2.5 w-2.5 rounded-full bg-sky-400"></span><span class="h-2.5 w-2.5 rounded-full bg-amber-400"></span></span>
					PromptPay
				</span>
				{#if orders.onlineRiders === 0}
					<div class="mt-4 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
						<div class="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
							<Icon name="alert" class="h-6 w-6" />
						</div>
						<p class="text-base font-bold text-red-900">{t('ไม่สามารถสร้าง QR Code ได้')}</p>
						<p class="mt-1 text-xs text-red-700">{t('ขณะนี้ไม่มีคนหิ้วเปิดรับงานในระบบ (0 คน) จึงระงับการสร้าง QR Code ชำระเงินชั่วคราว')}</p>
					</div>
				{:else}
					<div class="mx-auto mt-4 w-fit border border-slate-100 p-2" bind:this={qrBox}>
						<MockQr seed={`${checkout.reference}-${checkout.total}`} size={184} />
					</div>
					<p class="mt-3 text-xs text-slate-500">{t('Goose Man Escrow · อ้างอิง {reference}', { reference: checkout.reference })}</p>
					<p class="mt-3 text-xs font-medium text-slate-500">{t('ยอดเงินที่ต้องชำระ')}</p>
					<p class="text-3xl font-bold text-brand tabular-nums">{t('{v} ฿', { v: checkout.total.toFixed(2) })}</p>
					<div class="mt-4 border-t border-slate-100 pt-4">
						<button type="button" onclick={saveQr} class="inline-flex items-center gap-1.5 text-sm font-medium text-brand underline underline-offset-4">
							<Icon name="download" class="h-4 w-4" /> {t('บันทึกภาพ QR Code ลงเครื่อง')}
						</button>
					</div>
				{/if}
			</section>

			<section class="rounded-2xl border border-dashed border-slate-300 p-4">
				<h2 class="text-sm font-semibold text-slate-900">{t('ขั้นตอนการชำระเงิน')}</h2>
				<ol class="mt-3 space-y-2.5 text-sm text-slate-600">
					{#each [t('สแกน QR ผ่านแอปธนาคารใดก็ได้'), t('ระบบตรวจสอบยอดเงินอัตโนมัติ ไม่ต้องส่งสลิป'), t('เงินพักไว้ในระบบ จะโอนให้เพื่อนเมื่อคุณยืนยัน OTP')] as step, i (step)}
						<li class="flex gap-3">
							<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand">{i + 1}</span>
							{step}
						</li>
					{/each}
				</ol>
			</section>

			<label class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-brand py-3.5 text-sm font-medium text-brand active:bg-brand-50">
				<Icon name="upload" class="h-4 w-4" /> {t('แนบสลิปการโอนเงิน (หากระบบไม่อัปเดต)')}
				<input type="file" accept="image/*" class="sr-only" onchange={onSlip} disabled={verifying || orders.onlineRiders === 0} />
			</label>
		</div>

		<BottomBar>
			<button
				type="button"
				onclick={confirmPaid}
				disabled={verifying || orders.onlineRiders === 0}
				class="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-4 text-sm font-semibold text-white active:bg-brand-600 disabled:opacity-60 disabled:cursor-not-allowed"
			>
				{#if verifying}
					<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span> {t('กำลังตรวจสอบการชำระเงิน...')}
				{:else if orders.onlineRiders === 0}
					{t('ไม่มีคนหิ้วเปิดรับงานในขณะนี้')}
				{:else}
					{t('ยืนยันการชำระเงินและค้นหาเพื่อนหิ้ว ({v})', { v: formatBaht(checkout.total) })}
				{/if}
			</button>
		</BottomBar>
	{/if}
</div>
{/if}
