<script lang="ts">
	import { assets } from '$app/paths';
	import Icon from '$lib/components/Icon.svelte';
	import { adminError } from '../api';
	import { consoleState as c } from '../console.svelte';
	import { ago, baht, clock, dateTime, phone } from '../format';
	import { ACTION_LABEL, ATTENTION_HELP, CANCEL_REASONS, describeDetail } from '../labels';
	import type { OrderDetail } from '../types';
	import AttentionChip from '../ui/AttentionChip.svelte';
	import CopyButton from '../ui/CopyButton.svelte';
	import Modal from '../ui/Modal.svelte';
	import StagePill from '../ui/StagePill.svelte';

	let { id, onclose, fullPage = false }: { id: string; onclose: () => void; fullPage?: boolean } = $props();

	let order = $state<OrderDetail | null>(null);
	let loadError = $state('');

	$effect(() => {
		void c.tick;
		const want = id;
		c.api
			?.order(want)
			.then((d) => {
				if (want === id) {
					order = d;
					loadError = '';
				}
			})
			.catch((err) => (loadError = adminError(err)));
	});

	type Dialog = 'cancel' | 'pay' | 'refund' | 'requeue' | 'unlock' | null;
	let dialog = $state<Dialog>(null);
	let busy = $state(false);
	let dialogError = $state('');
	let reason = $state('');
	let reasonOther = $state('');
	let ref = $state('');
	let checked = $state(false);

	function open(d: Dialog) {
		dialog = d;
		dialogError = '';
		reason = '';
		reasonOther = '';
		ref = '';
		checked = false;
	}

	const finalReason = $derived(reason === 'อื่นๆ' ? reasonOther.trim() : reason);

	async function run(action: () => Promise<unknown>, success: string) {
		busy = true;
		dialogError = '';
		try {
			await action();
			dialog = null;
			c.done(success);
			order = await c.api!.order(id);
		} catch (err) {
			dialogError = adminError(err);
		} finally {
			busy = false;
		}
	}

	const locked = $derived(!!order?.attention.some((a) => a.code === 'OTP_LOCKED'));
	const refundDue = $derived(!!order && order.status === 'CANCELLED' && !!order.paid_at && !order.refunded_at);
	const canCancel = $derived(!!order && order.status !== 'COMPLETED' && order.status !== 'CANCELLED');
	const img = (u: string) => (!u ? '' : /^(https?:|data:|\/)/.test(u) ? u : `${assets}/${u}`);

	const timeline = $derived.by(() => {
		if (!order) return [];
		const o = order;
		const steps: { label: string; at: string | null; by?: string }[] = [{ label: 'สั่งออเดอร์', at: o.created_at, by: o.customer ?? undefined }];
		if (o.payment === 'PROMPTPAY')
			steps.push({ label: o.payment_confirmed_by ? 'ชำระเงิน (ทีมยืนยันเอง)' : 'ชำระเงิน (ตรวจสลิปอัตโนมัติ)', at: o.paid_at, by: o.payment_confirmed_by ?? undefined });
		if (o.status === 'CANCELLED') {
			steps.push({ label: `ยกเลิก${o.cancel_reason ? ` · ${o.cancel_reason}` : ''}`, at: o.cancelled_at, by: o.cancelled_by ?? 'ผู้ซื้อ' });
			if (o.paid_at) steps.push({ label: o.refunded_at ? `คืนเงินแล้ว · อ้างอิง ${o.refund_ref}` : 'รอคืนเงิน', at: o.refunded_at });
		} else {
			steps.push({ label: 'คนหิ้วรับงาน', at: o.accepted_at, by: o.rider ?? undefined }, { label: 'รับของที่ร้านแล้ว', at: o.delivering_at }, { label: 'ส่งสำเร็จ (ยืนยัน OTP)', at: o.completed_at });
		}
		return steps;
	});
</script>

