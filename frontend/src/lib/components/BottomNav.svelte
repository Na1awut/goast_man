<script lang="ts">
	import type { TabId } from '$lib/types';
	import { cart } from '$lib/stores/cart.svelte';
	import { nav } from '$lib/stores/nav.svelte';
	import { orders } from '$lib/stores/orders.svelte';
	import Icon, { type IconName } from './Icon.svelte';

	type Tab = { id: TabId; label: string; icon: IconName };

	const left: Tab[] = [
		{ id: 'HOME', label: 'หน้าแรก', icon: 'home' },
		{ id: 'ORDERS', label: 'คำสั่งซื้อ', icon: 'receipt' }
	];
	const right: Tab[] = [
		{ id: 'CHAT', label: 'แชท', icon: 'message' },
		{ id: 'PROFILE', label: 'โปรไฟล์', icon: 'user' }
	];

	const badges = $derived<Partial<Record<TabId, number>>>({ ORDERS: orders.active.length });

	function openTab(id: TabId) {
		if (id === 'CHAT') {
			// Chat belongs to an order: open the latest active one
			const active = orders.active.find((o) => o.rider) ?? orders.active[0];
			if (active) orders.open(active.id);
			else orders.currentOrderId = null;
		}
		nav.reset(id);
	}
</script>

{#snippet tab(t: Tab)}
	{@const active = nav.activeTab === t.id}
	{@const badge = badges[t.id] ?? 0}
	<button
		type="button"
		onclick={() => openTab(t.id)}
		aria-current={active ? 'page' : undefined}
		class="relative flex h-full flex-1 flex-col items-center justify-center gap-1 {active ? 'text-brand' : 'text-slate-400'}"
	>
		<span class="relative">
			<Icon name={t.icon} class="h-6 w-6" strokeWidth={active ? 2.2 : 1.8} />
			{#if badge > 0}
				<span class="absolute -top-1 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white ring-2 ring-white">{badge}</span>
			{/if}
		</span>
		<span class="text-[11px] {active ? 'font-semibold' : 'font-medium'}">{t.label}</span>
	</button>
{/snippet}

<nav class="sticky bottom-0 z-40 border-t border-slate-100 bg-white pb-[env(safe-area-inset-bottom)]" aria-label="เมนูหลัก">
	<div class="relative flex h-[4.25rem] items-stretch px-2">
		{#each left as t (t.id)}{@render tab(t)}{/each}

		<!-- Primary action: order food -->
		<div class="flex flex-none justify-center px-1">
			<button
				type="button"
				onclick={() => nav.reset('STORES')}
				class="relative flex h-11 items-center gap-1.5 self-center rounded-full bg-brand px-4 text-sm font-semibold whitespace-nowrap text-white transition-transform active:scale-95"
				aria-label="สั่งอาหาร{cart.totalItems ? ` (ในตะกร้า ${cart.totalItems} ชิ้น)` : ''}"
			>
				<Icon name="cart" class="h-5 w-5" />
				สั่งอาหาร
				{#if cart.totalItems > 0}
					{#key cart.totalItems}<span class="tick absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-900 px-1 text-[11px] font-semibold ring-2 ring-white">{cart.totalItems}</span>{/key}
				{/if}
			</button>
		</div>

		{#each right as t (t.id)}{@render tab(t)}{/each}
	</div>
</nav>
