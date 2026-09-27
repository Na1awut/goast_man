import type { HandleClientError } from '@sveltejs/kit';
import { reportError } from '$lib/errorlog';

// Errors SvelteKit catches itself (while loading or rendering a page) never reach
// window.onerror, so they are reported here. Unknown paths (404) are not bugs.
export const handleError: HandleClientError = ({ error, status }) => {
	if (status !== 404) reportError(error);
};
