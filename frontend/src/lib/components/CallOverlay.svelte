<script lang="ts">
	import { t } from '$lib/i18n';
	// The call screen: covers the app while a call rings, connects or runs.
	import { fade } from 'svelte/transition';
	import Avatar from '$lib/components/Avatar.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { call } from '$lib/stores/call.svelte';

	let audio = $state<HTMLAudioElement>();

	$effect(() => {
		if (audio) audio.srcObject = call.remoteStream;
	});

	const ROLE = { CUSTOMER: t('ผู้ซื้อ'), RIDER: t('คนหิ้ว') } as const;
	const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
	const status = $derived(
		call.state === 'outgoing'
			? t('กำลังโทร...')
			: call.state === 'incoming'
				? t('สายเรียกเข้า')
				: call.state === 'connecting'
					? t('กำลังเชื่อมต่อ...')
					: call.state === 'active'
						? clock(call.seconds)
						: call.message
	);
</script>

{#if call.state !== 'idle'}
	<div
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 z-[90] mx-auto flex max-w-md flex-col items-center justify-between bg-slate-900 px-6 pt-[calc(4rem+env(safe-area-inset-top))] pb-[calc(3rem+env(safe-area-inset-bottom))] text-white"
		role="dialog"
		aria-modal="true"
		aria-label={t('โทรผ่านแอปกับ {peerName}', { peerName: call.peerName })}
	>
		<audio bind:this={audio} autoplay playsinline></audio>

		<div class="flex flex-col items-center text-center">
			<div class="relative">
				{#if call.state === 'incoming' || call.state === 'outgoing'}
					<span class="absolute inset-0 animate-ping rounded-full bg-brand/40 motion-reduce:animate-none" aria-hidden="true"></span>
				{/if}
				<span class="relative block"><Avatar name={call.peerName} size="lg" /></span>
			</div>
			<p class="mt-5 text-2xl font-semibold">{call.peerName}</p>
			<p class="mt-1 text-sm text-white/70">{ROLE[call.peerRole]}{call.orderCode ? t(' · ออเดอร์ {orderCode}', { orderCode: call.orderCode }) : ''}</p>
			<p class="mt-6 text-lg tabular-nums {call.state === 'ended' ? 'text-white/80' : 'text-white'}" aria-live="polite">{status}</p>
			<p class="mt-2 flex items-center gap-1 text-xs text-white/50"><Icon name="lock" class="h-3.5 w-3.5" /> {t('โทรผ่านแอป ไม่ใช้เบอร์โทรศัพท์')}</p>
		</div>

		{#if call.state === 'incoming'}
			<div class="flex w-full items-center justify-around">
				<div class="flex flex-col items-center gap-2">
					<button type="button" onclick={() => call.hangup(t('ปฏิเสธสายแล้ว'))} aria-label={t('ปฏิเสธสาย')} class="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 active:bg-red-700">
						<Icon name="phone" class="h-7 w-7 rotate-[135deg]" />
					</button>
					<span class="text-xs text-white/70">{t('ปฏิเสธ')}</span>
				</div>
				<div class="flex flex-col items-center gap-2">
					<button type="button" onclick={() => call.accept()} aria-label={t('รับสาย')} class="flex h-16 w-16 items-center justify-center rounded-full bg-fresh active:bg-fresh-700">
						<Icon name="phone" class="h-7 w-7" />
					</button>
					<span class="text-xs text-white/70">{t('รับสาย')}</span>
				</div>
			</div>
		{:else if call.state !== 'ended'}
			<div class="flex w-full items-center justify-around">
				<div class="flex flex-col items-center gap-2">
					<button
						type="button"
						onclick={() => call.toggleMute()}
						aria-pressed={call.muted}
						aria-label={call.muted ? t('เปิดไมค์') : t('ปิดไมค์')}
						class="flex h-16 w-16 items-center justify-center rounded-full {call.muted ? 'bg-white text-slate-900' : 'bg-white/15 text-white'}"
					>
						<Icon name={call.muted ? 'volume-off' : 'volume'} class="h-7 w-7" />
					</button>
					<span class="text-xs text-white/70">{call.muted ? t('ปิดไมค์อยู่') : t('ปิดไมค์')}</span>
				</div>
				<div class="flex flex-col items-center gap-2">
					<button type="button" onclick={() => call.hangup()} aria-label={t('วางสาย')} class="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 active:bg-red-700">
						<Icon name="phone" class="h-7 w-7 rotate-[135deg]" />
					</button>
					<span class="text-xs text-white/70">{t('วางสาย')}</span>
				</div>
			</div>
		{:else}
			<div class="h-16"></div>
		{/if}
	</div>
{/if}
