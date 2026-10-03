<script lang="ts">
	import { t } from '$lib/i18n';
	import type { Promotion } from '$lib/types';
	import Icon from './Icon.svelte';

	// One-line summary of a promotion's benefit, used on cards and at checkout.
	let { promotion, class: className = '' }: { promotion: Promotion; class?: string } = $props();

	const benefit = $derived(
		[promotion.discount > 0 ? t('ลด {discount} บาท', { discount: promotion.discount }) : '', promotion.freeDelivery ? t('ฟรีค่าหิ้ว') : '']
			.filter(Boolean)
			.join(' + ')
	);
</script>

<span class="flex min-w-0 items-center gap-1 {className}">
	<Icon name={promotion.kind === 'CO_PROMO' ? 'zap' : 'tag'} class="h-3.5 w-3.5 shrink-0" />
	<span class="truncate">{promotion.title}</span>
	<span class="sr-only">({benefit}{promotion.minQty > 1 ? t(' เมื่อสั่ง {minQty} ชิ้น', { minQty: promotion.minQty }) : ''})</span>
</span>
