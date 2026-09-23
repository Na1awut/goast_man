<script lang="ts">
	import { onMount } from 'svelte';
	import type { MenuItem, Store, Order, ChatMessage, OrderStatus } from '$lib/types';
	import { MOCK_STORES, getStoreById } from '$lib/data/stores';
	import { DROPOFF_POINTS, PICKUP_HUBS } from '$lib/stores/location.svelte';

	// =====================================================================
	// NAVIGATION STATE
	// =====================================================================
	type Screen = 'LOGIN' | 'HOME' | 'STORES' | 'STORE_DETAIL' | 'ORDER_CREATE' | 'CHECKOUT' | 'TRACKING' | 'CHAT' | 'SUCCESS' | 'ORDERS' | 'PROFILE';
	let screen = $state<Screen>('LOGIN');
	let screenHistory = $state<Screen[]>([]);

	function goTo(s: Screen) {
		screenHistory = [...screenHistory, screen];
		screen = s;
	}
	function goBack() {
		if (screenHistory.length > 0) {
			screen = screenHistory[screenHistory.length - 1];
			screenHistory = screenHistory.slice(0, -1);
		} else {
			screen = 'HOME';
		}
	}

	// =====================================================================
	// AUTH STATE
	// =====================================================================
	let isLoggedIn = $state(false);
	let userName = $state('น้องกูส');
	let userEmail = $state('goose@mail.kmutt.ac.th');
	let userStudentId = $state('66130500001');
	let userPhone = $state('081-234-5678');
	let userPromptPay = $state('0812345678');

	function handleLogin() {
		isLoggedIn = true;
		screen = 'HOME';
		screenHistory = [];
		showToast('🎉 เข้าสู่ระบบสำเร็จ! สวัสดี น้องกูส 🪿');
		initDemoOrders();
	}

	function handleLogout() {
		isLoggedIn = false;
		screen = 'LOGIN';
		screenHistory = [];
		cart = [];
		cartStore = null;
		showToast('👋 ออกจากระบบเรียบร้อย');
	}

	// =====================================================================
	// LOCATION STATE
	// =====================================================================
	let showLocationModal = $state(false);
	let currentDropoff = $state('ตึก LX ชั้น 1 (พหุวิทยาการ)');

	// =====================================================================
	// STORE STATE
	// =====================================================================
	let selectedStoreId = $state('store-panee');
	let selectedStore = $derived(getStoreById(selectedStoreId) || MOCK_STORES[0]);
	let storeFilterZone = $state('all');
	let storeSearchQuery = $state('');
	let filteredStores = $derived(() => {
		let result = MOCK_STORES;
		if (storeFilterZone !== 'all') {
			result = result.filter(s => s.locationId === storeFilterZone);
		}
		if (storeSearchQuery.trim()) {
			const q = storeSearchQuery.toLowerCase();
			result = result.filter(s => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q));
		}
		return result;
	});

	// =====================================================================
	// CART STATE
	// =====================================================================
	interface CartItem { menuItem: MenuItem; quantity: number; }
	let cart = $state<CartItem[]>([]);
	let cartStore = $state<Store | null>(null);
	let cartTotalItems = $derived(cart.reduce((s, i) => s + i.quantity, 0));
	let cartSubtotal = $derived(cart.reduce((s, i) => s + i.menuItem.price * i.quantity, 0));

	function addToCart(item: MenuItem, store: Store) {
		if (cartStore && cartStore.id !== store.id) {
			cart = [];
			cartStore = store;
			showToast(`🔄 เปลี่ยนร้านเป็น "${store.name}"`);
		}
		if (!cartStore) cartStore = store;
		const idx = cart.findIndex(c => c.menuItem.id === item.id);
		if (idx > -1) { cart[idx].quantity += 1; }
		else { cart.push({ menuItem: item, quantity: 1 }); }
		showToast(`➕ เพิ่ม "${item.name}" แล้ว`);
	}

	function removeFromCart(itemId: string) {
		const idx = cart.findIndex(c => c.menuItem.id === itemId);
		if (idx > -1) {
			if (cart[idx].quantity > 1) cart[idx].quantity -= 1;
			else cart.splice(idx, 1);
			if (cart.length === 0) cartStore = null;
		}
	}

	function getItemQty(id: string): number {
		return cart.find(c => c.menuItem.id === id)?.quantity ?? 0;
	}

	// =====================================================================
	// CHECKOUT STATE
	// =====================================================================
	let checkoutDropoff = $state('อาคารการเรียนรู้พหุวิทยาการ (LX) ชั้น 1 หน้าตู้เต่าบิน');
	let pickupNote = $state('');
	let promoInput = $state('');
	let appliedPromo = $state('');
	let codeDiscount = $state(0);
	let storeDiscount = $state(5);
	let deliveryFee = $state(20);
	let paymentMethod = $state<'PROMPTPAY' | 'CASH'>('PROMPTPAY');
	let showPromptPayModal = $state(false);
	let netTotal = $derived(Math.max(0, cartSubtotal + deliveryFee - codeDiscount - storeDiscount));

	function applyPromo() {
		if (promoInput.toUpperCase() === 'KMUTTFIRST') {
			appliedPromo = 'KMUTTFIRST';
			codeDiscount = 15;
			showToast('🎉 ใช้โค้ด KMUTTFIRST สำเร็จ! ลด 15 บาท');
		} else if (promoInput.toUpperCase() === 'GOOSEFREE') {
			appliedPromo = 'GOOSEFREE';
			codeDiscount = 20;
			showToast('🎉 ใช้โค้ด GOOSEFREE สำเร็จ! ฟรีค่าหิ้ว');
		} else {
			showToast('❌ โค้ดส่วนลดไม่ถูกต้อง');
		}
	}

	function handlePlaceOrder() {
		if (paymentMethod === 'PROMPTPAY') {
			showPromptPayModal = true;
		} else {
			completeOrder();
		}
	}

	function completeOrder() {
		showPromptPayModal = false;
		const otp = String(Math.floor(1000 + Math.random() * 9000));
		const newOrder: Order = {
			id: `ord-${otp}`,
			orderCode: `#KM-${otp}`,
			customerId: 'u-demo-001',
			customerEmail: userEmail,
			pickupHubId: cartStore?.locationId || '',
			pickupHubName: cartStore?.name || '',
			dropoffNodeId: 'lx-1',
			dropoffNodeName: checkoutDropoff,
			itemDetails: cart.map(c => `${c.menuItem.name} x${c.quantity}`).join(', '),
			estimatedPrice: cartSubtotal,
			deliveryFee: deliveryFee,
			discount: codeDiscount,
			totalPrice: netTotal,
			status: 'PENDING',
			otpCode: otp,
			note: pickupNote,
			createdAt: new Date().toISOString(),
		};
		activeOrders = [newOrder, ...activeOrders];
		currentOrderId = newOrder.id;
		cart = [];
		cartStore = null;
		appliedPromo = '';
		codeDiscount = 0;
		promoInput = '';
		pickupNote = '';
		showToast('🎉 สั่งซื้อสำเร็จ! กำลังหาเพื่อนรับหิ้ว...');
		screen = 'TRACKING';
		screenHistory = ['HOME'];

		// Simulate rider accepting after 3s
		setTimeout(() => {
			const o = activeOrders.find(o => o.id === newOrder.id);
			if (o && o.status === 'PENDING') {
				o.status = 'ACCEPTED';
				o.riderName = 'พี่สมชาย';
				o.riderFaculty = 'วิศวกรรมเครื่องกล ปี 3';
				o.riderRating = 4.95;
				o.riderPhone = '081-234-5678';
				o.acceptedAt = new Date().toISOString();
				showToast('✅ พี่สมชาย (วิศวะ ปี 3) รับงานหิ้วแล้ว!');
			}
		}, 3000);

		// Simulate delivering after 8s
		setTimeout(() => {
			const o = activeOrders.find(o => o.id === newOrder.id);
			if (o && o.status === 'ACCEPTED') {
				o.status = 'DELIVERING';
				o.deliveringAt = new Date().toISOString();
				showToast('🏃 พี่สมชาย ซื้อของเสร็จแล้ว กำลังเดินมาส่ง!');
			}
		}, 8000);
	}

	// =====================================================================
	// ORDER TRACKING STATE
	// =====================================================================
	let activeOrders = $state<Order[]>([]);
	let orderHistory = $state<Order[]>([]);
	let currentOrderId = $state('');
	let currentOrder = $derived(activeOrders.find(o => o.id === currentOrderId) || orderHistory.find(o => o.id === currentOrderId));
	let orderFilterStatus = $state<'all' | OrderStatus>('all');
	let allFilteredOrders = $derived([...activeOrders, ...orderHistory].filter(o => orderFilterStatus === 'all' || o.status === orderFilterStatus));

	function initDemoOrders() {
		orderHistory = [
			{
				id: 'ord-7720', orderCode: '#KM-7720', customerId: 'u-demo-001', customerEmail: userEmail,
				riderName: 'น้องแก้ว', riderFaculty: 'วิทยาศาสตร์ ปี 2', riderRating: 4.8,
				pickupHubId: 'green-canteen', pickupHubName: 'Green Canteen (190 ปี)',
				dropoffNodeId: 'cb2', dropoffNodeName: 'อาคาร CB2 ม้าหินอ่อน',
				itemDetails: 'ผัดไทกุ้งสด 1 จาน + น้ำมะนาว 1 แก้ว',
				estimatedPrice: 65, deliveryFee: 15, totalPrice: 80, status: 'COMPLETED',
				otpCode: '7720', createdAt: new Date(Date.now() - 86400000).toISOString(),
				completedAt: new Date(Date.now() - 84600000).toISOString(),
			} as Order,
			{
				id: 'ord-6100', orderCode: '#KM-6100', customerId: 'u-demo-001', customerEmail: userEmail,
				riderName: 'พี่โอ๊ต', riderFaculty: 'สถาปัตยกรรมศาสตร์ ปี 4', riderRating: 4.7,
				pickupHubId: '7eleven-dorm', pickupHubName: 'เซเว่นหน้าหอใน',
				dropoffNodeId: 'dorm-s6', dropoffNodeName: 'หอพักหญิง S6 ล็อบบี้',
				itemDetails: 'ขนมปัง + นม + ขนมขบเคี้ยว 2 ถุง',
				estimatedPrice: 95, deliveryFee: 15, totalPrice: 110, status: 'COMPLETED',
				otpCode: '6100', createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
			} as Order,
		];
	}

	function simulateComplete() {
		if (currentOrder && currentOrder.status === 'DELIVERING') {
			currentOrder.status = 'COMPLETED';
			currentOrder.completedAt = new Date().toISOString();
			showToast('🎉 ส่งมอบอาหารสำเร็จ!');
			// Move to history
			const idx = activeOrders.findIndex(o => o.id === currentOrder!.id);
			if (idx > -1) {
				const [done] = activeOrders.splice(idx, 1);
				orderHistory = [done, ...orderHistory];
			}
			screen = 'SUCCESS';
			screenHistory = ['HOME'];
		}
	}

	// =====================================================================
	// CHAT STATE
	// =====================================================================
	let chatMessages = $state<ChatMessage[]>([
		{ id: 'c1', sender: 'RIDER', text: 'สวัสดีครับ! กำลังรอคิวหน้าร้านให้อยู่นะครับ', time: '12:10 น.' },
		{ id: 'c2', sender: 'CUSTOMER', text: 'ขอบคุณครับพี่! ขอซุปมะนาวดองเพิ่มด้วยนะครับ', time: '12:12 น.' },
		{ id: 'c3', sender: 'SYSTEM', text: 'คนหิ้วได้รับอาหารเรียบร้อยแล้ว กำลังเดินทางไปส่ง', time: '12:15 น.' },
		{ id: 'c4', sender: 'RIDER', text: 'ได้อาหารครบแล้วครับ เดินข้ามสะพานลอยไปตึก LX แป๊บเดียวถึง!', time: '12:16 น.' },
	]);
	let chatInput = $state('');

	function sendChat() {
		if (!chatInput.trim()) return;
		chatMessages = [...chatMessages, { id: crypto.randomUUID(), sender: 'CUSTOMER', text: chatInput, time: 'เมื่อสักครู่' }];
		const msg = chatInput;
		chatInput = '';
		// Auto-reply after 2s
		setTimeout(() => {
			chatMessages = [...chatMessages, { id: crypto.randomUUID(), sender: 'RIDER', text: 'รับทราบครับ! 👍', time: 'เมื่อสักครู่' }];
		}, 2000);
	}

	// =====================================================================
	// RATING STATE
	// =====================================================================
	let ratingValue = $state(5);
	let ratingTags = $state<string[]>(['ส่งไวมาก ⚡', 'อาหารยังร้อน 🍲']);
	let extraTip = $state<number | null>(10);

	// =====================================================================
	// CUSTOM ORDER FORM STATE
	// =====================================================================
	let customPickup = $state('โรงอาหารพระจอมเกล้า (โรงชาย)');
	let customItems = $state('');
	let customPrice = $state(50);
	let customDropoff = $state('ตึก LX ชั้น 1 (พหุวิทยาการ)');

	function submitCustomOrder() {
		const otp = String(Math.floor(1000 + Math.random() * 9000));
		const newOrder: Order = {
			id: `ord-${otp}`, orderCode: `#KM-${otp}`, customerId: 'u-demo-001', customerEmail: userEmail,
			pickupHubId: '', pickupHubName: customPickup, dropoffNodeId: '', dropoffNodeName: customDropoff,
			itemDetails: customItems || 'ไม่ระบุรายการ', estimatedPrice: customPrice, deliveryFee: 20,
			totalPrice: customPrice + 20, status: 'PENDING', otpCode: otp, note: '', createdAt: new Date().toISOString(),
		};
		activeOrders = [newOrder, ...activeOrders];
		currentOrderId = newOrder.id;
		showToast('🎉 ฝากซื้อสำเร็จ! กำลังหาเพื่อนหิ้ว...');
		screen = 'TRACKING';
		screenHistory = ['HOME'];
		customItems = '';
		customPrice = 50;
		// Simulate
		setTimeout(() => { const o = activeOrders.find(o => o.id === newOrder.id); if (o && o.status === 'PENDING') { o.status = 'ACCEPTED'; o.riderName = 'น้องแก้ว'; o.riderFaculty = 'วิทยาศาสตร์ ปี 2'; o.riderRating = 4.8; o.riderPhone = '089-999-0000'; showToast('✅ น้องแก้ว รับงานหิ้วแล้ว!'); } }, 3000);
		setTimeout(() => { const o = activeOrders.find(o => o.id === newOrder.id); if (o && o.status === 'ACCEPTED') { o.status = 'DELIVERING'; showToast('🏃 น้องแก้ว ซื้อของเสร็จ กำลังเดินมาส่ง!'); } }, 8000);
	}

	// =====================================================================
	// TOAST STATE
	// =====================================================================
	let toastMessage = $state<string | null>(null);
	function showToast(msg: string) {
		toastMessage = msg;
		setTimeout(() => { toastMessage = null; }, 3500);
	}

	// =====================================================================
	// PROFILE EDIT STATE
	// =====================================================================
	let editingProfile = $state(false);

	// =====================================================================
	// BOTTOM NAV HELPERS
	// =====================================================================
	type TabId = 'home' | 'stores' | 'orders' | 'profile';
	let activeTab = $derived<TabId>(
		screen === 'HOME' ? 'home' :
		screen === 'STORES' || screen === 'STORE_DETAIL' || screen === 'CHECKOUT' ? 'stores' :
		screen === 'ORDERS' || screen === 'TRACKING' || screen === 'CHAT' || screen === 'SUCCESS' ? 'orders' :
		screen === 'PROFILE' ? 'profile' : 'home'
	);
