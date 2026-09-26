<script lang="ts">
	import head1 from '$lib/assets/goose-head-1.webp';
	import GoogleIcon from '$lib/components/GoogleIcon.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { isLive } from '$lib/supabase';
	import { consoleState as c } from '../console.svelte';
</script>

<main class="grid min-h-dvh bg-white lg:grid-cols-[1.1fr_1fr]">
	<section class="flex flex-col justify-center bg-brand-50 px-6 pt-[calc(3rem+env(safe-area-inset-top))] pb-10 sm:px-12 lg:px-16">
		<img src={head1} alt="" width="480" height="480" class="h-28 w-28 lg:h-40 lg:w-40" />
		<p class="mt-6 text-lg font-bold text-brand-700">Goose Man · ห่านบางมด</p>
		<h1 class="mt-1 text-3xl leading-tight font-bold tracking-tight text-slate-900 lg:text-5xl">ศูนย์ควบคุมทีมงาน</h1>
		<p class="mt-3 max-w-md text-base text-slate-600 lg:text-lg">ดูออเดอร์ แก้ปัญหา และจัดการร้านกับคนหิ้ว ในที่เดียว</p>
	</section>

	<section class="flex flex-col justify-center px-6 py-10 pb-[calc(2.5rem+env(safe-area-inset-bottom))] sm:px-12">
		<div class="mx-auto w-full max-w-sm">
			<h2 class="text-2xl font-bold text-slate-900">เข้าสู่ระบบทีมงาน</h2>
			<p class="mt-1 text-sm text-slate-500">ใช้บัญชี Google ของ มจธ. แบบเดียวกับแอปสั่งอาหาร</p>

			{#if c.signInError}
				<p class="mt-5 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert"><Icon name="alert" class="mt-0.5 h-4 w-4" />{c.signInError}</p>
			{/if}

			<button
				type="button"
				onclick={() => c.signIn()}
				disabled={c.signingIn}
				class="mt-6 flex h-13 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white text-[15px] font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-70"
			>
				{#if c.signingIn}
					<span class="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand"></span> กำลังเปิด Google...
				{:else}
					<GoogleIcon /> เข้าสู่ระบบด้วย Google
				{/if}
			</button>
			<p class="mt-3 flex items-center gap-1.5 text-xs text-slate-500"><Icon name="lock" class="h-3.5 w-3.5" />เฉพาะอีเมลที่อยู่ในรายชื่อทีมงาน Goose Man</p>
			{#if !isLive}
				<p class="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">โหมดทดลอง: ยังไม่ได้ต่อฐานข้อมูล กดปุ่มแล้วจะเข้าเป็นแอดมินทดลองพร้อมข้อมูลตัวอย่าง</p>
			{/if}
			<a href="https://goose-man.tech" class="mt-8 inline-flex items-center gap-1 text-sm font-medium text-brand">ไปหน้าสั่งอาหาร goose-man.tech <Icon name="arrow-right" class="h-4 w-4" /></a>
		</div>
	</section>
</main>
