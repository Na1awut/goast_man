<script lang="ts">
	import { t } from '$lib/i18n';
	// "Turn on notifications": asked at the moment it matters (a buyer with an order
	// on its way, a rider who just went online), never as a bare browser popup.
	// The browser's own permission dialog only appears after the user taps the
	// button here, so a "no" is a choice they made, not a reflex.
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import Sheet from '$lib/components/Sheet.svelte';
	import { push } from '$lib/stores/push.svelte';

	const COPY: Record<'buyer' | 'rider', { title: string; lead: string; points: { icon: IconName; text: string }[] }> = {
		buyer: {
			title: t('ให้ห่านเตือนตอนของมาถึง'),
			lead: t('ไม่ต้องเปิดแอปค้างไว้ รู้ทันทีที่คนหิ้วรับงานและตอนกำลังเดินไปส่ง'),
			points: [
				{ icon: 'package', text: t('คนหิ้วรับงาน และกำลังไปส่งถึงหน้าตึก') },
				{ icon: 'message', text: t('ข้อความจากคนหิ้ว') },
				{ icon: 'phone', text: t('สายเรียกเข้าในแอป ดังได้แม้ปิดหน้าจอ') }
			]
		},
		rider: {
			title: t('ไม่พลาดงานใหม่'),
			lead: t('งานเข้าแล้วเด้งทันที ใครกดรับก่อนได้งานนั้น'),
			points: [
				{ icon: 'zap', text: t('งานใหม่เข้ามาในระบบ') },
				{ icon: 'message', text: t('ข้อความจากผู้สั่ง') },
				{ icon: 'phone', text: t('สายเรียกเข้า และเมื่อทีมยกเลิกหรือคืนงาน') }
			]
		}
	};

	const copy = $derived(COPY[push.promptContext]);
	const title = $derived(push.state === 'on' ? t('เปิดแจ้งเตือนแล้ว') : push.state === 'blocked' ? t('การแจ้งเตือนถูกปิดอยู่') : push.state === 'needs-install' ? t('เพิ่มแอปลงหน้าจอโฮมก่อน') : copy.title);

	// Switching on while the sheet is open (e.g. from the profile toggle) closes the loop
	let tested = $state(false);
	async function test() {
		await push.sendTest();
		tested = true;
	}
</script>