</script>

<!-- ================================================================== -->
<!-- FULL SCREEN MOBILE CONTAINER                                       -->
<!-- ================================================================== -->
<div class="w-full max-w-md mx-auto min-h-screen bg-[#F8FAFC] flex flex-col relative sm:shadow-2xl sm:my-0">

<!-- ================================================================== -->
<!-- TOAST                                                              -->
<!-- ================================================================== -->
{#if toastMessage}
	<div class="fixed top-3 left-4 right-4 max-w-md mx-auto z-[60] bg-slate-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl text-xs font-medium flex items-center justify-between border border-[#FA4616]/30">
		<span class="leading-snug flex-1">{toastMessage}</span>
		<button onclick={() => (toastMessage = null)} class="ml-2 text-slate-400 hover:text-white">✕</button>
	</div>
{/if}

<!-- ================================================================== -->
<!-- LOCATION PICKER MODAL                                              -->
<!-- ================================================================== -->
{#if showLocationModal}
	<div class="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex justify-center items-end sm:items-center p-4">
		<div class="bg-white w-full max-w-sm rounded-[28px] p-5 shadow-2xl space-y-4">
			<div class="flex justify-between items-center border-b border-slate-100 pb-3">
				<h3 class="font-extrabold text-slate-900 text-sm">📍 เลือกจุดรับของ (มจธ. บางมด)</h3>
				<button onclick={() => (showLocationModal = false)} class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">✕</button>
			</div>
			<div class="space-y-2 max-h-64 overflow-y-auto">
				{#each DROPOFF_POINTS as loc}
					<button onclick={() => { currentDropoff = loc.name; checkoutDropoff = loc.name; showLocationModal = false; showToast(`📍 อัปเดตจุดรับเป็น ${loc.name}`); }}
						class="w-full text-left p-3 rounded-2xl border border-slate-100 hover:border-[#FA4616]/40 hover:bg-[#FFF5F2] flex items-center justify-between transition-all active:scale-98">
						<div>
							<div class="font-bold text-slate-800 text-xs">📍 {loc.name}</div>
							<div class="text-[11px] text-slate-400">{loc.note}</div>
						</div>
						{#if currentDropoff === loc.name}
							<span class="text-[#FA4616] font-bold text-[10px] bg-[#FFF5F2] px-2 py-0.5 rounded-full">✓ เลือก</span>
						{/if}
					</button>
				{/each}
			</div>
		</div>
	</div>
{/if}

<!-- ================================================================== -->
<!-- PROMPTPAY QR MODAL                                                 -->
<!-- ================================================================== -->
{#if showPromptPayModal}
	<div class="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex justify-center items-center p-4">
		<div class="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl space-y-4 text-center relative">
			<button onclick={() => (showPromptPayModal = false)} class="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">✕</button>
			<div class="flex justify-center items-center gap-2 pt-2">
				<div class="bg-[#113767] text-white px-3 py-1 rounded-lg font-bold text-xs uppercase tracking-wider">PromptPay</div>
			</div>
			<div class="bg-orange-50 text-[#FA4616] text-xs font-bold px-3 py-1.5 rounded-full inline-block">⏱️ กรุณาชำระภายใน 10:00 นาที</div>
			<div class="bg-gradient-to-b from-[#113767] to-[#0A2345] p-4 rounded-3xl shadow-xl max-w-[220px] mx-auto">
				<div class="bg-white p-3 rounded-2xl w-40 h-40 mx-auto flex items-center justify-center">
					<div class="w-full h-full bg-slate-900 rounded-lg p-2 grid grid-cols-5 gap-0.5">
						{#each Array(25) as _, i}<div class={`rounded-sm ${i % 3 === 0 ? 'bg-[#113767]' : i % 2 === 0 ? 'bg-white' : 'bg-slate-900'}`}></div>{/each}
					</div>
				</div>
				<div class="text-[11px] text-blue-100 font-medium mt-2">สแกนผ่านแอปธนาคารใดก็ได้</div>
			</div>
			<div class="text-3xl font-black text-[#FA4616]">{netTotal.toFixed(2)} ฿</div>
			<button onclick={() => { completeOrder(); }} class="w-full py-3.5 bg-[#FA4616] text-white font-extrabold rounded-full text-sm shadow-lg shadow-[#FA4616]/30 active:scale-95">
				ยืนยันชำระเรียบร้อย ({netTotal} ฿)
			</button>
		</div>
	</div>
{/if}

<!-- ================================================================== -->
<!-- SCREEN: LOGIN                                                      -->
<!-- ================================================================== -->
{#if screen === 'LOGIN'}
	<div class="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-b from-[#FA4616] via-orange-500 to-amber-500 min-h-screen text-white text-center">
		<div class="w-24 h-24 rounded-3xl bg-white/20 backdrop-blur-md flex items-center justify-center text-6xl mb-6 shadow-xl">🪿</div>
		<h1 class="text-3xl font-black mb-1">Goose Man</h1>
		<p class="text-orange-100 text-sm font-medium mb-1">กูสแมน (ห่านบางมด 🪿)</p>
		<p class="text-orange-200 text-xs mb-8 max-w-xs leading-relaxed">ขี้เกียจเดินฝ่าแดด? ให้ห่านบางมดหิ้วให้! แพลตฟอร์มฝากหิ้วอาหาร KMUTT Campus P2P Delivery</p>
		<button onclick={handleLogin} class="w-full max-w-xs bg-white text-slate-900 font-extrabold py-4 rounded-full shadow-xl flex items-center justify-center gap-3 text-sm hover:bg-slate-50 active:scale-95 transition-all">
			<svg class="w-5 h-5" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.9 32.7 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.2-2.7-.4-3.9z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.3 16 18.8 13 24 13c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.4 0-9.9-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.7 39.4 44 34 44 24c0-1.3-.2-2.7-.4-3.9z"/></svg>
			Sign in with Google (@kmutt.ac.th)
		</button>
		<p class="text-orange-200 text-[11px] mt-4">เข้าสู่ระบบได้เฉพาะบัญชีนักศึกษา มจธ. เท่านั้น</p>
	</div>

<!-- ================================================================== -->
<!-- LOGGED-IN SCREENS (with TopHeader + BottomNav)                     -->
<!-- ================================================================== -->
{:else}
	<!-- TOP HEADER -->
	<header class="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-2.5 flex items-center justify-between shadow-sm">
		<button onclick={() => { screen = 'HOME'; screenHistory = []; }} class="flex items-center gap-2 group">
			<div class="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#FA4616] to-amber-400 text-white flex items-center justify-center font-black text-xl shadow-md shadow-[#FA4616]/20 group-hover:scale-105 transition-transform">🪿</div>
			<div>
				<div class="font-extrabold text-slate-900 text-sm leading-none">Goose Man <span class="text-[10px] bg-amber-100 text-[#FA4616] px-1.5 py-0.5 rounded-full font-bold">ห่านบางมด 🪿</span></div>
				<div class="text-[10px] text-slate-400">KMUTT Campus P2P</div>
			</div>
		</button>
		<div class="flex items-center gap-2">
			<button onclick={() => (showLocationModal = true)} class="text-[10px] font-bold text-[#FA4616] bg-[#FFF5F2] px-2.5 py-1 rounded-full border border-[#FA4616]/20 truncate max-w-[140px]">📍 {currentDropoff.split('(')[0].trim()}</button>
			<button onclick={() => showToast('🔔 ไม่มีการแจ้งเตือนใหม่')} class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm relative">
				🔔
				{#if activeOrders.length > 0}<span class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#FA4616] border-2 border-white"></span>{/if}
			</button>
		</div>
	</header>

	<!-- SCROLLABLE BODY -->
	<div class="flex-1 overflow-y-auto overscroll-contain pb-20">

		<!-- ============================================================ -->
		<!-- SCREEN: HOME                                                 -->
		<!-- ============================================================ -->
		{#if screen === 'HOME'}
			<div class="p-5 space-y-5">
				<!-- Greeting -->
				<div class="flex items-center gap-3">
					<div class="w-12 h-12 rounded-2xl bg-[#FFF5F2] border-2 border-[#FA4616]/30 flex items-center justify-center text-2xl shadow-sm">🧑‍🎓</div>
					<div>
						<h1 class="font-extrabold text-slate-900 text-base">สวัสดี {userName} 🪿</h1>
						<p class="text-xs text-slate-500 flex items-center gap-1">มจธ. บางมด <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span></p>
					</div>
				</div>

				<!-- Location Chip -->
				<button onclick={() => (showLocationModal = true)} class="w-full bg-[#FFF5F2] text-[#FA4616] p-3 rounded-2xl text-xs font-bold border border-[#FA4616]/20 flex items-center justify-between shadow-sm">
					<span class="truncate">📍 จุดรับของ: <strong class="text-slate-900">{currentDropoff}</strong></span>
					<span class="text-[#FA4616] font-bold whitespace-nowrap ml-2">เปลี่ยน ▾</span>
				</button>

				<!-- Hero Banner -->
				<div class="relative bg-gradient-to-r from-[#FA4616] via-orange-500 to-amber-500 rounded-3xl p-5 text-white shadow-xl shadow-[#FA4616]/20 overflow-hidden">
					<div class="absolute -right-6 -bottom-6 text-7xl opacity-20 pointer-events-none">🪿</div>
					<div class="inline-block bg-white/20 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider mb-2">KMUTT Student P2P</div>
					<h2 class="text-lg font-black leading-tight">ขี้เกียจเดินฝ่าแดด? ☀️<br/>ให้ห่านบางมดหิ้วให้!</h2>
					<p class="text-xs text-orange-100 mt-1">ค่าหิ้วเริ่มต้น 15.- ส่งตรงถึงตึกเรียน</p>
					<div class="flex gap-2 mt-3">
						<button onclick={() => goTo('ORDER_CREATE')} class="bg-white text-[#FA4616] font-black px-4 py-2 rounded-full text-xs shadow-md active:scale-95">ฝากหิ้วเลย ➔</button>
						<button onclick={() => goTo('STORES')} class="bg-white/20 backdrop-blur-md text-white font-bold px-4 py-2 rounded-full text-xs active:scale-95">ดูร้านค้า 🏬</button>
					</div>
				</div>

				<!-- Quick Services -->
				<div class="grid grid-cols-3 gap-2.5">
					<button onclick={() => { selectedStoreId = 'store-panee'; goTo('STORE_DETAIL'); }} class="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md text-center space-y-1.5 active:scale-95 group">
						<div class="w-10 h-10 rounded-2xl bg-orange-50 text-[#FA4616] flex items-center justify-center text-xl mx-auto group-hover:scale-110 transition-transform">🍱</div>
						<div class="font-bold text-slate-900 text-[11px]">สั่งจากโรงชาย</div>
					</button>
					<button onclick={() => goTo('ORDER_CREATE')} class="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md text-center space-y-1.5 active:scale-95 group">
						<div class="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl mx-auto group-hover:scale-110 transition-transform">🛒</div>
						<div class="font-bold text-slate-900 text-[11px]">หิ้วเซเว่น</div>
					</button>
					<button onclick={() => goTo('STORES')} class="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md text-center space-y-1.5 active:scale-95 group">
						<div class="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl mx-auto group-hover:scale-110 transition-transform">🏬</div>
						<div class="font-bold text-slate-900 text-[11px]">ร้านค้าทั้งหมด</div>
					</button>
				</div>

				<!-- Active Order Banner -->
				{#if activeOrders.length > 0}
					<button onclick={() => { currentOrderId = activeOrders[0].id; goTo('TRACKING'); }}
						class="w-full bg-white p-4 rounded-2xl border-2 border-[#FA4616]/30 shadow-sm flex items-center justify-between hover:shadow-md transition-all active:scale-98">
						<div class="flex items-center gap-3">
							<div class="w-10 h-10 rounded-2xl bg-orange-100 text-[#FA4616] flex items-center justify-center text-xl animate-bounce">📦</div>
							<div class="text-left">
								<div class="font-extrabold text-slate-900 text-xs">{activeOrders[0].orderCode} — {activeOrders[0].status === 'PENDING' ? 'กำลังหาคนหิ้ว...' : activeOrders[0].status === 'ACCEPTED' ? 'คนหิ้วรับงานแล้ว!' : 'กำลังเดินมาส่ง!'}</div>
								<div class="text-[11px] text-slate-500 truncate max-w-[200px]">{activeOrders[0].itemDetails}</div>
							</div>
						</div>
						<span class="text-[#FA4616] font-bold text-xs">ดู ➔</span>
					</button>
				{/if}

				<!-- Partner Stores -->
				<div class="space-y-3">
					<div class="flex justify-between items-center">
						<h3 class="font-bold text-slate-900 text-sm">ร้านค้าพาร์ทเนอร์ยอดฮิต</h3>
						<button onclick={() => goTo('STORES')} class="text-xs text-[#FA4616] font-bold">ดูทั้งหมด ➔</button>
					</div>
					<div class="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
						{#each MOCK_STORES.slice(0, 3) as store}
							<button onclick={() => { selectedStoreId = store.id; goTo('STORE_DETAIL'); }} class="min-w-[200px] bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden text-left group active:scale-98">
								<div class="relative h-24 overflow-hidden">
									<img src={store.imageUrl} alt={store.name} class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
									{#if store.dealText}
										<div class="absolute top-2 left-2 bg-[#FA4616] text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full">🔥 โปร!</div>
									{/if}
								</div>
								<div class="p-3 space-y-0.5">
									<h4 class="font-extrabold text-slate-900 text-xs truncate">{store.name}</h4>
									<div class="text-[10px] text-slate-500">⭐ {store.rating} • {store.queueStatus}</div>
								</div>
							</button>
						{/each}
					</div>
				</div>

				<!-- Online Riders Counter -->
				<div class="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between text-xs">
					<div class="flex items-center gap-2">
						<div class="relative flex h-3 w-3"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></div>
						<span class="font-bold text-slate-800">เพื่อน นศ. พร้อมรับหิ้ว</span>
					</div>
					<span class="bg-emerald-50 text-emerald-700 font-extrabold px-3 py-1 rounded-full border border-emerald-200">42 คน ⚡</span>
				</div>
			</div>

		<!-- ============================================================ -->
		<!-- SCREEN: STORES                                               -->
		<!-- ============================================================ -->
		{:else if screen === 'STORES'}
			<div class="p-5 space-y-4">
				<div class="flex items-center justify-between">
					<button onclick={goBack} class="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold active:scale-95">←</button>
					<h2 class="font-extrabold text-slate-900 text-base">ร้านค้าทั้งหมด</h2>
					<div class="w-9"></div>
				</div>

				<!-- Search -->
				<input type="text" bind:value={storeSearchQuery} placeholder="🔍 ค้นหาร้านอาหาร เมนู..." class="w-full p-3 bg-white border border-slate-200 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-[#FA4616] shadow-sm" />

				<!-- Zone Filters -->
				<div class="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
					{#each [{ id: 'all', label: 'ทั้งหมด' }, { id: 'canteen-male', label: 'โรงชาย' }, { id: 'green-canteen', label: 'Green Canteen' }] as zone}
						<button onclick={() => (storeFilterZone = zone.id)} class={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap ${storeFilterZone === zone.id ? 'bg-[#FA4616] text-white shadow-sm' : 'bg-white text-slate-700 border border-slate-200'}`}>{zone.label}</button>
					{/each}
				</div>

				<!-- Store List -->
				<div class="space-y-3">
					{#each filteredStores() as store}
						<button onclick={() => { selectedStoreId = store.id; goTo('STORE_DETAIL'); }} class="w-full bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden text-left group active:scale-98 hover:shadow-md transition-all">
							<div class="relative h-36 overflow-hidden">
								<img src={store.imageUrl} alt={store.name} class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
								{#if store.dealText}<div class="absolute top-3 left-3 bg-[#FA4616] text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full shadow-md">🔥 โปร</div>{/if}
								<div class="absolute bottom-3 right-3 bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-bold px-3 py-1 rounded-full">คิว: {store.queueStatus}</div>
							</div>
							<div class="p-4 space-y-1">
								<div class="flex justify-between items-start">
									<h4 class="font-extrabold text-slate-900 text-sm">{store.name}</h4>
									<span class="text-xs font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full">⭐ {store.rating}</span>
								</div>
								<p class="text-xs text-slate-500">{store.category} • {store.reviewsCount} รีวิว</p>
								{#if store.dealText}<p class="text-[11px] text-[#FA4616] font-bold">{store.dealText}</p>{/if}
							</div>
						</button>
					{/each}
				</div>
			</div>

		<!-- ============================================================ -->
		<!-- SCREEN: STORE DETAIL                                         -->
		<!-- ============================================================ -->
		{:else if screen === 'STORE_DETAIL'}
			<div class="space-y-4 pb-24">
				<!-- Cover -->
				<div class="relative h-48 bg-slate-800">
					<img src={selectedStore.imageUrl} alt={selectedStore.name} class="w-full h-full object-cover opacity-90" />
					<div class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/40"></div>
					<div class="absolute top-4 left-4"><button onclick={goBack} class="w-9 h-9 rounded-full bg-white/90 backdrop-blur-md text-slate-800 flex items-center justify-center font-bold shadow-md">←</button></div>
				</div>

				<div class="px-5 space-y-2">
					<h1 class="text-xl font-black text-slate-900">{selectedStore.name}</h1>
					<div class="text-xs text-slate-500">⭐ <strong class="text-slate-800">{selectedStore.rating}</strong> ({selectedStore.reviewsCount} รีวิว) • คิว: <span class="text-[#FA4616] font-bold">{selectedStore.queueStatus}</span></div>
					{#if selectedStore.dealText}
						<div class="bg-[#FFF5F2] border border-[#FA4616]/30 p-3 rounded-2xl text-xs text-[#FA4616] font-medium flex items-center gap-2">
							<span class="text-lg">⚡</span><span><strong class="font-extrabold">{selectedStore.dealText}</strong></span>
						</div>
					{/if}
				</div>

				<!-- Menu Items -->
				<div class="px-5 space-y-3">
					<h3 class="font-bold text-slate-900 text-sm">เมนูอาหาร</h3>
					{#each selectedStore.menuItems || [] as item}
						{@const qty = getItemQty(item.id)}
						<div class="bg-white p-3.5 rounded-3xl border border-slate-100 shadow-sm flex gap-3 items-center">
							<img src={item.imageUrl} alt={item.name} class="w-20 h-20 rounded-2xl object-cover" />
							<div class="flex-1 space-y-1">
								<div class="font-bold text-slate-900 text-xs sm:text-sm">{item.name}</div>
								<div class="text-[11px] text-slate-400 line-clamp-2">{item.description}</div>
								<div class="flex items-center gap-2 pt-1">
									<span class="font-black text-[#FA4616] text-sm">{item.price} ฿</span>
									{#if item.originalPrice}<span class="text-[10px] text-slate-400 line-through">{item.originalPrice} ฿</span>{/if}
								</div>
							</div>
							<div class="flex flex-col items-center">
								{#if qty > 0}
									<div class="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
										<button onclick={() => removeFromCart(item.id)} class="w-6 h-6 rounded-lg bg-white text-slate-700 font-bold text-xs shadow-sm">-</button>
										<span class="text-xs font-black w-4 text-center">{qty}</span>
										<button onclick={() => addToCart(item, selectedStore)} class="w-6 h-6 rounded-lg bg-[#FA4616] text-white font-bold text-xs shadow-sm">+</button>
									</div>
								{:else}
									<button onclick={() => addToCart(item, selectedStore)} class="w-9 h-9 rounded-2xl bg-[#FA4616] text-white font-bold text-lg flex items-center justify-center shadow-md active:scale-90">+</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>

				<!-- Floating Cart Bar -->
				{#if cartTotalItems > 0}
					<div class="fixed bottom-20 left-4 right-4 max-w-md mx-auto z-30">
						<button onclick={() => goTo('CHECKOUT')} class="w-full bg-[#FA4616] text-white p-4 rounded-3xl shadow-2xl flex items-center justify-between active:scale-98 border border-white/20">
							<div class="flex items-center gap-2">
								<span class="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">{cartTotalItems}</span>
								<span class="font-bold text-xs">ตะกร้า | {cartSubtotal} ฿</span>
							</div>
							<span class="font-extrabold text-sm">ไปชำระเงิน ➔</span>
						</button>
					</div>
				{/if}
			</div>

		<!-- ============================================================ -->
		<!-- SCREEN: ORDER CREATE (Custom)                                -->
		<!-- ============================================================ -->
		{:else if screen === 'ORDER_CREATE'}
			<div class="p-5 space-y-5">
				<div class="flex items-center justify-between">
					<button onclick={goBack} class="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold active:scale-95">←</button>
					<h2 class="font-extrabold text-slate-900 text-base">ฝากซื้ออาหาร / ของกิน</h2>
					<div class="w-9"></div>
				</div>

				<div class="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-4">
					<div class="space-y-1">
						<div class="text-xs font-bold text-slate-800">1. เลือกจุดซื้ออาหาร</div>
						<select bind:value={customPickup} class="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none">
							{#each PICKUP_HUBS as hub}<option value={hub.name}>{hub.name}</option>{/each}
						</select>
					</div>
					<div class="space-y-1">
						<div class="text-xs font-bold text-slate-800">2. รายการอาหาร / ของที่ต้องการ</div>
						<textarea bind:value={customItems} rows="3" placeholder="เช่น ข้าวมันไก่ผสมพิเศษ ร้านป้าณี ล็อก 8..." class="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs outline-none resize-none"></textarea>
					</div>
					<div class="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-200">
						<div>
							<div class="text-xs font-bold text-slate-800">3. ประเมินราคา (บาท)</div>
							<div class="text-[11px] text-slate-400">เพื่อนจะสำรองจ่ายให้ก่อน</div>
						</div>
						<input type="number" bind:value={customPrice} class="w-20 text-right p-2 bg-white font-extrabold text-slate-900 rounded-xl text-base border border-slate-200" />
					</div>
					<div class="space-y-1">
						<div class="text-xs font-bold text-slate-800">4. จุดส่งมอบ</div>
						<button onclick={() => (showLocationModal = true)} class="w-full p-3 bg-[#FFF5F2] border border-[#FA4616]/30 rounded-2xl text-xs font-bold text-slate-800 flex items-center justify-between">
							<span>📍 {currentDropoff}</span>
							<span class="text-[#FA4616] font-extrabold">เปลี่ยน</span>
						</button>
					</div>
				</div>

				<div class="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-2 text-xs">
					<div class="flex justify-between"><span class="text-slate-600">ค่าอาหารประมาณ</span><span class="font-bold text-slate-900">{customPrice} ฿</span></div>
					<div class="flex justify-between"><span class="text-slate-600">ค่าหิ้วน้ำใจเพื่อน</span><span class="font-bold text-[#FA4616]">20 ฿</span></div>
					<hr class="border-dashed border-slate-200" />
					<div class="flex justify-between items-center text-sm font-bold pt-1">
						<span class="text-slate-900">ยอดรวม</span>
						<span class="text-[#FA4616] text-xl font-black">{customPrice + 20} ฿</span>
					</div>
				</div>

				<button onclick={submitCustomOrder} class="w-full bg-[#FA4616] text-white font-extrabold py-4 rounded-full shadow-lg shadow-[#FA4616]/30 text-sm active:scale-95">
					ยืนยันฝากซื้อและหาเพื่อนหิ้ว ({customPrice + 20} ฿)
				</button>
			</div>

		<!-- ============================================================ -->
		<!-- SCREEN: CHECKOUT                                             -->
		<!-- ============================================================ -->
		{:else if screen === 'CHECKOUT'}
			<div class="p-5 space-y-5">
				<div class="flex items-center justify-between">
					<button onclick={goBack} class="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold active:scale-95">←</button>
					<h2 class="font-extrabold text-slate-900 text-base">สรุปคำสั่งซื้อ</h2>
					<div class="w-9"></div>
				</div>

				<!-- Dropoff -->
				<div class="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-3">
					<div class="flex items-center justify-between text-xs font-bold text-slate-800">
						<span class="text-[#FA4616]">📍 จุดส่งมอบ</span>
						<button onclick={() => (showLocationModal = true)} class="text-[#FA4616] text-xs">เปลี่ยน ▾</button>
					</div>
					<div class="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800">{checkoutDropoff}</div>
					<textarea bind:value={pickupNote} rows="2" placeholder="หมายเหตุถึงคนหิ้ว เช่น นั่งม้าหินอ่อน ใส่เสื้อสีขาว..." class="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs outline-none resize-none"></textarea>
				</div>

				<!-- Cart Items -->
				<div class="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-3">
					<div class="font-bold text-slate-900 text-xs flex items-center gap-2 border-b border-slate-100 pb-2">🏪 {cartStore?.name}</div>
					{#each cart as item}
						<div class="flex justify-between items-center text-xs text-slate-800">
							<span>{item.quantity}x {item.menuItem.name}</span>
							<span class="font-bold">{item.menuItem.price * item.quantity} ฿</span>
						</div>
					{/each}
					<button onclick={goBack} class="text-[#FA4616] text-xs font-bold">+ เพิ่มรายการอาหาร</button>
				</div>

				<!-- Promo -->
				<div class="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-3">
					<div class="font-bold text-slate-900 text-xs">🎫 โค้ดส่วนลด</div>
					<div class="flex gap-2">
						<input type="text" bind:value={promoInput} placeholder="ใส่โค้ด เช่น KMUTTFIRST" class="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold uppercase outline-none" />
						<button onclick={applyPromo} class="bg-[#FA4616] text-white px-4 py-3 rounded-2xl text-xs font-bold active:scale-95 shadow-md">ใช้โค้ด</button>
					</div>
					{#if appliedPromo}
						<div class="bg-emerald-50 text-emerald-700 p-2.5 rounded-2xl text-xs font-bold flex justify-between items-center border border-emerald-200">
							<span>{appliedPromo} ลด {codeDiscount} บาท</span>
							<button onclick={() => { appliedPromo = ''; codeDiscount = 0; }} class="text-emerald-700 font-bold">✕</button>
						</div>
					{/if}
				</div>

				<!-- Total -->
				<div class="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-2 text-xs">
					<div class="flex justify-between"><span class="text-slate-600">ค่าอาหาร</span><span class="font-bold text-slate-900">{cartSubtotal} ฿</span></div>
					<div class="flex justify-between"><span class="text-slate-600">ค่าหิ้วน้ำใจ</span><span class="font-bold text-slate-900">{deliveryFee} ฿</span></div>
					{#if codeDiscount > 0}<div class="flex justify-between text-emerald-600 font-bold"><span>ส่วนลดโค้ด</span><span>-{codeDiscount} ฿</span></div>{/if}
					{#if storeDiscount > 0}<div class="flex justify-between text-emerald-600 font-bold"><span>ส่วนลดร้านพาร์ทเนอร์</span><span>-{storeDiscount} ฿</span></div>{/if}
					<hr class="border-slate-100" />
					<div class="flex justify-between items-center text-sm font-bold pt-1">
						<span class="text-slate-900">ยอดชำระสุทธิ</span>
						<span class="text-[#FA4616] text-2xl font-black">{netTotal} ฿</span>
					</div>
				</div>

				<!-- Payment Method -->
				<div class="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-3">
					<div class="font-bold text-slate-900 text-xs">เลือกวิธีชำระเงิน</div>
					{#each [{ val: 'PROMPTPAY' as const, label: 'PromptPay QR Code', sub: '(แนะนำ / ปลดล็อกเงินอัตโนมัติ)' }, { val: 'CASH' as const, label: 'เงินสดปลายทาง', sub: '(จ่ายให้เพื่อนตอนรับของ)' }] as pm}
						<button onclick={() => (paymentMethod = pm.val)} class={`w-full p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all ${paymentMethod === pm.val ? 'border-[#FA4616] bg-[#FFF5F2]' : 'border-slate-200'}`}>
							<div class={`w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center ${paymentMethod === pm.val ? 'border-[#FA4616] bg-[#FA4616]' : 'border-slate-300'}`}>
								{#if paymentMethod === pm.val}<div class="w-1.5 h-1.5 rounded-full bg-white"></div>{/if}
							</div>
							<div><div class="font-bold text-slate-900 text-xs">{pm.label}</div><div class="text-[11px] text-slate-500">{pm.sub}</div></div>
						</button>
					{/each}
				</div>

				<button onclick={handlePlaceOrder} class="w-full bg-[#FA4616] text-white font-extrabold py-4 rounded-full shadow-lg shadow-[#FA4616]/30 text-sm active:scale-95">
					สั่งอาหารและหาคนหิ้ว ({netTotal} ฿)
				</button>
			</div>

		<!-- ============================================================ -->
		<!-- SCREEN: TRACKING                                             -->
		<!-- ============================================================ -->
		{:else if screen === 'TRACKING' && currentOrder}
			<div class="p-5 space-y-5">
				<div class="flex items-center justify-between">
					<button onclick={() => { screen = 'HOME'; screenHistory = []; }} class="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold active:scale-95">←</button>
					<h2 class="font-extrabold text-slate-900 text-base">{currentOrder.orderCode}</h2>
					<span class="text-[10px] font-bold bg-orange-100 text-[#FA4616] px-2.5 py-1 rounded-full whitespace-nowrap">
						{currentOrder.status === 'PENDING' ? '⏳ หาคนหิ้ว...' : currentOrder.status === 'ACCEPTED' ? '✅ รับงานแล้ว' : currentOrder.status === 'DELIVERING' ? '🏃 กำลังส่ง' : '✓ เสร็จ'}
					</span>
				</div>

				<!-- Timeline Stepper -->
				<div class="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
					<div class="space-y-3 relative before:absolute before:left-3.5 before:top-3 before:bottom-3 before:w-[2px] before:bg-slate-100">
						{#each [
							{ step: 'สร้างออเดอร์', done: true, active: false, time: currentOrder.createdAt ? new Date(currentOrder.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '' },
							{ step: 'เพื่อนรับงานหิ้ว', done: ['ACCEPTED', 'DELIVERING', 'COMPLETED'].includes(currentOrder.status), active: currentOrder.status === 'ACCEPTED', time: currentOrder.acceptedAt ? new Date(currentOrder.acceptedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '' },
							{ step: 'ซื้อเสร็จ กำลังเดินมาส่ง', done: ['DELIVERING', 'COMPLETED'].includes(currentOrder.status), active: currentOrder.status === 'DELIVERING', time: currentOrder.deliveringAt ? new Date(currentOrder.deliveringAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '' },
							{ step: 'ส่งมอบสำเร็จ (OTP)', done: currentOrder.status === 'COMPLETED', active: false, time: '' },
						] as s}
							<div class="flex items-center justify-between text-xs relative z-10">
								<div class="flex items-center gap-3">
									<div class={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${s.done ? 'bg-[#FA4616] text-white' : s.active ? 'bg-[#FA4616] text-white animate-pulse' : 'bg-slate-100 border-2 border-slate-200 text-slate-300'}`}>
										{s.done ? '✓' : s.active ? '●' : '○'}
									</div>
									<span class={s.done || s.active ? 'font-bold text-slate-900' : 'text-slate-400'}>{s.step}</span>
								</div>
								{#if s.time}<span class="text-slate-400 text-[11px]">{s.time}</span>{/if}
							</div>
						{/each}
					</div>
				</div>

				<!-- Rider Info (if assigned) -->
				{#if currentOrder.riderName}
					<div class="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
						<div class="flex items-center gap-3">
							<div class="w-12 h-12 rounded-2xl bg-[#FA4616] text-white flex items-center justify-center font-black text-lg shadow-md">{currentOrder.riderName.charAt(0)}</div>
							<div>
								<div class="font-extrabold text-slate-900 text-sm">{currentOrder.riderName}</div>
								<div class="text-xs text-slate-500">{currentOrder.riderFaculty} • ⭐ {currentOrder.riderRating}</div>
							</div>
						</div>
						<div class="flex gap-2">
							<button onclick={() => goTo('CHAT')} class="w-10 h-10 rounded-2xl bg-[#FFF5F2] text-[#FA4616] flex items-center justify-center text-lg shadow-sm">💬</button>
							<button onclick={() => showToast('📞 กำลังโทรออก...')} class="w-10 h-10 rounded-2xl bg-[#FFF5F2] text-[#FA4616] flex items-center justify-center text-lg shadow-sm">📞</button>
						</div>
					</div>
				{:else}
					<div class="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm text-center space-y-2">
						<div class="text-3xl animate-bounce">🔍</div>
						<div class="font-bold text-slate-900 text-sm">กำลังค้นหาเพื่อนรับหิ้ว...</div>
						<div class="text-xs text-slate-500">ระบบกำลังแมตช์กับ นศ. ที่อยู่ใกล้ร้านอาหาร</div>
					</div>
				{/if}

				<!-- OTP Display -->
				{#if currentOrder.status === 'DELIVERING' || currentOrder.status === 'ACCEPTED'}
					<div class="bg-gradient-to-b from-[#FFF5F2] to-orange-50/80 p-6 rounded-3xl border-2 border-dashed border-[#FA4616] text-center space-y-3 shadow-sm">
						<div class="w-10 h-10 rounded-full bg-white text-[#FA4616] flex items-center justify-center text-xl mx-auto shadow-sm">🔑</div>
						<h3 class="font-extrabold text-slate-900 text-base">รหัส OTP ปิดงาน</h3>
						<div class="flex justify-center gap-3">
							{#each currentOrder.otpCode.split('') as digit}
								<div class="w-14 h-16 rounded-2xl bg-white border-2 border-orange-200 flex items-center justify-center font-black text-3xl text-[#FA4616] shadow-md">{digit}</div>
							{/each}
						</div>
						<p class="text-xs text-slate-500">แจ้งรหัส 4 หลักนี้ให้เพื่อนเมื่อรับของเรียบร้อย</p>
					</div>
				{/if}

				<!-- Item Details Card -->
				<div class="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm text-xs space-y-2">
					<div class="font-bold text-slate-900">📝 รายการที่สั่ง</div>
					<div class="text-slate-600">{currentOrder.itemDetails}</div>
					<hr class="border-slate-100" />
					<div class="flex justify-between"><span class="text-slate-500">รวมชำระ</span><span class="font-black text-[#FA4616]">{currentOrder.totalPrice} ฿</span></div>
				</div>

				<!-- Simulate Complete Button (for demo) -->
				{#if currentOrder.status === 'DELIVERING'}
					<button onclick={simulateComplete} class="w-full bg-emerald-500 text-white font-extrabold py-4 rounded-full shadow-lg text-sm active:scale-95">
						🎉 จำลอง: คนหิ้วกรอก OTP สำเร็จ (ส่งของเรียบร้อย)
					</button>
				{/if}
			</div>

		<!-- ============================================================ -->
		<!-- SCREEN: CHAT                                                 -->
		<!-- ============================================================ -->
		{:else if screen === 'CHAT'}
			<div class="flex flex-col h-[calc(100vh-120px)]">
				<div class="bg-white p-3 border-b border-slate-100 flex items-center gap-3">
					<button onclick={goBack} class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold active:scale-95">←</button>
					<div class="w-9 h-9 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-sm">ส</div>
					<div>
						<div class="font-extrabold text-slate-900 text-xs">พี่สมชาย (วิศวะ ปี 3)</div>
						<div class="text-[11px] text-emerald-600 font-bold">● กำลังส่ง</div>
					</div>
				</div>
				<div class="flex-1 p-4 space-y-3 overflow-y-auto bg-slate-50">
					{#each chatMessages as msg}
						{#if msg.sender === 'SYSTEM'}
							<div class="text-center"><span class="bg-slate-200/80 text-slate-600 text-[10px] font-bold px-3 py-1 rounded-full">{msg.text}</span></div>
						{:else if msg.sender === 'RIDER'}
							<div class="flex flex-col items-start max-w-[85%]">
								<div class="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-100 text-xs text-slate-800 shadow-sm">{msg.text}</div>
								<span class="text-[10px] text-slate-400 mt-0.5">{msg.time}</span>
							</div>
						{:else}
							<div class="flex flex-col items-end max-w-[85%] ml-auto">
								<div class="bg-[#FA4616] text-white p-3 rounded-2xl rounded-tr-none text-xs shadow-md">{msg.text}</div>
								<span class="text-[10px] text-slate-400 mt-0.5">{msg.time}</span>
							</div>
						{/if}
					{/each}
				</div>
				<div class="p-2 bg-white border-t border-slate-100 flex gap-1.5 overflow-x-auto text-xs">
					{#each ['รออยู่หน้าตู้เต่าบินครับ', 'ขอบคุณครับ!', 'มาถึงรึยังครับ?'] as chip}
						<button onclick={() => { chatInput = chip; sendChat(); }} class="px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 font-bold whitespace-nowrap">{chip}</button>
					{/each}
				</div>
				<div class="p-3 bg-white border-t border-slate-100 flex items-center gap-2">
					<input type="text" bind:value={chatInput} placeholder="พิมพ์ข้อความ..." onkeydown={(e) => e.key === 'Enter' && sendChat()} class="flex-1 bg-slate-100 p-3 rounded-full text-xs outline-none focus:ring-2 focus:ring-[#FA4616]" />
					<button onclick={sendChat} class="w-10 h-10 rounded-full bg-[#FA4616] text-white flex items-center justify-center font-bold shadow-md active:scale-90">➔</button>
				</div>
			</div>

		<!-- ============================================================ -->
		<!-- SCREEN: SUCCESS                                              -->
		<!-- ============================================================ -->
		{:else if screen === 'SUCCESS'}
			<div class="p-6 text-center space-y-5 pt-6">
				<div class="relative w-28 h-28 mx-auto">
					<div class="w-24 h-24 rounded-full bg-[#FFF5F2] text-5xl flex items-center justify-center mx-auto shadow-md border-2 border-[#FA4616]/30">🪿</div>
					<div class="absolute bottom-0 right-2 w-10 h-10 rounded-full bg-emerald-500 text-white border-4 border-white flex items-center justify-center text-lg font-bold shadow-lg">✓</div>
				</div>
				<div>
					<h2 class="text-xl font-black text-slate-900">ส่งมอบสำเร็จ! 🎉</h2>
					<p class="text-xs text-slate-500 mt-1">ขอบคุณที่ใช้บริการ Goose Man (ห่านบางมด)!</p>
				</div>

				<!-- Rating -->
				<div class="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
					<h3 class="font-bold text-slate-900 text-sm">ให้คะแนนเพื่อนคนหิ้ว</h3>
					<div class="flex justify-center gap-2">
						{#each [1, 2, 3, 4, 5] as star}
							<button onclick={() => (ratingValue = star)} class={`text-3xl transition-transform active:scale-125 ${ratingValue >= star ? 'text-amber-400 scale-110' : 'text-slate-200'}`}>★</button>
						{/each}
					</div>
					<div class="flex flex-wrap justify-center gap-2">
						{#each ['ส่งไวมาก ⚡', 'อาหารยังร้อน 🍲', 'พูดจาสุภาพ 😊', 'ตรงเวลา ⏰'] as tag}
							<button onclick={() => { ratingTags = ratingTags.includes(tag) ? ratingTags.filter(t => t !== tag) : [...ratingTags, tag]; }}
								class={`px-3 py-1.5 rounded-full text-xs font-bold border ${ratingTags.includes(tag) ? 'bg-[#FFF5F2] text-[#FA4616] border-[#FA4616]/30' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>{tag}</button>
						{/each}
					</div>
				</div>

				<!-- Extra Tip -->
				<div class="space-y-2">
					<div class="text-xs font-bold text-slate-700">ทิปเพิ่ม (ไม่บังคับ)</div>
					<div class="grid grid-cols-3 gap-2">
						{#each [5, 10, null] as tip}
							<button onclick={() => (extraTip = tip)} class={`py-3 rounded-2xl text-xs font-bold border ${extraTip === tip ? 'bg-[#FA4616] text-white border-[#FA4616]' : 'bg-white border-slate-200 text-slate-700'}`}>{tip ? `+${tip} ฿` : 'ไม่ใส่'}</button>
						{/each}
					</div>
				</div>

				<button onclick={() => { screen = 'HOME'; screenHistory = []; showToast('ขอบคุณสำหรับรีวิว! กลับสู่หน้าหลัก'); }}
					class="w-full bg-[#FA4616] text-white font-extrabold py-4 rounded-full shadow-lg shadow-[#FA4616]/30 text-sm active:scale-95">เสร็จสิ้น กลับหน้าหลัก</button>
			</div>

		<!-- ============================================================ -->
		<!-- SCREEN: ORDERS (History)                                     -->
		<!-- ============================================================ -->
		{:else if screen === 'ORDERS'}
			<div class="p-5 space-y-4">
				<h2 class="font-extrabold text-slate-900 text-base">คำสั่งซื้อทั้งหมด</h2>

				<!-- Status Filter -->
				<div class="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
					{#each [{ id: 'all' as const, label: 'ทั้งหมด' }, { id: 'DELIVERING' as const, label: '🏃 กำลังส่ง' }, { id: 'COMPLETED' as const, label: '✓ สำเร็จ' }] as f}
						<button onclick={() => (orderFilterStatus = f.id)} class={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap ${orderFilterStatus === f.id ? 'bg-[#FA4616] text-white' : 'bg-white text-slate-700 border border-slate-200'}`}>{f.label}</button>
					{/each}
				</div>

				<!-- Order Cards -->
				{#if allFilteredOrders.length === 0}
					<div class="text-center py-10 text-slate-400">
						<div class="text-4xl mb-3">📦</div>
						<div class="font-bold text-sm">ยังไม่มีคำสั่งซื้อ</div>
						<button onclick={() => goTo('STORES')} class="mt-3 text-[#FA4616] font-bold text-xs">ไปสั่งอาหารเลย ➔</button>
					</div>
				{:else}
					<div class="space-y-3">
						{#each allFilteredOrders as order}
							<button onclick={() => { currentOrderId = order.id; goTo('TRACKING'); }}
								class="w-full bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-left hover:shadow-md transition-all active:scale-98 space-y-2">
								<div class="flex justify-between items-center">
									<span class="font-extrabold text-slate-900 text-xs">{order.orderCode}</span>
									<span class={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${order.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : order.status === 'CANCELLED' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-[#FA4616]'}`}>
										{order.status === 'COMPLETED' ? '✓ สำเร็จ' : order.status === 'CANCELLED' ? '✕ ยกเลิก' : order.status === 'DELIVERING' ? '🏃 กำลังส่ง' : order.status === 'ACCEPTED' ? '✅ รับงานแล้ว' : '⏳ รอคนหิ้ว'}
									</span>
								</div>
								<div class="text-xs text-slate-600 truncate">{order.itemDetails}</div>
								<div class="flex justify-between items-center text-[11px] text-slate-400">
									<span>{order.pickupHubName} ➔ {order.dropoffNodeName.split('(')[0].trim()}</span>
									<span class="font-bold text-slate-900">{order.totalPrice} ฿</span>
								</div>
							</button>
						{/each}
					</div>
				{/if}
			</div>

		<!-- ============================================================ -->
		<!-- SCREEN: PROFILE                                              -->
		<!-- ============================================================ -->
		{:else if screen === 'PROFILE'}
			<div class="p-5 space-y-5">
				<h2 class="font-extrabold text-slate-900 text-base">โปรไฟล์ของฉัน</h2>

				<!-- Avatar & Name -->
				<div class="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm text-center space-y-3">
					<div class="w-20 h-20 rounded-full bg-[#FFF5F2] text-4xl flex items-center justify-center mx-auto shadow-md border-2 border-[#FA4616]/30">🧑‍🎓</div>
					<div>
						<h3 class="font-extrabold text-slate-900 text-lg">{userName}</h3>
						<p class="text-xs text-slate-500">{userEmail}</p>
					</div>
				</div>

				<!-- Info Card -->
				<div class="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-3">
					{#each [
						{ label: 'Student ID', value: userStudentId, icon: '🎓' },
						{ label: 'เบอร์โทรศัพท์', value: userPhone, icon: '📞' },
						{ label: 'PromptPay No.', value: userPromptPay, icon: '💳' },
						{ label: 'จุดรับเริ่มต้น', value: currentDropoff, icon: '📍' },
					] as item}
						<div class="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
							<div class="flex items-center gap-2">
								<span class="text-lg">{item.icon}</span>
								<div>
									<div class="text-[11px] text-slate-400">{item.label}</div>
									<div class="text-xs font-bold text-slate-900">{item.value}</div>
								</div>
							</div>
						</div>
					{/each}
				</div>

				<!-- Stats -->
				<div class="grid grid-cols-3 gap-2.5">
					<div class="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm text-center">
						<div class="text-lg font-black text-[#FA4616]">{orderHistory.length}</div>
						<div class="text-[10px] text-slate-500 font-medium">ออเดอร์สำเร็จ</div>
					</div>
					<div class="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm text-center">
						<div class="text-lg font-black text-[#FA4616]">{orderHistory.reduce((s, o) => s + (o.totalPrice || 0), 0)}</div>
						<div class="text-[10px] text-slate-500 font-medium">บาท (รวม)</div>
					</div>
					<div class="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm text-center">
						<div class="text-lg font-black text-amber-500">⭐ 4.9</div>
						<div class="text-[10px] text-slate-500 font-medium">คะแนนเฉลี่ย</div>
					</div>
				</div>

				<!-- App Info -->
				<div class="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-2">
					<button class="w-full text-left py-2 text-xs font-bold text-slate-700 flex items-center justify-between border-b border-slate-50">
						<span>📜 เงื่อนไขการใช้งาน</span><span class="text-slate-400">➔</span>
					</button>
					<button class="w-full text-left py-2 text-xs font-bold text-slate-700 flex items-center justify-between border-b border-slate-50">
						<span>🔒 นโยบายความเป็นส่วนตัว</span><span class="text-slate-400">➔</span>
					</button>
					<button class="w-full text-left py-2 text-xs font-bold text-slate-700 flex items-center justify-between">
						<span>💬 ติดต่อเรา / รายงานปัญหา</span><span class="text-slate-400">➔</span>
					</button>
				</div>

				<div class="text-center text-[11px] text-slate-400 font-medium">Goose Man (กูสแมน - ห่านบางมด) v1.0.0 — KMUTT Bangmod</div>

				<button onclick={handleLogout} class="w-full bg-slate-100 text-slate-700 font-extrabold py-3.5 rounded-full text-sm active:scale-95 hover:bg-slate-200">
					ออกจากระบบ
				</button>
			</div>
		{/if}

	</div>

	<!-- ============================================================ -->
	<!-- BOTTOM NAV BAR (5 Tabs)                                      -->
	<!-- ============================================================ -->
	{#if screen !== 'CHAT'}
		<nav class="sticky bottom-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-100 px-3 py-2 flex justify-around items-center shadow-lg">
			<button onclick={() => { screen = 'HOME'; screenHistory = []; }} class={`flex flex-col items-center gap-0.5 text-xs font-bold transition-all ${activeTab === 'home' ? 'text-[#FA4616] scale-105' : 'text-slate-400'}`}>
				<span class="text-lg">🏠</span><span class="text-[10px]">หน้าแรก</span>
			</button>
			<button onclick={() => { screen = 'STORES'; screenHistory = ['HOME']; }} class={`flex flex-col items-center gap-0.5 text-xs font-bold transition-all relative ${activeTab === 'stores' ? 'text-[#FA4616] scale-105' : 'text-slate-400'}`}>
				<span class="text-lg">🏬</span><span class="text-[10px]">ร้านค้า</span>
				{#if cartTotalItems > 0}
					<span class="absolute -top-1 right-0 w-4 h-4 rounded-full bg-[#FA4616] text-white text-[9px] font-black flex items-center justify-center border border-white">{cartTotalItems}</span>
				{/if}
			</button>
			<button onclick={() => { screen = 'ORDERS'; screenHistory = ['HOME']; }} class={`flex flex-col items-center gap-0.5 text-xs font-bold transition-all relative ${activeTab === 'orders' ? 'text-[#FA4616] scale-105' : 'text-slate-400'}`}>
				<span class="text-lg">📦</span><span class="text-[10px]">คำสั่งซื้อ</span>
				{#if activeOrders.length > 0}
					<span class="absolute -top-1 right-0 w-4 h-4 rounded-full bg-[#FA4616] text-white text-[9px] font-black flex items-center justify-center border border-white">{activeOrders.length}</span>
				{/if}
			</button>
			<button onclick={() => { screen = 'PROFILE'; screenHistory = ['HOME']; }} class={`flex flex-col items-center gap-0.5 text-xs font-bold transition-all ${activeTab === 'profile' ? 'text-[#FA4616] scale-105' : 'text-slate-400'}`}>
				<span class="text-lg">👤</span><span class="text-[10px]">โปรไฟล์</span>
			</button>
		</nav>
	{/if}
{/if}

</div>
