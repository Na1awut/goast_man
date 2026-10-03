<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import { requestTestTicket } from '$lib/api/live';
	import { TEST_ROLE_CHOICES, isTestEnv } from '$lib/sim';
	import { toast } from '$lib/stores/toast.svelte';
	import { friendlyError, isLive } from '$lib/supabase';
	import { consoleState as c } from '../console.svelte';
	import Toggle from '../ui/Toggle.svelte';
	import { dateTime } from '../format';

	const testOn = $derived(!!c.flags?.payment_test_mode);

	// Real console only: open the test site already signed in, with no separate password
	let testRole = $state('team');
	let opening = $state(false);
	async function openTestSite() {
		if (opening) return;
		opening = true;
		// Opened now, in the click, so the browser doesn't block it; pointed at the test site once the ticket arrives
		const tab = window.open('about:blank', '_blank');
		try {
			const { ticket, url } = await requestTestTicket(testRole);
			if (!tab) throw new Error('POPUP_BLOCKED');
			tab.opener = null;
			tab.location.href = `${url}#t=${ticket}`;
		} catch (err) {
			tab?.close();
			toast.show(err instanceof Error && err.message === 'POPUP_BLOCKED' ? 'เบราว์เซอร์บล็อกหน้าต่างใหม่ อนุญาตป๊อปอัปแล้วลองอีกครั้ง' : friendlyError(err), 'error');
		} finally {
			opening = false;
		}
	}
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

	{#if isTestEnv || !isLive}
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
	{/if}

	{#if isLive && !isTestEnv}
		<section class="rounded-2xl border border-slate-100 bg-white p-5">
			<h2 class="text-base font-semibold">เว็บทดสอบ</h2>
			<p class="mt-1 text-sm text-slate-500">ลองอัปเดตใหม่ก่อนขึ้นเว็บจริง ใช้ฐานข้อมูลแยก ไม่กระทบผู้ใช้จริง เข้าได้เลยด้วยบัญชีนี้ ไม่ต้องใส่รหัสผ่านอีก</p>
			<div class="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="เลือกบทบาทที่จะเข้าเว็บทดสอบ">
				{#each TEST_ROLE_CHOICES as r (r.id)}
					<button type="button" aria-pressed={testRole === r.id} onclick={() => (testRole = r.id)} class="min-h-9 rounded-full border px-3 text-sm {testRole === r.id ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-slate-700'}">{r.label}</button>
				{/each}
			</div>
			<button type="button" onclick={openTestSite} disabled={opening} class="mt-4 flex h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60">
				{#if opening}กำลังเปิด...{:else}เปิดเว็บทดสอบ <Icon name="arrow-right" class="h-4 w-4" />{/if}
			</button>
			<p class="mt-3 text-xs text-slate-500">ตั๋วเข้าใช้ได้ครั้งเดียวภายใน 1 นาที และออกให้เฉพาะ ADMIN/STAFF ที่ล็อกอินอยู่</p>
		</section>
	{/if}

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
