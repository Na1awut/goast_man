// Client-rendered PWA shell: all state lives in the browser (localStorage + runes),
// so SSR would only render the splash screen.
export const ssr = false;
// Emit the empty shell as index.html for static hosting
export const prerender = true;
