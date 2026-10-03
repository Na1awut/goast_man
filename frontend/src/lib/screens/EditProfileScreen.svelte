<script lang="ts">
	import { t } from '$lib/i18n';
	import AppBar from '$lib/components/AppBar.svelte';
	import ProfileForm from '$lib/components/ProfileForm.svelte';
	import { nav } from '$lib/stores/nav.svelte';
	import { toast } from '$lib/stores/toast.svelte';

	function saved() {
		toast.show(t('บันทึกข้อมูลแล้ว'), 'success');
		nav.back();
	}
</script>

<div class="flex flex-1 flex-col">
	<AppBar title={t('แก้ไขข้อมูลส่วนตัว')} />
	<ProfileForm mode="edit" onsaved={saved} />
</div>
