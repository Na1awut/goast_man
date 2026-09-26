<script lang="ts">
	import './layout.css';
	import { base } from '$app/paths';
	import { isConsoleHost } from '$lib/admin/host';
	let { children } = $props();

	// goastman.dev is the team's address: its home page is the team console, not the buyer app
	const consoleHome = typeof location !== 'undefined' && isConsoleHost(location.hostname) && location.pathname.replace(/\/$/, '') === base;
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
