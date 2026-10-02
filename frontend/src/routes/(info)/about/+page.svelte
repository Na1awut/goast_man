<script lang="ts">
	import InfoShell from '$lib/components/InfoShell.svelte';
	import { FAQ, STEPS } from '$lib/seoContent';
</script>

<InfoShell
	title="แอปส่งอาหารใน มจธ. บางมด ใช้ Goose Man ฝากหิ้วยังไง"
	lead="Goose Man (ห่านบางมด) คือแอปส่งอาหารและฝากหิ้วโดยนักศึกษา เพื่อนักศึกษา สั่งอาหารจากโรงอาหารหรือร้านรอบมอ แล้วเพื่อนที่อยู่ใกล้ร้านหิ้วมาส่งถึงหน้าตึกเรียนหรือหอพัก ไม่ต้องเดินฝ่าแดดหรือฝน"
>
	<section aria-labelledby="steps">
		<h2 id="steps" class="text-xl font-bold">ฝากหิ้วทำงานยังไง</h2>
		<ol class="mt-4 space-y-4">
			{#each STEPS as s, i (s.title)}
				<li class="flex gap-3">
					<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white" aria-hidden="true">{i + 1}</span>
					<div>
						<h3 class="font-semibold">{s.title}</h3>
						<p class="mt-0.5 text-slate-600">{s.body}</p>
					</div>
				</li>
			{/each}
		</ol>
	</section>

	<section aria-labelledby="fee">
		<h2 id="fee" class="text-xl font-bold">ค่าหิ้วและการชำระเงิน</h2>
		<p class="mt-3 text-slate-700">ค่าหิ้วเริ่มต้น <strong>15 บาท</strong>ต่อออเดอร์ ช่วงฝนตกอาจมีค่าหิ้วเพิ่ม ระบบแสดงยอดรวมทั้งหมดก่อนชำระเสมอ ชำระด้วย <strong>PromptPay</strong> สแกน QR แล้วแนบสลิป ระบบตรวจสลิปให้อัตโนมัติ</p>
	</section>

	<section aria-labelledby="safe">
		<h2 id="safe" class="text-xl font-bold">ปลอดภัยยังไง</h2>
		<ul class="mt-3 list-disc space-y-1.5 pl-5 text-slate-700">
			<li>ใช้ได้เฉพาะอีเมล @kmutt.ac.th และ @mail.kmutt.ac.th จึงรู้ว่าทุกคนในระบบเป็นคนใน มจธ.</li>
			<li>คนหิ้วเป็นนักศึกษา มจธ. ที่ทีมงานนัดตรวจบัตรนักศึกษาและอบรมก่อนเริ่มงาน</li>
			<li>รับของด้วยรหัส OTP 4 หลัก บอกเมื่อได้ของครบเท่านั้น</li>
			<li>คุยผ่านแชทและโทรในแอปได้โดยไม่ต้องแลกเบอร์โทรกันเอง แชทเก็บไว้เป็นหลักฐานอย่างน้อย 10 วัน</li>
		</ul>
	</section>

	<section aria-labelledby="where">
		<h2 id="where" class="text-xl font-bold">ส่งและรับของที่ไหนได้บ้าง</h2>
		<p class="mt-3 text-slate-700">ส่งถึงอาคารเรียน LX, CB2, CB3, SIT, ตึกวิศวะ 12 ชั้น, หอสมุด มจธ. และหอพักชาย S5 กับหอพักหญิง S6 หิ้วจากโรงอาหาร KFC (King Mongkut's Food Center) โรงอาหารหอพัก CB1 Green Canteen และร้านรอบมอ ดู<a href="/areas/" class="font-medium text-brand underline underline-offset-2">รายละเอียดจุดส่งและจุดรับ</a></p>
	</section>

	<section aria-labelledby="faq">
		<h2 id="faq" class="text-xl font-bold">คำถามที่พบบ่อย</h2>
		<dl class="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white">
			{#each FAQ as f (f.q)}
				<div class="px-4 py-3.5">
					<dt class="font-semibold">{f.q}</dt>
					<dd class="mt-1 text-slate-600">{f.a}</dd>
				</div>
			{/each}
		</dl>
	</section>

	<p class="rounded-2xl bg-brand-50 p-5 text-center">
		<a href="/" class="inline-flex min-h-12 items-center rounded-full bg-brand px-6 font-semibold text-white hover:bg-brand-600">เปิดแอป แล้วฝากหิ้วเลย</a>
	</p>
</InfoShell>
