<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import { toast } from '$lib/stores/toast.svelte';

	let { value, label = 'คัดลอก' }: { value: string; label?: string } = $props();

	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
			toast.show(`คัดลอก ${value} แล้ว`, 'success');
		} catch {
			toast.show('คัดลอกไม่สำเร็จ', 'error');
		}
	}
</script>

<button type="button" onclick={copy} aria-label="{label} {value}" class="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-medium whitespace-nowrap text-brand hover:bg-brand-50">
	<Icon name="copy" class="h-3.5 w-3.5" />{label}
</button>
