<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import head from '$lib/assets/goose-head-1.webp';
	import Icon from '$lib/components/Icon.svelte';
	import { initialOf } from '$lib/utils';
	import { consoleState as c, PAGES, type Page } from '../console.svelte';
	import { bangkokToday, clock, thaiDate } from '../format';

	let { children }: { children: Snippet } = $props();

	const MOBILE_TABS: Page[] = ['overview', 'orders', 'finance', 'stores'];

	let searchText = $state('');
	let mobileSearch = $state(false);
	let moreOpen = $state(false);
	let userMenu = $state(false);
	let dateInput = $state<HTMLInputElement>();

	const visible = $derived(PAGES.filter((p) => !p.admin || c.isAdmin));
	const current = $derived(PAGES.find((p) => p.id === c.page)!);
	const isToday = $derived(c.day === bangkokToday());
	const initial = $derived(initialOf(c.me?.nickname || c.me?.email || '?').toUpperCase());

	function search(e: SubmitEvent) {
		e.preventDefault();
		c.search = searchText.trim();
		mobileSearch = false;
		c.go('orders');
	}

	function openDate() {
		try {
			dateInput?.showPicker();
		} catch {
			dateInput?.focus();
		}
	}

	function onkeydown(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			document.getElementById('console-search')?.focus();
		}
		if (e.key === 'Escape') {
			moreOpen = false;
			userMenu = false;
		}
	}
</script>

<svelte:window {onkeydown} />

