<script lang="ts">
	import AppBar from '$lib/components/AppBar.svelte';
	import BottomBar from '$lib/components/BottomBar.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { PICKUP_HUBS } from '$lib/data/locations';
	import { CUSTOM_DELIVERY_FEE, CUSTOM_MAX_PRICE } from '$lib/pricing';
	import { campus } from '$lib/stores/campus.svelte';
	import { nav } from '$lib/stores/nav.svelte';
	import { profileGate } from '$lib/stores/profileGate.svelte';
	import { customDraft, OrderError, orders } from '$lib/stores/orders.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { formatBaht } from '$lib/utils';

	let submitted = $state(false);
	let sending = $state(false);

	const pickup = $derived(PICKUP_HUBS.find((h) => h.id === customDraft.pickupId) ?? PICKUP_HUBS[0]);
	const food = $derived(typeof customDraft.price === 'number' && Number.isFinite(customDraft.price) ? Math.max(0, Math.round(customDraft.price)) : 0);
	const total = $derived(food + CUSTOM_DELIVERY_FEE);

	const errors = $derived({
		items: customDraft.items.trim().length < 3 ? 'ระบุรายการที่ต้องการอย่างน้อย 3 ตัวอักษร' : '',
		price: food <= 0 ? 'ใส่ราคาประมาณ เพื่อให้เพื่อนสำรองเงินได้พอ' : food > CUSTOM_MAX_PRICE ? `สูงสุด ${CUSTOM_MAX_PRICE} บาท เพราะเพื่อนต้องสำรองจ่ายก่อน` : ''
	});
	const isValid = $derived(!errors.items && !errors.price);

	const steps = ['ข้อมูลคำสั่งซื้อ', 'หาคนหิ้ว', 'จัดส่งสำเร็จ'];

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		submitted = true;
		if (!isValid || sending) return;
		// First order: ask for the buyer's details once; what was typed here stays
		if (!profileGate.ensure()) return;
		sending = true;
		try {
			await orders.place({
				kind: 'CUSTOM',
				pickupName: pickup.name,
				dropoffName: campus.dropoff.name,
				itemDetails: customDraft.items.trim().replace(/\n+/g, ', '),
				foodTotal: food,
				deliveryFee: CUSTOM_DELIVERY_FEE,
				codeDiscount: 0,
				partnerDiscount: 0,
				totalPrice: total,
				paymentMethod: 'CASH',
				note: customDraft.note.trim() || undefined
			});
			customDraft.clear();
			nav.reset('TRACKING');
		} catch (err) {
			toast.show(err instanceof OrderError ? err.message : 'สั่งไม่สำเร็จ ลองใหม่อีกครั้ง', 'error', { duration: 5000 });
		} finally {
			sending = false;
		}
	}
</script>

