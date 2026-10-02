<script lang="ts">
	import InfoShell from '$lib/components/InfoShell.svelte';
	import { DROPOFF_POINTS, PICKUP_HUBS } from '$lib/data/locations';

	const canteens = PICKUP_HUBS.filter((h) => h.zone === 'CANTEEN');
	const others = PICKUP_HUBS.filter((h) => h.zone !== 'CANTEEN');
</script>

<InfoShell
	title="จุดส่งและจุดรับของใน มจธ. บางมด"
	lead="Goose Man ส่งถึงหน้าตึกเรียนและหอพักในมหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี (บางมด) และหิ้วจากโรงอาหารกับร้านรอบมอ ทุกจุดรับของที่ชั้น 1"
>
	<section aria-labelledby="dropoff">
		<h2 id="dropoff" class="text-xl font-bold">จุดส่งของในมหาวิทยาลัย</h2>
		<p class="mt-2 text-slate-600">เลือกจุดส่งตอนสั่ง คนหิ้วจะเอาของมาส่งที่จุดนี้ ทุกอาคารรับของที่ชั้น 1</p>
		<ul class="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white">
			{#each DROPOFF_POINTS as p (p.id)}
				<li class="px-4 py-3">
					<h3 class="font-semibold">{p.name}</h3>
					<p class="text-sm text-slate-600">{p.note}</p>
				</li>
			{/each}
		</ul>
	</section>

	<section aria-labelledby="canteens">
		<h2 id="canteens" class="text-xl font-bold">โรงอาหารที่หิ้วได้</h2>
		<p class="mt-2 text-slate-600">โรงอาหารกลางของ มจธ. ชื่อ KFC ย่อมาจาก King Mongkut's Food Center ไม่ใช่ร้านไก่ทอด รวมอาหารไทย ก๋วยเตี๋ยว อาหารฮาลาล และอาหารมังสวิรัติ</p>
		<ul class="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white">
			{#each canteens as h (h.id)}<li class="px-4 py-3 font-semibold">{h.name}</li>{/each}
		</ul>
	</section>

	<section aria-labelledby="others">
		<h2 id="others" class="text-xl font-bold">ร้านในอาคารและร้านรอบมอ</h2>
		<ul class="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white">
			{#each others as h (h.id)}<li class="px-4 py-3 font-semibold">{h.name}</li>{/each}
		</ul>
		<p class="mt-3 text-sm text-slate-500">ร้านที่เปิดให้สั่งและเวลาเปิด-ปิดดูได้ในแอป แต่ละร้านตั้งเวลาเองและอาจเปลี่ยนได้</p>
	</section>

	<section aria-labelledby="address">
		<h2 id="address" class="text-xl font-bold">ที่ตั้งมหาวิทยาลัย</h2>
		<p class="mt-2 text-slate-700">มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี (มจธ. / KMUTT) วิทยาเขตบางมด 126 ถนนประชาอุทิศ แขวงบางมด เขตทุ่งครุ กรุงเทพมหานคร 10140</p>
	</section>

	<p class="rounded-2xl bg-brand-50 p-5 text-center">
		<a href="/" class="inline-flex min-h-12 items-center rounded-full bg-brand px-6 font-semibold text-white hover:bg-brand-600">เลือกร้านและฝากหิ้วเลย</a>
	</p>
</InfoShell>
