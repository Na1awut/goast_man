<script lang="ts">
	import { onMount, type Component } from 'svelte';
	import { fly } from 'svelte/transition';
	import type { Screen } from '$lib/types';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import GooseMark from '$lib/components/GooseMark.svelte';
	import LocationSheet from '$lib/components/LocationSheet.svelte';
	import NotificationSheet from '$lib/components/NotificationSheet.svelte';
	import ToastStack from '$lib/components/ToastStack.svelte';
	import WelcomeSplash from '$lib/components/WelcomeSplash.svelte';
	import ChatScreen from '$lib/screens/ChatScreen.svelte';
	import CheckoutScreen from '$lib/screens/CheckoutScreen.svelte';
	import CustomOrderScreen from '$lib/screens/CustomOrderScreen.svelte';
	import EditProfileScreen from '$lib/screens/EditProfileScreen.svelte';
	import HomeScreen from '$lib/screens/HomeScreen.svelte';
	import LoginScreen from '$lib/screens/LoginScreen.svelte';
	import OnboardingScreen from '$lib/screens/OnboardingScreen.svelte';
	import OrdersScreen from '$lib/screens/OrdersScreen.svelte';
	import PartnerScreen from '$lib/screens/PartnerScreen.svelte';
	import PaymentScreen from '$lib/screens/PaymentScreen.svelte';
	import ProfileScreen from '$lib/screens/ProfileScreen.svelte';
	import RiderScreen from '$lib/screens/RiderScreen.svelte';
	import RiderEarningsScreen from '$lib/screens/RiderEarningsScreen.svelte';
	import RiderApplyScreen from '$lib/screens/RiderApplyScreen.svelte';
	import RiderChatScreen from '$lib/screens/RiderChatScreen.svelte';
	import StoreDetailScreen from '$lib/screens/StoreDetailScreen.svelte';
	import StoresScreen from '$lib/screens/StoresScreen.svelte';
	import SuccessScreen from '$lib/screens/SuccessScreen.svelte';
	import TrackingScreen from '$lib/screens/TrackingScreen.svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import { campus } from '$lib/stores/campus.svelte';
	import { cart } from '$lib/stores/cart.svelte';
	import { catalog } from '$lib/stores/catalog.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { AuthError } from '$lib/stores/auth.svelte';
	import { nav } from '$lib/stores/nav.svelte';
	import { orders } from '$lib/stores/orders.svelte';
	import { push } from '$lib/stores/push.svelte';
	import { rider } from '$lib/stores/rider.svelte';
	import { welcome } from '$lib/stores/welcome.svelte';
	import { friendlyError, returnedFromSignIn } from '$lib/supabase';
	import { prefersReducedMotion, withTimeout } from '$lib/utils';

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
		PROFILE: ProfileScreen,
		PARTNER: PartnerScreen,
		ONBOARDING: OnboardingScreen,
		EDIT_PROFILE: EditProfileScreen,
		RIDER: RiderScreen,
		RIDER_EARNINGS: RiderEarningsScreen,
		RIDER_APPLY: RiderApplyScreen,
		RIDER_CHAT: RiderChatScreen
	};

	let ready = $state(false);
	let reduceMotion = $state(false);

	onMount(() => {
		reduceMotion = prefersReducedMotion();
		campus.init();
		void start();
		void push.init();

		// When the browser restores from bfcache all WebSocket connections are
		// dead and the refresh token may have expired in the meantime. Re-check
		// the session so we redirect to LOGIN immediately instead of letting
		// every subsequent API call fail with 401.
		const handlePageShow = (e: PageTransitionEvent) => {
			if (e.persisted) {
				void auth.init().catch(() => {});
			}
		};
		window.addEventListener('pageshow', handlePageShow);

		return () => {
			orders.reset();
			rider.reset();
			window.removeEventListener('pageshow', handlePageShow);
		};
	});

	const AUTH_TIMEOUT_MS = 8000;

	async function start() {
		// Data loads behind the UI: screens show their own loading states, so a slow
		// campus network never traps anyone on the splash screen.
		void catalog.load().then(() => cart.init());
		try {
			if (await withTimeout(auth.init(), AUTH_TIMEOUT_MS)) {
				nav.reset(auth.isPartner ? 'PARTNER' : auth.mustOnboardNow ? 'ONBOARDING' : 'HOME');
				void orders.init(auth.user!.id);
				// Say hello only after a fresh sign-in, not when a saved session is restored
				if (returnedFromSignIn) welcome.show(auth.displayName);
			}
		} catch (err) {
			toast.show(err instanceof AuthError ? err.message : friendlyError(err), 'error', { duration: 6000 });
		} finally {
			ready = true;
		}
	}

	// Guard: never render an authenticated screen without a session
	$effect(() => {
		if (!ready) return;
		if (!auth.isAuthenticated && nav.screen !== 'LOGIN') {
			nav.reset('LOGIN');
		} else if (auth.isPartner) {
			// Partner accounts only manage the store; no access to student screens
			if (nav.screen !== 'PARTNER') nav.reset('PARTNER');
		} else if (auth.isAuthenticated && auth.mustOnboardNow && nav.screen !== 'ONBOARDING') {
			nav.reset('ONBOARDING');
		}
	});

	// A tapped notification opens its order, chat or the job board once my orders are in
	$effect(() => {
		const tag = push.pendingTag;
		if (tag === null || !ready || !auth.isAuthenticated || auth.isPartner || auth.mustOnboardNow || !orders.loaded) return;
		push.pendingTag = null;
		const cut = tag.indexOf('-');
		const kind = tag.slice(0, cut);
		const id = tag.slice(cut + 1);
		if (kind === 'job') return nav.reset('RIDER', ['HOME', 'PROFILE']);
		if (kind !== 'order' && kind !== 'chat') return;
		if (orders.orders.some((o) => o.id === id)) {
			// I am the buyer
			orders.open(id);
			nav.reset(kind === 'chat' ? 'CHAT' : 'TRACKING', ['HOME', 'ORDERS']);
		} else if (kind === 'chat') {
			// I am the rider: load the board first so the chat finds its job
			void rider.init().then(() => {
				if (!rider.mine.some((j) => j.id === id)) return nav.reset('RIDER', ['HOME', 'PROFILE']);
				rider.openChat(id);
				nav.reset('RIDER_CHAT', ['HOME', 'PROFILE', 'RIDER']);
			});
		} else {
			nav.reset('RIDER', ['HOME', 'PROFILE']);
		}
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
		{#if nav.showBottomNav && !auth.isPartner}<BottomNav />{/if}
		<LocationSheet />
		<NotificationSheet />
	{/if}
	<ToastStack />
	<WelcomeSplash />
</div>
