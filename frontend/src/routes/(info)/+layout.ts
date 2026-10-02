// The information pages are real HTML for search engines: rendered at build time,
// one folder each (/about/ -> about/index.html), unlike the app shell at "/".
export const ssr = true;
export const prerender = true;
export const trailingSlash = 'always';
