<script lang="ts" module>
	import type { OrderStatus } from '$lib/types';

	export const STATUS_META: Record<OrderStatus, { label: string; class: string; dot: string }> = {
		PENDING: { label: 'กำลังหาคนหิ้ว', class: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
		ACCEPTED: { label: 'เพื่อนรับงานแล้ว', class: 'bg-brand-50 text-brand-700', dot: 'bg-brand' },
		DELIVERING: { label: 'กำลังเดินไปส่ง', class: 'bg-brand-50 text-brand-700', dot: 'bg-brand' },
		COMPLETED: { label: 'ส่งมอบสำเร็จ', class: 'bg-fresh-50 text-fresh-700', dot: 'bg-fresh' },
		CANCELLED: { label: 'ยกเลิกแล้ว', class: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' }
	};
</script>

<script lang="ts">
	let { status }: { status: OrderStatus } = $props();
	const meta = $derived(STATUS_META[status]);
</script>

<span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap {meta.class}">
	<span class="h-1.5 w-1.5 rounded-full {meta.dot}"></span>
	{meta.label}
</span>
