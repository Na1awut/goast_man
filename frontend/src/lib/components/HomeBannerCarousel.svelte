<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import SmartImage from '$lib/components/SmartImage.svelte';
	import { banners } from '$lib/stores/banners.svelte';
	import { nav } from '$lib/stores/nav.svelte';
	import { storeView } from '$lib/stores/storeView.svelte';
	import type { HomeBanner } from '$lib/types';

	const items = $derived(banners.activeBanners);
	let currentIndex = $state(0);
	let container = $state<HTMLDivElement | null>(null);
	let isPaused = $state(false);
	let autoPlayTimer: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		void banners.load();
		startAutoPlay();
	});

	onDestroy(() => {
		stopAutoPlay();
	});

	function startAutoPlay() {
		stopAutoPlay();
		autoPlayTimer = setInterval(() => {
			if (isPaused || items.length <= 1 || !container) return;
			const next = (currentIndex + 1) % items.length;
			goToSlide(next);
		}, 4500);
	}

	function stopAutoPlay() {
		if (autoPlayTimer) {
			clearInterval(autoPlayTimer);
			autoPlayTimer = null;
		}
	}

	function goToSlide(index: number) {
		if (!container) return;
		const slides = container.children;
		if (slides[index]) {
			(slides[index] as HTMLElement).scrollIntoView({
				behavior: 'smooth',
				block: 'nearest',
				inline: 'start'
			});
			currentIndex = index;
		}
	}

	function onScroll() {
		if (!container) return;
		const width = container.clientWidth;
		if (width <= 0) return;
		const scrollLeft = container.scrollLeft;
		const index = Math.round(scrollLeft / width);
		if (index !== currentIndex && index >= 0 && index < items.length) {
			currentIndex = index;
		}
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

<section
	class="relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xs"
	aria-roledescription="carousel"
	aria-label="แบนเนอร์ประชาสัมพันธ์"
	onmouseenter={() => (isPaused = true)}
	onmouseleave={() => (isPaused = false)}
>
	<!-- Carousel Track / Slide Container -->
	<div
		bind:this={container}
		onscroll={onScroll}
		class="no-scrollbar flex w-full snap-x snap-mandatory overflow-x-auto scroll-smooth"
	>
		{#each items as banner, index (banner.id)}
			<div class="w-full shrink-0 snap-start" aria-roledescription="slide" aria-label="{index + 1} จาก {items.length}">
				<!-- Banner Graphic -->
				<button
					type="button"
					onclick={() => handleClick(banner)}
					class="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
				>
					<SmartImage
						src={banner.imageUrl}
						alt={banner.title || 'แบนเนอร์ Goose Man'}
						class="block aspect-[2658/984] w-full object-cover"
						pending
					/>
				</button>

				<!-- Banner Content & Action Footer -->
				<div class="flex items-center justify-between gap-3 px-4 py-3">
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-semibold text-slate-900">{banner.title}</p>
						{#if banner.subtitle}
							<p class="truncate text-xs text-slate-500">{banner.subtitle}</p>
						{/if}
					</div>
					<button
						type="button"
						onclick={() => handleClick(banner)}
						class="flex shrink-0 items-center gap-1 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-brand-600 active:bg-brand-700"
					>
						<span>{banner.buttonText || 'ฝากหิ้วเลย'}</span>
						<Icon name="arrow-right" class="h-4 w-4" />
					</button>
				</div>
			</div>
		{/each}
	</div>

	<!-- Multi-banner controls: navigation arrows & pagination dots -->
	{#if items.length > 1}
		<!-- Left / Right arrows (hover / tablet / desktop) -->
		<button
			type="button"
			onclick={() => goToSlide((currentIndex - 1 + items.length) % items.length)}
			aria-label="แบนเนอร์ก่อนหน้า"
			class="absolute top-1/3 left-2.5 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-opacity hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-brand"
		>
			<Icon name="chevron-left" class="h-4 w-4" />
		</button>
		<button
			type="button"
			onclick={() => goToSlide((currentIndex + 1) % items.length)}
			aria-label="แบนเนอร์ถัดไป"
			class="absolute top-1/3 right-2.5 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-opacity hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-brand"
		>
			<Icon name="chevron-right" class="h-4 w-4" />
		</button>

		<!-- Slide Pagination Indicator Dots -->
		<div class="flex items-center justify-center gap-1.5 pb-2.5" role="tablist" aria-label="เลือกแบนเนอร์">
			{#each items as _, i (i)}
				<button
					type="button"
					role="tab"
					aria-selected={currentIndex === i}
					aria-label="ไปที่แบนเนอร์ที่ {i + 1}"
					onclick={() => goToSlide(i)}
					class="transition-all duration-300 {currentIndex === i
						? 'h-1.5 w-5 rounded-full bg-brand'
						: 'h-1.5 w-1.5 rounded-full bg-slate-200 hover:bg-slate-400'}"
				></button>
			{/each}
		</div>
	{/if}
</section>
