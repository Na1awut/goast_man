<script lang="ts">
	import { onMount } from 'svelte';
	import AppBar from '$lib/components/AppBar.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import type { RiderEarning } from '$lib/types';
	import { auth } from '$lib/stores/auth.svelte';
	import { nav } from '$lib/stores/nav.svelte';
	import { rider } from '$lib/stores/rider.svelte';
	import { formatBaht, formatRelativeDate } from '$lib/utils';

	onMount(() => void rider.loadEarnings());

	/** Where the team sends the money: the PromptPay number, or the phone when none is set */
	const payTo = $derived(auth.user?.promptPayNo || auth.user?.phoneNumber || '');

	const pending = $derived(rider.earnings.filter((e) => e.owed > 0 && !e.paidOutAt));
	const settled = $derived(rider.earnings.filter((e) => e.owed === 0 || e.paidOutAt));

	/** One line on why this job owes what it owes */
	function why(e: RiderEarning): string {
		const tip = e.tip ? ` + ทิป ${formatBaht(e.tip)}` : '';
		if (e.paymentMethod === 'PROMPTPAY') return `ค่าอาหาร ${formatBaht(e.foodTotal)} ที่ออกไปก่อน + ค่าหิ้ว ${formatBaht(e.deliveryFee)}${tip}`;
		if (e.owed > 0) return `เก็บเงินสด ${formatBaht(e.totalPrice)} แล้ว ทีมจ่ายส่วนลดที่ลูกค้าไม่ได้จ่ายให้`;
		return `เก็บเงินสด ${formatBaht(e.totalPrice)} แล้ว ได้ค่าหิ้ว ${formatBaht(e.deliveryFee)}${tip} ไปในนั้น`;
	}
</script>

{#snippet row(e: RiderEarning)}
	<li class="flex gap-3 px-4 py-3">
		<div class="min-w-0 flex-1">
			<p class="flex items-baseline gap-2">
				<span class="text-sm font-semibold text-slate-900">{e.orderCode}</span>
				<span class="truncate text-xs text-slate-500">{formatRelativeDate(e.completedAt)}</span>
			</p>
			<p class="truncate text-xs text-slate-500">{e.pickupName} → {e.dropoffName}</p>
			<p class="mt-0.5 text-xs text-slate-600">{why(e)}</p>
			{#if e.paidOutAt}
				<p class="mt-0.5 text-xs text-fresh-700">โอนแล้ว {formatRelativeDate(e.paidOutAt)}{e.payoutRef ? ` · อ้างอิง ${e.payoutRef}` : ''}</p>
			{/if}
		</div>
		<p class="shrink-0 text-right text-sm font-semibold tabular-nums {e.owed > 0 && !e.paidOutAt ? 'text-slate-900' : 'text-slate-400'}">
			{e.owed > 0 ? formatBaht(e.owed) : '—'}
		</p>
	</li>
{/snippet}

<div class="flex flex-1 flex-col">
	<AppBar title="รายได้คนหิ้ว" />

	<div class="space-y-5 px-4 pt-4 pb-8">
		<section class="rounded-2xl bg-brand p-4 text-white">
			<p class="text-sm text-white/85">ทีมยังต้องโอนให้คุณ</p>
			<p class="mt-0.5 text-3xl font-semibold tabular-nums">{formatBaht(rider.unpaid.amount)}</p>
			<p class="mt-1 text-xs text-white/85">{rider.unpaid.jobs} งาน · โอนเข้า PromptPay {payTo || 'ยังไม่ได้ใส่'}</p>
			<button type="button" onclick={() => nav.go('EDIT_PROFILE')} class="mt-3 inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium">
				<Icon name="qr" class="h-3.5 w-3.5" />{auth.user?.promptPayNo ? 'เปลี่ยนเลข PromptPay' : 'ใส่เลข PromptPay'}
			</button>
		</section>

		<section class="grid grid-cols-2 divide-x divide-slate-100 rounded-2xl border border-slate-100 bg-white py-4 text-center">
			<div class="px-2">
				<p class="text-base font-semibold text-slate-900 tabular-nums">{rider.today.jobs} งาน · {formatBaht(rider.today.fees)}</p>
				<p class="text-xs text-slate-500">ส่งวันนี้ · ค่าหิ้ว</p>
			</div>
			<div class="px-2">
				<p class="text-base font-semibold text-slate-900 tabular-nums">{formatBaht(rider.paidOut)}</p>
				<p class="text-xs text-slate-500">ทีมโอนแล้ว (30 วัน)</p>
			</div>
		</section>

		{#if !rider.earningsLoaded}
			<div class="space-y-2">{#each Array(3) as _, i (i)}<div class="h-16 animate-pulse rounded-2xl bg-slate-100"></div>{/each}</div>
		{:else if rider.earnings.length === 0}
			<p class="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">ยังไม่มีงานที่ส่งสำเร็จใน 30 วันนี้</p>
		{:else}
			{#if pending.length}
				<section>
					<h2 class="mb-2 text-base font-semibold text-slate-900">รอทีมโอน</h2>
					<ul class="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white">
						{#each pending as e (e.id)}{@render row(e)}{/each}
					</ul>
				</section>
			{/if}
			{#if settled.length}
				<section>
					<h2 class="mb-2 text-base font-semibold text-slate-900">เรียบร้อยแล้ว</h2>
					<ul class="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white">
						{#each settled as e (e.id)}{@render row(e)}{/each}
					</ul>
				</section>
			{/if}
		{/if}

		<section class="rounded-2xl border border-slate-100 bg-white p-4 text-xs leading-relaxed text-slate-600">
			<p class="mb-1 text-sm font-semibold text-slate-900">ทีมโอนเท่าไร</p>
			<p><span class="font-medium text-slate-800">ลูกค้าจ่าย PromptPay:</span> เงินเข้าบัญชีทีม คุณออกค่าอาหารไปก่อน ทีมโอนคืนค่าอาหาร + ค่าหิ้ว</p>
			<p class="mt-1"><span class="font-medium text-slate-800">ลูกค้าจ่ายเงินสด:</span> คุณได้ค่าอาหารและค่าหิ้วจากลูกค้าแล้ว ทีมโอนเฉพาะส่วนลดที่ลูกค้าไม่ได้จ่าย (ถ้ามี)</p>
			<p class="mt-1"><span class="font-medium text-slate-800">ทิป:</span> ลูกค้าเลือกปัดยอดขึ้นตอนสั่ง (เช่น 52 เป็น 55) ส่วนที่ปัดเป็นทิปของคุณ รวมอยู่ในยอดด้านบนแล้ว</p>
			<p class="mt-1">ทีมโอนหลังคุณกรอก OTP สำเร็จ</p>
		</section>
	</div>
</div>
