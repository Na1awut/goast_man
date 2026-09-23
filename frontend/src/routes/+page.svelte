<script lang="ts">
	import { onMount, type Component } from 'svelte';
	import { fly } from 'svelte/transition';
	import type { Screen } from '$lib/types';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import GooseMark from '$lib/components/GooseMark.svelte';
	import LocationSheet from '$lib/components/LocationSheet.svelte';
	import NotificationSheet from '$lib/components/NotificationSheet.svelte';
	import ToastStack from '$lib/components/ToastStack.svelte';
	import ChatScreen from '$lib/screens/ChatScreen.svelte';
	import CheckoutScreen from '$lib/screens/CheckoutScreen.svelte';
	import CustomOrderScreen from '$lib/screens/CustomOrderScreen.svelte';
	import HomeScreen from '$lib/screens/HomeScreen.svelte';
	import LoginScreen from '$lib/screens/LoginScreen.svelte';
	import OrdersScreen from '$lib/screens/OrdersScreen.svelte';
	import PaymentScreen from '$lib/screens/PaymentScreen.svelte';
	import ProfileScreen from '$lib/screens/ProfileScreen.svelte';
	import StoreDetailScreen from '$lib/screens/StoreDetailScreen.svelte';
	import StoresScreen from '$lib/screens/StoresScreen.svelte';
	import SuccessScreen from '$lib/screens/SuccessScreen.svelte';
	import TrackingScreen from '$lib/screens/TrackingScreen.svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import { campus } from '$lib/stores/campus.svelte';
	import { cart } from '$lib/stores/cart.svelte';
	import { nav } from '$lib/stores/nav.svelte';
	import { orders } from '$lib/stores/orders.svelte';
	import { prefersReducedMotion } from '$lib/utils';

	const SCREENS: Record<Exclude<Screen, 'LOGIN'>, Component> = {
		HOME: HomeScreen,
		STORES: StoresScreen,
		STORE_DETAIL: StoreDetailScreen,
		CUSTOM_ORDER: CustomOrderScreen,
		CHECKOUT: CheckoutScreen,
		PAYMENT: PaymentScreen,
		TRACKING: TrackingScreen,
		CHAT: ChatScreen,
		SUCCESS: SuccessScreen,
		ORDERS: OrdersScreen,
		PROFILE: ProfileScreen
	};

	let ready = $state(false);
	let reduceMotion = $state(false);

	onMount(() => {
		reduceMotion = prefersReducedMotion();
		campus.init();
		cart.init();
		if (auth.init()) {
			orders.init();
			nav.reset('HOME');
		}
		ready = true;
		return () => orders.reset();
	});

	// Guard: never render an authenticated screen without a session
	$effect(() => {
		if (ready && !auth.isAuthenticated && nav.screen !== 'LOGIN') nav.reset('LOGIN');
	});

	const ActiveScreen = $derived(nav.screen === 'LOGIN' ? null : SCREENS[nav.screen]);
</script>

<div class="relative mx-auto flex min-h-dvh w-full max-w-md flex-col bg-canvas">
	{#if !ready}
		<div class="flex min-h-dvh items-center justify-center bg-white">
			<GooseMark class="h-28 w-28" large />
		</div>
	{:else if !ActiveScreen}
		<LoginScreen />
	{:else}
		<main class="flex flex-1 flex-col">
			{#key nav.screen}
				<div class="flex flex-1 flex-col" in:fly={{ y: 8, duration: reduceMotion ? 0 : 200 }}>
					<ActiveScreen />
				</div>
			{/key}
		</main>
		{#if nav.showBottomNav}<BottomNav />{/if}
		<LocationSheet />
		<NotificationSheet />
	{/if}
	<ToastStack />
</div>
