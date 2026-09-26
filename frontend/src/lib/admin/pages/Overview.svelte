<script lang="ts">
	import { initialOf } from '$lib/utils';
	import { consoleState as c } from '../console.svelte';
	import { baht, clock, count } from '../format';
	import { STAGE } from '../labels';
	import type { OrderRow } from '../types';
	import AttentionChip from '../ui/AttentionChip.svelte';
	import Card from '../ui/Card.svelte';
	import Empty from '../ui/Empty.svelte';
	import KpiTile from '../ui/KpiTile.svelte';
	import SlotChart from '../ui/SlotChart.svelte';
	import StagePill from '../ui/StagePill.svelte';
	import StatusDonut from '../ui/StatusDonut.svelte';

	const o = $derived(c.overview);
	const updated = $derived(c.lastUpdated ? `อัปเดต ${clock(c.lastUpdated.toISOString())}` : '');

	let attention = $state<OrderRow[] | null>(null);
	$effect(() => {
		void c.tick;
		c.api?.orders({ tab: 'attention', limit: 6 }).then((p) => (attention = p.rows)).catch(() => (attention = []));
	});

	const avatarTone = ['bg-sky-100 text-sky-700', 'bg-pink-100 text-pink-700', 'bg-violet-100 text-violet-700', 'bg-amber-100 text-amber-700', 'bg-emerald-100 text-emerald-700'];
	const shortStore = (name: string) => name.replace(/\s*\(.*\)\s*/g, ' ').trim();
</script>

