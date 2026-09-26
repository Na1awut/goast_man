<script lang="ts">
	import goose from '$lib/assets/goose-stand.webp';
	import GoogleIcon from '$lib/components/GoogleIcon.svelte';
	import LegalSheet from '$lib/components/LegalSheet.svelte';
	import type { LegalPage } from '$lib/data/legal';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import { auth, AuthError } from '$lib/stores/auth.svelte';
	import { nav } from '$lib/stores/nav.svelte';
	import { welcome } from '$lib/stores/welcome.svelte';
	import { orders } from '$lib/stores/orders.svelte';

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
			nav.reset(auth.mustOnboardNow ? 'ONBOARDING' : auth.isPartner ? 'PARTNER' : 'HOME');
			void orders.init(user.id);
			welcome.show(auth.displayName);
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

<main class="login-page">
	<div class="login-layout">
		<section class="intro" aria-labelledby="welcome-title">
			<header class="brand-lockup">
				<img src={goose} alt="" width="360" height="280" class="brand-mascot" fetchpriority="high" />
				<div>
					<p class="brand-name">Goose Man</p>
					<p class="brand-description">ห่านบางมด · ฝากหิ้วในรั้ว มจธ.</p>
				</div>
			</header>

			<h1 id="welcome-title">ขี้เกียจเดินฝ่าแดด?<br /><span>ให้ห่านบางมดหิ้วให้</span></h1>
			<ul class="benefits">
				{#each points as p (p.title)}
					<li>
						<span class="benefit-icon"><Icon name={p.icon} /></span>
						<div>
							<p class="benefit-title">{p.title}</p>
							<p class="benefit-description">{p.body}</p>
						</div>
					</li>
				{/each}
			</ul>
		</section>

		<section class="sign-in" aria-labelledby="sign-in-title">
			<div class="sign-in-content">
				<h2 id="sign-in-title">พร้อมฝากหิ้วแล้วหรือยัง?</h2>
				<p class="sign-in-description">เข้าสู่ระบบ แล้วให้เพื่อนในมอหิ้วให้</p>
				<div class="auth-actions">
					{#if error}
						<p id="sign-in-error" class="sign-in-error" role="alert">
							<Icon name="alert" class="h-5 w-5 shrink-0" />
							<span>{error}</span>
						</p>
					{/if}
					<button
						type="button"
						onclick={() => signIn()}
						disabled={loading !== null}
						aria-busy={loading === 'student'}
						aria-describedby={error ? 'account-help sign-in-error' : 'account-help'}
						class="google-button"
					>
						{#if loading === 'student'}
							<span class="spinner" aria-hidden="true"></span>
							กำลังยืนยันบัญชี...
						{:else}
							<GoogleIcon />
							เข้าสู่ระบบด้วย Google
						{/if}
					</button>
					<p id="account-help" class="account-help">
						<Icon name="lock" class="mt-0.5 h-3.5 w-3.5" />
						<span>ใช้ได้เฉพาะอีเมลมหาวิทยาลัย<br /><span class="email-domain">@kmutt.ac.th</span> และ <span class="email-domain">@mail.kmutt.ac.th</span></span>
					</p>
					<p class="sr-only" role="status">{loading === 'student' ? 'กำลังยืนยันบัญชี Google' : loading === 'partner' ? 'กำลังเข้าสู่ระบบร้านค้า' : ''}</p>
				</div>
				<div class="partner-entry">
					<p>สำหรับร้านค้า Partner</p>
					<button type="button" onclick={() => signIn(true)} disabled={loading !== null} aria-busy={loading === 'partner'} aria-describedby={error ? 'sign-in-error' : undefined} class="partner-button">
						{#if loading === 'partner'}
							<span class="spinner" aria-hidden="true"></span> กำลังเข้าสู่ระบบร้านค้า...
						{:else}
							<Icon name="store" class="h-4 w-4" /> เข้าสู่ระบบร้านค้า <Icon name="arrow-right" class="h-4 w-4" />
						{/if}
					</button>
				</div>
			</div>
			<footer class="legal-links">
				<button type="button" onclick={() => (legal = 'terms')}>เงื่อนไขการใช้งาน</button>
				<span aria-hidden="true">·</span>
				<button type="button" onclick={() => (legal = 'privacy')}>นโยบายความเป็นส่วนตัว</button>
			</footer>
		</section>
	</div>
</main>

<LegalSheet page={legal} onclose={() => (legal = null)} />

<style>
	.login-page {
		display: flex;
		min-height: 100dvh;
		flex-direction: column;
		background: white;
	}
	.login-layout {
		display: flex;
		flex: 1;
		flex-direction: column;
		width: 100%;
	}
	.intro {
		--intro-ink: #352b27;
		--intro-muted: #795c4f;
		padding: calc(24px + env(safe-area-inset-top, 0px)) 24px 20px;
		background: var(--color-brand-50);
		color: var(--intro-ink);
	}
	.brand-lockup {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
	}
	.brand-mascot {
		display: block;
		width: 72px;
		height: auto;
		flex-shrink: 0;
	}
	.brand-name {
		font-size: 24px;
		font-weight: 700;
		letter-spacing: -0.025em;
	}
	.brand-description {
		margin-top: 2px;
		font-size: 12px;
		color: var(--intro-muted);
	}
	h1 {
		margin: 20px 0;
		font-size: clamp(24px, 6.4vw, 28px);
		line-height: 1.55;
		font-weight: 600;
		letter-spacing: -0.025em;
		text-align: center;
	}
	h1 span {
		color: var(--color-brand-700);
	}
	.benefits {
		display: grid;
		max-width: 360px;
		margin-inline: auto;
		padding-top: 8px;
		border-top: 1px solid var(--color-brand-100);
	}
	.benefits li {
		display: flex;
		align-items: center;
		gap: 12px;
		padding-block: 8px;
	}
	.benefit-icon {
		display: flex;
		width: 38px;
		height: 38px;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		color: var(--color-brand-700);
	}
	.benefit-title {
		font-size: 14px;
		font-weight: 500;
	}
	.benefit-description {
		margin-top: 2px;
		font-size: 12px;
		line-height: 1.65;
		color: var(--intro-muted);
	}
	.sign-in {
		display: flex;
		flex: 1;
		flex-direction: column;
		padding: 24px 24px calc(12px + env(safe-area-inset-bottom, 0px));
		background: white;
	}
	.sign-in-content {
		width: 100%;
		max-width: 360px;
		margin: 0 auto;
	}
	h2 {
		font-size: 22px;
		font-weight: 600;
		line-height: 1.5;
		letter-spacing: -0.025em;
	}
	.sign-in-description {
		margin-top: 6px;
		font-size: 13px;
		color: var(--color-slate-500);
	}
	.auth-actions {
		margin-top: 20px;
	}
	.sign-in-error {
		display: flex;
		gap: 8px;
		margin-bottom: 16px;
		padding: 12px;
		border-radius: 12px;
		background: var(--color-red-50);
		color: var(--color-red-700);
		font-size: 13px;
		line-height: 1.65;
		overflow-wrap: anywhere;
	}
	button {
		cursor: pointer;
	}
	.google-button {
		display: flex;
		width: 100%;
		min-height: 52px;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 12px 16px;
		border: 1px solid var(--color-slate-300);
		border-radius: 12px;
		background: white;
		font-size: 14px;
		font-weight: 500;
		transition: background-color 160ms, border-color 160ms;
	}
	.google-button:hover:not(:disabled) {
		border-color: var(--color-brand-700);
		background: var(--color-brand-50);
	}
	.google-button:active:not(:disabled) {
		background: var(--color-brand-100);
	}
	button:disabled {
		cursor: wait;
		opacity: 0.65;
	}
	.account-help {
		display: flex;
		align-items: flex-start;
		justify-content: center;
		gap: 7px;
		margin-top: 12px;
		color: var(--color-slate-500);
		text-align: center;
		font-size: 11px;
		line-height: 1.9;
	}
	.email-domain {
		white-space: nowrap;
	}
	.partner-entry {
		margin-top: 24px;
		padding-top: 20px;
		border-top: 1px solid var(--color-slate-100);
		text-align: center;
	}
	.partner-entry > p {
		color: var(--color-slate-500);
		font-size: 12px;
	}
	.partner-button {
		display: flex;
		min-height: 44px;
		margin: 2px auto 0;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 8px 12px;
		border-radius: 8px;
		color: var(--color-brand-700);
		font-size: 13px;
		font-weight: 500;
		transition: background-color 160ms;
	}
	.partner-button:hover:not(:disabled) {
		background: var(--color-brand-50);
	}
	.partner-button:active:not(:disabled) {
		background: var(--color-brand-100);
	}
	.legal-links {
		display: flex;
		justify-content: center;
		align-items: center;
		flex-wrap: wrap;
		gap: 0 8px;
		margin-top: 20px;
		color: var(--color-slate-500);
		font-size: 11px;
	}
	.legal-links button {
		min-height: 44px;
		text-underline-offset: 4px;
	}
	.legal-links button:hover {
		color: var(--color-brand-700);
		text-decoration: underline;
	}
	.spinner {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		border: 2px solid var(--color-brand-100);
		border-top-color: var(--color-brand-700);
		border-radius: 50%;
		animation: spin 800ms linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.spinner {
			animation: none;
		}
		.google-button, .partner-button {
			transition: none;
		}
	}
</style>
