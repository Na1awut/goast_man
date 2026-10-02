<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import SmartImage from '$lib/components/SmartImage.svelte';
	import { banners } from '$lib/stores/banners.svelte';
	import { nav } from '$lib/stores/nav.svelte';
	import { storeView } from '$lib/stores/storeView.svelte';
	import type { HomeBanner } from '$lib/types';
	import { prefersReducedMotion } from '$lib/utils';

	/** How long each banner stays; the bar under it fills over exactly this long */
	const SLIDE_MS = 5000;

	const items = $derived(banners.activeBanners);
	const many = $derived(items.length > 1);
	let currentIndex = $state(0);
	let container = $state<HTMLDivElement | null>(null);
	let root = $state<HTMLElement | null>(null);

	const reduced = prefersReducedMotion();
	/** The user's own choice (button). Starts paused for people who asked for less motion */
	let userPlaying = $state(!reduced);
	// Reasons to hold still even while playing: hovering with a mouse, a finger down, keyboard focus inside,
	// the banner scrolled out of view, the tab in the background
	let hovering = $state(false);
	let touching = $state(false);
	let focused = $state(false);
	let onScreen = $state(true);
	let tabHidden = $state(false);
	const running = $derived(userPlaying && many && onScreen && !tabHidden && !hovering && !touching && !focused);

	// Keep the index valid if banners change underneath us (team edits, reload)
	$effect(() => {
		if (currentIndex >= items.length) currentIndex = 0;
	});

	onMount(() => {
		void banners.load();
		const io = new IntersectionObserver(([entry]) => (onScreen = entry.isIntersecting), { threshold: 0.4 });
		if (root) io.observe(root);
		const onVisibility = () => (tabHidden = document.hidden);
		document.addEventListener('visibilitychange', onVisibility);
		// A rotated phone changes the slide width: stay on the same slide
		let lastWidth = container?.clientWidth ?? 0;
		const ro = new ResizeObserver(() => {
			if (!container || container.clientWidth === lastWidth) return; // height changes (images loading) need no re-snap
			lastWidth = container.clientWidth;
			container.scrollTo({ left: currentIndex * lastWidth, behavior: 'auto' });
		});
		if (container) ro.observe(container);
		return () => {
			io.disconnect();
			ro.disconnect();
			document.removeEventListener('visibilitychange', onVisibility);
		};
	});

	/** After our own smooth scroll, ignore the scroll events it fires on the way (they would flicker the bar) */
	let settleUntil = 0;

	function goToSlide(index: number) {
		if (!container || index < 0 || index >= items.length) return;
		currentIndex = index;
		settleUntil = Date.now() + 700;
		// scrollTo on the track only: scrollIntoView would also drag the whole page to the banner
		container.scrollTo({ left: index * container.clientWidth, behavior: reduced ? 'auto' : 'smooth' });
	}

	const step = (by: number) => goToSlide((currentIndex + by + items.length) % items.length);

	function onScroll() {
		if (!container || Date.now() < settleUntil) return;
		const width = container.clientWidth;
		if (width <= 0) return;
		const index = Math.round(container.scrollLeft / width);
		if (index !== currentIndex && index >= 0 && index < items.length) currentIndex = index;
	}

	function onKeydown(e: KeyboardEvent) {
		if (!many || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
		e.preventDefault();
		step(e.key === 'ArrowRight' ? 1 : -1);
	}

	function handleClick(banner: HomeBanner) {
		const target = (banner.linkUrl || 'STORES').trim();
		if (!target || target === 'STORES') {
			storeView.browse();
		} else if (target === 'CUSTOM_ORDER') {
			nav.go('CUSTOM_ORDER');
		} else if (target === 'ORDERS') {
			nav.go('ORDERS');
		} else if (/^https?:\/\//i.test(target)) {
			window.open(target, '_blank', 'noopener,noreferrer');
		} else {
			// Try as store ID
			storeView.open(target);
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section
	bind:this={root}
	class="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xs"
	aria-roledescription="carousel"
	aria-label="แบนเนอร์ประชาสัมพันธ์"
	onkeydown={onKeydown}
	onpointerenter={(e) => (hovering = e.pointerType === 'mouse')}
	onpointerleave={() => (hovering = false)}
	onpointerdown={(e) => (touching = e.pointerType !== 'mouse')}
	onpointerup={() => (touching = false)}
	onpointercancel={() => (touching = false)}
	onfocusin={(e) => (focused = (e.target as HTMLElement).matches(':focus-visible'))}
	onfocusout={(e) => (focused = root?.contains(e.relatedTarget as Node | null) ?? false)}
>
	<!-- The slides: swipe with a finger, or use the arrows / keys -->
	<div
		bind:this={container}
		onscroll={onScroll}
		aria-live={running ? 'off' : 'polite'}
		class="no-scrollbar flex w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
	>
		{#each items as banner, index (banner.id)}
			<div class="w-full shrink-0 snap-start snap-always" role="group" aria-roledescription="slide" aria-label="{index + 1} จาก {items.length}" inert={index !== currentIndex}>
				<!-- The picture is tappable too, but the button below is the one keyboards and screen readers use -->
				<button type="button" tabindex="-1" onclick={() => handleClick(banner)} class="block w-full text-left outline-none">
					<SmartImage src={banner.imageUrl} alt={banner.title || 'แบนเนอร์ Goose Man'} class="block aspect-[2658/984] w-full object-cover" pending />
				</button>

				<div class="flex items-center justify-between gap-3 px-4 pt-3 {many ? 'pb-1' : 'pb-3'}">
					<div class="min-w-0 flex-1">
						<p class="line-clamp-2 text-sm leading-snug font-semibold text-balance text-slate-900">{banner.title}</p>
						{#if banner.subtitle}
							<p class="mt-0.5 truncate text-xs text-slate-500">{banner.subtitle}</p>
						{/if}
					</div>
					<button
						type="button"
						onclick={() => handleClick(banner)}
						class="flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-brand px-4 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:bg-brand-700"
					>
						<span>{banner.buttonText || 'ฝากหิ้วเลย'}</span>
						<Icon name="arrow-right" class="h-4 w-4" />
					</button>
				</div>
			</div>
		{/each}
	</div>

	{#if many}
		<!-- Arrows: only where there is a mouse (touch swipes), over the picture, shown on hover or keyboard focus -->
		<div class="pointer-events-none absolute inset-x-0 top-0 hidden aspect-[2658/984] items-center justify-between px-2.5 pointer-fine:flex">
			{#each [{ by: -1, icon: 'chevron-left', label: 'แบนเนอร์ก่อนหน้า' }, { by: 1, icon: 'chevron-right', label: 'แบนเนอร์ถัดไป' }] as arrow (arrow.by)}
				<button
					type="button"
					onclick={() => step(arrow.by)}
					aria-label={arrow.label}
					class="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-800 opacity-0 shadow-md shadow-slate-900/15 ring-1 ring-slate-900/5 transition-[opacity,transform] duration-200 group-focus-within:opacity-100 group-hover:opacity-100 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:scale-95"
				>
					<Icon name={arrow.icon === 'chevron-left' ? 'chevron-left' : 'chevron-right'} class="h-5 w-5" />
				</button>
			{/each}
		</div>

		<!-- The slide bar: one segment per banner. The current one fills over the time it stays, so the bar
		     says both where you are and when it moves on. Tap a segment to jump there. -->
		<div class="flex items-center gap-1.5 pr-2.5 pb-1.5 pl-4">
			<div class="flex min-w-0 flex-1 items-center gap-1.5">
				{#each items as banner, i (banner.id)}
					<button
						type="button"
						onclick={() => goToSlide(i)}
						aria-label="ไปที่แบนเนอร์ที่ {i + 1}: {banner.title}"
						aria-current={currentIndex === i ? 'true' : undefined}
						class="group/seg relative h-8 min-w-0 flex-1 rounded-md focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand"
					>
						<span class="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-slate-200 transition-[height] duration-150 group-hover/seg:h-1.5">
							{#if i < currentIndex}
								<span class="absolute inset-0 bg-brand-200"></span>
							{:else if i === currentIndex}
								{#key currentIndex}
									<span
										class="fill absolute inset-0 bg-brand"
										class:fill-still={!userPlaying}
										style:animation-duration="{SLIDE_MS}ms"
										style:animation-play-state={running ? 'running' : 'paused'}
										onanimationend={() => step(1)}
									></span>
								{/key}
							{/if}
						</span>
					</button>
				{/each}
			</div>
			<!-- Under "reduce motion" nothing auto-advances, so there is nothing to pause -->
			{#if !reduced}
			<button
				type="button"
				onclick={() => (userPlaying = !userPlaying)}
				aria-label={userPlaying ? 'หยุดเลื่อนแบนเนอร์อัตโนมัติ' : 'เลื่อนแบนเนอร์อัตโนมัติ'}
				class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-brand"
			>
				<Icon name={userPlaying ? 'pause' : 'play'} class="h-3.5 w-3.5" filled />
			</button>
			{/if}
		</div>
	{/if}
</section>

<style>
	/* Time passing is the one place a linear ease is right */
	.fill {
		transform-origin: left center;
		animation-name: banner-fill;
		animation-timing-function: linear;
		animation-fill-mode: forwards;
	}
	@keyframes banner-fill {
		from {
			transform: scaleX(0);
		}
		to {
			transform: scaleX(1);
		}
	}
	/* Paused by choice, or the user prefers less motion: the current segment is simply full */
	.fill-still {
		animation: none;
		transform: none;
	}
	@media (prefers-reduced-motion: reduce) {
		.fill {
			animation: none;
			transform: none;
		}
	}
</style>
