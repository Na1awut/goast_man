<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import SmartImage from '$lib/components/SmartImage.svelte';
	import MenuItemSheet from './MenuItemSheet.svelte';
	import type { MenuItem, Store } from '$lib/types';
	import { catalog } from '$lib/stores/catalog.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { friendlyError } from '$lib/supabase';
	import { formatBaht } from '$lib/utils';

	let { store }: { store: Store } = $props();

	let query = $state('');
	let busyId = $state<string | null>(null);
	/** Dish being edited; null = adding one; undefined = sheet closed */
	let editing = $state<MenuItem | null | undefined>(undefined);

	const soldOut = $derived(store.menuItems.filter((m) => !m.isAvailable).length);
	const groups = $derived.by(() => {
		const q = query.trim().toLowerCase();
		const map = new Map<string, MenuItem[]>();
		for (const m of store.menuItems) {
			if (q && !m.name.toLowerCase().includes(q)) continue;
			map.set(m.category, [...(map.get(m.category) ?? []), m]);
		}
		return [...map.entries()];
	});

	async function toggle(m: MenuItem) {
		if (busyId) return;
		busyId = m.id;
		const next = !m.isAvailable;
		try {
			await catalog.setItemAvailable(store.id, m.id, next);
			toast.show(next ? `${m.name} กลับมาขายแล้ว` : `${m.name} ขึ้นว่าหมดแล้ว`, next ? 'success' : 'info');
		} catch (err) {
			toast.show(friendlyError(err), 'error');
		} finally {
			busyId = null;
		}
	}
</script>

<div class="space-y-4">
	<div class="flex items-center gap-2">
		<label class="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl bg-white px-3.5 text-slate-500 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-brand">
			<Icon name="search" class="h-[18px] w-[18px] shrink-0" />
			<input bind:value={query} type="search" placeholder="ค้นหาเมนู" class="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none" />
		</label>
		<button type="button" onclick={() => (editing = null)} class="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-brand px-3.5 text-sm font-semibold text-white"><Icon name="plus" class="h-4 w-4" />เพิ่มเมนู</button>
	</div>
	<p class="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
		<span class="rounded-full px-2 py-0.5 font-medium {soldOut ? 'bg-red-50 text-red-700' : 'bg-fresh-50 text-fresh-700'}">{soldOut ? `หมด ${soldOut} เมนู` : 'มีขายครบ'}</span>
		แตะเมนูเพื่อแก้ชื่อ ราคา รูป · สวิตช์ = มีขาย/หมด นักศึกษาเห็นทันที
	</p>

	{#each groups as [category, items] (category)}
		<section class="rounded-2xl border border-slate-100 bg-white" aria-label={category}>
			<h2 class="px-4 pt-3 text-sm font-semibold text-slate-900">{category}</h2>
			<ul class="divide-y divide-slate-100">
				{#each items as m (m.id)}
					<li class="flex items-center gap-3 px-4 py-2.5">
						<button type="button" onclick={() => (editing = m)} aria-label="แก้ไข {m.name}" class="flex min-w-0 flex-1 items-center gap-3 text-left">
							<span class="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-slate-100">
								{#if m.imageUrl}<SmartImage src={m.imageUrl} alt="" class="h-11 w-11" />{:else}<span class="flex h-full w-full items-center justify-center text-slate-300"><Icon name="camera" class="h-4 w-4" /></span>{/if}
							</span>
							<span class="min-w-0 flex-1">
								<span class="block truncate text-sm {m.isAvailable ? 'text-slate-900' : 'text-slate-400 line-through'}">{m.name}</span>
								<span class="block text-xs text-slate-500 tabular-nums">{formatBaht(m.price)}{m.specialPrice ? ` · พิเศษ ${formatBaht(m.specialPrice)}` : ''}</span>
							</span>
						</button>
						<span class="w-10 shrink-0 text-right text-xs {m.isAvailable ? 'text-fresh-700' : 'font-medium text-red-600'}">{m.isAvailable ? 'มีขาย' : 'หมด'}</span>
						<button
							type="button"
							role="switch"
							aria-checked={m.isAvailable}
							aria-label="{m.name} มีขาย"
							disabled={busyId === m.id}
							onclick={() => toggle(m)}
							class="relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 {m.isAvailable ? 'bg-fresh-700' : 'bg-slate-200'}"
						>
							<span class="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all {m.isAvailable ? 'left-6' : 'left-1'}"></span>
						</button>
					</li>
				{/each}
			</ul>
		</section>
	{:else}
		<p class="py-6 text-center text-sm text-slate-500">ไม่พบเมนู</p>
	{/each}
</div>

<MenuItemSheet {store} item={editing} onclose={() => (editing = undefined)} />
