<script lang="ts">
	import FaqSection from '$lib/components/FaqSection.svelte';
	import InfoShell from '$lib/components/InfoShell.svelte';
	import { FAQ_PARTNER } from '$lib/seoContent';
</script>

<InfoShell
	title="ลงร้านกับ Goose Man ขายอาหารให้นักศึกษา มจธ."
	lead="ร้านในมหาวิทยาลัยและรอบมอ รับออเดอร์จากนักศึกษาผ่านแอปได้โดยไม่ต้องทำระบบสั่งอาหารเอง นักศึกษาสั่ง คนหิ้วมารับที่หน้าร้าน"
>
	<section aria-labelledby="what">
		<h2 id="what" class="text-xl font-bold">ร้านจัดการอะไรเองได้</h2>
		<ul class="mt-3 list-disc space-y-1.5 pl-5 text-slate-700">
			<li>เมนู ราคา รูป ตัวเลือกเสริม และราคาพิเศษของแต่ละเมนู</li>
			<li>เปิด-ปิดรับออเดอร์ และตั้งเวลาเปิด-ปิดร้านอัตโนมัติตามวันและเวลาที่ร้านกำหนด (ข้ามเที่ยงคืนได้)</li>
			<li>โปรโมชันของร้าน เช่น ซื้อครบจำนวนลดราคา</li>
			<li>ติดตามออเดอร์ที่กำลังมาและดูยอดขายรายวัน</li>
		</ul>
	</section>

	<section aria-labelledby="flow">
		<h2 id="flow" class="text-xl font-bold">ออเดอร์เข้ามายังไง</h2>
		<p class="mt-3 text-slate-700">นักศึกษาชำระเงินผ่านแอปก่อน แล้วคนหิ้วมารับของที่หน้าร้านและจ่ายร้านตามราคาในออเดอร์ ร้านไม่ต้องรับเงินจากผู้สั่งเอง และไม่ต้องเห็นชื่อหรือเบอร์โทรของผู้สั่ง</p>
	</section>

	<section aria-labelledby="join">
		<h2 id="join" class="text-xl font-bold">เข้าร่วมยังไง</h2>
		<p class="mt-3 text-slate-700">ติดต่อทีม Goose Man ผ่าน<a href="https://www.facebook.com/profile.php?id=61594818175024" rel="me noopener" class="font-medium text-brand underline underline-offset-2">เพจ Facebook</a>หรือ<a href="https://www.instagram.com/gooseman.co/" rel="me noopener" class="font-medium text-brand underline underline-offset-2">Instagram: gooseman.co</a> ทีมงานจะเพิ่มร้านของคุณและส่งคำเชิญไปที่อีเมลของร้าน จากนั้นเข้าสู่ระบบที่หน้าแรกด้วยปุ่ม "เข้าสู่ระบบร้านค้า" เพื่อจัดการร้านได้ทันที</p>
	</section>

	<FaqSection items={FAQ_PARTNER} heading="คำถามสำหรับร้านค้า" />

	<p class="rounded-2xl bg-brand-50 p-5 text-center">
		<a href="/" class="inline-flex min-h-12 items-center rounded-full bg-brand px-6 font-semibold text-white hover:bg-brand-600">เข้าสู่ระบบร้านค้า</a>
	</p>
</InfoShell>
