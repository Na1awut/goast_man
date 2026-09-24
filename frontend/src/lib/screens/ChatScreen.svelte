<script lang="ts">
	import { tick } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import Avatar from '$lib/components/Avatar.svelte';
	import Goose from '$lib/components/Goose.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { STATUS_META } from '$lib/components/StatusBadge.svelte';
	import { campus } from '$lib/stores/campus.svelte';
	import { nav } from '$lib/stores/nav.svelte';
	import { orders } from '$lib/stores/orders.svelte';
	import { formatBaht } from '$lib/utils';

	const QUICK_REPLIES = ['ถึงจุดนัดแล้วครับ', 'รออยู่หน้าตู้เต่าบินครับ', 'มาถึงรึยังครับ?', 'ขอบคุณครับ'];

	const order = $derived(orders.current);
	const messages = $derived(orders.currentChat);
	const riderTyping = $derived(order !== null && orders.typingOrderId === order.id);
	const canChat = $derived(!!order?.rider && order.status !== 'COMPLETED' && order.status !== 'CANCELLED');

	let draft = $state('');
	let input = $state<HTMLInputElement>();

	function send(text = draft, image?: { url: string; file: File }) {
		if (!order || !canChat || (!text.trim() && !image)) return;
		orders.sendChat(order.id, text, image);
		draft = '';
		if (!image) input?.focus();
	}

	function onPhoto(e: Event) {
		const el = e.currentTarget as HTMLInputElement;
		const file = el.files?.[0];
		if (file) send('', { url: URL.createObjectURL(file), file });
		el.value = '';
	}

	function back() {
		if (nav.history.length) nav.back();
		else nav.reset('HOME');
	}

	// Keep the newest message in view
	$effect(() => {
		void messages.length;
		void riderTyping;
		tick().then(() => window.scrollTo({ top: document.documentElement.scrollHeight }));
	});
</script>

