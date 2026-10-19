import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import Icons from 'unplugin-icons/vite';
import type { Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { readBuildInfo, readCommits } from './build-info.ts';
import { chromiumPath } from './scripts/lib/chromium-path.ts';

// Lets sandboxes with a preinstalled Chromium skip `playwright install`.
const executablePath = chromiumPath();

const buildInfo = readBuildInfo();
// One line naming the build, in the same format as describeBuild() in
// src/lib/features/about/report-issue.ts. It is also SvelteKit's version name, so app.html's
// boot-failure screen can show it (%sveltekit.version%) without the app bundle; the service
// worker's cache name and `version` from $app/env change with every build, as before.
const buildLine = `v${buildInfo.version} · ${buildInfo.commit.slice(0, 7)} · ${buildInfo.branch} · ${buildInfo.channel} · built ${buildInfo.builtAt}`;

/**
 * Publishes `/build-notes.json` with the build's recent commits, which an older build's
 * update prompt fetches to show what changed (src/lib/features/about/update-notes.ts).
 * It is not in the service worker's precache, so the prompt always reaches the network.
 */
function buildNotes(): Plugin {
	let ssr = false;
	return {
		name: 'grim-games-build-notes',
		apply: 'build',
		configResolved(config) {
			ssr = !!config.build.ssr;
		},
		generateBundle() {
			if (ssr) return;
			this.emitFile({
				type: 'asset',
				fileName: 'build-notes.json',
				source: JSON.stringify({ commit: buildInfo.commit, commits: readCommits() })
			});
		}
	};
}

/**
 * Publishes `/precache-sizes.json`: the byte size of every file the client build and `static/`
 * hold, so a new build's service worker can tell open pages "2.4 MB of 6.1 MB" while it stores
 * itself (src/lib/features/about/update-progress.ts; Trevor, 2026-10-18). Only the client
 * build has `_app/immutable/` files, so the server and service worker builds write nothing.
 */
function precacheSizes(): Plugin {
	let staticDir = '';
	return {
		name: 'grim-games-precache-sizes',
		apply: 'build',
		configResolved(config) {
			staticDir = path.resolve(config.root, 'static');
		},
		// After writing, so the sizes are of the files as served.
		writeBundle(options, bundle) {
			const files = Object.keys(bundle);
			if (!options.dir || !files.some((file) => file.startsWith('_app/immutable/'))) return;
			const sizes: Record<string, number> = {};
			for (const file of files) {
				const full = path.join(options.dir, file);
				if (fs.existsSync(full)) sizes[`/${file}`] = fs.statSync(full).size;
			}
			if (fs.existsSync(staticDir))
				for (const entry of fs.readdirSync(staticDir, { recursive: true, withFileTypes: true }))
					if (entry.isFile()) {
						const full = path.join(entry.parentPath, entry.name);
						sizes[`/${path.relative(staticDir, full).split(path.sep).join('/')}`] =
							fs.statSync(full).size;
					}
			fs.writeFileSync(path.join(options.dir, 'precache-sizes.json'), JSON.stringify(sizes));
		}
	};
}

const rulesTests = ['src/lib/core/abilities/**/*.test.ts', 'src/lib/core/jinxes/**/*.test.ts'];

export default defineConfig({
	define: {
		__BUILD_INFO__: JSON.stringify(buildInfo)
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
			adapter: adapter({ fallback: 'index.html' }),
			version: { name: buildLine }
		}),
		// Compiles `~icons/<set>/<name>` imports into Svelte components at build time, so icons
		// are bundled and work offline (src/lib/ui/icons, scripts/generate-icons.ts).
		Icons({ compiler: 'svelte' }),
		buildNotes(),
		precacheSizes()
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
