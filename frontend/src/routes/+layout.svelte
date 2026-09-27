<script lang="ts">
	import './layout.css';
	import { base } from '$app/paths';
	import { isConsoleHost } from '$lib/admin/host';
	import { installErrorLog, installStaleBuildReload } from '$lib/errorlog';
	import { db, isLive } from '$lib/supabase';
	let { children } = $props();

	// goastman.dev is the team's address: its home page is the team console, not the buyer app
	const consoleHome = typeof location !== 'undefined' && isConsoleHost(location.hostname) && location.pathname.replace(/\/$/, '') === base;

	// A tab left open across a deploy asks for files that no longer exist: reload once instead of breaking
	if (typeof window !== 'undefined') installStaleBuildReload();

	// Uncaught errors go to the team's error log (console page "ข้อผิดพลาด")
	if (isLive && typeof window !== 'undefined') {
		installErrorLog(
			(fn, args) => db().rpc(fn, args),
			() => (consoleHome || location.pathname.startsWith(`${base}/admin`) ? 'console' : 'buyer'),
			__RELEASE__
		);
	}
</script>

<svelte:head>
	<title>Goose Man (ห่านบางมด) | KMUTT Campus P2P Delivery</title>
	<meta name="description" content="แพลตฟอร์มฝากหิ้วอาหารในรั้ว มจธ. บางมด — ขี้เกียจเดินฝ่าแดด? ให้ห่านบางมดหิ้วให้!" />
</svelte:head>

{#if consoleHome}
	{#await import('$lib/admin/AdminApp.svelte') then { default: AdminApp }}
		<AdminApp />
	{/await}
{:else}
	{@render children()}
{/if}
