<script lang="ts">
	import type { DropoffPoint, HubZone } from '$lib/types';
	import { DROPOFF_POINTS } from '$lib/data/locations';
	import { campus } from '$lib/stores/campus.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import Icon, { type IconName } from './Icon.svelte';
	import Sheet from './Sheet.svelte';

	const ZONE_ICON: Partial<Record<HubZone, IconName>> = { ACADEMIC: 'building', DORM: 'key', OFFICE: 'book' };

	function choose(point: DropoffPoint) {
		const changed = point.id !== campus.dropoff.id;
		campus.select(point);
		if (changed) toast.show(`จุดรับของ: ${point.name}`, 'success');
	}
</script>

<Sheet open={campus.pickerOpen} title="เลือกจุดรับของใน มจธ." onclose={() => campus.closePicker()}>
	<ul class="divide-y divide-slate-100">
		{#each DROPOFF_POINTS as point (point.id)}
			{@const selected = point.id === campus.dropoff.id}
			<li>
				<button type="button" onclick={() => choose(point)} aria-pressed={selected} class="flex w-full items-center gap-3 py-3 text-left">
					<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl {selected ? 'bg-brand-50 text-brand' : 'bg-slate-100 text-slate-500'}">
						<Icon name={ZONE_ICON[point.zone] ?? 'pin'} />
					</span>
					<span class="min-w-0 flex-1">
						<span class="block truncate text-sm font-medium text-slate-900">{point.name}</span>
						<span class="block truncate text-xs text-slate-500">{point.note}</span>
					</span>
					{#if selected}<Icon name="check" class="h-5 w-5 text-brand" />{/if}
				</button>
			</li>
		{/each}
	</ul>
</Sheet>
