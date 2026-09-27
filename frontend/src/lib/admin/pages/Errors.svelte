<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { adminError } from '../api';
	import { consoleState as c } from '../console.svelte';
	import { ago, count, dateTime, deviceOf } from '../format';
	import type { ClientError, ErrorStatus } from '../types';
	import Empty from '../ui/Empty.svelte';
	import Tabs from '../ui/Tabs.svelte';

	let status = $state<ErrorStatus>('open');
	let rows = $state<ClientError[] | null>(null);
	let error = $state('');
	let openId = $state<number | null>(null);
	let busyId = $state<number | null>(null);

	$effect(() => {
		void c.tick;
		const want = status;
		c.api
			?.errors(want)
			.then((r) => {
				if (want !== status) return;
				rows = r;
				error = '';
			})
			.catch((err) => (error = adminError(err)));
	});

	function switchTab(s: ErrorStatus) {
		if (s === status) return;
		status = s;
		rows = null;
		openId = null;
	}

	const APP = { buyer: { text: 'แอปลูกค้า', cls: 'bg-brand-50 text-brand-700' }, console: { text: 'หน้าทีมงาน', cls: 'bg-slate-100 text-slate-700' } } as const;
	const KIND = { error: 'error', rejection: 'error ใน Promise', svelte: 'ตอนเปิดหน้า' } as const;

	/** Count badge: grey once fixed, red when it keeps happening */
	function countTone(e: ClientError): string {
		if (e.resolved_at) return 'bg-slate-100 text-slate-600';
		return e.count >= 5 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800';
	}

	/** Path and hash only: the domain is the same for every row */
	const pageOf = (url: string) => {
		try {
			const u = new URL(url);
			return `${u.pathname}${u.hash}` || '/';
		} catch {
			return url;
		}
	};

	async function resolve(e: ClientError) {
		busyId = e.id;
		const ok = await c.act(() => c.api!.resolveError(e.id), 'ปิดข้อผิดพลาดแล้ว ถ้าเกิดอีกจะขึ้นเป็นรายการใหม่');
		busyId = null;
		if (ok) openId = null;
	}

	async function copy(e: ClientError) {
		const text = [
			e.message,
			`app: ${e.app} · ${e.kind} · release ${e.release || '-'}`,
			`url: ${e.url}`,
			`seen: ${e.count}x, ${dateTime(e.first_at)} - ${dateTime(e.last_at)}`,
			`device: ${e.user_agent}`,
			'',
			e.stack || e.source
		].join('\n');
		try {
			await navigator.clipboard.writeText(text);
			toast.show('คัดลอกรายละเอียดแล้ว ส่งให้คนแก้โค้ดได้เลย', 'success');
		} catch {
			toast.show('คัดลอกไม่สำเร็จ', 'error');
		}
	}
</script>

