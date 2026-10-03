<script lang="ts">
	// Sign-in for the test site's own test accounts (lib/sim.ts). Only rendered on a test site.
	// The password is not in the code: whoever runs the test site hands it to the team.
	import Icon from '$lib/components/Icon.svelte';
	import { TEST_ACCOUNTS } from '$lib/sim';

	let {
		area,
		busy = false,
		error = '',
		onsubmit
	}: { area: 'app' | 'console'; busy?: boolean; error?: string; onsubmit: (email: string, password: string) => void | Promise<void> } = $props();

	const accounts = $derived(TEST_ACCOUNTS.filter((a) => a.area === area));
	let email = $state('');
	let password = $state('');

	function submit(e: SubmitEvent) {
		e.preventDefault();
		if (email.trim() && password) void onsubmit(email, password);
	}
</script>

<form onsubmit={submit} class="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-left" aria-label="เข้าสู่ระบบด้วยบัญชีทดสอบ">
	<h2 class="text-sm font-bold text-amber-950">เข้าสู่ระบบด้วยบัญชีทดสอบ</h2>
	<p class="mt-1 text-xs text-amber-900">เว็บนี้ใช้ฐานข้อมูลทดสอบแยกจากเว็บจริง เลือกบทบาทแล้วใส่รหัสผ่านที่ผู้ดูแลเว็บทดสอบให้</p>

	<div class="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="เลือกบัญชีทดสอบ">
		{#each accounts as a (a.email)}
			<button
				type="button"
				aria-pressed={email === a.email}
				onclick={() => (email = a.email)}
				class="min-h-9 rounded-full border px-3 text-xs font-semibold {email === a.email ? 'border-amber-900 bg-amber-900 text-white' : 'border-amber-300 bg-white text-amber-950'}"
			>{a.label}</button>
		{/each}
	</div>

	<label class="mt-3 block">
		<span class="mb-1 block text-xs font-medium text-amber-950">อีเมล</span>
		<input bind:value={email} type="email" autocomplete="username" required class="h-11 w-full rounded-xl bg-white px-3 text-sm outline-none ring-1 ring-amber-300 focus:ring-2 focus:ring-amber-700" />
	</label>
	<label class="mt-2 block">
		<span class="mb-1 block text-xs font-medium text-amber-950">รหัสผ่าน</span>
		<input bind:value={password} type="password" autocomplete="current-password" required class="h-11 w-full rounded-xl bg-white px-3 text-sm outline-none ring-1 ring-amber-300 focus:ring-2 focus:ring-amber-700" />
	</label>

	{#if error}<p class="mt-2 flex items-start gap-1.5 text-xs text-red-700" role="alert"><Icon name="alert" class="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}</p>{/if}

	<button type="submit" disabled={busy || !email.trim() || !password} class="mt-3 flex min-h-11 w-full items-center justify-center rounded-xl bg-amber-900 text-sm font-semibold text-white disabled:opacity-60">
		{#if busy}กำลังเข้าสู่ระบบ...{:else}เข้าสู่ระบบ{/if}
	</button>
</form>