<div class="flex flex-col rounded-2xl border border-slate-100 bg-white {fullPage ? '' : 'h-full'}">
	<header class="flex items-start gap-3 border-b border-slate-100 p-4 sm:p-5">
		<button type="button" onclick={onclose} aria-label={fullPage ? 'กลับไปรายการออเดอร์' : 'ปิดรายละเอียด'} class="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100">
			<Icon name={fullPage ? 'chevron-left' : 'x'} class="h-5 w-5" />
		</button>
		<div class="min-w-0 flex-1">
			{#if order}
				<div class="flex flex-wrap items-center gap-2">
					<h2 class="text-xl font-bold tabular-nums">{order.code}</h2>
					<StagePill stage={order.stage} />
					<CopyButton value={order.code} label="คัดลอกรหัส" />
				</div>
				<p class="mt-0.5 text-sm text-slate-500">สั่งเมื่อ {dateTime(order.created_at)} · {ago(order.created_at)}</p>
			{:else}
				<div class="h-7 w-40 animate-pulse rounded bg-slate-100"></div>
			{/if}
		</div>
	</header>

	{#if loadError && !order}
		<p class="m-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{loadError}</p>
	{:else if !order}
		<div class="space-y-3 p-5">{#each Array(5) as _, i (i)}<div class="h-16 animate-pulse rounded-xl bg-slate-100"></div>{/each}</div>
	{:else}
		<div class="flex-1 space-y-4 p-4 sm:p-5 {fullPage ? '' : 'overflow-y-auto'}">
			{#each order.attention as a (a.code)}
				{@const help = ATTENTION_HELP[a.code]}
				<div class="rounded-xl p-3.5 {help.severe ? 'bg-red-50' : 'bg-amber-50'}">
					<AttentionChip attention={a} />
					<p class="mt-1 text-sm {help.severe ? 'text-red-800' : 'text-amber-900'}">{help.text}</p>
				</div>
			{/each}

			<section aria-label="ลำดับเหตุการณ์">
				<ol class="space-y-0">
					{#each timeline as s, i (s.label)}
						<li class="relative flex gap-3 pb-4 last:pb-0">
							{#if i < timeline.length - 1}<span class="absolute top-5 bottom-0 left-[9px] w-px {s.at ? 'bg-brand' : 'bg-slate-200'}"></span>{/if}
							<span class="relative z-10 mt-0.5 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full {s.at ? 'bg-brand text-white' : 'border-2 border-slate-200 bg-white'}">
								{#if s.at}<Icon name="check" class="h-3 w-3" strokeWidth={3} />{/if}
							</span>
							<div class="flex min-w-0 flex-1 justify-between gap-3 text-sm">
								<span class={s.at ? 'text-slate-900' : 'text-slate-400'}>{s.label}{#if s.at && s.by}<span class="text-slate-500"> · {s.by}</span>{/if}</span>
								{#if s.at}<span class="shrink-0 text-slate-500 tabular-nums">{clock(s.at)}</span>{/if}
							</div>
						</li>
					{/each}
				</ol>
			</section>

			<section class="grid gap-3 {fullPage ? 'sm:grid-cols-2' : ''}">
				{#each [{ who: 'ผู้ซื้อ', p: order.customer_info }, { who: 'คนหิ้ว', p: order.rider_info }] as { who, p } (who)}
					<div class="rounded-xl border border-slate-100 p-3.5">
						<p class="text-xs font-medium text-slate-500">{who}</p>
						{#if p}
							<p class="mt-1 font-semibold">{p.nickname} <span class="font-normal text-slate-500">· {p.full_name}</span></p>
							<p class="text-xs text-slate-500">{[p.faculty, p.level].filter(Boolean).join(' · ')}{#if p.holding !== undefined} · ถืออยู่ {p.holding}/4 งาน{/if}</p>
							{#if p.phone}
								<div class="mt-2 flex items-center gap-1">
									<a href="tel:{p.phone}" class="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-50 px-3 text-sm font-medium whitespace-nowrap text-brand-700 tabular-nums"><Icon name="phone" class="h-4 w-4" />{phone(p.phone)}</a>
									<CopyButton value={p.phone} />
								</div>
							{/if}
						{:else}
							<p class="mt-1 text-sm text-slate-500">ยังไม่มีคนรับงาน</p>
						{/if}
					</div>
				{/each}
			</section>

			<section class="rounded-xl border border-slate-100 p-3.5">
				<div class="flex items-center gap-3">
					{#if order.store?.image_url}<img src={img(order.store.image_url)} alt="" class="h-11 w-11 rounded-lg object-cover" />{/if}
					<div class="min-w-0 text-sm">
						<p class="truncate font-semibold">{order.pickup}</p>
						{#if order.store?.lock}<p class="text-xs text-slate-500">{order.store.lock}</p>{/if}
					</div>
				</div>
				<p class="mt-2 flex items-center gap-2 text-sm"><Icon name="pin" class="h-4 w-4 text-brand" />ส่งที่ <span class="font-medium">{order.dropoff}</span></p>
				{#if order.note}<p class="mt-2 rounded-lg bg-slate-50 p-2.5 text-sm text-slate-700">"{order.note}"</p>{/if}
			</section>

			<section class="rounded-xl border border-slate-100 p-3.5 text-sm">
				<ul class="space-y-1.5">
					{#each order.items as it, i (i)}
						<li class="flex justify-between gap-3"><span>{it.name} × {it.quantity}</span><span class="tabular-nums">{baht(it.price * it.quantity)}</span></li>
					{/each}
				</ul>
				<div class="mt-3 space-y-1 border-t border-slate-100 pt-3 text-slate-600">
					<p class="flex justify-between"><span>ค่าอาหาร</span><span class="tabular-nums">{baht(order.food_total)}</span></p>
					<p class="flex justify-between"><span>ค่าหิ้ว</span><span class="tabular-nums">{baht(order.delivery_fee)}</span></p>
					{#if order.code_discount}<p class="flex justify-between"><span>ส่วนลดโค้ด {order.promo_code ?? ''}</span><span class="text-fresh-700 tabular-nums">-{baht(order.code_discount)}</span></p>{/if}
					{#if order.partner_discount}<p class="flex justify-between"><span>ส่วนลดโปรร้าน</span><span class="text-fresh-700 tabular-nums">-{baht(order.partner_discount)}</span></p>{/if}
					<p class="flex justify-between pt-1 text-base font-bold text-slate-900"><span>ยอดสุทธิ</span><span class="tabular-nums">{baht(order.total)}</span></p>
					<p class="flex justify-between"><span>วิธีจ่าย</span><span>{order.payment === 'CASH' ? 'เงินสดปลายทาง' : 'PromptPay'}</span></p>
					{#if order.payment === 'PROMPTPAY'}
						<p class="flex justify-between gap-3"><span>สถานะการจ่าย</span><span class="text-right">{order.paid_at ? `ชำระ ${clock(order.paid_at)}` : 'ยังไม่ชำระ'}</span></p>
						{#if order.slip_ref}<p class="flex justify-between gap-3"><span>อ้างอิงสลิป</span><span class="truncate text-right tabular-nums">{order.slip_ref}</span></p>{/if}
					{/if}
					<p class="flex justify-between"><span>OTP</span><span class={order.otp_failed >= 5 ? 'font-medium text-red-600' : ''}>กรอกผิด {order.otp_failed}/5 ครั้ง</span></p>
				</div>
			</section>

			{#if order.activity.length}
				<section>
					<p class="mb-2 text-xs font-medium text-slate-500">ทีมงานทำอะไรกับออเดอร์นี้</p>
					<ul class="space-y-1.5 text-sm">
						{#each order.activity as a, i (i)}
							<li class="flex gap-2"><span class="shrink-0 text-slate-500 tabular-nums">{clock(a.at)}</span><span><span class="font-medium">{a.by}</span> {ACTION_LABEL[a.action] ?? a.action}{#if describeDetail(a.detail)}<span class="text-slate-500"> · {describeDetail(a.detail)}</span>{/if}</span></li>
						{/each}
					</ul>
				</section>
			{/if}
		</div>

		<footer class="border-t border-slate-100 bg-white p-4 {fullPage ? 'sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] rounded-b-2xl md:bottom-0' : ''}">
			<div class="flex flex-wrap gap-2">
				{#if locked}<button type="button" onclick={() => open('unlock')} class="h-11 flex-1 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-600"><Icon name="unlock" class="mr-1 inline h-4 w-4" />ปลดล็อก OTP</button>{/if}
				{#if order.stage === 'AWAITING_PAYMENT'}<button type="button" onclick={() => open('pay')} class="h-11 flex-1 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-600">ยืนยันรับเงินเอง</button>{/if}
				{#if refundDue}<button type="button" onclick={() => open('refund')} class="h-11 flex-1 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-600">บันทึกคืนเงินแล้ว</button>{/if}
				{#if order.status === 'ACCEPTED'}<button type="button" onclick={() => open('requeue')} class="h-11 flex-1 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">คืนงานเข้าคิว</button>{/if}
				{#if canCancel}<button type="button" onclick={() => open('cancel')} class="h-11 flex-1 rounded-xl border border-red-200 px-4 text-sm font-medium text-red-600 hover:bg-red-50">ยกเลิกออเดอร์</button>{/if}
				{#if !locked && order.stage !== 'AWAITING_PAYMENT' && !refundDue && order.status !== 'ACCEPTED' && !canCancel}
					<p class="py-2 text-sm text-slate-500">ออเดอร์นี้ไม่มีอะไรต้องทำเพิ่ม</p>
				{/if}
			</div>
		</footer>

		<Modal open={dialog === 'cancel'} title="ยกเลิกออเดอร์ {order.code}?" onclose={() => (dialog = null)} confirmLabel="ยกเลิกออเดอร์" danger {busy} disabled={!finalReason} error={dialogError}
			onconfirm={() => run(() => c.api!.cancelOrder(order!.id, finalReason), `ยกเลิก ${order!.code} แล้ว`)}>
			<p>{order.pickup} · {order.customer} · {baht(order.total)}</p>
			{#if order.paid_at}<p class="mt-3 rounded-xl bg-amber-50 p-3 text-amber-900">ผู้ซื้อจ่ายแล้ว {baht(order.total)} ต้องคืนเงินหลังยกเลิก ออเดอร์นี้จะไปอยู่ในแท็บ "คืนเงินผู้ซื้อ" ของหน้าการเงิน</p>{/if}
			{#if order.status === 'DELIVERING'}<p class="mt-3 rounded-xl bg-red-50 p-3 text-red-800">คนหิ้วจ่ายค่าอาหารให้ร้านไปแล้ว ตกลงกับคนหิ้วก่อนยกเลิก</p>{/if}
			<fieldset class="mt-4">
				<legend class="mb-2 font-medium text-slate-900">เหตุผล</legend>
				<div class="grid gap-2">
					{#each [...CANCEL_REASONS, 'อื่นๆ'] as r (r)}
						<label class="flex h-11 cursor-pointer items-center gap-3 rounded-xl border px-3.5 {reason === r ? 'border-brand bg-brand-50' : 'border-slate-200'}">
							<input type="radio" name="cancel-reason" value={r} bind:group={reason} class="accent-brand" />{r}
						</label>
					{/each}
				</div>
				{#if reason === 'อื่นๆ'}<input bind:value={reasonOther} maxlength="120" placeholder="พิมพ์เหตุผล" class="mt-2 h-11 w-full rounded-xl bg-slate-100 px-3.5 outline-none focus:ring-2 focus:ring-brand" />{/if}
			</fieldset>
		</Modal>

		<Modal open={dialog === 'pay'} title="ยืนยันว่าได้รับเงินแล้ว" onclose={() => (dialog = null)} confirmLabel="ยืนยันรับเงิน" {busy} disabled={!ref.trim() || !checked} error={dialogError}
			onconfirm={() => run(() => c.api!.confirmPayment(order!.id, ref), `ยืนยันรับเงิน ${order!.code} แล้ว`)}>
			<p class="text-slate-500">ใช้เมื่อผู้ซื้อโอนแล้ว แต่ระบบตรวจสลิปอัตโนมัติไม่ผ่าน</p>
			<p class="mt-3 text-3xl font-bold text-slate-900 tabular-nums">{baht(order.total)}</p>
			<p class="text-slate-600">{order.customer_info?.nickname} · {phone(order.customer_info?.phone)}</p>
			<label class="mt-4 block">
				<span class="mb-1 block font-medium text-slate-900">เลขอ้างอิงจากแอปธนาคาร</span>
				<input bind:value={ref} maxlength="60" placeholder="เช่น 2026092612041234" class="h-11 w-full rounded-xl bg-slate-100 px-3.5 outline-none focus:ring-2 focus:ring-brand" />
			</label>
			<label class="mt-3 flex items-start gap-3"><input type="checkbox" bind:checked class="mt-1 h-5 w-5 accent-brand" />ตรวจในแอปธนาคารแล้วว่าเงินเข้าบัญชีทีมครบ {baht(order.total)}</label>
		</Modal>

		<Modal open={dialog === 'refund'} title="บันทึกว่าคืนเงินแล้ว" onclose={() => (dialog = null)} confirmLabel="บันทึกคืนเงินแล้ว" {busy} disabled={!ref.trim()} error={dialogError}
			onconfirm={() => run(() => c.api!.markRefunded(order!.id, ref), `บันทึกคืนเงิน ${order!.code} แล้ว`)}>
			<p class="text-3xl font-bold text-slate-900 tabular-nums">{baht(order.total)}</p>
			<p class="text-slate-600">คืนให้ {order.customer_info?.nickname}</p>
			{#if order.customer_info?.promptpay}<p class="mt-2 flex items-center gap-1">PromptPay {phone(order.customer_info.promptpay)}<CopyButton value={order.customer_info.promptpay} /></p>{/if}
			<label class="mt-4 block">
				<span class="mb-1 block font-medium text-slate-900">เลขอ้างอิงการโอน</span>
				<input bind:value={ref} maxlength="60" class="h-11 w-full rounded-xl bg-slate-100 px-3.5 outline-none focus:ring-2 focus:ring-brand" />
			</label>
		</Modal>

		<Modal open={dialog === 'requeue'} title="คืนงาน {order.code} เข้าคิว?" onclose={() => (dialog = null)} confirmLabel="คืนงานเข้าคิว" {busy} disabled={!reasonOther.trim()} error={dialogError}
			onconfirm={() => run(() => c.api!.requeueOrder(order!.id, reasonOther), `คืนงาน ${order!.code} เข้าคิวแล้ว`)}>
			<p>งานจะออกจากมือ {order.rider} แล้วกลับไปรอคนหิ้วคนอื่นรับ ใช้เมื่อคนหิ้วยังไม่ได้ซื้อของ</p>
			<label class="mt-4 block">
				<span class="mb-1 block font-medium text-slate-900">เหตุผล</span>
				<input bind:value={reasonOther} maxlength="120" placeholder="เช่น คนหิ้วติดเรียน" class="h-11 w-full rounded-xl bg-slate-100 px-3.5 outline-none focus:ring-2 focus:ring-brand" />
			</label>
		</Modal>

		<Modal open={dialog === 'unlock'} title="ปลดล็อก OTP ของ {order.code}?" onclose={() => (dialog = null)} confirmLabel="ปลดล็อก OTP" {busy} error={dialogError}
			onconfirm={() => run(() => c.api!.unlockOtp(order!.id), `ปลดล็อก OTP ${order!.code} แล้ว`)}>
			<p>คนหิ้วจะกรอก OTP ได้อีก 5 ครั้ง ก่อนปลดล็อก ให้โทรถามผู้ซื้อว่าได้ของครบแล้วจริง</p>
		</Modal>
	{/if}
</div>
