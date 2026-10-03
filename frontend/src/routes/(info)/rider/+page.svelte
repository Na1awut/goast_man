<script lang="ts">
	import FaqSection from '$lib/components/FaqSection.svelte';
	import InfoShell from '$lib/components/InfoShell.svelte';
	import { FAQ_RIDER } from '$lib/seoContent';
</script>

<InfoShell
	title="สมัครเป็นคนหิ้ว หารายได้พิเศษระหว่างเรียน นักศึกษา มจธ."
	lead="หิ้วอาหารให้เพื่อนในมหาวิทยาลัยตอนที่คุณอยู่แถวโรงอาหารอยู่แล้ว ได้ค่าหิ้วเริ่มต้นงานละ 15 บาท + ทิป เลือกวันและเวลาว่างเองได้"
>
	<section aria-labelledby="how">
		<h2 id="how" class="text-xl font-bold">งานคนหิ้วทำอะไร</h2>
		<ul class="mt-3 list-disc space-y-1.5 pl-5 text-slate-700">
			<li>กดรับงานที่อยู่ใกล้ รับอาหารจากโรงอาหารหรือร้านรอบมอ ไปส่งหน้าตึกเรียนหรือหอพัก</li>
			<li>ถือได้ครั้งละไม่เกิน 4 งาน และเห็นงานที่ไปทางเดียวกันแนะนำให้</li>
			<li>ถึงจุดส่งแล้วให้ผู้สั่งบอกรหัส OTP เพื่อปิดงาน</li>
			<li>คุยกับผู้สั่งผ่านแชทและโทรในแอป</li>
		</ul>
	</section>

	<section aria-labelledby="pay">
		<h2 id="pay" class="text-xl font-bold">ค่าหิ้วและการโอนเงิน</h2>
		<p class="mt-3 text-slate-700">ได้ค่าหิ้วเริ่มต้นงานละ 15 บาท + ทิปจากผู้สั่ง (ถ้ามี) ทีมงานโอนค่าหิ้วเข้า PromptPay ของคุณหลังยืนยันส่งสำเร็จด้วย OTP และดูรายได้ที่รอโอนในแอปได้</p>
	</section>

	<section aria-labelledby="join">
		<h2 id="join" class="text-xl font-bold">สมัครยังไง</h2>
		<ol class="mt-3 list-decimal space-y-1.5 pl-5 text-slate-700">
			<li>เข้าสู่ระบบด้วยอีเมลนักศึกษา @kmutt.ac.th หรือ @mail.kmutt.ac.th (สมัครได้เฉพาะบัญชีนักศึกษา มจธ.)</li>
			<li>ไปที่โปรไฟล์ แล้วกดสมัครเป็นคนหิ้ว เลือกวันและช่วงเวลาที่ว่าง</li>
			<li>ทีมงานนัดตรวจบัตรนักศึกษาและอบรมวิธีส่งกับ OTP ประมาณ 15 นาที</li>
			<li>เปิดโหมดคนหิ้ว กดพร้อมรับงาน แล้วเริ่มหิ้วได้เลย</li>
		</ol>
	</section>

	<FaqSection items={FAQ_RIDER} heading="คำถามเกี่ยวกับการเป็นคนหิ้ว" />

	<p class="rounded-2xl bg-brand-50 p-5 text-center">
		<a href="/" class="inline-flex min-h-12 items-center rounded-full bg-brand px-6 font-semibold text-white hover:bg-brand-600">เปิดแอป แล้วสมัครเป็นคนหิ้ว</a>
	</p>
</InfoShell>
