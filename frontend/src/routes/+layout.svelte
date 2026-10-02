<script lang="ts">
	import './layout.css';
	import { afterNavigate } from '$app/navigation';
	import { base } from '$app/paths';
	import { isConsoleHost } from '$lib/admin/host';
	import { installErrorLog, installStaleBuildReload } from '$lib/errorlog';
	import { installClientSecurity } from '$lib/security';
	import { seoFor } from '$lib/seo';
	import { db, isLive } from '$lib/supabase';
	let { children } = $props();

	// Client-side security: anti-F12, anti-inspect, anti-offline/download
	if (typeof window !== 'undefined') installClientSecurity();

	// goastman.dev is the team's address: its home page is the team console, not the buyer app
	const consoleHome = typeof location !== 'undefined' && isConsoleHost(location.hostname) && location.pathname.replace(/\/$/, '') === base;

	// A tab left open across a deploy asks for files that no longer exist: reload once instead of breaking
	if (typeof window !== 'undefined') installStaleBuildReload();

	// Title, description, canonical and share tags are written into each page's HTML at build time
	// (hooks.server.ts + lib/seo.ts). Moving between pages inside the open app only needs the tab title.
	afterNavigate(({ to }) => {
		const page = to && seoFor(to.url.pathname);
		if (page) document.title = page.title;
	});

	// Uncaught errors go to the team's error log (console page "ข้อผิดพลาด")
	if (isLive && typeof window !== 'undefined') {
		installErrorLog(
			(fn, args) => db().rpc(fn, args),
			() => (consoleHome || location.pathname.startsWith(`${base}/admin`) ? 'console' : 'buyer'),
			__RELEASE__
		);
	}
</script>

{#if consoleHome}
	{#await import('$lib/admin/AdminApp.svelte') then { default: AdminApp }}
		<AdminApp />
	{/await}
{:else}
	{@render children()}
{/if}
