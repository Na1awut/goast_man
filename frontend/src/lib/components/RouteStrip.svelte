<script lang="ts">
	import type { Order } from '$lib/types';
	import Goose from './Goose.svelte';
	import { awaitingPayment } from '$lib/payments';
	import Icon from './Icon.svelte';

	// The goose walks the real route: counter → building. Position comes only from
	// order state and the stated ETA, and never reaches the door before the OTP.
	let { order }: { order: Order } = $props();

	const ETA_MINUTES = 8;

	let now = $state(Date.now());
	$effect(() => {
		if (order.status !== 'DELIVERING') return;
		const id = setInterval(() => (now = Date.now()), 5000);
		return () => clearInterval(id);
	});

	const elapsedMin = $derived(order.deliveringAt ? (now - new Date(order.deliveringAt).getTime()) / 60000 : 0);
	const minutesLeft = $derived(Math.max(1, Math.ceil(ETA_MINUTES - elapsedMin)));

	/** 0 = at the counter, 1 = at the drop-off */
	const progress = $derived.by(() => {
		switch (order.status) {
			case 'PENDING':
			case 'CANCELLED':
				return 0;
			case 'ACCEPTED':
				return 0.06;
			case 'DELIVERING':
				return 0.22 + 0.63 * Math.min(1, elapsedMin / ETA_MINUTES);
			case 'COMPLETED':
				return 1;
		}
	});

	const pose = $derived(
		order.status === 'DELIVERING' ? 'walk' : order.status === 'COMPLETED' ? 'hop' : order.status === 'CANCELLED' ? 'idle' : 'wait'
	);

	const rider = $derived(order.rider?.name ?? 'เพื่อน');
	const line = $derived(
		{
			PENDING: awaitingPayment(order) ? 'รอชำระเงินก่อน แล้วน้องห่านจะหาเพื่อนให้' : 'น้องห่านกำลังหาเพื่อนที่อยู่ใกล้ร้าน',
			ACCEPTED: `${rider} ต่อคิวซื้อให้อยู่ที่ร้าน`,
			DELIVERING: `${rider} หิ้วของเดินมาแล้ว อีกราว ${minutesLeft} นาที`,
			COMPLETED: 'ถึงมือแล้ว ขอให้อร่อย',
			CANCELLED: 'ออเดอร์นี้ยกเลิกแล้ว'
		}[order.status]
	);
</script>

<section class="overflow-hidden rounded-2xl border border-slate-100 bg-white" aria-label="เส้นทางการส่ง">
	<div class="relative px-4 pt-5 pb-3">
		<!-- Track: the goose's box is inset so 100% lands exactly on the pin -->
		<div class="relative h-[72px]">
			<!-- route line -->
			<div class="absolute right-5 bottom-3 left-5 h-0.5 border-t-2 border-dashed border-slate-200"></div>
			<div
				class="absolute bottom-3 left-5 h-0.5 origin-left bg-brand transition-transform duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]"
				style="width: calc(100% - 2.5rem); transform: scaleX({progress})"
			></div>
			<!-- ends -->
			<span class="absolute bottom-0 left-0 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white" title={order.pickupName}>
				<Icon name="store" class="h-3.5 w-3.5" />
			</span>
			<span class="absolute right-0 bottom-0 flex h-7 w-7 items-center justify-center rounded-full {order.status === 'COMPLETED' ? 'bg-fresh' : 'bg-brand'} text-white" title={order.dropoffName}>
				<Icon name={order.status === 'COMPLETED' ? 'check' : 'pin'} class="h-3.5 w-3.5" strokeWidth={2.5} />
			</span>
			<!-- goose rides a full-width layer translated by progress -->
			<div class="pointer-events-none absolute inset-y-0 right-14 left-7">
				<div
					class="absolute bottom-4 left-0 w-full transition-transform duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] {order.status === 'CANCELLED' ? 'opacity-40 grayscale' : ''}"
					style="transform: translateX({progress * 100}%)"
				>
					<Goose {pose} class="w-16" />
				</div>
			</div>
		</div>
		<div class="mt-1 flex justify-between gap-4 text-[11px] text-slate-500">
			<span class="truncate">{order.pickupName}</span>
			<span class="truncate text-right">{order.dropoffName}</span>
		</div>
	</div>
	<p class="border-t border-slate-100 bg-slate-50/70 px-4 py-2.5 text-sm font-medium text-slate-800" aria-live="polite">{line}</p>
</section>
