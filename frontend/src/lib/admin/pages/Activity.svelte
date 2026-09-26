<script lang="ts">
	import { adminError } from '../api';
	import { consoleState as c } from '../console.svelte';
	import { dateTime } from '../format';
	import { ACTION_LABEL, describeDetail } from '../labels';
	import type { LogEntry } from '../types';
	import Empty from '../ui/Empty.svelte';

	let log = $state<LogEntry[] | null>(null);
	let error = $state('');
	let who = $state('');
	let action = $state('');

	$effect(() => {
		void c.tick;
		c.api
			?.activity(300)
			.then((l) => {
				log = l;
				error = '';
			})
			.catch((err) => (error = adminError(err)));
	});

	const people = $derived([...new Set((log ?? []).map((l) => l.by))].filter(Boolean));
	const actions = $derived([...new Set((log ?? []).map((l) => l.action))]);
	const shown = $derived((log ?? []).filter((l) => (!who || l.by === who) && (!action || l.action === action)));
	const select = 'h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-brand';
</script>

<div class="space-y-4">
	<div class="flex flex-wrap gap-2">
		<select bind:value={who} aria-label="ทีมงาน" class={select}><option value="">ทุกคน</option>{#each people as p (p)}<option value={p}>{p}</option>{/each}</select>
		<select bind:value={action} aria-label="การกระทำ" class={select}><option value="">ทุกการกระทำ</option>{#each actions as a (a)}<option value={a}>{ACTION_LABEL[a] ?? a}</option>{/each}</select>
	</div>
	<div class="rounded-2xl border border-slate-100 bg-white">
		{#if error && !log}
			<Empty title="โหลดบันทึกไม่สำเร็จ" body={error} />
		{:else if !log}
			<div class="space-y-2 p-4">{#each Array(6) as _, i (i)}<div class="h-10 animate-pulse rounded-lg bg-slate-100"></div>{/each}</div>
		{:else if shown.length === 0}
			<Empty title="ยังไม่มีบันทึก" body="ทุกปุ่มที่ทีมงานกดในหน้านี้จะถูกบันทึกไว้ที่นี่" goose={false} />
		{:else}
			<table class="hidden w-full text-left text-sm md:table">
				<thead class="text-xs text-slate-500"><tr class="border-b border-slate-100"><th class="py-3 pl-5 font-medium">เวลา</th><th class="py-3 font-medium">ทีมงาน</th><th class="py-3 font-medium">การกระทำ</th><th class="py-3 font-medium">เป้าหมาย</th><th class="py-3 pr-5 font-medium">รายละเอียด</th></tr></thead>
				<tbody>
					{#each shown as l (l.id)}
						<tr class="border-b border-slate-50 last:border-0">
							<td class="py-3 pl-5 whitespace-nowrap tabular-nums">{dateTime(l.at)}</td>
							<td class="py-3 font-medium">{l.by}</td>
							<td class="py-3">{ACTION_LABEL[l.action] ?? l.action}</td>
							<td class="max-w-56 truncate py-3">{#if l.target_type === 'order'}<a href="#/orders/{l.target_id}" class="font-medium text-brand">{l.target}</a>{:else}{l.target}{/if}</td>
							<td class="max-w-72 truncate py-3 pr-5 text-slate-600">{describeDetail(l.detail) || '—'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<ol class="divide-y divide-slate-100 md:hidden">
				{#each shown as l (l.id)}
					<li class="px-4 py-3 text-sm">
						<p><span class="font-medium">{l.by}</span> {ACTION_LABEL[l.action] ?? l.action} · {#if l.target_type === 'order'}<a href="#/orders/{l.target_id}" class="text-brand">{l.target}</a>{:else}{l.target}{/if}</p>
						<p class="text-xs text-slate-500">{dateTime(l.at)}{describeDetail(l.detail) ? ` · ${describeDetail(l.detail)}` : ''}</p>
					</li>
				{/each}
			</ol>
		{/if}
	</div>
</div>
