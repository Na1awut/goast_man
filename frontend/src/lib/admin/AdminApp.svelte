<script lang="ts">
	// Team console root: sign-in gate, then the shell with the current page.
	import { onMount } from 'svelte';
	import head1 from '$lib/assets/goose-head-1.webp';
	import ToastStack from '$lib/components/ToastStack.svelte';
	import { consoleState as c } from './console.svelte';
	import Shell from './ui/Shell.svelte';
	import Login from './pages/Login.svelte';
	import NoAccess from './pages/NoAccess.svelte';
	import OverviewPage from './pages/Overview.svelte';
	import OrdersPage from './pages/Orders.svelte';
	import FinancePage from './pages/Finance.svelte';
	import StoresPage from './pages/Stores.svelte';
	import RidersPage from './pages/Riders.svelte';
	import PartnersPage from './pages/Partners.svelte';
	import TeamPage from './pages/Team.svelte';
	import ActivityPage from './pages/Activity.svelte';
	import SettingsPage from './pages/Settings.svelte';

	const PAGES = {
		overview: OverviewPage,
		orders: OrdersPage,
		finance: FinancePage,
		stores: StoresPage,
		riders: RidersPage,
		partners: PartnersPage,
		team: TeamPage,
		activity: ActivityPage,
		settings: SettingsPage
	};
	const Page = $derived(PAGES[c.page]);

	onMount(() => void c.init());
</script>

<svelte:head>
	<title>Goose Man · ทีมงาน</title>
	<meta name="robots" content="noindex" />
</svelte:head>

{#if c.session === 'loading'}
	<div class="flex min-h-dvh items-center justify-center bg-white">
		<img src={head1} alt="Goose Man" width="480" height="480" class="h-24 w-24 animate-pulse" />
	</div>
{:else if c.session === 'signed-out'}
	<Login />
{:else if c.session === 'no-access'}
	<NoAccess />
{:else}
	<Shell>
		{#key c.page}<Page />{/key}
	</Shell>
{/if}
<ToastStack />
