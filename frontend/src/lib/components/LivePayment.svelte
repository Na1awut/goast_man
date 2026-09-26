<script lang="ts">
	// Live PromptPay: the order already exists (unpaid, hidden from riders). The
	// buyer transfers the server's total to the team and uploads the slip; the
	// verify-slip function checks it with SlipOK and the order goes to riders.
	import * as api from '$lib/api/live';
	import { awaitingPayment, promptPayName, promptPayPayload } from '$lib/payments';
	import { nav } from '$lib/stores/nav.svelte';
	import { orders } from '$lib/stores/orders.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { friendlyError } from '$lib/supabase';
	import AppBar from './AppBar.svelte';
	import BottomBar from './BottomBar.svelte';
	import Icon from './Icon.svelte';
	import PromptPayQr from './PromptPayQr.svelte';

	const order = $derived(orders.current);
	const payable = $derived(!!order && awaitingPayment(order));

	let checking = $state(false);
	let slipInput = $state<HTMLInputElement>();

	async function onSlip(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file || !order || checking) return;
		checking = true;
		try {
			await api.verifySlip(order.id, file);
			await orders.reload(order.id);
			toast.show('ตรวจสลิปผ่านแล้ว กำลังหาเพื่อนรับหิ้ว', 'success');
			nav.reset('TRACKING', ['HOME', 'ORDERS']);
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
	<AppBar title="ชำระเงิน (PromptPay)" onback={() => nav.reset('TRACKING', ['HOME', 'ORDERS'])} />

	{#if !order || !payable}
		<div class="flex flex-1 flex-col items-center justify-center px-8 text-center">
			<p class="text-sm font-medium text-slate-800">{order && order.paidAt ? 'ออเดอร์นี้ชำระแล้ว' : 'ไม่มีรายการที่รอชำระ'}</p>
			<button type="button" onclick={() => nav.reset(order ? 'TRACKING' : 'STORES')} class="mt-4 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white">
				{order ? 'ดูสถานะออเดอร์' : 'กลับไปเลือกร้าน'}
			</button>
		</div>
	{:else}
		<div class="flex-1 space-y-4 px-4 pt-4 pb-6">
			<section class="rounded-2xl border border-slate-100 bg-white px-5 py-6 text-center">
				<span class="inline-flex items-center gap-1.5 rounded-md bg-promptpay px-3 py-1.5 text-xs font-semibold text-white">
					<span class="flex -space-x-1"><span class="h-2.5 w-2.5 rounded-full bg-sky-400"></span><span class="h-2.5 w-2.5 rounded-full bg-amber-400"></span></span>
					PromptPay
				</span>
				<div class="mt-4">
					<PromptPayQr payload={promptPayPayload(order.totalPrice)} filename={`gooseman-${order.orderCode.replace('#', '')}.png`} />
				</div>
				{#if promptPayName}<p class="mt-3 text-xs text-slate-500">โอนเข้า {promptPayName}</p>{/if}
				<p class="mt-3 text-xs font-medium text-slate-500">ยอดที่ต้องชำระ · {order.orderCode}</p>
				<p class="text-3xl font-bold text-brand tabular-nums">{order.totalPrice.toFixed(2)} ฿</p>
			</section>

			<section class="rounded-2xl border border-dashed border-slate-300 p-4">
				<h2 class="text-sm font-semibold text-slate-900">ขั้นตอนการชำระเงิน</h2>
				<ol class="mt-3 space-y-2.5 text-sm text-slate-600">
					{#each ['สแกน QR ด้วยแอปธนาคาร ยอดเงินจะขึ้นให้เอง', 'โอนเสร็จ กด "แนบสลิป" แล้วเลือกรูปสลิป', 'ระบบตรวจสลิปอัตโนมัติ ผ่านแล้วเพื่อนจะเห็นงานนี้ทันที'] as step, i (step)}
						<li class="flex gap-3">
							<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand">{i + 1}</span>
							{step}
						</li>
					{/each}
				</ol>
				<p class="mt-3 text-xs text-slate-500">ยังไม่มีเพื่อนเห็นออเดอร์นี้จนกว่าจะตรวจสลิปผ่าน</p>
			</section>

			<button type="button" onclick={cancelOrder} disabled={checking} class="mx-auto block text-sm text-slate-500 underline underline-offset-2">ยกเลิกออเดอร์นี้</button>
		</div>

		<BottomBar>
			<button type="button" onclick={() => slipInput?.click()} disabled={checking} class="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-4 text-sm font-semibold text-white active:bg-brand-600 disabled:opacity-80">
				{#if checking}
					<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span> กำลังตรวจสลิป...
				{:else}
					<Icon name="upload" class="h-4 w-4" /> แนบสลิปการโอน ({order.totalPrice} ฿)
				{/if}
			</button>
			<input bind:this={slipInput} type="file" accept="image/*" class="sr-only" onchange={onSlip} aria-label="เลือกรูปสลิปการโอน" />
		</BottomBar>
	{/if}
</div>
