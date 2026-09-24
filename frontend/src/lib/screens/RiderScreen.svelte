<script lang="ts">
	import { onMount } from 'svelte';
	import type { RiderJob } from '$lib/types';
	import AppBar from '$lib/components/AppBar.svelte';
	import Goose from '$lib/components/Goose.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Sheet from '$lib/components/Sheet.svelte';
	import { START_OPTIONS } from '$lib/routing';
	import { DEMO_OTP, rider } from '$lib/stores/rider.svelte';
	import { isLive } from '$lib/supabase';
	import { formatBaht } from '$lib/utils';

	onMount(() => void rider.init());

	interface Stop {
		kind: 'pickup' | 'delivery';
		job: RiderJob;
		/** Seconds from now, when the plan knows */
		arriveAt?: number;
		wait?: number;
	}

	const minutes = (seconds: number) => Math.max(1, Math.round(seconds / 60));
	const waitedMinutes = (job: RiderJob) => Math.max(0, Math.floor((rider.now - Date.parse(job.createdAt)) / 60_000));
	const money = (job: RiderJob) => (job.paymentMethod === 'CASH' ? `เก็บเงินสด ${formatBaht(job.totalPrice)}` : 'จ่ายแล้วทาง PromptPay');

	/** The planned order when every stop is on the map, otherwise the order the jobs were taken */
	const stops = $derived.by<Stop[]>(() => {
		const byId = new Map(rider.mine.map((j) => [j.id, j]));
		if (rider.plan) return rider.plan.stops.map((s) => ({ kind: s.kind, job: byId.get(s.orderId)!, arriveAt: s.arriveAt, wait: s.wait }));
		return rider.mine.flatMap((job): Stop[] => (job.status === 'DELIVERING' ? [{ kind: 'delivery', job }] : [{ kind: 'pickup', job }, { kind: 'delivery', job }]));
	});
	const holding = $derived(rider.mine.length > 0);

	let otpJob = $state<RiderJob | null>(null);
	let otp = $state('');
	let otpError = $state('');
	let releaseTarget = $state<RiderJob | null>(null);

	function openOtp(job: RiderJob) {
		otpJob = job;
		otp = '';
		otpError = '';
	}

	async function submitOtp(e: SubmitEvent) {
		e.preventDefault();
		if (!otpJob) return;
		if (!/^\d{4}$/.test(otp)) {
			otpError = 'ใส่รหัส 4 หลักที่ลูกค้าบอก';
			return;
		}
		const result = await rider.confirm(otpJob, otp);
		if (result === 'ok') otpJob = null;
		else if (result === 'wrong') {
			otpError = 'รหัสไม่ถูกต้อง ถามลูกค้าอีกครั้ง (ผิดได้ไม่เกิน 5 ครั้ง)';
			otp = '';
		}
	}

	async function confirmRelease() {
		if (!releaseTarget) return;
		const job = releaseTarget;
		releaseTarget = null;
		await rider.release(job);
	}
</script>

