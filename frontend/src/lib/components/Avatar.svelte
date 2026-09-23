<script lang="ts">
	import { initialOf } from '$lib/utils';

	let {
		name,
		size = 'md',
		tone = 'brand'
	}: { name: string; size?: 'sm' | 'md' | 'lg'; tone?: 'brand' | 'soft' } = $props();

	const sizes = { sm: 'h-8 w-8 text-sm', md: 'h-12 w-12 text-lg', lg: 'h-16 w-16 text-2xl' };
	const tones = { brand: 'bg-brand text-white', soft: 'bg-brand-50 text-brand-700' };
</script>

<span class="flex shrink-0 items-center justify-center rounded-full font-semibold {sizes[size]} {tones[tone]}" aria-hidden="true">
	{initialOf(name)}
</span>
