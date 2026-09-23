<script lang="ts">
	import logo from '$lib/assets/logo.webp';
	import logoLg from '$lib/assets/logo-lg.webp';

	// Brand mark: the Goose Man mascot on a white tile.
	let { class: className = 'h-10 w-10', large = false }: { class?: string; large?: boolean } = $props();
</script>

<span class="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white {className}">
	<img src={large ? logoLg : logo} alt="Goose Man" class="h-full w-full object-contain" decoding="async" />
</span>