<div class="flex min-h-dvh flex-1 flex-col">
	<header class="sticky top-0 z-40 border-b border-slate-100 bg-white pt-[env(safe-area-inset-top)]">
		<div class="flex h-16 items-center gap-3 px-3">
			<button type="button" onclick={back} aria-label="ย้อนกลับ" class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-800 hover:bg-slate-100">
				<Icon name="chevron-left" class="h-6 w-6" />
			</button>
			{#if order?.rider}
				<Avatar name={order.rider.fullName} size="sm" />
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm font-semibold text-slate-900">{order.rider.name} (คนหิ้ว {order.rider.faculty})</p>
					<p class="flex items-center gap-1.5 truncate text-xs text-slate-500">
						<span class="h-1.5 w-1.5 shrink-0 rounded-full {canChat ? 'bg-fresh' : 'bg-slate-300'}"></span>
						{#if riderTyping}กำลังพิมพ์...{:else if canChat}{order.status === 'DELIVERING' ? `กำลังไปส่งที่ ${campus.dropoff.shortName}` : STATUS_META[order.status].label}{:else}ออเดอร์ปิดแล้ว{/if}
					</p>
				</div>
				<a href="tel:{order.rider.phone}" aria-label="โทรหา {order.rider.name}" class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white">
					<Icon name="phone" class="h-4 w-4" />
				</a>
			{:else}
				<p class="flex-1 text-sm font-semibold text-slate-900">แชท</p>
			{/if}
		</div>
		{#if order?.rider}
			<button
				type="button"
				onclick={() => nav.go('TRACKING')}
				class="mx-3 mb-3 flex w-[calc(100%-1.5rem)] items-center gap-3 rounded-xl bg-brand-50 px-3.5 py-2.5 text-left"
			>
				<span class="min-w-0 flex-1">
					<span class="block truncate text-xs font-semibold text-brand-700">{order.itemDetails} → {campus.dropoff.shortName}</span>
					<span class="flex items-center gap-1 text-[11px] text-brand">ดูรายละเอียด <Icon name="arrow-right" class="h-3 w-3" /></span>
				</span>
				<span class="shrink-0 text-base font-bold text-brand tabular-nums">{formatBaht(order.totalPrice)}</span>
			</button>
		{/if}
	</header>

	{#if !order?.rider}
		<div class="flex flex-1 flex-col items-center justify-center bg-canvas px-8 text-center">
			<Goose pose="wait" class="mb-3 w-28" />
			<p class="text-sm font-medium text-slate-800">ยังไม่มีแชทที่เปิดอยู่</p>
			<p class="mt-1 text-xs text-slate-500">แชทจะเปิดเมื่อมีเพื่อนรับออเดอร์ของคุณ</p>
			<button type="button" onclick={() => nav.reset('STORES')} class="mt-5 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white">สั่งอาหาร</button>
		</div>
	{:else}
		<ol class="flex-1 space-y-4 bg-canvas px-4 py-4" aria-live="polite">
			{#each messages as msg (msg.id)}
				<li in:fly={{ y: 8, duration: 180 }}>
					{#if msg.sender === 'SYSTEM'}
						<p class="mx-auto w-fit max-w-[90%] rounded-full bg-slate-200/70 px-3 py-1 text-center text-xs text-slate-600">{msg.text} ({msg.time})</p>
					{:else if msg.sender === 'RIDER'}
						<div class="max-w-[78%]">
							<p class="rounded-2xl rounded-tl-md border border-slate-100 bg-white px-3.5 py-2.5 text-sm text-slate-800">{msg.text}</p>
							<p class="mt-1 text-[11px] text-slate-400">{msg.time}</p>
						</div>
					{:else}
						<div class="ml-auto flex max-w-[78%] flex-col items-end">
							{#if msg.imageUrl}
								<img src={msg.imageUrl} alt="รูปที่ส่ง" class="max-h-56 rounded-2xl rounded-tr-md object-cover" />
							{/if}
							{#if msg.text}<p class="rounded-2xl rounded-tr-md bg-brand px-3.5 py-2.5 text-sm text-white">{msg.text}</p>{/if}
							<p class="mt-1 text-[11px] text-slate-400">{msg.time}</p>
						</div>
					{/if}
				</li>
			{/each}
			{#if riderTyping}
				<li transition:fade={{ duration: 120 }}>
					<span class="inline-flex gap-1 rounded-2xl rounded-tl-md border border-slate-100 bg-white px-4 py-3" aria-label="กำลังพิมพ์">
						{#each [0, 150, 300] as delay (delay)}
							<span class="typing-dot h-1.5 w-1.5 rounded-full bg-slate-500" style="animation-delay: {delay}ms"></span>
						{/each}
					</span>
				</li>
			{/if}
		</ol>

		<div class="sticky bottom-0 z-30 border-t border-slate-100 bg-white pb-[env(safe-area-inset-bottom)]">
			{#if canChat}
				<div class="no-scrollbar flex gap-2 overflow-x-auto px-4 pt-3">
					{#each QUICK_REPLIES as chip (chip)}
						<button type="button" onclick={() => send(chip)} class="shrink-0 rounded-full border border-slate-200 px-3.5 py-1.5 text-xs text-slate-700 active:bg-slate-100">{chip}</button>
					{/each}
				</div>
				<form
					class="flex items-center gap-2 px-4 py-3"
					onsubmit={(e) => {
						e.preventDefault();
						send();
					}}
				>
					<label class="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-slate-100 text-slate-600" aria-label="ส่งรูป">
						<Icon name="camera" />
						<input type="file" accept="image/*" class="sr-only" onchange={onPhoto} />
					</label>
					<input
						bind:this={input}
						bind:value={draft}
						type="text"
						maxlength="300"
						enterkeyhint="send"
						placeholder="พิมพ์ข้อความ..."
						aria-label="ข้อความ"
						class="min-w-0 flex-1 rounded-full bg-slate-100 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand"
					/>
					<button type="submit" disabled={!draft.trim()} aria-label="ส่งข้อความ" class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white disabled:bg-slate-200 disabled:text-slate-400">
						<Icon name="send" />
					</button>
				</form>
			{:else}
				<p class="px-4 py-4 text-center text-xs text-slate-500">ออเดอร์นี้ปิดแล้ว ไม่สามารถส่งข้อความได้</p>
			{/if}
		</div>
	{/if}
</div>
