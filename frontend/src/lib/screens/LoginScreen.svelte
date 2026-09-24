<script lang="ts">
	import banner from '$lib/assets/banner.webp';
	import GoogleIcon from '$lib/components/GoogleIcon.svelte';
	import LegalSheet from '$lib/components/LegalSheet.svelte';
	import type { LegalPage } from '$lib/data/legal';
	import GooseMark from '$lib/components/GooseMark.svelte';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import { auth, AuthError } from '$lib/stores/auth.svelte';
	import { nav } from '$lib/stores/nav.svelte';
	import { orders } from '$lib/stores/orders.svelte';
	import { toast } from '$lib/stores/toast.svelte';

	let loading = $state<'student' | 'partner' | null>(null);
	/** Shown on the page, not only as a toast: this is the one thing a rejected student needs to read */
	let error = $state(auth.signInError);
	let legal = $state<LegalPage | null>(null);

	async function signIn(asPartner = false) {
		if (loading) return;
		loading = asPartner ? 'partner' : 'student';
		error = '';
		try {
			const user = await auth.signInWithGoogle({ asPartner });
			nav.reset(auth.needsProfile ? 'ONBOARDING' : auth.isPartner ? 'PARTNER' : 'HOME');
			void orders.init(user.id);
			if (!auth.needsProfile) toast.show(`เข้าสู่ระบบแล้ว สวัสดี ${user.nickname}`, 'success');
		} catch (err) {
			error = err instanceof AuthError ? err.message : 'เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง';
		} finally {
			loading = null;
		}
	}

	const points: { icon: IconName; title: string; body: string }[] = [
		{ icon: 'walk', title: 'เพื่อนในมอหิ้วให้', body: 'ส่งถึงหน้าตึกเรียนหรือหอพัก' },
		{ icon: 'key', title: 'รับของด้วยรหัส OTP', body: 'บอกรหัสให้เพื่อนเมื่อได้ของครบเท่านั้น' },
		{ icon: 'cash', title: 'ค่าหิ้วเริ่มต้น 15 บาท', body: 'จ่ายผ่าน PromptPay หรือเงินสด' }
	];
</script>

<main class="flex min-h-dvh flex-col bg-white">
	<img src={banner} alt="Goose Rider เพื่อนแท้เรื่องส่งของ ก้าวเดียวถึงมือคุณ" width="1200" height="444" class="block aspect-[2658/984] w-full bg-brand object-cover pt-[env(safe-area-inset-top)]" />

	<section class="flex flex-1 flex-col px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
		<GooseMark class="-mt-10 h-20 w-20 rounded-2xl border border-slate-100 shadow-sm" large />
		<h1 class="mt-3 text-2xl font-bold text-slate-900">Goose Man</h1>
		<p class="text-sm text-slate-500">ห่านบางมด · ฝากหิ้วในรั้ว มจธ.</p>
		<p class="mt-5 mb-6 text-lg leading-snug font-semibold text-slate-900">ขี้เกียจเดินฝ่าแดด? ให้ห่านบางมดหิ้วให้</p>
		<ul class="space-y-5">
			{#each points as p (p.title)}
				<li class="flex gap-4">
					<span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand"><Icon name={p.icon} /></span>
					<div>
						<p class="text-sm font-semibold text-slate-900">{p.title}</p>
						<p class="text-sm text-slate-500">{p.body}</p>
					</div>
				</li>
			{/each}
		</ul>

		<div class="mt-auto space-y-3 pt-10">
			{#if error}
				<p class="flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">
					<Icon name="alert" class="h-5 w-5 shrink-0" />
					<span>{error}</span>
				</p>
			{/if}
			<button
				type="button"
				onclick={() => signIn()}
				disabled={loading !== null}
				class="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white py-3.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50 active:bg-slate-100 disabled:opacity-70"
			>
				{#if loading === 'student'}
					<span class="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand"></span>
					กำลังยืนยันบัญชี...
				{:else}
					<GoogleIcon />
					Sign in with Google (@kmutt.ac.th)
				{/if}
			</button>
			<p class="flex items-center justify-center gap-1.5 text-xs text-slate-500">
				<Icon name="lock" class="h-3.5 w-3.5" />
				ใช้ได้เฉพาะอีเมล @kmutt.ac.th และ @mail.kmutt.ac.th
			</p>
			<button type="button" onclick={() => signIn(true)} disabled={loading !== null} class="flex w-full items-center justify-center gap-1.5 pt-2 text-sm font-medium text-brand disabled:opacity-60">
				{#if loading === 'partner'}
					<span class="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand"></span> กำลังเข้าสู่ระบบร้านค้า...
				{:else}
					<Icon name="store" class="h-4 w-4" /> สำหรับร้านค้า Partner เข้าสู่ระบบที่นี่
				{/if}
			</button>
			<p class="pt-2 text-center text-[11px] text-slate-400">
				<button type="button" onclick={() => (legal = 'terms')} class="underline underline-offset-2">เงื่อนไขการใช้งาน</button>
				·
				<button type="button" onclick={() => (legal = 'privacy')} class="underline underline-offset-2">นโยบายความเป็นส่วนตัว</button>
			</p>
		</div>
	</section>
</main>

<LegalSheet page={legal} onclose={() => (legal = null)} />
