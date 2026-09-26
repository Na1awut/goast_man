<script lang="ts">
	// Confirmation surface: a centred dialog on desktop, a bottom sheet on phones.
	// The primary button names the action; errors stay inside, the dialog stays open.
	import type { Snippet } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import Icon from '$lib/components/Icon.svelte';

	let {
		open,
		title,
		onclose,
		confirmLabel,
		onconfirm,
		danger = false,
		busy = false,
		disabled = false,
		error = '',
		children
	}: {
		open: boolean;
		title: string;
		onclose: () => void;
		confirmLabel?: string;
		onconfirm?: () => void;
		danger?: boolean;
		busy?: boolean;
		disabled?: boolean;
		error?: string;
		children: Snippet;
	} = $props();

	function onkeydown(e: KeyboardEvent) {
		if (open && e.key === 'Escape' && !busy) onclose();
	}
</script>

<svelte:window {onkeydown} />

{#if open}
	<div class="fixed inset-0 z-[65] flex items-end justify-center sm:items-center sm:p-6">
		<button type="button" aria-label="ปิด" class="absolute inset-0 bg-slate-900/40" onclick={() => !busy && onclose()} transition:fade={{ duration: 150 }}></button>
		<div
			role="dialog"
			aria-modal="true"
			aria-label={title}
			class="relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-white shadow-2xl shadow-slate-900/20 sm:max-w-lg sm:rounded-2xl"
			transition:fly={{ y: 40, duration: 200 }}
		>
		<form
			class="flex min-h-0 flex-1 flex-col"
			onsubmit={(e) => {
				e.preventDefault();
				if (!busy && !disabled) onconfirm?.();
			}}
		>
			<div class="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
				<h2 class="text-base font-semibold text-slate-900">{title}</h2>
				<button type="button" onclick={onclose} disabled={busy} aria-label="ปิด" class="-mr-2 flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
					<Icon name="x" class="h-5 w-5" />
				</button>
			</div>
			<div class="overflow-y-auto px-5 py-4 text-sm text-slate-700">
				{@render children()}
				{#if error}
					<p class="mt-4 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert"><Icon name="alert" class="mt-0.5 h-4 w-4" />{error}</p>
				{/if}
			</div>
			{#if confirmLabel}
				<div class="flex gap-3 border-t border-slate-100 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
					<button type="button" onclick={onclose} disabled={busy} class="h-11 flex-1 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:flex-none sm:px-5">ยกเลิก</button>
					<button
						type="submit"
						disabled={busy || disabled}
						class="flex h-11 flex-[2] items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white disabled:opacity-50 sm:ml-auto sm:flex-none {danger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand hover:bg-brand-600'}"
					>
						{#if busy}<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span> กำลังบันทึก...{:else}{confirmLabel}{/if}
					</button>
				</div>
			{/if}
		</form>
		</div>
	</div>
{/if}
