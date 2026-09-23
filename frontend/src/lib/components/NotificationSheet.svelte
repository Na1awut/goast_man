<script lang="ts">
	import { toast } from '$lib/stores/toast.svelte';
	import Icon from './Icon.svelte';
	import Sheet from './Sheet.svelte';

	function close() {
		toast.markAllRead();
		toast.inboxOpen = false;
	}
</script>

<Sheet open={toast.inboxOpen} title="การแจ้งเตือน" onclose={close}>
	{#if toast.notifications.length === 0}
		<div class="py-10 text-center">
			<span class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Icon name="bell" /></span>
			<p class="text-sm font-medium text-slate-700">ยังไม่มีการแจ้งเตือน</p>
			<p class="text-xs text-slate-500">สถานะออเดอร์จะแสดงที่นี่</p>
		</div>
	{:else}
		<ul class="divide-y divide-slate-100">
			{#each toast.notifications as n (n.id)}
				<li class="flex gap-3 py-3">
					<span class="mt-1.5 h-2 w-2 shrink-0 rounded-full {n.read ? 'bg-transparent' : 'bg-brand'}"></span>
					<div class="min-w-0 flex-1">
						<p class="text-sm text-slate-800">{n.text}</p>
						<p class="mt-0.5 text-xs text-slate-400">{n.time}</p>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</Sheet>
