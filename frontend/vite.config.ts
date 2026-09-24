/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) => filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// Static SPA for GitHub Pages. 404.html serves any unknown path so the app still boots there.
			adapter: adapter({ fallback: '404.html' }),
			// '' on a custom domain; '/<repo>' when served from <user>.github.io/<repo> (set by the deploy workflow)
			paths: { base: (process.env.BASE_PATH ?? '') as '' | `/${string}` }
		})
	],
	test: {
		include: ['src/**/*.test.ts'],
		// Worker threads, not child processes: spawning forks fails on low-memory Windows machines
		pool: 'threads'
	}
});
