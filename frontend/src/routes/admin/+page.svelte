<script lang="ts">
	// /admin on local dev and preview hosts; the public buyer site sends it home.
	// goastman.dev serves the console at its root instead (see +layout.svelte).
	import { base } from '$app/paths';
	import { allowsAdminPath } from '$lib/admin/host';

	const allowed = allowsAdminPath(location.hostname);
	if (!allowed) location.replace(`${base}/`);
</script>

{#if allowed}
	{#await import('$lib/admin/AdminApp.svelte') then { default: AdminApp }}
		<AdminApp />
	{/await}
{/if}
