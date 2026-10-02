<script lang="ts">
	// Turn on notifications that arrive with the app closed (Web Push).
	// `prompt` is the nudge on a screen where it matters (tracking, rider board):
	// it only shows while push is still off and can be switched on.
	import Icon from '$lib/components/Icon.svelte';
	import { push } from '$lib/stores/push.svelte';

	let { context = 'buyer', prompt = false }: { context?: 'buyer' | 'rider'; prompt?: boolean } = $props();

	const what = $derived(context === 'rider' ? 'งานใหม่ ข้อความจากผู้ซื้อ และงานที่ถูกยกเลิก' : 'คนหิ้วรับงาน กำลังไปส่ง และข้อความใหม่');
	const show = $derived(push.available && (!prompt || push.state === 'off' || push.state === 'needs-install'));
</script>

{#if show}
	{#if push.state === 'needs-install'}
		<div class="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4">
			<Icon name="bell" class="mt-0.5 h-5 w-5 shrink-0 text-brand" />
			<div class="min-w-0 text-sm">
				<p class="font-semibold text-slate-900">แจ้งเตือนบน iPhone ต้องเพิ่มแอปลงหน้าจอโฮมก่อน</p>
				<p class="mt-0.5 text-xs text-slate-500">กด <Icon name="share" class="inline h-3.5 w-3.5 align-[-2px]" /> แชร์ → "เพิ่มไปยังหน้าจอโฮม" แล้วเปิด Goose Man จากไอคอนนั้น</p>
			</div>
		</div>
	{:else if push.state === 'blocked'}
		<div class="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4">
			<Icon name="bell" class="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
			<div class="min-w-0 text-sm">
				<p class="font-semibold text-slate-900">การแจ้งเตือนถูกปิดไว้ในเบราว์เซอร์</p>
				<p class="mt-0.5 text-xs text-slate-500">เปิดได้ที่ไอคอนกุญแจข้างแถบที่อยู่ → การแจ้งเตือน → อนุญาต แล้วกลับมาที่นี่</p>
			</div>
		</div>
	{:else}
		<button
			type="button"
			role="switch"
			aria-checked={push.state === 'on'}
			disabled={push.busy}
			onclick={() => (push.state === 'on' ? push.disable() : prompt ? push.openPrompt(context) : push.enable())}
			class="flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors disabled:opacity-70 {prompt ? 'border-brand/30 bg-brand-50' : 'border-slate-100 bg-white'}"
		>
			<Icon name="bell" class="h-5 w-5 shrink-0 {push.state === 'on' || prompt ? 'text-brand' : 'text-slate-400'}" />
			<span class="min-w-0 flex-1">
				<span class="block text-sm font-semibold text-slate-900">{push.state === 'on' ? 'แจ้งเตือนเปิดอยู่' : 'รับแจ้งเตือนแม้ปิดแอป'}</span>
				<span class="block text-xs text-slate-500">{what}</span>
				{#if push.error}<span class="mt-1 block text-xs text-red-600" role="alert">{push.error}</span>{/if}
			</span>
			<span class="relative h-7 w-12 shrink-0 rounded-full transition-colors {push.state === 'on' ? 'bg-brand' : 'bg-slate-200'}" aria-hidden="true">
				<span class="absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform {push.state === 'on' ? 'translate-x-5' : ''}"></span>
			</span>
		</button>
	{/if}
{/if}
