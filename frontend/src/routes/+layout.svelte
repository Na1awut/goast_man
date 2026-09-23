<script lang="ts">
	import './layout.css';
	let { children } = $props();
</script>

<svelte:head>
	<title>Goose Man (ห่านบางมด) | KMUTT Campus P2P Delivery</title>
	<meta name="description" content="แพลตฟอร์มฝากหิ้วอาหารในรั้ว มจธ. บางมด — ขี้เกียจเดินฝ่าแดด? ให้ห่านบางมดหิ้วให้!" />
</svelte:head>

{@render children()}
