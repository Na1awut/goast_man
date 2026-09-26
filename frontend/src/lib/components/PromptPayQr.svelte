<script lang="ts">
	import QRCode from 'qrcode';
	import Icon from './Icon.svelte';

	// A real, scannable PromptPay QR. Rendered as a PNG so it can also be saved to
	// the photo gallery: most Thai banking apps scan QR codes from saved images.
	let { payload, size = 184, filename = 'gooseman-promptpay.png' }: { payload: string; size?: number; filename?: string } = $props();

	let src = $state('');

	$effect(() => {
		let cancelled = false;
		QRCode.toDataURL(payload, { width: 480, margin: 1, errorCorrectionLevel: 'M' }).then((url) => {
			if (!cancelled) src = url;
		});
		return () => {
			cancelled = true;
		};
	});
</script>

<div class="mx-auto w-fit border border-slate-100 p-2">
	{#if src}
		<img {src} alt="QR Code PromptPay สำหรับสแกนจ่าย" width={size} height={size} class="block" />
	{:else}
		<span class="block animate-pulse rounded bg-slate-100" style="width: {size}px; height: {size}px"></span>
	{/if}
</div>
{#if src}
	<a href={src} download={filename} class="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand underline underline-offset-4">
		<Icon name="download" class="h-4 w-4" /> บันทึกภาพ QR ลงเครื่อง
	</a>
{/if}
