<script lang="ts">
	import './layout.css';
	let { children } = $props();
</script>

<svelte:head>
	<title>Goose Man (ห่านบางมด) | KMUTT Campus P2P Delivery</title>
	<meta name="description" content="แพลตฟอร์มฝากหิ้วอาหารข้ามฝั่ง มจธ. บางมด — ขี้เกียจเดินฝ่าแดด? ให้ห่านบางมดหิ้วให้!" />
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no" />
	<meta name="theme-color" content="#FA4616" />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700;800;900&family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
</svelte:head>

<div class="font-['Prompt','Inter',sans-serif] selection:bg-[#FA4616] selection:text-white">
	{@render children()}
</div>
