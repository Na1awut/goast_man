<script lang="ts">
	import type { LegalPage } from '$lib/data/legal';
	import {
		digitsOnly,
		FACULTIES,
		formatPhone,
		STUDY_LEVELS,
		TERMS_VERSION,
		validateProfile,
		type ProfileInput,
		type StudyLevel
	} from '$lib/profile';
	import { auth, AuthError } from '$lib/stores/auth.svelte';
	import Avatar from './Avatar.svelte';
	import BottomBar from './BottomBar.svelte';
	import Icon from './Icon.svelte';
	import LegalSheet from './LegalSheet.svelte';

	// One form for first-run onboarding and later edits, so the rules never diverge.
	// Only details that stay the same for every order live here; the drop-off
	// point, payment and note are chosen on each order.
	let { mode, onsaved, submitLabel }: { mode: 'onboarding' | 'edit'; onsaved: () => void; submitLabel?: string } = $props();

	const OTHER = '__other__';
	const user = auth.user!;
	const isStudent = user.role === 'STUDENT';
	/** Edits keep the existing consent unless the terms changed since */
	const mustConsent = $derived(mode === 'onboarding' || user.termsVersion !== TERMS_VERSION);

	const knownFaculty = FACULTIES.includes(user.faculty);
	let nickname = $state(user.nickname || user.fullName.split(' ')[0] || '');
	let phone = $state(formatPhone(user.phoneNumber));
	let promptPay = $state(user.promptPayNo ? (digitsOnly(user.promptPayNo).length === 10 ? formatPhone(user.promptPayNo) : user.promptPayNo) : '');
	let studentId = $state(user.studentId);
	let studyLevel = $state<StudyLevel | ''>((user.studyLevel as StudyLevel) ?? '');
	let facultyChoice = $state(knownFaculty ? user.faculty : user.faculty ? OTHER : '');
	let facultyOther = $state(knownFaculty ? '' : user.faculty);
	let consent = $state(false);

	let submitted = $state(false);
	let saving = $state(false);
	let serverError = $state('');
	let legal = $state<LegalPage | null>(null);

	const isStaff = $derived(studyLevel === 'staff');
	const faculty = $derived(isStaff || facultyChoice === OTHER ? facultyOther : facultyChoice);
	const input = $derived<ProfileInput>({ nickname, phone, promptPay, studentId, faculty, studyLevel, consent: consent || !mustConsent });
	const errors = $derived(validateProfile(input, user.role));
	const show = (field: keyof ProfileInput) => (submitted ? errors[field] : '');

	function samePhoneForPromptPay() {
		promptPay = phone;
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		submitted = true;
		serverError = '';
		if (Object.keys(errors).length || saving) {
			// Take the student straight to the first field that needs attention
			requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
			return;
		}
		saving = true;
		try {
			await auth.completeProfile(input);
			onsaved();
		} catch (err) {
			serverError = err instanceof AuthError ? err.message : 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง';
		} finally {
			saving = false;
		}
	}

	const field = 'w-full rounded-xl bg-slate-100 px-3.5 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2';
	const ring = (bad: string | undefined) => (bad ? 'ring-2 ring-red-300' : 'focus:ring-brand');
</script>

