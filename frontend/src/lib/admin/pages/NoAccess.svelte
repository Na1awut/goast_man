<script lang="ts">
	import head2 from '$lib/assets/goose-head-2.webp';
	import { consoleState as c } from '../console.svelte';
</script>

<main class="flex min-h-dvh flex-col items-center justify-center bg-white px-6 text-center">
	<img src={head2} alt="" width="480" height="480" class="h-32 w-32" />
	<h1 class="mt-5 text-2xl font-bold text-slate-900">บัญชีนี้ยังไม่ได้อยู่ในทีมงาน</h1>
	<p class="mt-3 rounded-xl bg-slate-100 px-4 py-2 text-sm text-slate-700">{c.outsiderEmail || 'บัญชีที่เข้าสู่ระบบอยู่'}</p>
	<p class="mt-3 max-w-sm text-sm text-slate-500">ถ้าคุณเป็นทีมงาน ให้ ADMIN เพิ่มอีเมลนี้ในหน้า "ทีมงาน" แล้วเข้าสู่ระบบใหม่อีกครั้ง</p>
	<button type="button" onclick={() => c.signOut()} class="mt-6 h-12 rounded-xl bg-brand px-6 text-sm font-semibold text-white hover:bg-brand-600">ออกจากระบบแล้วใช้บัญชีอื่น</button>
	<a href="https://goose-man.tech" class="mt-4 text-sm font-medium text-brand">ไปหน้าสั่งอาหาร</a>
</main>
