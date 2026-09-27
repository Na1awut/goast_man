<script lang="ts">
	// The rider's side of an order's chat: talk to the buyer of a job in hand.
	// Same messages as the buyer's chat screen, seen from the other side.
	import { tick } from 'svelte';
	import { fly } from 'svelte/transition';
	import Avatar from '$lib/components/Avatar.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { nav } from '$lib/stores/nav.svelte';
	import { rider } from '$lib/stores/rider.svelte';
	import { formatBaht } from '$lib/utils';

	const QUICK_REPLIES = ['รับงานแล้ว กำลังไปต่อคิวครับ', 'รับของแล้ว กำลังไปส่งครับ', 'ถึงจุดส่งแล้วครับ', 'เมนูนี้หมด ขอเปลี่ยนเป็นอย่างอื่นได้ไหมครับ'];

	const job = $derived(rider.chatJob);
	const messages = $derived(job ? (rider.chats[job.id] ?? []) : []);

	let draft = $state('');
	let input = $state<HTMLInputElement>();

	function send(text = draft, file?: File) {
		if (!job || (!text.trim() && !file)) return;
		void rider.sendChat(job.id, text, file);
		draft = '';
		if (!file) input?.focus();
	}

	function onPhoto(e: Event) {
		const el = e.currentTarget as HTMLInputElement;
		const file = el.files?.[0];
		if (file) send('', file);
		el.value = '';
	}

	function back() {
		rider.closeChat();
		if (nav.history.length) nav.back();
		else nav.reset('RIDER');
	}

	// New messages on this job count as read while the chat is open
	$effect(() => {
		void messages.length;
		if (job) rider.unread[job.id] = 0;
		tick().then(() => window.scrollTo({ top: document.documentElement.scrollHeight }));
	});
</script>

<div class="flex min-h-dvh flex-1 flex-col">
	<header class="sticky top-0 z-40 border-b border-slate-100 bg-white pt-[env(safe-area-inset-top)]">
		<div class="flex h-16 items-center gap-3 px-3">
			<button type="button" onclick={back} aria-label="ย้อนกลับ" class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-800 hover:bg-slate-100">
				<Icon name="chevron-left" class="h-6 w-6" />
			</button>
			{#if job}
				<Avatar name={job.customer?.nickname ?? 'ลูกค้า'} size="sm" />
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm font-semibold text-slate-900">{job.customer?.nickname ?? 'ลูกค้า'} (ผู้สั่ง)</p>
					<p class="flex items-center gap-1.5 truncate text-xs text-slate-500">
						<span class="h-1.5 w-1.5 shrink-0 rounded-full bg-fresh"></span>
						{job.orderCode} · {job.status === 'DELIVERING' ? 'กำลังไปส่ง' : 'รับงานแล้ว'}
					</p>
				</div>
				{#if job.customer?.phone}
					<a href="tel:{job.customer.phone}" aria-label="โทรหา {job.customer.nickname}" class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white">
						<Icon name="phone" class="h-4 w-4" />
					</a>
				{/if}
			{:else}
				<p class="flex-1 text-sm font-semibold text-slate-900">แชทกับผู้สั่ง</p>
			{/if}
		</div>
		{#if job}
			<div class="mx-3 mb-3 flex items-center gap-3 rounded-xl bg-brand-50 px-3.5 py-2.5">
				<span class="min-w-0 flex-1">
					<span class="block truncate text-xs font-semibold text-brand-700">{job.pickupName} → {job.dropoffName}</span>
					<span class="block truncate text-[11px] text-brand-700/80">{job.itemDetails}</span>
				</span>
				<span class="shrink-0 text-right">
					<span class="block text-base font-bold text-brand tabular-nums">{formatBaht(job.totalPrice)}</span>
					<span class="block text-[11px] text-brand-700">{job.paymentMethod === 'CASH' ? 'เก็บเงินสด' : 'จ่ายแล้ว'}</span>
				</span>
			</div>
		{/if}
	</header>

	{#if !job}
		<div class="flex flex-1 flex-col items-center justify-center bg-canvas px-8 text-center">
			<p class="text-sm font-medium text-slate-800">งานนี้ปิดแล้ว</p>
			<p class="mt-1 text-xs text-slate-500">แชทได้เฉพาะงานที่กำลังถืออยู่</p>
			<button type="button" onclick={back} class="mt-5 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white">กลับไปหน้างาน</button>
		</div>
	{:else}
		<ol class="flex-1 space-y-4 bg-canvas px-4 py-4" aria-live="polite">
			{#each messages as msg (msg.id)}
				<li in:fly={{ y: 8, duration: 180 }}>
					{#if msg.sender === 'SYSTEM'}
						<p class="mx-auto w-fit max-w-[90%] rounded-full bg-slate-200/70 px-3 py-1 text-center text-xs text-slate-600">{msg.text} ({msg.time})</p>
					{:else if msg.sender === 'CUSTOMER'}
						<div class="max-w-[78%]">
							{#if msg.imageUrl}<img src={msg.imageUrl} alt="รูปจากผู้สั่ง" class="max-h-56 rounded-2xl rounded-tl-md object-cover" />{/if}
							{#if msg.text}<p class="rounded-2xl rounded-tl-md border border-slate-100 bg-white px-3.5 py-2.5 text-sm text-slate-800">{msg.text}</p>{/if}
							<p class="mt-1 text-[11px] text-slate-400">{msg.time}</p>
						</div>
					{:else}
						<div class="ml-auto flex max-w-[78%] flex-col items-end">
							{#if msg.imageUrl}<img src={msg.imageUrl} alt="รูปที่ส่ง" class="max-h-56 rounded-2xl rounded-tr-md object-cover" />{/if}
							{#if msg.text}<p class="rounded-2xl rounded-tr-md bg-brand px-3.5 py-2.5 text-sm text-white">{msg.text}</p>{/if}
							<p class="mt-1 text-[11px] text-slate-400">{msg.time}</p>
						</div>
					{/if}
				</li>
			{:else}
				<li class="py-10 text-center text-xs text-slate-500">ยังไม่มีข้อความ ทักผู้สั่งได้เลย เช่น บอกว่ารับงานแล้ว</li>
			{/each}
		</ol>

		<div class="sticky bottom-0 z-30 border-t border-slate-100 bg-white pb-[env(safe-area-inset-bottom)]">
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
					placeholder="พิมพ์ข้อความถึงผู้สั่ง..."
					aria-label="ข้อความ"
					class="min-w-0 flex-1 rounded-full bg-slate-100 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand"
				/>
				<button type="submit" disabled={!draft.trim()} aria-label="ส่งข้อความ" class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white disabled:bg-slate-200 disabled:text-slate-400">
					<Icon name="send" />
				</button>
			</form>
		</div>
	{/if}
</div>
