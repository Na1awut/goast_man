<script lang="ts">
	import AppBar from '$lib/components/AppBar.svelte';
	import BottomBar from '$lib/components/BottomBar.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { nav } from '$lib/stores/nav.svelte';
	import { profileGate } from '$lib/stores/profileGate.svelte';
	import { riderApplication } from '$lib/stores/riderApplication.svelte';
	import { toast } from '$lib/stores/toast.svelte';

	const DAYS = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'];
	const SLOTS = [
		{ id: 'เช้า', hint: '8-11 น.' },
		{ id: 'เที่ยง', hint: '11-13 น.' },
		{ id: 'บ่าย', hint: '13-16 น.' },
		{ id: 'เย็น', hint: '16-19 น.' }
	];

	let days = $state<string[]>([]);
	let slots = $state<string[]>([]);
	let note = $state('');
	let agreed = $state(false);
	let error = $state('');

	const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
	/** Kept in the week's order, whatever order they were tapped */
	const availability = $derived(
		[DAYS.filter((d) => days.includes(d)).join(' '), SLOTS.filter((s) => slots.includes(s.id)).map((s) => s.id).join(', ')].filter(Boolean).join(' · ')
	);
	const ready = $derived(days.length > 0 && slots.length > 0 && agreed);

	async function submit() {
		error = '';
		if (!ready) {
			error = !days.length || !slots.length ? 'เลือกวันและช่วงเวลาที่ว่างอย่างน้อยอย่างละ 1' : 'ติ๊กยอมรับเรื่องนัดตรวจก่อนเริ่มงาน';
			return;
		}
		// The team needs the nickname, phone and student id on the application
		if (!profileGate.ensure()) return;
		error = await riderApplication.submit(availability, note.trim());
		if (error) return;
		toast.show('ส่งใบสมัครแล้ว ทีม Goose Man จะติดต่อนัดตรวจบัตรและอบรม', 'success', { duration: 5000, notify: true });
		nav.back();
	}

	const chip = (on: boolean) => `rounded-full border px-3.5 py-2 text-sm transition-colors ${on ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-slate-700'}`;
</script>

<div class="flex flex-1 flex-col">
	<AppBar title="สมัครเป็นคนหิ้ว" />

	<div class="flex-1 space-y-4 px-4 pt-4 pb-6">
		<section class="rounded-2xl bg-brand-50 p-4 text-sm text-slate-700">
			<p class="font-semibold text-slate-900">หิ้วให้เพื่อนในมอ ได้ค่าหิ้วงานละ 15 บาท + ทิป</p>
			<ul class="mt-2 space-y-1.5">
				<li class="flex gap-2"><Icon name="walk" class="mt-0.5 h-4 w-4 shrink-0 text-brand" />รับอาหารจากโรงอาหารไปส่งหน้าตึกหรือหอ ถือได้ครั้งละไม่เกิน 4 งาน</li>
				<li class="flex gap-2"><Icon name="wallet" class="mt-0.5 h-4 w-4 shrink-0 text-brand" />ทีมโอนค่าหิ้วเข้า PromptPay หลังคุณยืนยันส่งด้วย OTP</li>
				<li class="flex gap-2"><Icon name="shield" class="mt-0.5 h-4 w-4 shrink-0 text-brand" />ก่อนเริ่ม ทีมจะนัดตรวจบัตรนักศึกษาและอบรมวิธีส่งกับ OTP ประมาณ 15 นาที</li>
			</ul>
		</section>

		<section class="rounded-2xl border border-slate-100 bg-white p-4">
			<h2 class="text-sm font-semibold text-slate-900">วันที่ว่าง</h2>
			<div class="mt-2 flex flex-wrap gap-2" role="group" aria-label="วันที่ว่าง">
				{#each DAYS as d (d)}
					<button type="button" aria-pressed={days.includes(d)} onclick={() => (days = toggle(days, d))} class={chip(days.includes(d))}>{d}</button>
				{/each}
			</div>
			<h2 class="mt-4 text-sm font-semibold text-slate-900">ช่วงเวลา</h2>
			<div class="mt-2 grid grid-cols-2 gap-2" role="group" aria-label="ช่วงเวลา">
				{#each SLOTS as s (s.id)}
					<button type="button" aria-pressed={slots.includes(s.id)} onclick={() => (slots = toggle(slots, s.id))} class="{chip(slots.includes(s.id))} rounded-xl text-left">
						<span class="block font-medium">{s.id}</span>
						<span class="block text-xs {slots.includes(s.id) ? 'text-white/85' : 'text-slate-500'}">{s.hint}</span>
					</button>
				{/each}
			</div>
		</section>

		<label class="block rounded-2xl border border-slate-100 bg-white p-4">
			<span class="text-sm font-semibold text-slate-900">เล่าให้ทีมฟังหน่อย <span class="font-normal text-slate-400">(ไม่บังคับ)</span></span>
			<textarea bind:value={note} rows="3" maxlength="300" placeholder="เช่น มีจักรยาน อยู่หอ S5 เคยส่งของมาก่อน" class="mt-2 w-full rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand"></textarea>
		</label>

		<label class="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4 text-sm text-slate-700">
			<input type="checkbox" bind:checked={agreed} class="mt-0.5 h-5 w-5 shrink-0 accent-brand" />
			<span>เข้าใจว่าต้องนัดทีมตรวจบัตรนักศึกษาและอบรมก่อน จึงจะรับงานได้ และทีมอาจไม่อนุมัติพร้อมแจ้งเหตุผล</span>
		</label>

		{#if error}<p class="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>{/if}
	</div>

	<BottomBar>
		<button type="button" onclick={submit} disabled={riderApplication.submitting} class="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-4 text-sm font-semibold text-white active:bg-brand-600 disabled:opacity-70">
			{#if riderApplication.submitting}<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span> กำลังส่ง...{:else}ส่งใบสมัคร{/if}
		</button>
	</BottomBar>
</div>
