<script lang="ts">
	import AppBar from '$lib/components/AppBar.svelte';
	import Goose from '$lib/components/Goose.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { nav } from '$lib/stores/nav.svelte';
	import { orders } from '$lib/stores/orders.svelte';
	import { formatBaht, formatRelativeDate } from '$lib/utils';

	type Filter = 'ALL' | 'ACTIVE' | 'COMPLETED';
	let filter = $state<Filter>('ALL');

	const filters = $derived<{ id: Filter; label: string; count: number }[]>([
		{ id: 'ALL', label: 'ทั้งหมด', count: orders.orders.length },
		{ id: 'ACTIVE', label: 'กำลังส่ง', count: orders.active.length },
		{ id: 'COMPLETED', label: 'สำเร็จ', count: orders.completed.length }
	]);

	const list = $derived(filter === 'ALL' ? orders.orders : filter === 'ACTIVE' ? orders.active : orders.completed);

	function open(id: string) {
		orders.open(id);
		nav.go('TRACKING');
	}
</script>

<div class="flex flex-1 flex-col">
	<AppBar title="คำสั่งซื้อ" showBack={false}>
		<div class="flex px-4" role="tablist" aria-label="กรองสถานะ">
			{#each filters as f (f.id)}
				{@const active = filter === f.id}
				<button
					type="button"
					role="tab"
					aria-selected={active}
					onclick={() => (filter = f.id)}
					class="flex flex-1 items-center justify-center gap-1.5 border-b-2 py-3 text-sm transition-colors {active ? 'border-brand font-semibold text-brand' : 'border-transparent text-slate-500'}"
				>
					{f.label} <span class="text-xs {active ? 'text-brand' : 'text-slate-400'}">{f.count}</span>
				</button>
			{/each}
		</div>
	</AppBar>

	<div class="flex-1 px-4 pt-4 pb-8">
		{#if list.length === 0}
			<div class="rounded-2xl border border-slate-100 bg-white px-6 py-12 text-center">
				<Goose pose="wait" class="mx-auto mb-3 w-28" />
				<p class="text-sm font-medium text-slate-800">{filter === 'ACTIVE' ? 'ตอนนี้ไม่มีใครหิ้วของให้คุณอยู่' : 'ยังไม่มีคำสั่งซื้อ'}</p>
				<p class="mt-1 text-xs text-slate-500">หิวเมื่อไหร่ ฝากเพื่อนที่อยู่ใกล้ร้านได้เลย</p>
				<button type="button" onclick={() => nav.reset('STORES')} class="mt-4 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white">สั่งอาหาร</button>
			</div>
		{:else}
			<ul class="space-y-3">
				{#each list as order (order.id)}
					<li>
						<button type="button" onclick={() => open(order.id)} class="w-full rounded-2xl border border-slate-100 bg-white p-4 text-left">
							<div class="flex items-start justify-between gap-2">
								<div>
									<p class="text-sm font-semibold text-slate-900">{order.orderCode}</p>
									<p class="text-xs text-slate-400">{formatRelativeDate(order.createdAt)} · {order.kind === 'CUSTOM' ? 'ฝากซื้อ' : 'ร้านพาร์ทเนอร์'}</p>
								</div>
								<StatusBadge status={order.status} />
							</div>
							<p class="mt-2 line-clamp-2 text-sm text-slate-700">{order.itemDetails}</p>
							<p class="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
								<span class="truncate">{order.pickupName}</span>
								<Icon name="arrow-right" class="h-3.5 w-3.5 shrink-0 text-brand" />
								<span class="truncate">{order.dropoffName}</span>
							</p>
							<div class="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
								<span class="flex items-center gap-1 text-xs text-slate-500">
									{#if order.rider}{order.rider.name}{/if}
									{#if order.rating}
										<span class="ml-1 flex items-center gap-0.5 text-slate-600"><Icon name="star" class="h-3.5 w-3.5 text-beak" filled strokeWidth={0} />{order.rating}</span>
									{/if}
								</span>
								<span class="text-sm font-semibold text-slate-900 tabular-nums">{formatBaht(order.totalPrice + (order.tip ?? 0))}</span>
							</div>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
