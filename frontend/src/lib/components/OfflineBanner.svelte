<script lang="ts">
	// Tells the user the phone has no internet, and when it is back.
	// In the page flow (not floating), so it never covers a back button.
	import { slide } from 'svelte/transition';
	import Icon from '$lib/components/Icon.svelte';
	import { network } from '$lib/stores/network.svelte';
	import { prefersReducedMotion } from '$lib/utils';

	const duration = prefersReducedMotion() ? 0 : 180;
</script>

{#if !network.online}
	<div transition:slide={{ duration }} role="alert" class="flex items-center gap-3 bg-slate-900 px-4 py-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))] text-white">
		<Icon name="wifi-off" class="h-5 w-5 shrink-0 text-amber-300" />
		<div class="min-w-0 flex-1">
			<p class="text-sm font-semibold">ไม่มีอินเทอร์เน็ต</p>
			<p class="text-xs text-white/70">ข้อมูลอาจไม่ล่าสุด จะอัปเดตเองเมื่อสัญญาณกลับมา</p>
		</div>
	</div>
{:else if network.restored}
	<div transition:slide={{ duration }} role="status" class="flex items-center gap-3 bg-fresh-700 px-4 py-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))] text-white">
		<Icon name="wifi" class="h-5 w-5 shrink-0" />
		<p class="text-sm font-semibold">กลับมาออนไลน์แล้ว กำลังอัปเดตข้อมูล</p>
	</div>
{/if}