<form class="flex flex-1 flex-col" onsubmit={submit} novalidate>
	<AppBar title="ฝากซื้ออาหาร / ของกิน">
		<ol class="flex items-center gap-2 px-4 pb-3 text-xs" aria-label="ขั้นตอน">
			{#each steps as step, i (step)}
				{#if i > 0}<li aria-hidden="true" class="h-px flex-1 bg-slate-200"></li>{/if}
				<li class="flex items-center gap-1.5 {i === 0 ? 'font-medium text-brand' : 'text-slate-400'}" aria-current={i === 0 ? 'step' : undefined}>
					<span class="h-2 w-2 rounded-full {i === 0 ? 'bg-brand' : 'bg-slate-300'}"></span>{step}
				</li>
			{/each}
		</ol>
	</AppBar>

	<div class="flex-1 space-y-3 px-4 pt-4 pb-6">
		<!-- Pickup -->
		<label class="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4">
			<span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand"><Icon name={pickup.icon} /></span>
			<span class="min-w-0 flex-1">
				<span class="block text-xs text-slate-500">จุดซื้อของ</span>
				<span class="relative block">
					<select bind:value={customDraft.pickupId} class="w-full appearance-none bg-transparent pr-6 text-sm font-semibold text-slate-900 outline-none">
						{#each PICKUP_HUBS as hub (hub.id)}<option value={hub.id}>{hub.name}</option>{/each}
					</select>
					<Icon name="chevron-down" class="pointer-events-none absolute top-1/2 right-0 h-4 w-4 -translate-y-1/2 text-slate-400" />
				</span>
			</span>
		</label>

		<!-- Items -->
		<div class="space-y-2 pt-1">
			<label for="items" class="text-sm font-semibold text-slate-900">รายละเอียดอาหาร / ของกิน</label>
			<textarea
				id="items"
				bind:value={customDraft.items}
				rows="3"
				maxlength="300"
				placeholder="เช่น ข้าวมันไก่พิเศษเนื้อน่อง ไม่แตงกวา ร้านป้าณี"
				aria-invalid={submitted && !!errors.items}
				class="w-full resize-none rounded-2xl border bg-white p-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-brand {submitted && errors.items ? 'border-red-400' : 'border-slate-200'}"
			></textarea>
			{#if submitted && errors.items}<p class="text-xs text-red-600">{errors.items}</p>{/if}
		</div>

		<!-- Price -->
		<div class="rounded-2xl border bg-white p-4 {submitted && errors.price ? 'border-red-400' : 'border-slate-100'}">
			<div class="flex items-center gap-3">
				<label for="price" class="min-w-0 flex-1">
					<span class="block text-sm font-semibold text-slate-900">ประมาณราคาอาหาร (บาท)</span>
					<span class="block text-xs text-slate-500">เพื่อนจะใช้สำรองจ่ายก่อน</span>
				</label>
				<input
					id="price"
					type="number"
					inputmode="numeric"
					min="1"
					max={CUSTOM_MAX_PRICE}
					bind:value={customDraft.price}
					placeholder="0"
					aria-invalid={submitted && !!errors.price}
					class="w-24 rounded-xl bg-slate-100 px-3 py-2.5 text-right text-base font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-brand"
				/>
			</div>
			{#if submitted && errors.price}<p class="mt-2 text-xs text-red-600">{errors.price}</p>{/if}
		</div>

		<!-- Drop-off -->
		<button type="button" onclick={() => campus.openPicker()} class="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 text-left">
			<span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand"><Icon name="pin" /></span>
			<span class="min-w-0 flex-1">
				<span class="block text-xs text-slate-500">จุดส่งของ</span>
				<span class="block truncate text-sm font-semibold text-slate-900">{campus.dropoff.name}</span>
			</span>
			<Icon name="chevron-right" class="h-5 w-5 text-slate-400" />
		</button>

		<input
			type="text"
			bind:value={customDraft.note}
			maxlength="120"
			placeholder="หมายเหตุถึงคนหิ้ว (ไม่บังคับ)"
			aria-label="หมายเหตุถึงคนหิ้ว"
			class="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-brand"
		/>

		<!-- Summary -->
		<div class="space-y-2 rounded-2xl border border-slate-100 bg-white p-4 text-sm">
			<div class="flex justify-between text-slate-600"><span>ค่าอาหาร</span><span class="text-slate-900 tabular-nums">{food}</span></div>
			<div class="flex items-center justify-between text-slate-600">
				<span class="flex items-center gap-2">ค่าหิ้วน้ำใจ <span class="rounded bg-brand-50 px-1.5 py-0.5 text-[11px] text-brand-700">เริ่มต้นขั้นต่ำ</span></span>
				<span class="font-medium text-brand tabular-nums">{CUSTOM_DELIVERY_FEE}</span>
			</div>
			<div class="flex items-center justify-between border-t border-dashed border-slate-200 pt-3">
				<span class="font-semibold text-slate-900">ยอดรวมทั้งหมด</span>
				<span class="text-xl font-bold text-brand tabular-nums">{formatBaht(total)}</span>
			</div>
			<p class="flex items-center gap-1.5 text-xs text-slate-500"><Icon name="cash" class="h-4 w-4" /> ชำระเงินสดกับเพื่อนตอนรับของ ตามใบเสร็จจริง</p>
		</div>
	</div>

	<BottomBar>
		<button type="submit" disabled={sending} class="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-4 text-sm font-semibold text-white active:bg-brand-600 disabled:opacity-80">
			{#if sending}<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span> กำลังส่งออเดอร์...{:else}ยืนยันและหาเพื่อนหิ้ว ({formatBaht(total)}){/if}
		</button>
	</BottomBar>
</form>
