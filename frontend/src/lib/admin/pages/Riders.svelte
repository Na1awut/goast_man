<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import { initialOf } from '$lib/utils';
	import { adminError } from '../api';
	import { consoleState as c } from '../console.svelte';
	import { ago, phone, thaiDate } from '../format';
	import type { AdminRider, RiderApplicationRow } from '../types';
	import Empty from '../ui/Empty.svelte';
	import Modal from '../ui/Modal.svelte';
	import Tabs from '../ui/Tabs.svelte';

	let riders = $state<AdminRider[] | null>(null);
	let error = $state('');
	let query = $state('');
	let filter = $state<'all' | 'busy' | 'free'>('all');

	$effect(() => {
		void c.tick;
		c.api
			?.riders()
			.then((r) => {
				riders = r;
				error = '';
			})
			.catch((err) => (error = adminError(err)));
		// Before the rider-tools migration this call fails: the section just stays hidden
		c.api
			?.riderApplications()
			.then((a) => (applications = a))
			.catch(() => (applications = []));
	});

	let applications = $state<RiderApplicationRow[]>([]);
	let reviewing = $state<{ app: RiderApplicationRow; approve: boolean } | null>(null);
	let reviewNote = $state('');

	const shown = $derived(
		(riders ?? []).filter((r) => {
			const q = query.trim().toLowerCase();
			const match = !q || [r.nickname, r.full_name, r.email, r.phone].some((v) => v?.toLowerCase().includes(q));
			return match && (filter === 'all' || (filter === 'busy') === r.busy);
		})
	);

	let adding = $state(false);
	let removing = $state<AdminRider | null>(null);
	let email = $state('');
	let note = $state('');
	let reason = $state('');
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
			reviewing = null;
			c.done(success);
		} catch (err) {
			dialogError = adminError(err);
		} finally {
			busy = false;
		}
	}

	function load(r: AdminRider) {
		if (r.delivering) return { text: 'กำลังส่ง', cls: 'bg-violet-50 text-violet-700' };
		if (r.busy) return { text: `ถือ ${r.holding}/4`, cls: 'bg-brand-50 text-brand-700' };
		if (r.online) return { text: 'พร้อมรับงาน', cls: 'bg-fresh-50 text-fresh-700' };
		return { text: r.user_id ? 'ออฟไลน์' : 'ยังไม่เคยเข้าแอป', cls: 'bg-slate-100 text-slate-600' };
	}
	const readyCount = $derived((riders ?? []).filter((r) => r.online).length);
</script>

