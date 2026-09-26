<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import { attentionLabel, ATTENTION_HELP } from '../labels';
	import type { Attention } from '../types';

	let { attention }: { attention: Attention } = $props();
	const severe = $derived(ATTENTION_HELP[attention.code].severe);
</script>

<span class="inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap {severe ? 'text-red-600' : 'text-amber-700'}">
	<Icon name="alert" class="h-3.5 w-3.5" strokeWidth={2.25} />
	{attentionLabel(attention)}
</span>
