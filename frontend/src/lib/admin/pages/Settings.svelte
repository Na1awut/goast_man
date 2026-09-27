<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import { isLive } from '$lib/supabase';
	import { consoleState as c } from '../console.svelte';
	import Toggle from '../ui/Toggle.svelte';
	import { dateTime } from '../format';

	const testOn = $derived(!!c.flags?.payment_test_mode);
</script>

<div class="max-w-2xl space-y-4">
	<section class="rounded-2xl border border-slate-100 bg-white p-5">
		<h2 class="text-base font-semibold">บัญชี</h2>
		<p class="mt-3 font-semibold">{c.me?.full_name || c.me?.nickname}</p>
		<p class="text-sm text-slate-500">{c.me?.email}</p>
		<span class="mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-semibold {c.isAdmin ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-700'}">{c.me?.role}</span>
		<button type="button" onclick={() => c.signOut()} class="mt-4 flex h-11 items-center gap-2 rounded-xl border border-red-200 px-4 text-sm font-medium text-red-600 hover:bg-red-50"><Icon name="logout" class="h-4 w-4" />ออกจากระบบ</button>
	</section>

	<section class="rounded-2xl border border-slate-100 bg-white p-5">
		<h2 class="text-base font-semibold">การแจ้งเตือนของเครื่องนี้</h2>
		<div class="mt-3 flex items-center gap-4">
			<div class="min-w-0 flex-1">
				<p class="text-sm font-medium">เสียงเมื่อมีออเดอร์ปัญหาใหม่</p>
				<p class="text-sm text-slate-500">ดังสั้นๆ เมื่อจำนวนออเดอร์ที่ต้องจัดการเพิ่มขึ้น เปิดไว้ช่วงเฝ้าเที่ยง</p>
			</div>
			<Toggle checked={c.sound} label="เสียงแจ้งเตือน" onchange={() => c.toggleSound()} />
		</div>
		<p class="mt-4 text-sm text-slate-500">ข้อมูลทุกหน้าอัปเดตเองทุก 15 วินาทีขณะเปิดหน้านี้อยู่</p>
	</section>

	<section class="rounded-2xl border bg-white p-5 {testOn ? 'border-amber-300' : 'border-slate-100'}">
		<h2 class="text-base font-semibold">โหมดทดสอบจ่าย QR</h2>
		<div class="mt-3 flex items-center gap-4">
			<div class="min-w-0 flex-1">
				<p class="text-sm font-medium">{testOn ? 'เปิดอยู่: ลูกค้าจ่ายได้โดยไม่โอนเงินจริง' : 'ปิดอยู่: จ่ายด้วย QR ต้องโอนจริงและแนบสลิป'}</p>
				<p class="text-sm text-slate-500">
					{#if testOn && c.flags?.payment_test_since}เปิดโดย {c.flags.payment_test_by ?? 'ทีมงาน'} · {dateTime(c.flags.payment_test_since)}{:else}ไว้ลองสั่งจริงกับเพื่อนโดยไม่ต้องโอนเงิน{/if}
				</p>
			</div>
			{#if c.isAdmin}
				<Toggle checked={testOn} label="โหมดทดสอบจ่าย QR" onchange={(v) => c.act(async () => { await c.api!.setPaymentTestMode(v); c.flags = await c.api!.appFlags(); }, v ? 'เปิดโหมดทดสอบจ่าย QR แล้ว' : 'ปิดโหมดทดสอบจ่าย QR แล้ว')} />
			{/if}
		</div>
		<ul class="mt-4 space-y-1.5 text-sm text-slate-600">
			<li>• หน้าจ่าย PromptPay ของลูกค้าจะมีปุ่ม "จ่ายแบบทดสอบ" ออเดอร์ไปหาคนหิ้วเหมือนจ่ายแล้ว</li>
			<li>• ออเดอร์ที่จ่ายแบบนี้ขึ้นว่า "จ่ายแบบทดสอบ ไม่มีเงินจริง" ในรายละเอียดออเดอร์</li>
			<li>• ระหว่างเปิด ลูกค้าทุกคนกดได้ <strong class="font-semibold text-slate-900">ทดสอบเสร็จแล้วปิดทันที</strong> ปิดแล้วปุ่มหายเลย</li>
		</ul>
		{#if !c.isAdmin}<p class="mt-3 text-xs text-slate-500">เฉพาะ ADMIN เปิด/ปิดได้</p>{/if}
	</section>

	{#if !isLive}
		<section class="rounded-2xl border border-amber-200 bg-amber-50 p-5">
			<h2 class="text-base font-semibold text-amber-900">โหมดทดลอง</h2>
			<p class="mt-1 text-sm text-amber-900">ยังไม่ได้ต่อฐานข้อมูล ทุกอย่างเป็นข้อมูลตัวอย่าง ดูหน้าตาแบบ STAFF ได้ที่นี่</p>
			<div class="mt-3 inline-flex gap-1 rounded-xl bg-white p-1">
				{#each ['ADMIN', 'STAFF'] as const as r (r)}
					<button type="button" onclick={() => c.switchDemoRole(r)} class="h-9 rounded-lg px-4 text-sm {c.me?.role === r ? 'bg-brand font-semibold text-white' : 'text-slate-700'}">{r}</button>
				{/each}
			</div>
		</section>
	{/if}
</div>