{#snippet acceptButton(job: RiderJob)}
	<button
		type="button"
		onclick={() => rider.accept(job)}
		disabled={!!rider.acceptBlock || rider.busyId !== null}
		class="shrink-0 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-200 disabled:text-slate-500"
	>
		{rider.busyId === job.id ? 'กำลังรับ...' : 'รับงาน'}
	</button>
{/snippet}

<div class="flex flex-1 flex-col">
	<AppBar title="โหมดคนหิ้ว" />

	<div class="space-y-5 px-4 pt-4 pb-8">
		<label class="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3">
			<Icon name="pin" class="h-5 w-5 shrink-0 text-brand" />
			<span class="shrink-0 text-sm text-slate-500">ตอนนี้อยู่ที่</span>
			<select
				value={rider.startId}
				onchange={(e) => rider.setStart(e.currentTarget.value)}
				class="min-w-0 flex-1 truncate rounded-lg bg-slate-50 px-2 py-1.5 text-sm font-medium text-slate-900"
			>
				{#each START_OPTIONS as place (place.id)}
					<option value={place.id}>{place.label}</option>
				{/each}
			</select>
		</label>

		<!-- My round -->
		<section>
			<div class="mb-2 flex items-baseline justify-between">
				<h2 class="text-base font-semibold text-slate-900">รอบนี้ของฉัน</h2>
				<span class="text-sm text-slate-500 tabular-nums">{rider.mine.length}/{rider.capacity} งาน</span>
			</div>

			{#if !holding}
				<p class="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 text-center text-sm text-slate-500">ยังไม่มีงานในมือ เลือกรับจากรายการด้านล่างได้เลย</p>
			{:else}
				<div class="rounded-2xl border border-slate-100 bg-white">
					<div class="border-b border-slate-100 px-4 py-3">
						{#if rider.plan}
							<p class="text-sm font-medium text-slate-900">ส่งครบในประมาณ {minutes(rider.plan.finishSeconds)} นาที ถ้าเดินตามลำดับนี้</p>
							<p class="text-xs text-slate-400">เวลาเดินเป็นค่าประมาณ ยังไม่ได้ใช้แผนที่จริงของ มจธ.</p>
						{:else}
							<p class="text-sm text-slate-600">เรียงตามลำดับที่รับงาน บางจุดยังไม่อยู่ในแผนที่ จึงจัดเส้นทางให้ไม่ได้</p>
						{/if}
					</div>
					<ol class="divide-y divide-slate-100">
						{#each stops as stop, i (stop.kind + stop.job.id)}
							{@const job = stop.job}
							<li class="flex gap-3 px-4 py-3">
								<span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold {stop.kind === 'pickup' ? 'bg-brand-50 text-brand' : 'bg-fresh-50 text-fresh-700'}">{i + 1}</span>
								<div class="min-w-0 flex-1">
									<div class="flex items-start justify-between gap-2">
										<p class="text-sm font-semibold text-slate-900">
											{stop.kind === 'pickup' ? 'รับที่' : 'ส่งที่'}
											{stop.kind === 'pickup' ? job.pickupName : job.dropoffName}
										</p>
										{#if stop.arriveAt !== undefined}
											<span class="shrink-0 text-xs text-slate-500 tabular-nums">{stop.arriveAt < 30 ? 'อยู่ตรงนี้' : `~${minutes(stop.arriveAt)} นาที`}</span>
										{/if}
									</div>

									{#if stop.kind === 'pickup'}
										<p class="text-xs text-slate-500">{job.orderCode} · {job.itemDetails}</p>
										{#if job.kind === 'CUSTOM'}
											<p class="mt-1 text-xs text-slate-600">ฝากซื้อ สำรองจ่ายประมาณ {formatBaht(job.foodTotal)}</p>
										{/if}
										{#if job.note}<p class="mt-1 flex gap-1 text-xs text-slate-600"><Icon name="note" class="h-3.5 w-3.5 shrink-0" />{job.note}</p>{/if}
										{#if stop.wait && stop.wait >= 60}
											<p class="mt-1 text-xs text-amber-700">อาหารน่าจะเสร็จอีก ~{minutes(stop.wait)} นาทีหลังไปถึง</p>
										{/if}
										<div class="mt-2 flex items-center gap-3">
											<button type="button" onclick={() => rider.pickedUp(job)} disabled={rider.busyId !== null} class="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60">
												รับของแล้ว
											</button>
											<button type="button" onclick={() => (releaseTarget = job)} disabled={rider.busyId !== null} class="text-sm text-slate-500 underline-offset-2 hover:underline">คืนงาน</button>
										</div>
									{:else}
										<p class="text-xs text-slate-500">{job.orderCode} · {job.customer?.nickname ?? 'ลูกค้า'} · {money(job)}</p>
										<div class="mt-2 flex flex-wrap items-center gap-3">
											{#if job.status === 'DELIVERING'}
												<button type="button" onclick={() => openOtp(job)} disabled={rider.busyId !== null} class="rounded-full bg-fresh-700 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60">
													ส่งของ · ใส่ OTP
												</button>
											{:else}
												<span class="text-xs text-slate-400">กด "รับของแล้ว" ก่อน ถึงจะส่งได้</span>
											{/if}
											{#if job.customer?.phone}
												<a href="tel:{job.customer.phone}" class="flex items-center gap-1 text-sm font-medium text-brand"><Icon name="phone" class="h-4 w-4" />โทร</a>
											{/if}
										</div>
									{/if}
								</div>
							</li>
						{/each}
					</ol>
				</div>
			{/if}
		</section>

		<!-- Suggestions -->
		{#if rider.suggestions.length}
			<section>
				<h2 class="mb-2 text-base font-semibold text-slate-900">{holding ? 'รับเพิ่มได้ ทางเดียวกัน' : 'งานใกล้คุณ'}</h2>
				<ul class="space-y-2">
					{#each rider.suggestions as { job, seconds } (job.id)}
						<li class="flex items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50/60 px-4 py-3">
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium text-slate-900">{job.pickupName} → {job.dropoffName}</p>
								<p class="text-xs text-slate-600">
									{holding ? `ใช้เวลาเพิ่ม ~${minutes(seconds)} นาที` : `ใช้เวลาทั้งงาน ~${minutes(seconds)} นาที`} · ค่าหิ้ว {formatBaht(job.deliveryFee)}
								</p>
							</div>
							{@render acceptButton(job)}
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<!-- Open jobs -->
		<section>
			<div class="mb-2 flex items-baseline justify-between">
				<h2 class="text-base font-semibold text-slate-900">งานที่รอคนรับ</h2>
				<span class="text-sm text-slate-500 tabular-nums">{rider.open.length} งาน</span>
			</div>
			{#if rider.acceptBlock && rider.open.length}
				<p class="mb-2 flex gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600"><Icon name="info" class="h-4 w-4 shrink-0" />{rider.acceptBlock}</p>
			{/if}

			{#if !rider.loaded}
				<p class="py-8 text-center text-sm text-slate-500">กำลังโหลดงาน...</p>
			{:else if rider.open.length === 0}
				<div class="rounded-2xl border border-slate-100 bg-white px-6 py-10 text-center">
					<Goose pose="wait" class="mx-auto mb-3 w-24" />
					<p class="text-sm font-medium text-slate-800">ตอนนี้ยังไม่มีงานรอ</p>
					<p class="mt-1 text-xs text-slate-500">มีออเดอร์ใหม่เมื่อไหร่ จะขึ้นที่นี่ทันที</p>
				</div>
			{:else}
				<ul class="space-y-3">
					{#each rider.open as job (job.id)}
						<li class="rounded-2xl border border-slate-100 bg-white p-4">
							<div class="flex items-start justify-between gap-2">
								<div class="min-w-0">
									<p class="text-sm font-semibold text-slate-900">{job.orderCode} <span class="font-normal text-slate-400">· รอมา {waitedMinutes(job)} นาที</span></p>
									<p class="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
										<span class="truncate">{job.pickupName}</span>
										<Icon name="arrow-right" class="h-3.5 w-3.5 shrink-0 text-brand" />
										<span class="truncate">{job.dropoffName}</span>
									</p>
								</div>
								<span class="shrink-0 text-right text-sm font-semibold text-slate-900 tabular-nums"><span class="block text-xs font-normal text-slate-500">ค่าหิ้ว</span>{formatBaht(job.deliveryFee)}</span>
							</div>
							<p class="mt-2 line-clamp-2 text-sm text-slate-700">{job.itemDetails}</p>
							<div class="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
								<span class="text-xs text-slate-500">{job.kind === 'CUSTOM' ? `ฝากซื้อ · สำรองจ่าย ~${formatBaht(job.foodTotal)}` : money(job)}</span>
								{@render acceptButton(job)}
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</div>
</div>

<Sheet open={otpJob !== null} title="ยืนยันส่งของ" onclose={() => (otpJob = null)}>
	{#if otpJob}
		<form onsubmit={submitOtp} class="space-y-4">
			<div>
				<h2 class="text-lg font-semibold text-slate-900">ส่งของ {otpJob.orderCode}</h2>
				<p class="text-sm text-slate-600">ขอรหัส 4 หลักจาก {otpJob.customer?.nickname ?? 'ลูกค้า'} แล้วกรอกด้านล่าง{otpJob.paymentMethod === 'CASH' ? ` อย่าลืมเก็บเงินสด ${formatBaht(otpJob.totalPrice)}` : ''}</p>
			</div>
			<input
				bind:value={otp}
				oninput={() => (otpError = '')}
				inputmode="numeric"
				autocomplete="one-time-code"
				maxlength="4"
				placeholder="• • • •"
				aria-label="รหัส OTP 4 หลัก"
				class="w-full rounded-2xl border border-slate-200 py-3 text-center text-2xl font-semibold tracking-[0.5em] text-slate-900 tabular-nums"
			/>
			{#if otpError}<p class="text-sm text-red-600" role="alert">{otpError}</p>{/if}
			{#if !isLive}<p class="text-xs text-slate-400">โหมดเดโม: รหัสของทุกงานคือ {DEMO_OTP}</p>{/if}
			<button type="submit" disabled={rider.busyId !== null} class="w-full rounded-2xl bg-fresh-700 py-3.5 text-sm font-semibold text-white disabled:opacity-60">
				{rider.busyId ? 'กำลังตรวจรหัส...' : 'ยืนยันส่งของ'}
			</button>
		</form>
	{/if}
</Sheet>

<Sheet open={releaseTarget !== null} title="คืนงาน" onclose={() => (releaseTarget = null)}>
	{#if releaseTarget}
		<h2 class="text-lg font-semibold text-slate-900">คืนงาน {releaseTarget.orderCode}?</h2>
		<p class="mt-1 text-sm text-slate-600">งานจะกลับไปรอให้เพื่อนคนอื่นรับ และลูกค้าจะได้รับแจ้ง คืนได้เฉพาะงานที่ยังไม่ได้รับของ</p>
		<div class="mt-5 grid grid-cols-2 gap-3">
			<button type="button" onclick={() => (releaseTarget = null)} class="rounded-xl bg-slate-100 py-3 text-sm font-medium text-slate-700">ยกเลิก</button>
			<button type="button" onclick={confirmRelease} class="rounded-xl bg-red-600 py-3 text-sm font-medium text-white">คืนงาน</button>
		</div>
	{/if}
</Sheet>
