<script lang="ts">
	import stand from '$lib/assets/goose-stand.webp';
	import walk1 from '$lib/assets/goose-walk-1.webp';
	import walk2 from '$lib/assets/goose-walk-2.webp';
	import { prefersReducedMotion } from '$lib/utils';

	// The mascot from the logo artwork. `walk` plays the drawn walk cycle frame by frame;
	// the other poses are small CSS motions on the standing frame:
	// idle = still, wait = looking around at the counter, hop = arrival.
	let {
		pose = 'idle',
		class: className = 'w-16',
		alt = ''
	}: { pose?: 'idle' | 'walk' | 'wait' | 'hop'; class?: string; alt?: string } = $props();

	const FRAMES = [stand, walk1, walk2] as const;
	/** 4-beat gait: stand → left step → stand → right step */
	const GAIT = [0, 1, 0, 2];
	const FRAME_MS = 160;

	let beat = $state(0);
	const frame = $derived(pose === 'walk' ? GAIT[beat] : 0);

	$effect(() => {
		if (pose !== 'walk' || prefersReducedMotion()) {
			beat = 0;
			return;
		}
		let timer: ReturnType<typeof setInterval> | null = null;
		const start = () => {
			timer ??= setInterval(() => (beat = (beat + 1) % GAIT.length), FRAME_MS);
		};
		const stop = () => {
			if (timer) clearInterval(timer);
			timer = null;
		};
		// A non-essential loop: don't burn frames while the tab is in the background
		const onVisibility = () => (document.hidden ? stop() : start());
		document.addEventListener('visibilitychange', onVisibility);
		if (!document.hidden) start();
		return () => {
			stop();
			document.removeEventListener('visibilitychange', onVisibility);
		};
	});
</script>

<!-- All frames stay mounted and stacked, so switching is a paint, never a load or a layout shift -->
<span class="goose goose-{pose} relative block select-none {className}" role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : 'true'}>
	{#each FRAMES as src, i (src)}
		<img
			{src}
			alt=""
			width="360"
			height="280"
			draggable="false"
			class="block h-auto w-full {i === 0 ? '' : 'absolute inset-0'} {i === frame ? 'opacity-100' : 'opacity-0'}"
		/>
	{/each}
</span>
