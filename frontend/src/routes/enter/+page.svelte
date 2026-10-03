<script lang="ts">
	// Test site only. The real console opens this page as /enter/#t=<ticket>. The ticket is in the fragment so it
	// never reaches a server or a log; it is read once, removed from the address bar and traded for a session.
	import { onMount } from 'svelte';
	import { enterTestSite } from '$lib/api/live';
	import { isTestSite } from '$lib/sim';

	let message = $state('กำลังเข้าเว็บทดสอบ...');
	let failed = $state(false);

	onMount(async () => {
		const ticket = new URLSearchParams(location.hash.slice(1)).get('t') ?? '';
		history.replaceState(null, '', location.pathname);
		if (!isTestSite || !ticket) {
			failed = true;
			message = 'หน้านี้เปิดได้จากปุ่ม "เปิดเว็บทดสอบ" ในตั้งค่าของคอนโซลทีมงานเท่านั้น';
			return;
		}
		try {
			const next = await enterTestSite(ticket);
			// A full load, so the app starts up with the new session
			location.replace(next);
		} catch {
			failed = true;
			message = 'ตั๋วหมดอายุหรือถูกใช้ไปแล้ว กลับไปกด "เปิดเว็บทดสอบ" ในคอนโซลอีกครั้ง';
		}
	});
</script>

<svelte:head><title>เข้าเว็บทดสอบ</title></svelte:head>

<main class="grid min-h-dvh place-items-center bg-white px-6">
	<div class="max-w-sm text-center">
		{#if !failed}<span class="mx-auto mb-4 block h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand" aria-hidden="true"></span>{/if}
		<p class="text-base text-slate-800" role={failed ? 'alert' : 'status'}>{message}</p>
	</div>
</main>