<div class="space-y-4">
	<div class="flex flex-wrap items-center gap-3">
		<Tabs
			label="สถานะข้อผิดพลาด"
			value={status}
			onchange={switchTab}
			tabs={[
				{ id: 'open', label: 'ยังไม่แก้', count: status === 'open' ? rows?.length : undefined },
				{ id: 'resolved', label: 'แก้แล้ว' }
			]}
		/>
		<p class="text-xs text-slate-500 sm:ml-auto sm:max-w-sm sm:text-right">แอปส่ง error มาเอง error เดียวกันรวมเป็นแถวเดียวพร้อมจำนวนครั้ง กด "แก้แล้ว" หลังขึ้นเวอร์ชันที่แก้ ถ้ายังเกิดอีกจะกลับมาเป็นแถวใหม่</p>
	</div>

	<div class="rounded-2xl border border-slate-100 bg-white">
		{#if error && !rows}
			<Empty title="โหลดข้อผิดพลาดไม่สำเร็จ" body={error} />
		{:else if !rows}
			<div class="space-y-2 p-4">{#each Array(4) as _, i (i)}<div class="h-16 animate-pulse rounded-lg bg-slate-100"></div>{/each}</div>
		{:else if rows.length === 0}
			{#if status === 'open'}
				<Empty title="ไม่มี error ค้างอยู่" body="ถ้าผู้ใช้เจอ error ในแอปหรือหน้านี้ จะขึ้นที่นี่เองภายในไม่กี่วินาที" />
			{:else}
				<Empty title="ยังไม่มีรายการที่แก้แล้ว" goose={false} />
			{/if}
		{:else}
			<ul class="divide-y divide-slate-100">
				{#each rows as e (e.id)}
					{@const open = openId === e.id}
					{@const device = deviceOf(e.user_agent)}
					<li>
						<button
							type="button"
							onclick={() => (openId = open ? null : e.id)}
							aria-expanded={open}
							class="flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-slate-50 sm:px-5"
						>
							<span class="mt-0.5 flex h-9 min-w-9 shrink-0 items-center justify-center rounded-xl px-2 text-sm font-semibold tabular-nums {countTone(e)}" title="เกิด {e.count} ครั้ง">
								×{count(e.count)}
							</span>
							<span class="min-w-0 flex-1">
								<span class="line-clamp-2 font-mono text-[13px] leading-snug font-medium break-all text-slate-900">{e.message}</span>
								<span class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
									<span class="rounded-full px-2 py-0.5 font-medium {APP[e.app].cls}">{APP[e.app].text}</span>
									{#if e.resolved_at}
										<span>แก้แล้ว {ago(e.resolved_at)}{e.resolved_by ? ` โดย ${e.resolved_by}` : ''}</span>
									{:else}
										<span>ล่าสุด {ago(e.last_at)}</span>
									{/if}
									<span class="max-w-48 truncate">{pageOf(e.url)}</span>
									{#if device}<span>{device}</span>{/if}
								</span>
							</span>
							<Icon name="chevron-down" class="mt-2 h-4 w-4 shrink-0 text-slate-400 transition-transform {open ? 'rotate-180' : ''}" />
						</button>

						{#if open}
							<div class="space-y-3 px-4 pb-4 sm:px-5 sm:pl-[4.25rem]">
								<dl class="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
									<div><dt class="text-xs text-slate-500">หน้าที่เกิด</dt><dd class="break-all">{e.url || '—'}</dd></div>
									<div><dt class="text-xs text-slate-500">ผู้ใช้ล่าสุด</dt><dd>{e.user ?? 'ยังไม่ได้ login'}</dd></div>
									<div><dt class="text-xs text-slate-500">ครั้งแรก · ล่าสุด</dt><dd class="tabular-nums">{dateTime(e.first_at)} · {dateTime(e.last_at)}</dd></div>
									<div><dt class="text-xs text-slate-500">ประเภท · เวอร์ชัน</dt><dd>{KIND[e.kind]} · <span class="font-mono text-[13px]">{e.release || '—'}</span></dd></div>
									<div class="sm:col-span-2"><dt class="text-xs text-slate-500">เครื่อง</dt><dd class="text-xs break-all text-slate-600">{e.user_agent || '—'}</dd></div>
								</dl>
								{#if e.stack || e.source}
									<pre class="max-h-64 overflow-auto rounded-xl bg-slate-50 p-3 font-mono text-xs leading-relaxed whitespace-pre text-slate-700">{e.stack || e.source}</pre>
								{/if}
								<div class="flex flex-wrap gap-2">
									{#if !e.resolved_at}
										<button type="button" disabled={busyId === e.id} onclick={() => resolve(e)} class="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
											<Icon name="check" class="h-4 w-4" />แก้แล้ว
										</button>
									{/if}
									<button type="button" onclick={() => copy(e)} class="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
										<Icon name="copy" class="h-4 w-4" />คัดลอกรายละเอียด
									</button>
								</div>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
