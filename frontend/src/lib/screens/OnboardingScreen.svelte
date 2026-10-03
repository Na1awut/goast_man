<script lang="ts">
	import { t } from '$lib/i18n';
	import AppBar from '$lib/components/AppBar.svelte';
	import Goose from '$lib/components/Goose.svelte';
	import ProfileForm from '$lib/components/ProfileForm.svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import { cart } from '$lib/stores/cart.svelte';
	import { nav } from '$lib/stores/nav.svelte';
	import { orders } from '$lib/stores/orders.svelte';
	import { profileGate } from '$lib/stores/profileGate.svelte';
	import { rider } from '$lib/stores/rider.svelte';
	import { toast } from '$lib/stores/toast.svelte';

	const returning = !!auth.user?.consentedAt;
	/** Opened on the way to the first order (profileGate), not straight after sign-in */
	const gated = nav.history.length > 0;

	const title = returning ? t('เงื่อนไขมีการอัปเดต') : gated ? t('ก่อนสั่งครั้งแรก') : t('ยินดีต้อนรับสู่ Goose Man');
	const subtitle = returning
		? t('อ่านและยอมรับอีกครั้งเพื่อใช้งานต่อ')
		: gated
			? t('กรอกครั้งเดียว ข้อมูลจะผูกกับบัญชีนี้ ครั้งต่อไปไม่ต้องกรอกอีก')
			: auth.isPartner
				? t('กรอกข้อมูลติดต่อของร้านอีกนิดก่อนเริ่ม')
				: t('กรอกข้อมูลอีกนิด แล้วเริ่มฝากหิ้วได้เลย');

	function done() {
		if (gated) {
			toast.show(t('บันทึกแล้ว ตรวจรายการแล้วกดสั่งได้เลย'), 'success');
			profileGate.done();
			return;
		}
		toast.show(returning ? t('บันทึกแล้ว ขอบคุณที่อ่านเงื่อนไขฉบับใหม่') : t('ยินดีต้อนรับ {displayName}', { displayName: auth.displayName }), 'success');
		nav.reset(auth.isPartner ? 'PARTNER' : 'HOME');
	}

	/** Signed in with the wrong Google account */
	async function switchAccount() {
		orders.reset();
		rider.reset();
		cart.clear();
		await auth.logout();
		nav.reset('LOGIN');
	}
</script>

<div class="flex flex-1 flex-col">
	{#if gated}
		<AppBar title={t('ข้อมูลผู้สั่ง')} />
	{/if}
	<header class="border-b border-slate-100 bg-white px-4 pb-5 {gated ? 'pt-4' : 'pt-[calc(1.5rem+env(safe-area-inset-top))]'}">
		<div class="flex items-end gap-4">
			<Goose pose="hop" class="w-20 shrink-0" />
			<div class="min-w-0 pb-1">
				<h1 class="text-xl font-bold text-slate-900">{title}</h1>
				<p class="text-sm text-slate-500">{subtitle}</p>
			</div>
		</div>
		<p class="mt-3 text-xs text-slate-500">
			{t('ไม่ใช่บัญชีนี้?')}
			<button type="button" onclick={switchAccount} class="font-medium text-brand underline underline-offset-2">{t('ออกจากระบบแล้วเลือกบัญชีอื่น')}</button>
		</p>
	</header>

	<ProfileForm mode="onboarding" onsaved={done} submitLabel={gated ? t('บันทึกแล้วไปต่อ') : undefined} />
</div>