<Sheet open={push.promptOpen} title={t('การแจ้งเตือน')} onclose={() => push.closePrompt(true)}>
	<div class="pb-1">
		<div class="flex flex-col items-center text-center">
			<span class="relative flex h-16 w-16 items-center justify-center rounded-full {push.state === 'on' ? 'bg-fresh-50 text-fresh-700' : 'bg-brand-50 text-brand'}">
				<Icon name={push.state === 'on' ? 'check-circle' : 'bell'} class="h-8 w-8" />
				{#if push.state === 'off'}<span class="absolute top-3 right-3.5 h-2.5 w-2.5 rounded-full bg-brand ring-2 ring-brand-50"></span>{/if}
			</span>
			<h3 class="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
		</div>

		{#if push.state === 'on'}
			<p class="mt-2 text-center text-sm text-slate-600">{t('จากนี้ไปจะได้รับแจ้งเตือนแม้ปิดแอปอยู่ ปิดได้ทุกเมื่อที่หน้าโปรไฟล์')}</p>
			<button type="button" onclick={test} class="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-800 active:bg-slate-50">
				<Icon name="bell" class="h-4 w-4 text-brand" />{tested ? t('ส่งอีกครั้ง') : t('ลองส่งข้อความทดสอบ')}
			</button>
			{#if tested}<p class="mt-2 text-center text-xs text-slate-500">{t('ถ้าเห็นข้อความเด้งที่ด้านบนของจอ แปลว่าพร้อมใช้งาน')}</p>{/if}
			{#if push.error}<p class="mt-2 text-center text-xs text-red-600" role="alert">{push.error}</p>{/if}
			<button type="button" onclick={() => push.closePrompt()} class="mt-3 min-h-12 w-full rounded-xl bg-brand text-sm font-semibold text-white active:bg-brand-600">{t('เสร็จสิ้น')}</button>
		{:else if push.state === 'needs-install'}
			<p class="mt-2 text-center text-sm text-slate-600">{t('iPhone ส่งแจ้งเตือนให้เว็บได้เมื่อเปิดจากไอคอนบนหน้าจอโฮมเท่านั้น')}</p>
			<ol class="mt-4 space-y-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-800">
				<li class="flex gap-3"><span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">1</span><span>{t('กดปุ่มแชร์')} <Icon name="share" class="inline h-4 w-4 align-[-3px] text-brand" /> {t('ที่แถบด้านล่างของ Safari')}</span></li>
				<li class="flex gap-3"><span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">2</span><span>{t('เลือก "เพิ่มไปยังหน้าจอโฮม"')}</span></li>
				<li class="flex gap-3"><span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">3</span><span>{t('เปิด Goose Man จากไอคอนใหม่ แล้วกลับมาเปิดการแจ้งเตือนที่หน้าโปรไฟล์')}</span></li>
			</ol>
			<button type="button" onclick={() => push.closePrompt()} class="mt-4 min-h-12 w-full rounded-xl bg-brand text-sm font-semibold text-white active:bg-brand-600">{t('เข้าใจแล้ว')}</button>
		{:else if push.state === 'blocked'}
			<p class="mt-2 text-center text-sm text-slate-600">{t('เบราว์เซอร์ถูกตั้งไว้ไม่ให้ Goose Man แจ้งเตือน เปิดได้ในไม่กี่ขั้นตอน')}</p>
			<ol class="mt-4 space-y-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-800">
				<li class="flex gap-3"><span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">1</span><span>{t('แตะไอคอนกุญแจ')} <Icon name="lock" class="inline h-4 w-4 align-[-3px] text-brand" /> {t('ข้างแถบที่อยู่เว็บ')}</span></li>
				<li class="flex gap-3"><span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">2</span><span>{t('เข้า "การตั้งค่าเว็บไซต์" แล้วเปลี่ยน "การแจ้งเตือน" เป็น อนุญาต')}</span></li>
				<li class="flex gap-3"><span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">3</span><span>{t('กลับมาที่นี่แล้วกดปุ่มด้านล่าง')}</span></li>
			</ol>
			<button type="button" onclick={() => push.refresh()} class="mt-4 min-h-12 w-full rounded-xl bg-brand text-sm font-semibold text-white active:bg-brand-600">{t('เปิดแล้ว ตรวจอีกครั้ง')}</button>
			<button type="button" onclick={() => push.closePrompt()} class="mt-1 min-h-11 w-full text-sm text-slate-500">{t('ปิด')}</button>
		{:else}
			<p class="mt-2 text-center text-sm text-slate-600">{copy.lead}</p>
			<ul class="mt-4 space-y-2.5">
				{#each copy.points as point (point.text)}
					<li class="flex items-center gap-3 text-sm text-slate-800">
						<span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand"><Icon name={point.icon} class="h-4.5 w-4.5" /></span>
						{point.text}
					</li>
				{/each}
			</ul>
			<p class="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
				<Icon name="shield" class="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
				{t('แจ้งเฉพาะเรื่องออเดอร์ของคุณ ไม่มีโฆษณา ปิดได้ทุกเมื่อที่หน้าโปรไฟล์')}
			</p>
			{#if push.error}<p class="mt-3 text-center text-xs text-red-600" role="alert">{push.error}</p>{/if}
			<button
				type="button"
				onclick={() => push.enable()}
				disabled={push.busy}
				aria-busy={push.busy}
				class="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-semibold text-white active:bg-brand-600 disabled:opacity-70"
			>
				{#if push.busy}<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none"></span>{/if}
				{t('เปิดการแจ้งเตือน')}
			</button>
			<button type="button" onclick={() => push.closePrompt(true)} class="mt-1 min-h-11 w-full text-sm text-slate-500">{t('ไว้ทีหลัง')}</button>
			<p class="mt-1 text-center text-[11px] text-slate-400">{t('กดแล้วเบราว์เซอร์จะถามอีกครั้ง เลือก "อนุญาต"')}</p>
		{/if}
	</div>
</Sheet>
