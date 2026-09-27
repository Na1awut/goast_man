// Sends uncaught errors from the browser to the database (log_client_error),
// so the team sees them on the console's "ข้อผิดพลาด" page instead of hearing
// about them days later. Live mode only; demo mode has nothing to report to.

export type ErrorApp = 'buyer' | 'console';
export type ErrorKind = 'error' | 'rejection' | 'svelte';

export interface ErrorReport {
	app: ErrorApp;
	kind: ErrorKind;
	message: string;
	stack: string;
	/** file:line:col the error came from; tells two errors with the same text apart */
	source: string;
	url: string;
}

/** Errors that are not ours or not actionable */
const NOISE = [
	/ResizeObserver loop/i,
	// Cross-origin script errors carry no detail at all
	/^Script error\.?$/i,
	// The user's network, not a bug; the screens already say "ลองใหม่"
	/^(TypeError: )?(Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.?)$/i,
	/AbortError|The (operation|user) aborted/i
];
const EXTENSION = /\b(chrome|moz|safari(-web)?)-extension:\/\//;

export function isNoise(message: string, source: string): boolean {
	return NOISE.some((re) => re.test(message.trim())) || EXTENSION.test(source);
}

/**
 * A code file from an older deploy that is gone: the tab stayed open across a
 * release (each deploy renames its files). Not a bug; reloading fixes it.
 */
const STALE_BUILD = [/Failed to fetch dynamically imported module/i, /Importing a module script failed/i, /error loading dynamically imported module/i, /Unable to preload CSS/i];
export const isStaleBuild = (message: string) => STALE_BUILD.some((re) => re.test(message));

const RELOAD_KEY = 'goose-stale-reload';
/**
 * Reloads once so the tab picks up the new release. Returns false (report the
 * error instead) if it already reloaded within the last minute, so a file that
 * is really missing cannot cause a reload loop, or if storage is blocked.
 */
export function reloadForNewRelease(storage: Pick<Storage, 'getItem' | 'setItem'> | null, reload: () => void, now = Date.now()): boolean {
	try {
		if (!storage) return false;
		if (now - Number(storage.getItem(RELOAD_KEY) ?? 0) < 60_000) return false;
		storage.setItem(RELOAD_KEY, String(now));
	} catch {
		return false;
	}
	reload();
	return true;
}

let reloading = false;
/** True when the error is a stale file and the page is reloading for it (then don't report it) */
export function reloadIfStale(message: string): boolean {
	if (reloading) return isStaleBuild(message);
	if (typeof window === 'undefined' || !isStaleBuild(message)) return false;
	let storage: Storage | null = null;
	try {
		storage = sessionStorage;
	} catch {
		/* blocked */
	}
	reloading = reloadForNewRelease(storage, () => location.reload());
	return reloading;
}

let staleInstalled = false;
/** Call once in the browser (demo and live mode) */
export function installStaleBuildReload() {
	if (staleInstalled) return;
	staleInstalled = true;
	// Vite's own signal that a lazily loaded file failed
	addEventListener('vite:preloadError', (e) => {
		const payload = (e as Event & { payload?: unknown }).payload;
		if (reloadIfStale(describe(payload).message)) e.preventDefault();
	});
	addEventListener('unhandledrejection', (e) => {
		if (reloadIfStale(describe(e.reason).message)) e.preventDefault();
	});
}

/** Message, stack and source of anything thrown (Error, string, object) */
export function describe(value: unknown): { message: string; stack: string } {
	if (value instanceof Error) return { message: `${value.name}: ${value.message}`, stack: value.stack ?? '' };
	if (typeof value === 'string') return { message: value, stack: '' };
	try {
		return { message: JSON.stringify(value) ?? String(value), stack: '' };
	} catch {
		return { message: String(value), stack: '' };
	}
}

/** First "file:line:col" in a stack trace, if any */
export function sourceOf(stack: string): string {
	return stack.match(/(https?:\/\/[^\s)]+:\d+:\d+)/)?.[1] ?? '';
}

export interface ReporterOptions {
	/** Don't resend the same error within this many ms */
	quietMs?: number;
	/** Most reports one page load may send */
	max?: number;
	now?: () => number;
}

/** Filters noise and repeats, then hands each report to send (which must not throw) */
export function createReporter(send: (r: ErrorReport) => void, { quietMs = 60_000, max = 20, now = Date.now }: ReporterOptions = {}) {
	const lastSent = new Map<string, number>();
	let sent = 0;
	return (r: ErrorReport): boolean => {
		if (!r.message || isNoise(r.message, r.source)) return false;
		const key = `${r.app}|${r.kind}|${r.message}|${r.source}`;
		const at = now();
		const last = lastSent.get(key);
		if (sent >= max || (last !== undefined && at - last < quietMs)) return false;
		lastSent.set(key, at);
		sent++;
		send(r);
		return true;
	};
}

let report: ((r: ErrorReport) => boolean) | null = null;
let appOf: () => ErrorApp = () => 'buyer';

/** Reports an error caught somewhere other than the window handlers (e.g. SvelteKit's handleError) */
export function reportError(value: unknown, kind: ErrorKind = 'svelte') {
	const { message, stack } = describe(value);
	// A stale file reloads the page in demo mode too
	if (reloadIfStale(message) || !report) return;
	report({ app: appOf(), kind, message, stack, source: sourceOf(stack), url: location.href });
}

/** Starts listening; call once in the browser, live mode only */
export function installErrorLog(rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<unknown>, whichApp: () => ErrorApp, release: string) {
	if (report) return;
	appOf = whichApp;
	report = createReporter((r) => {
		if (!navigator.onLine) return;
		// Fire and forget: logging must never cause another error
		Promise.resolve(
			rpc('log_client_error', {
				p_app: r.app,
				p_kind: r.kind,
				p_message: r.message,
				p_stack: r.stack,
				p_source: r.source,
				p_url: r.url,
				p_user_agent: navigator.userAgent,
				p_release: release
			})
		).then(undefined, () => {});
	});
	addEventListener('error', (e) => {
		const { message, stack } = e.error ? describe(e.error) : { message: e.message, stack: '' };
		if (reloadIfStale(message)) return;
		const source = e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : sourceOf(stack);
		report?.({ app: appOf(), kind: 'error', message, stack, source, url: location.href });
	});
	addEventListener('unhandledrejection', (e) => {
		const { message, stack } = describe(e.reason);
		if (reloadIfStale(message)) return;
		report?.({ app: appOf(), kind: 'rejection', message, stack, source: sourceOf(stack), url: location.href });
	});
}
