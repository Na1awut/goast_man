<script lang="ts">
	import banner from '$lib/assets/banner.webp';
	import GoogleIcon from '$lib/components/GoogleIcon.svelte';
	import GooseMark from '$lib/components/GooseMark.svelte';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import { auth, AuthError } from '$lib/stores/auth.svelte';
	import { nav } from '$lib/stores/nav.svelte';
	import { orders } from '$lib/stores/orders.svelte';
	import { toast } from '$lib/stores/toast.svelte';

	let loading = $state(false);

	async function signIn() {
		if (loading) return;
		loading = true;
		try {
			const user = await auth.signInWithGoogle();
			orders.init();
			nav.reset('HOME');
			toast.show(`เข้าสู่ระบบแล้ว สวัสดี ${user.nickname}`, 'success');
		} catch (err) {
			toast.show(err instanceof AuthError ? err.message : 'เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง', 'error', { duration: 5000 });
		} finally {
			loading = false;
		}
	}

	const points: { icon: IconName; title: string; body: string }[] = [
		{ icon: 'walk', title: 'เพื่อนในมอหิ้วให้', body: 'ส่งถึงหน้าตึกเรียนหรือหอพัก' },
		{ icon: 'key', title: 'รับของด้วยรหัส OTP', body: 'เงินปลดล็อกเมื่อได้รับของครบ' },
		{ icon: 'cash', title: 'ค่าหิ้วเริ่มต้น 15 บาท', body: 'จ่ายผ่าน PromptPay หรือเงินสด' }
	];
</script>

<main class="flex min-h-dvh flex-col bg-white">
	<img src={banner} alt="Goose Rider บริการรับส่งสินค้าและอาหารภายใน มจธ. บางมด" width="851" height="315" class="block aspect-[851/315] w-full bg-brand object-cover pt-[env(safe-area-inset-top)]" />

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
			<button
				type="button"
				onclick={signIn}
				disabled={loading}
				class="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white py-3.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50 active:bg-slate-100 disabled:opacity-70"
			>
				{#if loading}
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
		</div>
	</section>
</main>
