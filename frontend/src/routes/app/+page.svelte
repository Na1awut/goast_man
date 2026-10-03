<script lang="ts">
	// The app on the test site, opened as one role: /app/?as=student | rider | partner.
	// Entering a role starts from clean test data; reloading afterwards keeps it.
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { auth } from '$lib/stores/auth.svelte';
	import { isSimulation, simEntry } from '$lib/sim';
	import App from '../+page.svelte';

	let ready = $state(false);

	onMount(() => {
		// The real site has no use for this page
		if (!isSimulation) return void location.replace(`${base}/`);
		const as = new URLSearchParams(location.search).get('as');
		if (as === 'student' || as === 'rider' || as === 'partner') {
			try {
				localStorage.clear();
			} catch {
				// Storage blocked: the test just starts from whatever is there
			}
			auth.signInDemo(as);
			simEntry.screen = as === 'rider' ? 'RIDER' : null;
			history.replaceState(history.state, '', `${base}/app/`);
		}
		ready = true;
	});
</script>

{#if ready}<App />{/if}
