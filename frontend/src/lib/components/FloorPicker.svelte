<script lang="ts">
	// Deliveries are always to the first floor
	let { class: className = '' }: { class?: string } = $props();
</script>

<div class="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs {className}">
	<span class="text-slate-600">จุดส่งมอบ</span>
	<span class="font-medium text-slate-800">ชั้น 1 (ไม่มีค่าบริการขึ้นชั้น)</span>
</div>
