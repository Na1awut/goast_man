<script lang="ts">
	// A strip across the top of every page of the test site, so nobody takes it for the real one.
	import { base } from '$app/paths';

	function reset() {
		try {
			localStorage.clear();
			sessionStorage.clear();
		} catch {
			// Storage blocked: nothing to clear
		}
		location.href = `${base}/`;
	}
</script>

<div class="flex flex-wrap items-center justify-center gap-x-4 gap-y-0.5 bg-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-950" role="note">
	<span>เว็บทดสอบ · ข้อมูลจำลอง ไม่เกี่ยวข้องกับเว็บจริง</span>
	<span class="flex items-center gap-1">
		<a href="{base}/" data-sveltekit-reload class="flex min-h-8 items-center px-1.5 underline underline-offset-2">เปลี่ยนบทบาท</a>
		<button type="button" onclick={reset} class="min-h-8 px-1.5 underline underline-offset-2">ล้างข้อมูลทดสอบ</button>
	</span>
</div>
