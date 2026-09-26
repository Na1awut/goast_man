<script lang="ts">
	import { fade } from 'svelte/transition';
	import head1 from '$lib/assets/goose-head-1.webp';
	import head2 from '$lib/assets/goose-head-2.webp';
	import { welcome } from '$lib/stores/welcome.svelte';
	import { prefersReducedMotion } from '$lib/utils';

	// The goose honks hello: beak closed ↔ open, frame by frame
	const FRAMES = [head1, head2] as const;
	const FRAME_MS = 220;

	let frame = $state(0);

	$effect(() => {
		if (!welcome.name || prefersReducedMotion()) {
			frame = 0;
			return;
		}
		const timer = setInterval(() => (frame = (frame + 1) % FRAMES.length), FRAME_MS);
		return () => clearInterval(timer);
	});
</script>

{#if welcome.name !== null}
	<button
		type="button"
		data-welcome
		onclick={() => welcome.hide()}
		aria-label="ข้ามหน้าต้อนรับ"
		class="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-white px-8 text-center"
		out:fade={{ duration: prefersReducedMotion() ? 0 : 250 }}
	>
		<!-- Both frames stay mounted and stacked, so switching is a paint, never a load -->
		<span class="relative block w-44" aria-hidden="true">
			{#each FRAMES as src, i (src)}
				<img {src} alt="" width="480" height="480" draggable="false" class="block h-auto w-full {i === 0 ? '' : 'absolute inset-0'} {i === frame ? 'opacity-100' : 'opacity-0'}" />
			{/each}
		</span>
		<span class="mt-4 block text-2xl font-bold text-slate-900">สวัสดี {welcome.name}</span>
		<span class="mt-1 block text-sm text-slate-500">ยินดีต้อนรับสู่ Goose Man</span>
	</button>
{/if}
