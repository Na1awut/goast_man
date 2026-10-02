<script lang="ts">
	// Frame for the public information pages: brand, a way into the app, and links
	// between the pages (internal links are how search engines find and weigh them).
	import type { Snippet } from 'svelte';
	import logo from '$lib/assets/logo.webp';

	let { title, lead, children }: { title: string; lead: string; children: Snippet } = $props();

	const links = [
		{ href: '/about/', label: 'ใช้งานยังไง' },
		{ href: '/areas/', label: 'จุดส่งและจุดรับใน มจธ.' },
		{ href: '/rider/', label: 'สมัครเป็นคนหิ้ว' },
		{ href: '/partner/', label: 'สำหรับร้านค้า' }
	];
</script>

<div class="min-h-dvh bg-canvas text-slate-900">
	<header class="border-b border-slate-100 bg-white">
		<div class="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
			<a href="/" class="flex min-w-0 items-center gap-2.5">
				<img src={logo} alt="" width="40" height="40" class="h-10 w-10 shrink-0 rounded-xl" />
				<span class="min-w-0">
					<span class="block text-base leading-tight font-bold">Goose Man</span>
					<span class="block truncate text-xs text-slate-500">ห่านบางมด · ฝากหิ้วในรั้ว มจธ.</span>
				</span>
			</a>
			<a href="/" class="flex min-h-11 shrink-0 items-center rounded-full bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-600">เปิดแอป</a>
		</div>
	</header>

	<main class="mx-auto max-w-3xl px-4 py-8 sm:py-12">
		<h1 class="text-2xl leading-snug font-bold text-balance sm:text-3xl">{title}</h1>
		<p class="mt-3 max-w-prose text-base leading-relaxed text-slate-600">{lead}</p>
		<div class="mt-8 space-y-10">{@render children()}</div>
	</main>

	<footer class="border-t border-slate-100 bg-white">
		<nav class="mx-auto flex max-w-3xl flex-wrap gap-x-5 gap-y-1 px-4 pt-5" aria-label="เมนูข้อมูล">
			{#each links as l (l.href)}<a href={l.href} class="min-h-11 py-3 text-sm font-medium text-slate-700 hover:text-brand">{l.label}</a>{/each}
		</nav>
		<p class="mx-auto max-w-3xl px-4 pt-1 pb-8 text-xs leading-relaxed text-slate-500">Goose Man ใช้ได้เฉพาะนักศึกษาและบุคลากร มจธ. ที่เข้าสู่ระบบด้วยอีเมล @kmutt.ac.th หรือ @mail.kmutt.ac.th · ติดต่อทีม: Facebook GooseRider · Instagram gooserider.co</p>
	</footer>
</div>
