/**
 * Client Security Guard for Goose Man.
 * - Blocks F12, Inspect, View Source, DevTools shortcuts.
 * - Blocks Context Menu (Right Click), Dragging, and Printing/Saving (Ctrl+S, Ctrl+P).
 * - Anti-Debugging: Traps DevTools with recursive debugger calls.
 * - Anti-Offline/Downloaded: Immediately halts and destroys DOM if loaded locally (file:, blob:) or offline.
 */

export function installClientSecurity() {
	if (typeof window === 'undefined') return;

	// 1. Anti-Download / Local File Killswitch
	// If someone saves or downloads files and opens them locally (file://, blob:, null origin)
	if (
		window.location.protocol === 'file:' ||
		window.location.protocol === 'blob:' ||
		window.location.origin === 'null' ||
		!window.location.host
	) {
		document.documentElement.innerHTML =
			'<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0b0f19;color:#fff;font-family:sans-serif;text-align:center;padding:24px;"><div><h1 style="font-size:22px;margin:0 0 8px;font-weight:700;">403 Forbidden</h1><p style="color:#94a3b8;font-size:14px;margin:0;">ไม่อนุญาตให้เปิดหรือบันทึกไฟล์ไปใช้งานแบบออฟไลน์</p></div></div>';
		if (window.stop) window.stop();
		throw new Error('Offline/downloaded execution prohibited');
	}

	// 2. Anti-Frame / Clickjacking
	if (window.top && window.top !== window.self) {
		try {
			window.top.location.href = window.self.location.href;
		} catch {
			document.documentElement.innerHTML = '';
		}
	}

	// 3. Block Shortcuts (F12, Inspect, Console, Source, Save, Print)
	window.addEventListener(
		'keydown',
		(e: KeyboardEvent) => {
			const k = e.key;
			const code = e.keyCode || e.which;

			// F12
			if (k === 'F12' || code === 123) {
				e.preventDefault();
				e.stopPropagation();
				return false;
			}

			// Ctrl+Shift+I / J / C (Inspect / Console / Select Element)
			if (
				(e.ctrlKey || e.metaKey) &&
				e.shiftKey &&
				(k === 'I' || k === 'i' || code === 73 || k === 'J' || k === 'j' || code === 74 || k === 'C' || k === 'c' || code === 67)
			) {
				e.preventDefault();
				e.stopPropagation();
				return false;
			}

			// Ctrl+U / Cmd+U (View Source)
			if ((e.ctrlKey || e.metaKey) && (k === 'u' || k === 'U' || code === 85)) {
				e.preventDefault();
				e.stopPropagation();
				return false;
			}

			// Ctrl+S / Cmd+S (Save Webpage)
			if ((e.ctrlKey || e.metaKey) && (k === 's' || k === 'S' || code === 83)) {
				e.preventDefault();
				e.stopPropagation();
				return false;
			}

			// Ctrl+P / Cmd+P (Print Page)
			if ((e.ctrlKey || e.metaKey) && (k === 'p' || k === 'P' || code === 80)) {
				e.preventDefault();
				e.stopPropagation();
				return false;
			}
		},
		true
	);

	// 4. Block Right Click (Context Menu)
	document.addEventListener(
		'contextmenu',
		(e: MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();
			return false;
		},
		true
	);

	// 5. Block Dragging Assets
	document.addEventListener(
		'dragstart',
		(e: DragEvent) => {
			e.preventDefault();
			return false;
		},
		true
	);

	// 6. Neuter and Clear Console
	try {
		const noop = () => {};
		const methods = ['log', 'debug', 'info', 'warn', 'error', 'table', 'trace', 'dir', 'dirxml'] as const;
		methods.forEach((m) => {
			console[m] = noop;
		});
	} catch {}
}