<form class="flex flex-1 flex-col" onsubmit={submit} novalidate>
	<div class="flex-1 space-y-4 px-4 pt-4 pb-6">
		<!-- The Google account this profile belongs to -->
		<section class="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4">
			<Avatar name={user.fullName} tone="soft" />
			<div class="min-w-0">
				<p class="truncate text-sm font-semibold text-slate-900">{user.fullName}</p>
				<p class="truncate text-xs text-slate-500">{user.email}</p>
			</div>
			<span class="ml-auto flex shrink-0 items-center gap-1 text-xs font-medium text-fresh-700">
				<Icon name="shield" class="h-3.5 w-3.5" />
				{isStudent ? 'บัญชี มจธ.' : 'ร้าน Partner'}
			</span>
		</section>

		<!-- About you -->
		<section class="space-y-4 rounded-2xl border border-slate-100 bg-white p-4">
			<h2 class="text-sm font-semibold text-slate-900">เกี่ยวกับคุณ</h2>
			<label class="block">
				<span class="mb-1 block text-sm text-slate-700">ชื่อเล่น <span class="text-slate-400">(คนหิ้วจะเห็นชื่อนี้)</span></span>
				<input type="text" bind:value={nickname} maxlength="30" autocomplete="nickname" aria-invalid={!!show('nickname')} class="{field} {ring(show('nickname'))}" />
				{#if show('nickname')}<span class="mt-1 block text-xs text-red-600">{show('nickname')}</span>{/if}
			</label>

			{#if isStudent}
				<fieldset>
					<legend class="mb-1.5 text-sm text-slate-700">ชั้นปี</legend>
					<div class="flex flex-wrap gap-2" role="radiogroup" aria-invalid={!!show('studyLevel')}>
						{#each STUDY_LEVELS as level (level.id)}
							<label class="cursor-pointer rounded-full border px-3.5 py-1.5 text-sm transition-colors {studyLevel === level.id ? 'border-brand bg-brand-50 font-medium text-brand-700' : 'border-slate-200 text-slate-600'}">
								<input type="radio" name="level" value={level.id} bind:group={studyLevel} class="sr-only" />
								{level.label}
							</label>
						{/each}
					</div>
					{#if show('studyLevel')}<span class="mt-1 block text-xs text-red-600">{show('studyLevel')}</span>{/if}
				</fieldset>

				{#if isStaff}
					<label class="block">
						<span class="mb-1 block text-sm text-slate-700">หน่วยงาน</span>
						<input type="text" bind:value={facultyOther} maxlength="80" placeholder="เช่น สำนักงานอธิการบดี" aria-invalid={!!show('faculty')} class="{field} {ring(show('faculty'))}" />
						{#if show('faculty')}<span class="mt-1 block text-xs text-red-600">{show('faculty')}</span>{/if}
					</label>
				{:else}
					<label class="block">
						<span class="mb-1 block text-sm text-slate-700">คณะ</span>
						<span class="relative block">
							<select bind:value={facultyChoice} aria-invalid={!!show('faculty')} class="{field} appearance-none pr-10 {ring(show('faculty'))}">
								<option value="" disabled>เลือกคณะ</option>
								{#each FACULTIES as f (f)}<option value={f}>{f}</option>{/each}
								<option value={OTHER}>อื่นๆ (พิมพ์เอง)</option>
							</select>
							<Icon name="chevron-down" class="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
						</span>
						{#if facultyChoice === OTHER}
							<input type="text" bind:value={facultyOther} maxlength="80" placeholder="ชื่อคณะ / หน่วยงาน" aria-label="ชื่อคณะ" class="mt-2 {field} focus:ring-brand" />
						{/if}
						{#if show('faculty')}<span class="mt-1 block text-xs text-red-600">{show('faculty')}</span>{/if}
					</label>

					<label class="block">
						<span class="mb-1 block text-sm text-slate-700">รหัสนักศึกษา <span class="text-slate-400">(ไม่แสดงให้ผู้ใช้อื่น)</span></span>
						<input type="text" inputmode="numeric" autocomplete="off" bind:value={studentId} maxlength="13" placeholder="เช่น 66070500123" aria-invalid={!!show('studentId')} class="{field} tabular-nums {ring(show('studentId'))}" />
						{#if show('studentId')}<span class="mt-1 block text-xs text-red-600">{show('studentId')}</span>{/if}
					</label>
				{/if}
			{/if}
		</section>

		<!-- Contact & payment -->
		<section class="space-y-4 rounded-2xl border border-slate-100 bg-white p-4">
			<h2 class="text-sm font-semibold text-slate-900">ติดต่อและรับเงิน</h2>
			<label class="block">
				<span class="mb-1 block text-sm text-slate-700">เบอร์มือถือ <span class="text-slate-400">(ให้คนหิ้วโทรหาตอนส่งของ)</span></span>
				<input
					type="tel"
					inputmode="tel"
					autocomplete="tel-national"
					value={phone}
					oninput={(e) => (phone = formatPhone(e.currentTarget.value))}
					placeholder="08x-xxx-xxxx"
					aria-invalid={!!show('phone')}
					class="{field} tabular-nums {ring(show('phone'))}"
				/>
				{#if show('phone')}<span class="mt-1 block text-xs text-red-600">{show('phone')}</span>{/if}
			</label>
			<label class="block">
				<span class="mb-1 flex items-baseline justify-between text-sm text-slate-700">
					<span>PromptPay <span class="text-slate-400">(ไม่บังคับ)</span></span>
					{#if phone && digitsOnly(phone) !== digitsOnly(promptPay)}
						<button type="button" onclick={samePhoneForPromptPay} class="text-xs font-medium text-brand">ใช้เบอร์เดียวกัน</button>
					{/if}
				</span>
				<input type="text" inputmode="numeric" autocomplete="off" bind:value={promptPay} maxlength="17" placeholder="เบอร์มือถือ หรือเลขบัตรประชาชน" aria-invalid={!!show('promptPay')} class="{field} tabular-nums {ring(show('promptPay'))}" />
				<span class="mt-1 block text-xs {show('promptPay') ? 'text-red-600' : 'text-slate-500'}">{show('promptPay') || 'ใช้รับเงินเมื่อคุณเป็นคนหิ้วให้เพื่อน'}</span>
			</label>
		</section>

		{#if mustConsent}
			<section class="rounded-2xl border bg-white p-4 {show('consent') ? 'border-red-300' : 'border-slate-100'}">
				<label class="flex cursor-pointer items-start gap-3">
					<input type="checkbox" bind:checked={consent} aria-invalid={!!show('consent')} class="mt-0.5 h-5 w-5 shrink-0 accent-brand" />
					<span class="text-sm text-slate-700">
						ฉันยอมรับ
						<button type="button" onclick={() => (legal = 'terms')} class="font-medium text-brand underline underline-offset-2">เงื่อนไขการใช้งาน</button>
						และยินยอมให้เก็บและใช้ข้อมูลตาม
						<button type="button" onclick={() => (legal = 'privacy')} class="font-medium text-brand underline underline-offset-2">นโยบายความเป็นส่วนตัว</button>
					</span>
				</label>
				{#if show('consent')}<span class="mt-2 block text-xs text-red-600">{show('consent')}</span>{/if}
			</section>
		{/if}

		{#if serverError}
			<p class="flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert"><Icon name="alert" class="h-5 w-5" />{serverError}</p>
		{/if}
	</div>

	<BottomBar>
		<button type="submit" disabled={saving} class="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-4 text-sm font-semibold text-white active:bg-brand-600 disabled:opacity-80">
			{#if saving}<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span> กำลังบันทึก...{:else}{submitLabel ?? (mode === 'onboarding' ? 'เริ่มใช้งาน Goose Man' : 'บันทึกข้อมูล')}{/if}
		</button>
	</BottomBar>
</form>

<LegalSheet page={legal} onclose={() => (legal = null)} />
