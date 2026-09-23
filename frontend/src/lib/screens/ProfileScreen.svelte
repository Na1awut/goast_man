<script lang="ts">
	import AppBar from '$lib/components/AppBar.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import Sheet from '$lib/components/Sheet.svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import { campus } from '$lib/stores/campus.svelte';
	import { cart } from '$lib/stores/cart.svelte';
	import { nav } from '$lib/stores/nav.svelte';
	import { orders } from '$lib/stores/orders.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { formatBaht } from '$lib/utils';

	type InfoPage = 'terms' | 'privacy' | 'contact';

	const INFO: Record<InfoPage, { title: string; icon: IconName; body: string[] }> = {
		terms: {
			title: 'เงื่อนไขการใช้งาน',
			icon: 'file',
			body: [
				'ใช้ได้เฉพาะนักศึกษาและบุคลากร มจธ. ที่ยืนยันตัวตนผ่านอีเมล @kmutt.ac.th',
				'แจ้งรหัส OTP ให้คนหิ้วเมื่อได้รับของครบเท่านั้น',
				'ออเดอร์ฝากซื้อ ชำระค่าของตามใบเสร็จจริงให้คนหิ้ว',
				'ห้ามฝากซื้อสินค้าผิดกฎหมาย เครื่องดื่มแอลกอฮอล์ หรือบุหรี่'
			]
		},
		privacy: {
			title: 'นโยบายความเป็นส่วนตัว',
			icon: 'lock',
			body: [
				'เก็บเฉพาะชื่อ อีเมล รหัสนักศึกษา และเบอร์โทร เพื่อใช้จับคู่ออเดอร์',
				'คนหิ้วเห็นเบอร์โทรของคุณเฉพาะระหว่างออเดอร์ที่กำลังดำเนินการ',
				'ประวัติแชทถูกลบอัตโนมัติ 30 วันหลังออเดอร์เสร็จสิ้น'
			]
		},
		contact: {
			title: 'ติดต่อเรา',
			icon: 'help',
			body: [
				'ปัญหาระหว่างออเดอร์: แชทหรือโทรหาคนหิ้วจากหน้าติดตามคำสั่งซื้อ',
				'ของไม่ครบหรือไม่ถูกต้อง: อย่าเพิ่งบอก OTP จนกว่าจะได้ของครบ',
				'จุดช่วยเหลือ: อาคาร LX ชั้น 1 (จ.-ศ. 11:00-14:00)'
			]
		}
	};

	let infoOpen = $state<InfoPage | null>(null);
	let confirmLogout = $state(false);

	const user = $derived(auth.user);

	function logout() {
		orders.reset();
		cart.clear();
		toast.reset();
		auth.logout();
		nav.reset('LOGIN');
		toast.show('ออกจากระบบแล้ว');
	}
</script>

{#if user}
	<div class="flex flex-1 flex-col">
		<AppBar title="โปรไฟล์" showBack={false} />

		<div class="space-y-3 px-4 pt-4 pb-8">
			<section class="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4">
				<Avatar name={user.fullName} size="lg" tone="soft" />
				<div class="min-w-0">
					<p class="text-lg font-semibold text-slate-900">{user.nickname}</p>
					<p class="truncate text-sm text-slate-600">{user.fullName}</p>
					<p class="truncate text-xs text-slate-500">{user.email}</p>
					<span class="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-fresh-700"><Icon name="shield" class="h-3.5 w-3.5" /> ยืนยันตัวตน มจธ. แล้ว</span>
				</div>
			</section>

			<section class="grid grid-cols-3 divide-x divide-slate-100 rounded-2xl border border-slate-100 bg-white py-4 text-center">
				{#each [
					{ value: String(orders.completed.length), label: 'ออเดอร์สำเร็จ' },
					{ value: formatBaht(orders.totalSpent), label: 'ยอดสะสม' },
					{ value: user.buyerRatingAvg.toFixed(2), label: 'คะแนนผู้สั่ง' }
				] as stat (stat.label)}
					<div class="px-2">
						<p class="truncate text-base font-semibold text-slate-900 tabular-nums">{stat.value}</p>
						<p class="text-xs text-slate-500">{stat.label}</p>
					</div>
				{/each}
			</section>

			<section class="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white px-4">
				{#each [
					{ icon: 'cap' as const, label: 'รหัสนักศึกษา', value: user.studentId },
					{ icon: 'building' as const, label: 'คณะ', value: user.faculty },
					{ icon: 'phone' as const, label: 'เบอร์โทรศัพท์', value: user.phoneNumber },
					{ icon: 'qr' as const, label: 'PromptPay No.', value: user.promptPayNo }
				] as row (row.label)}
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
						<span class="block text-xs text-slate-500">จุดรับเริ่มต้น</span>
						<span class="block truncate text-sm text-slate-900">{campus.dropoff.name}</span>
					</span>
					<span class="text-sm font-medium text-brand">เปลี่ยน</span>
				</button>
			</section>

			<section class="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white px-4">
				{#each Object.entries(INFO) as [id, info] (id)}
					<button type="button" onclick={() => (infoOpen = id as InfoPage)} class="flex w-full items-center gap-3 py-3.5 text-left text-sm text-slate-800">
						<Icon name={info.icon} class="h-5 w-5 text-slate-400" />
						<span class="flex-1">{info.title}</span>
						<Icon name="chevron-right" class="h-4 w-4 text-slate-300" />
					</button>
				{/each}
			</section>

			<button type="button" onclick={() => (confirmLogout = true)} class="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-white py-3.5 text-sm font-medium text-red-600">
				<Icon name="logout" class="h-4 w-4" /> ออกจากระบบ
			</button>
			<p class="text-center text-xs text-slate-400">Goose Man v1.0.0 · KMUTT Bangmod</p>
		</div>
	</div>

	<Sheet open={infoOpen !== null} title={infoOpen ? INFO[infoOpen].title : ''} onclose={() => (infoOpen = null)}>
		{#if infoOpen}
			<ul class="list-disc space-y-2 pb-2 pl-5 text-sm text-slate-700 marker:text-brand">
				{#each INFO[infoOpen].body as line (line)}<li>{line}</li>{/each}
			</ul>
		{/if}
	</Sheet>

	<Sheet open={confirmLogout} title="ออกจากระบบ?" onclose={() => (confirmLogout = false)}>
		<p class="text-sm text-slate-600">
			{orders.active.length > 0
				? `คุณมี ${orders.active.length} ออเดอร์ที่กำลังดำเนินการ ถ้าออกจากระบบจะไม่ได้รับการแจ้งเตือนสถานะ`
				: 'ตะกร้าและการตั้งค่าในเครื่องนี้จะถูกล้าง'}
		</p>
		<div class="mt-5 grid grid-cols-2 gap-3">
			<button type="button" onclick={() => (confirmLogout = false)} class="rounded-xl bg-slate-100 py-3 text-sm font-medium text-slate-700">ยกเลิก</button>
			<button type="button" onclick={logout} class="rounded-xl bg-red-600 py-3 text-sm font-medium text-white">ออกจากระบบ</button>
		</div>
	</Sheet>
{/if}