{#snippet navItem(p: (typeof PAGES)[number], compact = false)}
	{@const active = c.page === p.id}
	{@const badge = c.badges[p.id] ?? 0}
	<button
		type="button"
		onclick={() => c.go(p.id)}
		aria-current={active ? 'page' : undefined}
		title={compact ? p.label : undefined}
		class="relative flex h-11 w-full items-center gap-3 rounded-xl px-3 text-[15px] transition-colors {compact ? 'justify-center' : ''} {active
			? 'bg-brand font-semibold text-white shadow-sm shadow-brand/30'
			: 'text-slate-700 hover:bg-slate-50'}"
	>
		<Icon name={p.icon} class="h-5 w-5" strokeWidth={1.9} />
		{#if !compact}<span class="min-w-0 flex-1 truncate text-left">{p.label}</span>{/if}
		{#if badge > 0}
			<span
				class="{compact ? 'absolute top-1 right-1 min-w-4 px-1 text-[10px]' : 'min-w-6 px-1.5 text-xs'} rounded-full text-center font-semibold tabular-nums {active ? 'bg-white/25 text-white' : 'bg-brand-50 text-brand-700'}"
				>{badge > 99 ? '99+' : badge}</span
			>
		{/if}
	</button>
{/snippet}

<div class="min-h-dvh bg-canvas text-slate-900 md:pl-[76px] lg:pl-[248px]">
	<!-- Sidebar: full on desktop, icons only on tablet -->
	<aside class="fixed inset-y-0 left-0 z-40 hidden w-[76px] flex-col border-r border-slate-100 bg-white px-3 py-4 md:flex lg:w-[248px] lg:px-4">
		<div class="mb-6 flex items-center gap-2.5 px-1">
			<img src={head} alt="" width="480" height="480" class="h-11 w-11 shrink-0" />
			<div class="hidden min-w-0 lg:block">
				<p class="text-lg leading-tight font-bold text-slate-900">Goose Man</p>
				<p class="truncate text-xs text-slate-500">ห่านบางมด · ทีมงาน</p>
			</div>
		</div>
		<nav class="flex flex-1 flex-col gap-1" aria-label="เมนูทีมงาน">
			{#each visible.filter((p) => p.id !== 'settings') as p (p.id)}
				<div class="hidden lg:block">{@render navItem(p)}</div>
				<div class="lg:hidden">{@render navItem(p, true)}</div>
			{/each}
			<div class="my-3 border-t border-slate-100"></div>
			<div class="hidden lg:block">{@render navItem(PAGES.find((p) => p.id === 'settings')!)}</div>
			<div class="lg:hidden">{@render navItem(PAGES.find((p) => p.id === 'settings')!, true)}</div>
		</nav>
	</aside>

	<!-- Top bar -->
	<header class="sticky top-0 z-30 border-b border-slate-100 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-white/85">
		<div class="flex h-16 items-center gap-3 px-4 sm:px-6 lg:h-[72px]">
			<img src={head} alt="" width="480" height="480" class="h-9 w-9 md:hidden" />
			<p class="min-w-0 flex-1 truncate text-lg font-semibold md:hidden">{current.label}</p>

			<form class="hidden max-w-md flex-1 md:block" role="search" onsubmit={search}>
				<label class="flex h-11 items-center gap-2 rounded-xl bg-slate-100/80 px-3.5 text-slate-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand">
					<Icon name="search" class="h-[18px] w-[18px]" />
					<input id="console-search" bind:value={searchText} type="search" placeholder="ค้นหารหัสออเดอร์ ชื่อ หรือเบอร์" class="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400" />
					<kbd class="hidden rounded-md border border-slate-200 bg-white px-1.5 text-[11px] font-medium text-slate-400 lg:inline">Ctrl K</kbd>
				</label>
			</form>

			<div class="ml-auto flex items-center gap-1 sm:gap-2">
				<span class="hidden items-center gap-1.5 text-sm text-slate-600 xl:flex" title="ข้อมูลอัปเดตเองทุก 15 วินาที">
					<span class="h-2 w-2 rounded-full {c.online && !c.overviewError ? 'bg-fresh' : 'bg-slate-400'}"></span>
					{c.online ? (c.lastUpdated ? `อัปเดตล่าสุด ${clock(c.lastUpdated.toISOString())}` : 'กำลังโหลด...') : 'ออฟไลน์ · กำลังเชื่อมต่อใหม่'}
				</span>
				<span class="h-2 w-2 rounded-full xl:hidden {c.online && !c.overviewError ? 'bg-fresh' : 'bg-slate-400'}" title="อัปเดตอัตโนมัติ"></span>

				<button type="button" onclick={() => (mobileSearch = !mobileSearch)} aria-label="ค้นหา" class="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 md:hidden">
					<Icon name="search" class="h-5 w-5" />
				</button>
				<button type="button" onclick={() => c.toggleSound()} aria-pressed={c.sound} aria-label={c.sound ? 'ปิดเสียงแจ้งเตือน' : 'เปิดเสียงแจ้งเตือน'} class="hidden h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 sm:flex">
					<Icon name={c.sound ? 'volume' : 'volume-off'} class="h-5 w-5" />
				</button>

				<button type="button" onclick={openDate} class="relative hidden h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm text-slate-700 hover:bg-slate-50 sm:flex">
					<Icon name="calendar" class="h-[18px] w-[18px] text-slate-500" />
					<span class="tabular-nums">{isToday ? 'วันนี้ ' : ''}{thaiDate(c.day)}</span>
					<Icon name="chevron-down" class="h-4 w-4 text-slate-400" />
					<input bind:this={dateInput} type="date" value={c.day} max={bangkokToday()} onchange={(e) => c.setDay(e.currentTarget.value)} class="pointer-events-none absolute inset-0 opacity-0" tabindex="-1" aria-label="เลือกวันที่" />
				</button>

				<button type="button" onclick={() => c.go('orders')} aria-label="ออเดอร์ที่ต้องจัดการ {c.badges.orders ?? 0} รายการ" class="relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100">
					<Icon name="bell" class="h-5 w-5" />
					{#if (c.badges.orders ?? 0) > 0}<span class="absolute top-2 right-2.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand"></span>{/if}
				</button>

				<div class="relative hidden md:block">
					<button type="button" onclick={() => (userMenu = !userMenu)} aria-expanded={userMenu} class="flex items-center gap-2.5 rounded-xl py-1 pr-2 pl-1 hover:bg-slate-50">
						<span class="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">{initial}</span>
						<span class="hidden text-left lg:block">
							<span class="block max-w-32 truncate text-sm leading-tight font-semibold">{c.me?.nickname}</span>
							<span class="block text-xs text-slate-500">{c.me?.role === 'ADMIN' ? 'Admin' : 'Staff'}</span>
						</span>
						<Icon name="chevron-down" class="h-4 w-4 text-slate-400" />
					</button>
					{#if userMenu}
						<div class="absolute top-full right-0 z-50 mt-2 w-64 rounded-2xl border border-slate-100 bg-white p-2 shadow-xl shadow-slate-900/10" transition:fly={{ y: -6, duration: 150 }}>
							<p class="truncate px-3 pt-2 text-sm font-semibold">{c.me?.full_name || c.me?.nickname}</p>
							<p class="truncate px-3 pb-2 text-xs text-slate-500">{c.me?.email}</p>
							<button type="button" onclick={() => { userMenu = false; c.go('settings'); }} class="flex h-10 w-full items-center gap-2 rounded-xl px-3 text-sm hover:bg-slate-50"><Icon name="settings" class="h-4 w-4" />ตั้งค่า</button>
							<button type="button" onclick={() => c.signOut()} class="flex h-10 w-full items-center gap-2 rounded-xl px-3 text-sm text-red-600 hover:bg-red-50"><Icon name="logout" class="h-4 w-4" />ออกจากระบบ</button>
						</div>
					{/if}
				</div>
			</div>
		</div>
		{#if mobileSearch}
			<form class="px-4 pb-3 md:hidden" role="search" onsubmit={search} transition:fly={{ y: -6, duration: 150 }}>
				<label class="flex h-11 items-center gap-2 rounded-xl bg-slate-100 px-3.5 text-slate-500 focus-within:ring-2 focus-within:ring-brand">
					<Icon name="search" class="h-[18px] w-[18px]" />
					<!-- svelte-ignore a11y_autofocus -->
					<input bind:value={searchText} type="search" autofocus placeholder="รหัสออเดอร์ ชื่อ หรือเบอร์" class="min-w-0 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400" />
				</label>
			</form>
		{/if}
	</header>

	<main class="mx-auto w-full max-w-[1440px] px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 md:pb-10 lg:pt-7">
		<div class="mb-5 lg:mb-6">
			<h1 class="hidden text-3xl font-bold tracking-tight text-slate-900 md:block">{current.title}</h1>
			<p class="text-sm text-slate-500 md:mt-1 md:text-[15px]">{current.subtitle}</p>
			<button type="button" onclick={openDate} class="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 sm:hidden">
				<Icon name="calendar" class="h-4 w-4 text-slate-500" />{isToday ? 'วันนี้ ' : ''}{thaiDate(c.day)}
			</button>
		</div>
		{@render children()}
	</main>

	<!-- Bottom tabs on phones -->
	<nav class="fixed inset-x-0 bottom-0 z-40 border-t border-slate-100 bg-white pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="เมนูทีมงาน">
		<div class="grid grid-cols-5">
			{#each MOBILE_TABS as id (id)}
				{@const p = PAGES.find((x) => x.id === id)!}
				{@const active = c.page === id}
				{@const badge = c.badges[id] ?? 0}
				<button type="button" onclick={() => c.go(id)} aria-current={active ? 'page' : undefined} class="relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] {active ? 'font-semibold text-brand' : 'text-slate-500'}">
					<Icon name={p.icon} class="h-6 w-6" strokeWidth={active ? 2.1 : 1.8} />
					{p.label}
					{#if badge > 0}<span class="absolute top-1.5 left-1/2 ml-2 min-w-5 rounded-full bg-brand px-1 text-center text-[10px] font-semibold text-white tabular-nums">{badge > 99 ? '99+' : badge}</span>{/if}
				</button>
			{/each}
			<button type="button" onclick={() => (moreOpen = true)} class="flex h-16 flex-col items-center justify-center gap-1 text-[11px] {!MOBILE_TABS.includes(c.page) ? 'font-semibold text-brand' : 'text-slate-500'}">
				<Icon name="menu" class="h-6 w-6" />เพิ่มเติม
			</button>
		</div>
	</nav>

	{#if moreOpen}
		<div class="fixed inset-0 z-[60] flex items-end md:hidden">
			<button type="button" aria-label="ปิด" class="absolute inset-0 bg-slate-900/40" onclick={() => (moreOpen = false)} transition:fade={{ duration: 150 }}></button>
			<div class="relative w-full rounded-t-3xl bg-white px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]" transition:fly={{ y: 200, duration: 220 }}>
				<div class="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200"></div>
				<div class="mb-3 flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
					<span class="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 font-semibold">{initial}</span>
					<div class="min-w-0">
						<p class="truncate text-sm font-semibold">{c.me?.nickname}</p>
						<p class="truncate text-xs text-slate-500">{c.me?.email} · {c.me?.role === 'ADMIN' ? 'Admin' : 'Staff'}</p>
					</div>
				</div>
				<div class="grid gap-1">
					{#each visible.filter((p) => !MOBILE_TABS.includes(p.id)) as p (p.id)}
						<button type="button" onclick={() => { moreOpen = false; c.go(p.id); }} class="flex h-12 items-center gap-3 rounded-xl px-3 text-left text-[15px] {c.page === p.id ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-700 hover:bg-slate-50'}">
							<Icon name={p.icon} class="h-5 w-5" />
							<span class="flex-1">{p.label}</span>
							{#if (c.badges[p.id] ?? 0) > 0}<span class="rounded-full bg-brand px-2 text-xs font-semibold text-white">{c.badges[p.id]}</span>{/if}
						</button>
					{/each}
					<button type="button" onclick={() => c.toggleSound()} class="flex h-12 items-center gap-3 rounded-xl px-3 text-[15px] text-slate-700 hover:bg-slate-50">
						<Icon name={c.sound ? 'volume' : 'volume-off'} class="h-5 w-5" /><span class="flex-1 text-left">เสียงแจ้งเตือน</span><span class="text-sm text-slate-500">{c.sound ? 'เปิด' : 'ปิด'}</span>
					</button>
					<button type="button" onclick={() => c.signOut()} class="flex h-12 items-center gap-3 rounded-xl px-3 text-[15px] text-red-600 hover:bg-red-50">
						<Icon name="logout" class="h-5 w-5" />ออกจากระบบ
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
