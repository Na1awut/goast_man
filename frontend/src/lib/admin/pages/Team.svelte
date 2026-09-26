<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import { initialOf } from '$lib/utils';
	import { adminError } from '../api';
	import { consoleState as c } from '../console.svelte';
	import { thaiDate } from '../format';
	import type { TeamMember, TeamRole } from '../types';
	import Empty from '../ui/Empty.svelte';
	import Modal from '../ui/Modal.svelte';

	let members = $state<TeamMember[] | null>(null);
	let error = $state('');

	$effect(() => {
		void c.tick;
		c.api
			?.team()
			.then((m) => {
				members = m;
				error = '';
			})
			.catch((err) => (error = adminError(err)));
	});

	const ROLES: { id: TeamRole; title: string; body: string }[] = [
		{ id: 'STAFF', title: 'STAFF', body: 'เฝ้าออเดอร์ ยกเลิก ปลดล็อก OTP ยืนยันรับเงิน โอนคนหิ้ว คืนเงิน เปิด/ปิดร้านและเมนู' },
		{ id: 'ADMIN', title: 'ADMIN', body: 'ทุกอย่างของ STAFF และเพิ่ม/นำคนหิ้วออก อนุมัติโปร เชิญร้าน จัดการทีมงาน ดูบันทึกการทำงาน' }
	];

	let adding = $state(false);
	let removing = $state<TeamMember | null>(null);
	let email = $state('');
	let role = $state<TeamRole>('STAFF');
	let note = $state('');
	let busy = $state(false);
	let dialogError = $state('');
	const validEmail = $derived(/^[^@\s]+@(mail\.)?kmutt\.ac\.th$/i.test(email.trim()));

	async function run(action: () => Promise<unknown>, success: string) {
		busy = true;
		dialogError = '';
		try {
			await action();
			adding = false;
			removing = null;
			c.done(success);
		} catch (err) {
			dialogError = adminError(err);
		} finally {
			busy = false;
		}
	}
</script>

<div class="space-y-4">
	<div class="grid gap-3 md:grid-cols-2">
		{#each ROLES as r (r.id)}
			<div class="rounded-2xl border border-slate-100 bg-white p-4">
				<span class="rounded-full px-2.5 py-1 text-xs font-semibold {r.id === 'ADMIN' ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-700'}">{r.title}</span>
				<p class="mt-2 text-sm text-slate-600">{r.body}</p>
			</div>
		{/each}
	</div>

	<div class="flex justify-end">
		<button type="button" onclick={() => { adding = true; email = ''; role = 'STAFF'; note = ''; dialogError = ''; }} class="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-600"><Icon name="user-plus" class="h-4 w-4" />เพิ่มทีมงาน</button>
	</div>

	<div class="rounded-2xl border border-slate-100 bg-white">
		{#if error && !members}
			<Empty title="โหลดรายชื่อทีมงานไม่สำเร็จ" body={error} />
		{:else if !members}
			<div class="space-y-2 p-4">{#each Array(3) as _, i (i)}<div class="h-14 animate-pulse rounded-lg bg-slate-100"></div>{/each}</div>
		{:else}
			<ul class="divide-y divide-slate-100">
				{#each members as m (m.email)}
					<li class="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
						<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-700">{initialOf(m.name || m.email).toUpperCase()}</span>
						<div class="min-w-0 flex-1">
							<p class="truncate font-semibold">{m.name ?? m.email}{#if m.is_me}<span class="ml-2 text-xs font-normal text-slate-500">(คุณ)</span>{/if}</p>
							<p class="truncate text-xs text-slate-500">{m.email}{m.has_account ? '' : ' · ยังไม่เคยเข้าแอป'} · เพิ่ม {thaiDate(m.added_at)}{m.added_by ? ` โดย ${m.added_by}` : ''}</p>
						</div>
						<select
							value={m.role}
							disabled={m.is_me}
							title={m.is_me ? 'เปลี่ยนสิทธิ์ของตัวเองไม่ได้' : undefined}
							aria-label="บทบาทของ {m.name ?? m.email}"
							onchange={(e) => c.act(() => c.api!.setMember(m.email, e.currentTarget.value as TeamRole), `เปลี่ยน ${m.name ?? m.email} เป็น ${e.currentTarget.value} แล้ว`)}
							class="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-brand disabled:bg-slate-50 disabled:text-slate-400"
						>
							<option value="STAFF">STAFF</option>
							<option value="ADMIN">ADMIN</option>
						</select>
						<button type="button" disabled={m.is_me} title={m.is_me ? 'นำตัวเองออกไม่ได้' : undefined} onclick={() => { removing = m; dialogError = ''; }} class="h-10 rounded-xl px-3 text-sm text-red-600 hover:bg-red-50 disabled:text-slate-300 disabled:hover:bg-transparent">นำออก</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>

<Modal open={adding} title="เพิ่มทีมงาน" onclose={() => (adding = false)} confirmLabel="เพิ่มทีมงาน" {busy} disabled={!validEmail} error={dialogError}
	onconfirm={() => run(() => c.api!.setMember(email, role, note), `เพิ่ม ${email.trim().toLowerCase()} เป็น ${role} แล้ว`)}>
	<label class="block">
		<span class="mb-1 block font-medium text-slate-900">อีเมล มจธ.</span>
		<input bind:value={email} type="email" autocomplete="off" placeholder="ชื่อ.นามสกุล@mail.kmutt.ac.th" class="h-11 w-full rounded-xl bg-slate-100 px-3.5 outline-none focus:ring-2 focus:ring-brand" />
		{#if email && !validEmail}<span class="mt-1 block text-xs text-red-600">ใช้ได้เฉพาะ @kmutt.ac.th หรือ @mail.kmutt.ac.th</span>{/if}
	</label>
	<fieldset class="mt-4">
		<legend class="mb-2 font-medium text-slate-900">บทบาท</legend>
		<div class="grid gap-2">
			{#each ROLES as r (r.id)}
				<label class="flex cursor-pointer gap-3 rounded-xl border p-3 {role === r.id ? 'border-brand bg-brand-50' : 'border-slate-200'}">
					<input type="radio" name="role" value={r.id} bind:group={role} class="mt-1 accent-brand" />
					<span><span class="block font-semibold">{r.title}</span><span class="text-xs {role === r.id ? 'text-brand-700' : 'text-slate-600'}">{r.body}</span></span>
				</label>
			{/each}
		</div>
	</fieldset>
	<label class="mt-4 block">
		<span class="mb-1 block font-medium text-slate-900">หมายเหตุ <span class="font-normal text-slate-400">(ไม่บังคับ)</span></span>
		<input bind:value={note} maxlength="120" placeholder="เช่น กะเที่ยงวันจันทร์-พุธ" class="h-11 w-full rounded-xl bg-slate-100 px-3.5 outline-none focus:ring-2 focus:ring-brand" />
	</label>
</Modal>

<Modal open={!!removing} title="นำ {removing?.name ?? removing?.email ?? ''} ออกจากทีมงาน?" onclose={() => (removing = null)} confirmLabel="นำออก" danger {busy} error={dialogError}
	onconfirm={() => run(() => c.api!.removeMember(removing!.email), `นำ ${removing!.email} ออกจากทีมงานแล้ว`)}>
	<p>จะเข้าหน้าทีมงานไม่ได้อีก จนกว่า ADMIN จะเพิ่มกลับ</p>
</Modal>
