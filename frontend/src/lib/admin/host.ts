// Where the team console opens. goastman.dev serves it at "/"; any other host
// except the public buyer site may open it at /admin (local dev, Vercel previews).
// This only decides what the page shows: the database checks the team role on
// every request, so reaching the page grants nothing.

export const CONSOLE_HOSTS = ['goastman.dev', 'www.goastman.dev'];
export const PUBLIC_HOSTS = ['goose-man.tech', 'www.goose-man.tech'];

/** The console is this host's home page */
export function isConsoleHost(hostname: string): boolean {
	return CONSOLE_HOSTS.includes(hostname.toLowerCase());
}

/** /admin may open the console here (never on the public buyer site) */
export function allowsAdminPath(hostname: string): boolean {
	return !PUBLIC_HOSTS.includes(hostname.toLowerCase());
}
