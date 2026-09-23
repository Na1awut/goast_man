<script lang="ts">
	import goose from '$lib/assets/goose.webp';

	// The mascot cut out of the logo artwork. `pose` drives a small CSS motion:
	// idle = still, walk = carrying the bag, wait = looking around at the counter, hop = arrival.
	let {
		pose = 'idle',
		class: className = 'w-16',
		alt = ''
	}: { pose?: 'idle' | 'walk' | 'wait' | 'hop'; class?: string; alt?: string } = $props();
</script>

<img src={goose} {alt} aria-hidden={alt ? undefined : 'true'} width="360" height="280" draggable="false" class="goose goose-{pose} block h-auto select-none {className}" />
