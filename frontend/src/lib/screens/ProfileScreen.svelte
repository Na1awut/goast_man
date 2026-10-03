<script lang="ts">
	import { t } from '$lib/i18n';
	import LangToggle from '$lib/components/LangToggle.svelte';
	import PushToggle from '$lib/components/PushToggle.svelte';
	import AppBar from '$lib/components/AppBar.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import LegalSheet from '$lib/components/LegalSheet.svelte';
	import Sheet from '$lib/components/Sheet.svelte';
	import { LEGAL, type LegalPage } from '$lib/data/legal';
	import { levelLabel } from '$lib/profile';
	import { auth } from '$lib/stores/auth.svelte';
	import { campus } from '$lib/stores/campus.svelte';
	import { cart } from '$lib/stores/cart.svelte';
	import { nav } from '$lib/stores/nav.svelte';
	import { orders } from '$lib/stores/orders.svelte';
	import { profileGate } from '$lib/stores/profileGate.svelte';
	import { riderApplication } from '$lib/stores/riderApplication.svelte';
	import { partnerDashboard } from '$lib/stores/partnerDashboard.svelte';
	import { onMount } from 'svelte';
	import { rider } from '$lib/stores/rider.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { formatBaht } from '$lib/utils';

	let infoOpen = $state<LegalPage | null>(null);
	const LEGAL_LINKS: { id: LegalPage; icon: IconName }[] = [
		{ id: 'terms', icon: 'file' },
		{ id: 'privacy', icon: 'lock' },
		{ id: 'contact', icon: 'help' }
	];
	let confirmLogout = $state(false);

	const user = $derived(auth.user);
	/** Students who are not riders yet can apply; the latest application decides what the card says */
	const canApply = $derived(!!user && user.role === 'STUDENT' && !user.isRider);
	const app = $derived(riderApplication.application);

	onMount(() => {
		if (canApply) void riderApplication.load();
	});

	async function logout() {
		orders.reset();
		rider.reset();
		riderApplication.reset();
		partnerDashboard.reset();
		cart.clear();
		toast.reset();
		await auth.logout();
		nav.reset('LOGIN');
		toast.show(t('ออกจากระบบแล้ว'));
	}
</script>

