<script lang="ts">
	// Home page of the test site: pick who to try the app as. Kept apart from the app and the
	// team console, which open as their own pages and carry no test controls of their own.
	import { base } from '$app/paths';
	import logo from '$lib/assets/logo.webp';
	import Icon from '$lib/components/Icon.svelte';

	const roles = [
		{ href: `${base}/app/?as=student`, title: 'ผู้ซื้อ', body: 'เลือกร้าน สั่งอาหาร จ่าย PromptPay (จำลอง) แล้วติดตามออเดอร์' },
		{ href: `${base}/app/?as=rider`, title: 'คนหิ้ว', body: 'ดูบอร์ดงาน รับงาน ซื้อของ แล้วส่งด้วยรหัส OTP' },
		{ href: `${base}/app/?as=partner`, title: 'ร้านค้า', body: 'จัดการเมนู เปิด-ปิดร้าน ตั้งเวลาเปิด-ปิด ดูยอดขาย' },
		{ href: `${base}/admin/`, title: 'ทีมงาน (คอนโซล)', body: 'ออเดอร์ การเงิน ร้านค้า คนหิ้ว ของทีม Admin และ Staff' }
	];

	function reset() {
		try {
			localStorage.clear();
			sessionStorage.clear();
		} catch {
			// Storage blocked: nothing to clear
		}
		location.reload();
	}
</script>

<main class="mx-auto flex min-h-dvh max-w-md flex-col bg-canvas px-5 pt-10 pb-8">
	<header class="flex items-center gap-3">
		<img src={logo} alt="" width="48" height="48" class="h-12 w-12 shrink-0 rounded-xl" />
		<div class="min-w-0">
			<p class="text-lg leading-tight font-bold">Goose Man</p>
			<p class="text-sm text-slate-500">เว็บทดสอบการอัปเดต</p>
		</div>
	</header>

	<h1 class="mt-8 text-2xl leading-snug font-bold text-balance">ลองใช้ในฐานะใคร</h1>
	<p class="mt-2 text-sm leading-relaxed text-slate-600">เว็บนี้แยกจากเว็บจริงทั้งหมด ใช้ข้อมูลตัวอย่างที่อยู่ในเบราว์เซอร์ของคุณเท่านั้น สั่งอะไรหรือแก้อะไรก็ไม่กระทบร้าน คนหิ้ว หรือผู้ใช้จริง</p>

	<ul class="mt-6 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
		{#each roles as r (r.title)}
			<li>
				<a href={r.href} data-sveltekit-reload class="flex min-h-[4.5rem] items-center gap-3 px-4 py-3.5 active:bg-brand-50">
					<span class="min-w-0 flex-1">
						<span class="block font-semibold text-slate-900">{r.title}</span>
						<span class="mt-0.5 block text-sm text-slate-600">{r.body}</span>
					</span>
					<Icon name="chevron-right" class="h-5 w-5 shrink-0 text-slate-400" />
				</a>
			</li>
		{/each}
	</ul>

	<section class="mt-8">
		<h2 class="text-sm font-semibold text-slate-900">สิ่งที่เว็บทดสอบจำลองไม่ได้</h2>
		<ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
			<li>แต่ละบทบาทแยกกัน ออเดอร์ของผู้ซื้อไม่ไปโผล่ที่คนหิ้วหรือร้านจริงๆ</li>
			<li>แจ้งเตือนตอนปิดแอป การโทรในแอป การตรวจสลิป และการเข้าสู่ระบบ Google/Microsoft</li>
		</ul>
	</section>

	<button type="button" onclick={reset} class="mt-8 flex min-h-11 items-center gap-2 self-start text-sm font-medium text-slate-600 underline underline-offset-4">
		ล้างข้อมูลทดสอบ แล้วเริ่มใหม่
	</button>
</main>