<div class="space-y-4">
	<div class="flex flex-wrap items-center gap-3">
		<label class="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-slate-500 focus-within:ring-2 focus-within:ring-brand sm:max-w-sm">
			<Icon name="search" class="h-[18px] w-[18px]" />
			<input bind:value={query} type="search" placeholder="ค้นหาชื่อ อีเมล หรือเบอร์" class="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none" />
		</label>
		<Tabs
			label="กรองคนหิ้ว"
			value={filter}
			onchange={(f) => (filter = f)}
			tabs={[
				{ id: 'all', label: `ทั้งหมด · พร้อม ${readyCount}`, count: riders?.length },
				{ id: 'busy', label: 'กำลังถืองาน', count: riders?.filter((r) => r.busy).length },
				{ id: 'free', label: 'ไม่มีงาน', count: riders?.filter((r) => !r.busy).length }
			]}
		/>
		{#if c.isAdmin}
			<button type="button" onclick={() => { adding = true; email = ''; note = ''; dialogError = ''; }} class="ml-auto inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-600">
				<Icon name="user-plus" class="h-4 w-4" />เพิ่มคนหิ้ว
			</button>
		{/if}
	</div>
	{#if !c.isAdmin}<p class="text-xs text-slate-500">STAFF ดูได้อย่างเดียว การเพิ่ม อนุมัติ หรือนำคนหิ้วออกทำได้เฉพาะ ADMIN</p>{/if}

	{#if applications.length}
		<section class="rounded-2xl border border-amber-200 bg-white" aria-label="ใบสมัครคนหิ้ว">
			<div class="flex items-baseline justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
				<h2 class="font-semibold">ใบสมัครรอตรวจ <span class="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{applications.length}</span></h2>
				<p class="text-xs text-slate-500">นัดตรวจบัตร นศ. และอบรมก่อนอนุมัติ</p>
			</div>
			<ul class="divide-y divide-slate-100">
				{#each applications as a (a.id)}
					<li class="flex flex-wrap items-start gap-3 px-4 py-3.5 sm:px-5">
						<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 font-semibold text-amber-800">{initialOf(a.nickname || a.email).toUpperCase()}</span>
						<div class="min-w-0 flex-1 text-sm">
							<p class="font-semibold">{a.nickname ?? a.email} <span class="font-normal text-slate-500">· {a.full_name ?? ''}</span></p>
							<p class="text-xs text-slate-500">{[a.faculty, a.level].filter(Boolean).join(' ')} · รหัส {a.student_id || '—'} · สั่งสำเร็จ {a.orders_as_buyer} ครั้ง · สมัคร {ago(a.created_at)}</p>
							<p class="mt-1"><span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">ว่าง {a.availability}</span></p>
							{#if a.note}<p class="mt-1 text-slate-600">“{a.note}”</p>{/if}
						</div>
						<div class="flex w-full items-center gap-2 sm:w-auto">
							{#if a.phone}<a href="tel:{a.phone}" class="inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand-50 px-3 text-sm font-medium whitespace-nowrap text-brand"><Icon name="phone" class="h-4 w-4" />{phone(a.phone)}</a>{/if}
							{#if c.isAdmin}
								<button type="button" onclick={() => { reviewing = { app: a, approve: false }; reviewNote = ''; dialogError = ''; }} class="h-10 rounded-xl px-3 text-sm text-red-600 hover:bg-red-50">ไม่อนุมัติ</button>
								<button type="button" onclick={() => { reviewing = { app: a, approve: true }; reviewNote = ''; dialogError = ''; }} class="h-10 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-600">อนุมัติ</button>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<div class="rounded-2xl border border-slate-100 bg-white">
		{#if error && !riders}
			<Empty title="โหลดรายชื่อคนหิ้วไม่สำเร็จ" body={error} />
		{:else if !riders}
			<div class="space-y-2 p-4">{#each Array(5) as _, i (i)}<div class="h-14 animate-pulse rounded-lg bg-slate-100"></div>{/each}</div>
		{:else if riders.length === 0}
			<Empty title="ยังไม่มีคนหิ้วในรายชื่อ" body="เพิ่มอีเมลของคนที่ผ่านการ verify แล้ว เขาจะรับงานได้ทันทีที่เข้าแอป" />
		{:else if shown.length === 0}
			<Empty title="ไม่พบคนหิ้ว" goose={false} />
		{:else}
			<table class="hidden w-full text-left text-sm lg:table">
				<thead class="text-xs text-slate-500">
					<tr class="border-b border-slate-100">
						<th class="py-3 pl-5 font-medium">คนหิ้ว</th><th class="py-3 font-medium">ติดต่อ</th><th class="py-3 font-medium">ตอนนี้</th>
						<th class="py-3 text-right font-medium">งานวันนี้ / ทั้งหมด</th><th class="py-3 pl-6 font-medium">คะแนน</th><th class="py-3 font-medium">verify</th><th class="py-3 pr-5"></th>
					</tr>
				</thead>
				<tbody>
					{#each shown as r (r.email)}
						{@const l = load(r)}
						<tr class="border-b border-slate-50 last:border-0">
							<td class="py-3 pl-5">
								<div class="flex items-center gap-3">
									<span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">{initialOf(r.nickname || r.email).toUpperCase()}</span>
									<div class="min-w-0"><p class="font-semibold">{r.nickname ?? '—'}</p><p class="max-w-52 truncate text-xs text-slate-500">{r.full_name ?? r.email}{r.faculty ? ` · ${r.faculty}${r.level ? ` ${r.level}` : ''}` : ''}</p></div>
								</div>
							</td>
							<td class="py-3"><p class="max-w-52 truncate">{r.email}</p>{#if r.phone}<a href="tel:{r.phone}" class="text-xs text-brand">{phone(r.phone)}</a>{/if}</td>
							<td class="py-3"><span class="rounded-full px-2.5 py-1 text-xs font-medium {l.cls}">{l.text}</span></td>
							<td class="py-3 text-right tabular-nums">{r.jobs_today} / {r.jobs_total}</td>
							<td class="py-3 pl-6">{#if r.rating}<span class="inline-flex items-center gap-1"><Icon name="star" class="h-4 w-4 text-beak" filled strokeWidth={0} />{r.rating}</span>{:else}<span class="text-slate-400">—</span>{/if}</td>
							<td class="max-w-56 py-3"><p class="text-xs">{thaiDate(r.added_at)}{r.added_by ? ` · โดย ${r.added_by}` : ''}</p>{#if r.note}<p class="truncate text-xs text-slate-500">{r.note}</p>{/if}</td>
							<td class="py-3 pr-5 text-right">
								{#if c.isAdmin}<button type="button" onclick={() => { removing = r; reason = ''; dialogError = ''; }} class="h-9 rounded-lg px-3 text-sm text-red-600 hover:bg-red-50">นำออก</button>{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<ul class="divide-y divide-slate-100 lg:hidden">
				{#each shown as r (r.email)}
					{@const l = load(r)}
					<li class="flex items-center gap-3 px-4 py-3">
						<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 font-semibold text-brand-700">{initialOf(r.nickname || r.email).toUpperCase()}</span>
						<div class="min-w-0 flex-1">
							<p class="flex items-center gap-2"><span class="truncate font-semibold">{r.nickname ?? r.email}</span><span class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium {l.cls}">{l.text}</span></p>
							<p class="truncate text-xs text-slate-500">งานวันนี้ {r.jobs_today} · ทั้งหมด {r.jobs_total}{r.rating ? ` · ${r.rating} ดาว` : ''}</p>
						</div>
						{#if r.phone}<a href="tel:{r.phone}" aria-label="โทรหา {r.nickname}" class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand"><Icon name="phone" class="h-5 w-5" /></a>{/if}
						{#if c.isAdmin}<button type="button" onclick={() => { removing = r; reason = ''; dialogError = ''; }} aria-label="นำ {r.nickname ?? r.email} ออก" class="flex h-10 w-10 items-center justify-center rounded-xl text-red-600 hover:bg-red-50"><Icon name="trash" class="h-5 w-5" /></button>{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>

<Modal open={adding} title="เพิ่มคนหิ้ว" onclose={() => (adding = false)} confirmLabel="เพิ่มเข้ารายชื่อ" {busy} disabled={!validEmail} error={dialogError}
	onconfirm={() => run(() => c.api!.addRider(email, note), `เพิ่ม ${email.trim().toLowerCase()} เป็นคนหิ้วแล้ว`)}>
	<label class="block">
		<span class="mb-1 block font-medium text-slate-900">อีเมล มจธ.</span>
		<input bind:value={email} type="email" autocomplete="off" placeholder="ชื่อ.นามสกุล@mail.kmutt.ac.th" class="h-11 w-full rounded-xl bg-slate-100 px-3.5 outline-none focus:ring-2 focus:ring-brand" />
		{#if email && !validEmail}<span class="mt-1 block text-xs text-red-600">ใช้ได้เฉพาะ @kmutt.ac.th หรือ @mail.kmutt.ac.th</span>{/if}
	</label>
	<label class="mt-4 block">
		<span class="mb-1 block font-medium text-slate-900">บันทึกการ verify</span>
		<textarea bind:value={note} rows="2" maxlength="200" placeholder="เช่น ตรวจบัตร นศ. + อบรมวิธีส่งและ OTP แล้ว" class="w-full rounded-xl bg-slate-100 px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-brand"></textarea>
	</label>
	<p class="mt-3 text-xs text-slate-500">ถ้ายังไม่เคยเข้าแอป จะรับงานได้ทันทีที่ login ครั้งแรก</p>
</Modal>

<Modal open={!!removing} title="นำ {removing?.nickname ?? removing?.email ?? ''} ออกจากรายชื่อคนหิ้ว?" onclose={() => (removing = null)} confirmLabel="นำออก" danger {busy} disabled={!reason.trim()} error={dialogError}
	onconfirm={() => run(() => c.api!.removeRider(removing!.email, reason), `นำ ${removing!.nickname ?? removing!.email} ออกแล้ว`)}>
	<p>{removing?.holding ? `งานที่ถืออยู่ ${removing.holding} งานยังส่งต่อได้จนจบ แต่` : ''}จะรับงานใหม่ไม่ได้</p>
	<label class="mt-4 block">
		<span class="mb-1 block font-medium text-slate-900">เหตุผล</span>
		<input bind:value={reason} maxlength="120" class="h-11 w-full rounded-xl bg-slate-100 px-3.5 outline-none focus:ring-2 focus:ring-brand" />
	</label>
</Modal>

<Modal
	open={!!reviewing}
	title={reviewing?.approve ? `อนุมัติ ${reviewing.app.nickname ?? reviewing.app.email} เป็นคนหิ้ว?` : `ไม่อนุมัติ ${reviewing?.app.nickname ?? reviewing?.app.email ?? ''}?`}
	onclose={() => (reviewing = null)}
	confirmLabel={reviewing?.approve ? 'อนุมัติ' : 'ไม่อนุมัติ'}
	danger={!reviewing?.approve}
	{busy}
	disabled={!reviewing?.approve && !reviewNote.trim()}
	error={dialogError}
	onconfirm={() => {
		const r = reviewing!;
		run(() => c.api!.reviewRiderApplication(r.app.id, r.approve, reviewNote), r.approve ? `${r.app.nickname ?? r.app.email} เป็นคนหิ้วแล้ว` : `แจ้ง ${r.app.nickname ?? r.app.email} แล้วว่ายังไม่ผ่าน`);
	}}
>
	{#if reviewing?.approve}
		<p>จะเพิ่มในรายชื่อคนหิ้วทันที นักศึกษาจะเห็นปุ่มโหมดคนหิ้วเมื่อเปิดแอปครั้งถัดไป</p>
		<label class="mt-4 block">
			<span class="mb-1 block font-medium text-slate-900">บันทึกการ verify</span>
			<input bind:value={reviewNote} maxlength="200" placeholder="เช่น ตรวจบัตร นศ. + อบรม OTP แล้ว 27/9" class="h-11 w-full rounded-xl bg-slate-100 px-3.5 outline-none focus:ring-2 focus:ring-brand" />
		</label>
	{:else}
		<label class="block">
			<span class="mb-1 block font-medium text-slate-900">เหตุผล (นักศึกษาจะเห็นข้อความนี้)</span>
			<textarea bind:value={reviewNote} rows="2" maxlength="200" placeholder="เช่น ยังไม่ได้มาตรวจบัตร นัดใหม่ได้ที่..." class="w-full rounded-xl bg-slate-100 px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-brand"></textarea>
		</label>
		<p class="mt-2 text-xs text-slate-500">นักศึกษาสมัครใหม่ได้หลังจากนี้</p>
	{/if}
</Modal>
