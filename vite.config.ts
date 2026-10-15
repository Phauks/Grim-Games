import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import Icons from 'unplugin-icons/vite';
import { readBuildInfo } from './build-info.ts';

// Lets sandboxes with a preinstalled Chromium skip `playwright install`.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

const rulesTests = ['src/lib/core/abilities/**/*.test.ts', 'src/lib/core/jinxes/**/*.test.ts'];

export default defineConfig({
	define: {
		__BUILD_INFO__: JSON.stringify(readBuildInfo())
	},
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// Prerendered SPA served as Workers static assets; unknown paths fall back to
			// index.html via `not_found_handling` in wrangler.jsonc.
			adapter: adapter({ fallback: 'index.html' })
		}),
		// Compiles `~icons/<set>/<name>` imports into Svelte components at build time, so icons
		// are bundled and work offline (src/lib/ui/icons, scripts/generate-icons.ts).
		Icons({ compiler: 'svelte' })
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright({ launchOptions: { executablePath } }),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}', 'scripts/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}', ...rulesTests]
				}
			},

			{
				// The per-character and per-jinx rules tests (04-architecture.md §10): over 300 small
				// files of pure core tests, run in node without per-file isolation, which keeps them
				// to a few seconds instead of ~25. They must not use vi.mock or leave module state.
				extends: './vite.config.ts',
				test: {
					name: 'rules',
					environment: 'node',
					include: rulesTests,
					isolate: false
				}
			}
		]
	}
});
