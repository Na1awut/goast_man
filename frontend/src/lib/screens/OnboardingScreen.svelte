<script lang="ts">
	import Goose from '$lib/components/Goose.svelte';
	import ProfileForm from '$lib/components/ProfileForm.svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import { cart } from '$lib/stores/cart.svelte';
	import { nav } from '$lib/stores/nav.svelte';
	import { orders } from '$lib/stores/orders.svelte';
	import { toast } from '$lib/stores/toast.svelte';

	const returning = !!auth.user?.consentedAt;

	function done() {
		toast.show(returning ? 'บันทึกแล้ว ขอบคุณที่อ่านเงื่อนไขฉบับใหม่' : `ยินดีต้อนรับ ${auth.user?.nickname ?? ''}`, 'success');
		nav.reset(auth.isPartner ? 'PARTNER' : 'HOME');
	}

	/** Signed in with the wrong Google account */
	async function switchAccount() {
		orders.reset();
		cart.clear();
		await auth.logout();
		nav.reset('LOGIN');
	}
</script>

<div class="flex flex-1 flex-col">
	<header class="border-b border-slate-100 bg-white px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-5">
		<div class="flex items-end gap-4">
			<Goose pose="hop" class="w-20 shrink-0" />
			<div class="min-w-0 pb-1">
				<h1 class="text-xl font-bold text-slate-900">{returning ? 'เงื่อนไขมีการอัปเดต' : 'ยินดีต้อนรับสู่ Goose Man'}</h1>
				<p class="text-sm text-slate-500">
					{returning ? 'อ่านและยอมรับอีกครั้งเพื่อใช้งานต่อ' : auth.isPartner ? 'กรอกข้อมูลติดต่อของร้านอีกนิดก่อนเริ่ม' : 'กรอกข้อมูลอีกนิด แล้วเริ่มฝากหิ้วได้เลย'}
				</p>
			</div>
		</div>
		<p class="mt-3 text-xs text-slate-500">
			ไม่ใช่บัญชีนี้?
			<button type="button" onclick={switchAccount} class="font-medium text-brand underline underline-offset-2">ออกจากระบบแล้วเลือกบัญชีอื่น</button>
		</p>
	</header>

	<ProfileForm mode="onboarding" onsaved={done} />
</div>