{#if !o}
	{#if c.overviewError}
		<Card><Empty title="โหลดภาพรวมไม่สำเร็จ" body={c.overviewError}><button type="button" onclick={() => c.refresh()} class="mt-4 h-10 rounded-xl bg-brand px-4 text-sm font-semibold text-white">ลองอีกครั้ง</button></Empty></Card>
	{:else}
		<div class="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3 min-[1600px]:grid-cols-6">
			{#each Array(6) as _, i (i)}<div class="h-[132px] animate-pulse rounded-2xl bg-white"></div>{/each}
		</div>
		<div class="mt-4 h-80 animate-pulse rounded-2xl bg-white"></div>
	{/if}
{:else}
	<div class="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3 min-[1600px]:grid-cols-6">
		<KpiTile label={o.is_today ? 'ออเดอร์วันนี้' : 'ออเดอร์'} value={count(o.orders)} icon="cart" trend={o.slots.map((s) => s.orders)} onclick={() => c.go('orders')}>
			{#snippet footer()}สำเร็จ {o.status_counts.COMPLETED} · ยกเลิก {o.status_counts.CANCELLED}{/snippet}
		</KpiTile>
		<KpiTile label={o.is_today ? 'ยอดขายวันนี้' : 'ยอดขาย'} value={baht(o.gmv)} icon="coins" trend={o.slots.map((s) => s.gmv)}>
			{#snippet footer()}อาหาร {baht(o.food)} · ค่าหิ้ว {baht(o.fees)}{/snippet}
		</KpiTile>
		<KpiTile label="รอคนรับ" value={count(o.waiting_rider)} icon="clock" onclick={() => c.go('orders')}>
			{#snippet footer()}{o.awaiting_payment ? `รอชำระอีก ${o.awaiting_payment}` : updated}{/snippet}
		</KpiTile>
		<KpiTile label="กำลังไปส่ง" value={count(o.delivering)} icon="bike">
			{#snippet footer()}รับงานแล้วและกำลังส่ง · {updated}{/snippet}
		</KpiTile>
		<KpiTile label="ร้านที่เปิดอยู่" value="{o.stores_open}/{o.stores_total}" icon="store" onclick={() => c.go('stores')}>
			{#snippet footer()}เปิดรับออเดอร์ตอนนี้{/snippet}
		</KpiTile>
		<KpiTile label="คนหิ้วที่ถืองาน" value={count(o.riders_busy)} icon="users" onclick={() => c.go('riders')}>
			{#snippet footer()}จาก {o.riders_total} คนในรายชื่อ{/snippet}
		</KpiTile>
	</div>

	<div class="mt-3 grid gap-3 sm:mt-4 sm:gap-4 xl:grid-cols-3">
		<Card title="ปริมาณออเดอร์และยอดขาย" subtitle="ออเดอร์และยอดขายทุก 15 นาที" class="xl:col-span-2">
			{#snippet actions()}
				<div class="hidden shrink-0 items-center gap-4 text-xs text-slate-600 sm:flex">
					<span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-brand-200"></span>ออเดอร์</span>
					<span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-brand"></span>ยอดขาย (฿)</span>
				</div>
			{/snippet}
			{#if o.orders === 0}
				<Empty title="ยังไม่มีออเดอร์ในวันนี้" body="กราฟจะขึ้นเมื่อมีออเดอร์แรก" goose={false} />
			{:else}
				<SlotChart slots={o.slots} day={o.day} />
			{/if}
		</Card>
		<Card title="สถานะออเดอร์{o.is_today ? 'วันนี้' : ''}">
			<StatusDonut counts={o.status_counts} />
		</Card>
	</div>

	<div class="mt-3 grid grid-cols-2 gap-3 sm:mt-4 sm:gap-4 xl:grid-cols-4">
		<KpiTile label="รอคืนเงิน" value={count(o.refunds_due)} icon="refresh" tone={o.refunds_due ? 'alert' : 'default'} onclick={() => c.go('finance')}>
			{#snippet footer()}{o.refunds_due ? `ต้องดำเนินการ · ${baht(o.refunds_due_amount)}` : 'ไม่มีค้าง'}{/snippet}
		</KpiTile>
		<KpiTile label="ค่าใช้จ่ายคนหิ้ว{o.is_today ? 'วันนี้' : ''}" value={baht(o.rider_cost_day)} icon="wallet" onclick={() => c.go('finance')}>
			{#snippet footer()}ค้างโอน {baht(o.payouts_due)}{o.payouts_due_riders ? ` · ${o.payouts_due_riders} คน` : ''}{/snippet}
		</KpiTile>
		<KpiTile label="เวลาเฉลี่ยกว่าจะมีคนรับ" value={o.avg_accept_minutes === null ? '—' : `${o.avg_accept_minutes} นาที`} icon="clock">
			{#snippet footer()}นับจากชำระแล้ว (หรือสั่ง ถ้าเงินสด){/snippet}
		</KpiTile>
		<KpiTile label="ออเดอร์มีปัญหา" value={count(o.problems)} icon="alert" tone={o.problems ? 'alert' : 'default'} onclick={() => c.go('orders')}>
			{#snippet footer()}{o.problems ? 'ต้องตรวจสอบ' : 'ไม่มีปัญหาตอนนี้'}{/snippet}
		</KpiTile>
	</div>

	<div class="mt-3 grid gap-3 sm:mt-4 sm:gap-4 xl:grid-cols-2 min-[1600px]:grid-cols-[1.6fr_1fr_1fr]">
		<Card title="ออเดอร์ที่ต้องจัดการ" linkLabel="ดูทั้งหมด" onlink={() => c.go('orders')} class="xl:col-span-2 min-[1600px]:col-span-1">
			{#if attention === null}
				<div class="space-y-2">{#each Array(4) as _, i (i)}<div class="h-10 animate-pulse rounded-lg bg-slate-100"></div>{/each}</div>
			{:else if attention.length === 0}
				<Empty title="ไม่มีออเดอร์ที่ต้องจัดการ" body="ออเดอร์ค้างจะขึ้นที่นี่ทันที" />
			{:else}
				<table class="hidden w-full text-left text-sm md:table">
					<thead class="text-xs text-slate-500">
						<tr class="border-b border-slate-100">
							<th class="py-2 pr-3 font-medium">รหัส</th><th class="py-2 pr-3 font-medium">ร้าน</th><th class="py-2 pr-3 font-medium">จุดส่ง</th>
							<th class="py-2 pr-3 text-right font-medium">ยอด</th><th class="py-2 pr-3 font-medium">สถานะ</th><th class="py-2 font-medium">แจ้งเตือน</th>
						</tr>
					</thead>
					<tbody>
						{#each attention as r (r.id)}
							<tr class="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50" onclick={() => c.go('orders', r.id)}>
								<td class="py-2.5 pr-3"><a href="#/orders/{r.id}" class="font-semibold text-brand tabular-nums">{r.code}</a></td>
								<td class="max-w-44 truncate py-2.5 pr-3">{shortStore(r.pickup)}</td>
								<td class="max-w-40 truncate py-2.5 pr-3 text-slate-600">{r.dropoff}</td>
								<td class="py-2.5 pr-3 text-right tabular-nums">{baht(r.total)}</td>
								<td class="py-2.5 pr-3"><StagePill stage={r.stage} /></td>
								<td class="py-2.5"><AttentionChip attention={r.attention[0]} /></td>
							</tr>
						{/each}
					</tbody>
				</table>
				<ul class="divide-y divide-slate-100 md:hidden">
					{#each attention as r (r.id)}
						<li>
							<a href="#/orders/{r.id}" class="flex items-start gap-3 py-3">
								<div class="min-w-0 flex-1">
									<p class="flex items-center gap-2"><span class="font-semibold text-brand tabular-nums">{r.code}</span><StagePill stage={r.stage} /></p>
									<p class="mt-1 truncate text-sm text-slate-700">{shortStore(r.pickup)} → {r.dropoff}</p>
									<p class="mt-1"><AttentionChip attention={r.attention[0]} /></p>
								</div>
								<span class="text-sm font-semibold tabular-nums">{baht(r.total)}</span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</Card>

		<Card title="ร้านขายดี{o.is_today ? 'วันนี้' : ''}" linkLabel="ดูทั้งหมด" onlink={() => c.go('stores')}>
			{#if o.top_stores.length === 0}
				<Empty title="ยังไม่มียอดขาย" goose={false} />
			{:else}
				<table class="w-full table-fixed text-left text-sm">
					<thead class="text-xs text-slate-500">
						<tr class="border-b border-slate-100"><th class="w-8 py-2 font-medium">#</th><th class="py-2 font-medium">ร้าน</th><th class="w-16 py-2 text-right font-medium">ออเดอร์</th><th class="w-20 py-2 text-right font-medium">ยอดขาย</th></tr>
					</thead>
					<tbody>
						{#each o.top_stores as s, i (s.id)}
							<tr class="border-b border-slate-50 last:border-0">
								<td class="py-2.5 text-slate-500 tabular-nums">{i + 1}</td>
								<td class="truncate py-2.5 pr-2" title={s.name}>{shortStore(s.name)}</td>
								<td class="py-2.5 text-right tabular-nums">{s.orders}</td>
								<td class="py-2.5 text-right font-medium tabular-nums">{baht(s.gmv)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</Card>

		<Card title="คนหิ้วที่กำลังวิ่งงาน" linkLabel="ดูทั้งหมด" onlink={() => c.go('riders')}>
			{#if o.riders.length === 0}
				<Empty title="ยังไม่มีคนหิ้วในรายชื่อ" body="ADMIN เพิ่มคนหิ้วที่ verify แล้วได้ที่หน้าคนหิ้ว" goose={false} />
			{:else}
				<ul class="space-y-3">
					{#each o.riders as r, i (r.id ?? r.nickname)}
						<li class="flex items-center gap-3">
							<span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold {avatarTone[i % avatarTone.length]}">{initialOf(r.nickname)}</span>
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-semibold">{r.nickname}{#if r.holding > 1}<span class="ml-1 text-xs font-normal text-slate-500">ถือ {r.holding} งาน</span>{/if}</p>
								<p class="truncate text-xs text-slate-500">{r.job_code ? `${r.job_code} · ${shortStore(r.job_pickup ?? '')} → ${r.job_dropoff}` : 'ไม่มีงานตอนนี้'}</p>
							</div>
							{#if r.job_status}
								<span class="flex shrink-0 items-center gap-1.5 text-xs font-medium {r.job_status === 'DELIVERING' ? 'text-violet-700' : 'text-sky-700'}">
									<span class="h-2 w-2 rounded-full" style="background: {STAGE[r.job_status].color}"></span>{STAGE[r.job_status].label}
								</span>
							{:else}
								<span class="flex shrink-0 items-center gap-1.5 text-xs text-slate-500"><span class="h-2 w-2 rounded-full bg-slate-300"></span>ไม่มีงาน</span>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</Card>
	</div>
{/if}
