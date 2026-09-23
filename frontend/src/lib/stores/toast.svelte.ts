// Toast global store (Svelte 5 runes)
let toastMessage = $state<string | null>(null);
let toastTimeout: ReturnType<typeof setTimeout> | null = null;

export function showToast(msg: string, duration = 3500) {
	if (toastTimeout) clearTimeout(toastTimeout);
	toastMessage = msg;
	toastTimeout = setTimeout(() => {
		toastMessage = null;
		toastTimeout = null;
	}, duration);
}

export function dismissToast() {
	if (toastTimeout) clearTimeout(toastTimeout);
	toastMessage = null;
}

export function getToast() {
	return toastMessage;
}