{#if user}
	<div class="flex flex-1 flex-col">
		<AppBar title={t('โปรไฟล์')} showBack={false} />

		<div class="space-y-3 px-4 pt-4 pb-8">
			<section class="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4">
				<Avatar name={user.fullName} size="lg" tone="soft" />
				<div class="min-w-0">
					<p class="text-lg font-semibold text-slate-900">{auth.displayName}</p>
					<p class="truncate text-sm text-slate-600">{user.fullName}</p>
					<p class="truncate text-xs text-slate-500">{user.email}</p>
					<span class="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-fresh-700"><Icon name="shield" class="h-3.5 w-3.5" /> {auth.isPartner ? t('บัญชีร้านค้า Partner') : t('ยืนยันตัวตน มจธ. แล้ว')}</span>
				</div>
				<button type="button" onclick={() => nav.go('EDIT_PROFILE')} class="ml-auto shrink-0 self-start rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700">{t('แก้ไข')}</button>
			</section>

			{#if user.isRider && !auth.isPartner}
				<!-- Only accounts the team has verified and added to the rider roster -->
				<button type="button" onclick={() => profileGate.ensure() && nav.go('RIDER')} class="flex w-full items-center gap-3 rounded-2xl bg-brand p-4 text-left text-white">
					<span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15"><Icon name="walk" /></span>
					<span class="min-w-0 flex-1">
						<span class="block text-sm font-semibold">{t('โหมดคนหิ้ว')}</span>
						<span class="block truncate text-xs text-white/85">{t('รับงาน จัดลำดับจุดรับ-ส่ง และดูรายได้')}</span>
					</span>
					<Icon name="chevron-right" class="h-5 w-5" />
				</button>
			{/if}

			{#if canApply && riderApplication.loaded}
				{#if app?.status === 'PENDING'}
					<section class="flex items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50 p-4">
						<span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-brand"><Icon name="clock" /></span>
						<span class="min-w-0 flex-1">
							<span class="block text-sm font-semibold text-slate-900">{t('ส่งใบสมัครคนหิ้วแล้ว')}</span>
							<span class="block text-xs text-slate-600">{t('รอทีมติดต่อนัดตรวจบัตรและอบรม · ว่าง {availability}', { availability: app.availability })}</span>
						</span>
					</section>
				{:else if app?.status === 'APPROVED'}
					<button type="button" onclick={() => location.reload()} class="flex w-full items-center gap-3 rounded-2xl bg-fresh-700 p-4 text-left text-white">
						<span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15"><Icon name="check-circle" /></span>
						<span class="min-w-0 flex-1">
							<span class="block text-sm font-semibold">{t('ผ่านการตรวจแล้ว')}</span>
							<span class="block text-xs text-white/85">{t('แตะเพื่อโหลดใหม่ แล้วจะเห็นปุ่มโหมดคนหิ้ว')}</span>
						</span>
						<Icon name="refresh" class="h-5 w-5" />
					</button>
				{:else}
					<button type="button" onclick={() => profileGate.ensure() && nav.go('RIDER_APPLY')} class="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 text-left">
						<span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand"><Icon name="walk" /></span>
						<span class="min-w-0 flex-1">
							<span class="block text-sm font-semibold text-slate-900">{app?.status === 'REJECTED' ? t('สมัครเป็นคนหิ้วอีกครั้ง') : t('สมัครเป็นคนหิ้ว')}</span>
							<span class="block text-xs text-slate-500">
								{app?.status === 'REJECTED' ? t('รอบก่อนยังไม่ผ่าน: {v}', { v: app.reviewNote ?? '' }) : t('หิ้วให้เพื่อนในมอ ได้ค่าหิ้วงานละ 15 บาท + ทิป')}
							</span>
						</span>
						<Icon name="chevron-right" class="h-5 w-5 text-slate-400" />
					</button>
				{/if}
			{/if}

			{#if auth.isPartner}
				<button type="button" onclick={() => nav.go('PARTNER')} class="flex w-full items-center gap-3 rounded-2xl bg-brand p-4 text-left text-white">
					<span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15"><Icon name="store" /></span>
					<span class="min-w-0 flex-1">
						<span class="block text-sm font-semibold">{t('จัดการร้านของฉัน')}</span>
						<span class="block truncate text-xs text-white/85">{t('แบนเนอร์หน้าร้าน, Fast lane และโปรโมชัน')}</span>
					</span>
					<Icon name="chevron-right" class="h-5 w-5" />
				</button>
			{/if}

			<section class="grid grid-cols-3 divide-x divide-slate-100 rounded-2xl border border-slate-100 bg-white py-4 text-center">
				{#each [
					{ value: String(orders.completed.length), label: t('ออเดอร์สำเร็จ') },
					{ value: formatBaht(orders.totalSpent), label: t('ยอดสะสม') },
					{ value: user.buyerRatingAvg.toFixed(2), label: t('คะแนนผู้สั่ง') }
				] as stat (stat.label)}
					<div class="px-2">
						<p class="truncate text-base font-semibold text-slate-900 tabular-nums">{stat.value}</p>
						<p class="text-xs text-slate-500">{stat.label}</p>
					</div>
				{/each}
			</section>

			<section class="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white px-4">
				{#each [
					{ icon: 'cap' as const, label: t('รหัสนักศึกษา'), value: user.studentId },
					{ icon: 'building' as const, label: user.studyLevel === 'staff' ? t('หน่วยงาน') : t('คณะ'), value: [t(user.faculty), user.studyLevel === 'staff' ? '' : levelLabel(user.studyLevel)].filter(Boolean).join(' · ') },
					{ icon: 'phone' as const, label: t('เบอร์โทรศัพท์'), value: user.phoneNumber },
					{ icon: 'qr' as const, label: 'PromptPay No.', value: user.promptPayNo }
				].filter((row) => row.value) as row (row.label)}
					<div class="flex items-center gap-3 py-3">
						<Icon name={row.icon} class="h-5 w-5 text-slate-400" />
						<div class="min-w-0">
							<p class="text-xs text-slate-500">{row.label}</p>
							<p class="truncate text-sm text-slate-900">{row.value}</p>
						</div>
					</div>
				{/each}
				<button type="button" onclick={() => campus.openPicker()} class="flex w-full items-center gap-3 py-3 text-left">
					<Icon name="pin" class="h-5 w-5 text-slate-400" />
					<span class="min-w-0 flex-1">
						<span class="block text-xs text-slate-500">{t('จุดรับเริ่มต้น')}</span>
						<span class="block truncate text-sm text-slate-900">{campus.dropoff.name}</span>
					</span>
					<span class="text-sm font-medium text-brand">{t('เปลี่ยน')}</span>
				</button>
			</section>

			<section class="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3">
				<Icon name="globe" class="h-5 w-5 text-slate-400" />
				<span class="min-w-0 flex-1 text-sm text-slate-900">ภาษา / Language</span>
				<LangToggle />
			</section>

			<PushToggle context={user.isRider ? 'rider' : 'buyer'} />

			<section class="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white px-4">
				{#each LEGAL_LINKS as link (link.id)}
					<button type="button" onclick={() => (infoOpen = link.id)} class="flex w-full items-center gap-3 py-3.5 text-left text-sm text-slate-800">
						<Icon name={link.icon} class="h-5 w-5 text-slate-400" />
						<span class="flex-1">{t(LEGAL[link.id].title)}</span>
						<Icon name="chevron-right" class="h-4 w-4 text-slate-300" />
					</button>
				{/each}
			</section>

			<button type="button" onclick={() => (confirmLogout = true)} class="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-white py-3.5 text-sm font-medium text-red-600">
				<Icon name="logout" class="h-4 w-4" /> {t('ออกจากระบบ')}
			</button>
			<p class="text-center text-xs text-slate-400">Goose Man v1.0.0 · KMUTT Bangmod</p>
		</div>
	</div>

	<LegalSheet page={infoOpen} onclose={() => (infoOpen = null)} />

	<Sheet open={confirmLogout} title={t('ออกจากระบบ?')} onclose={() => (confirmLogout = false)}>
		<p class="text-sm text-slate-600">
			{orders.active.length > 0
				? t('คุณมี {activeCount} ออเดอร์ที่กำลังดำเนินการ ถ้าออกจากระบบจะไม่ได้รับการแจ้งเตือนสถานะ', { activeCount: orders.active.length })
				: t('ตะกร้าและการตั้งค่าในเครื่องนี้จะถูกล้าง')}
		</p>
		<div class="mt-5 grid grid-cols-2 gap-3">
			<button type="button" onclick={() => (confirmLogout = false)} class="rounded-xl bg-slate-100 py-3 text-sm font-medium text-slate-700">{t('ยกเลิก')}</button>
			<button type="button" onclick={logout} class="rounded-xl bg-red-600 py-3 text-sm font-medium text-white">{t('ออกจากระบบ')}</button>
		</div>
	</Sheet>
{/if}
