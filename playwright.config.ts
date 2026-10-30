import { defineConfig, devices } from '@playwright/test';
import { chromiumPath } from './scripts/lib/chromium-path.ts';

// Touch-first (ROADMAP.md Phase 0): every e2e test runs on an emulated phone and tablet.
const executablePath = chromiumPath();
const PORT = Number(process.env.E2E_PORT) || 8787;

export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.e2e.ts',
	// Tests, not files, are spread over workers and CI shards: grimoire.e2e.ts alone is
	// several minutes of tests, which kept one worker busy while the others sat idle.
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	// The JSON report feeds the flaky-test list in the CI job summary (scripts/flaky-summary.ts).
	reporter: process.env.CI
		? [
				['github'],
				['html', { open: 'never' }],
				['json', { outputFile: 'test-results/results.json' }]
			]
		: 'list',
	use: {
		baseURL: `http://localhost:${PORT}`,
		launchOptions: { executablePath },
		trace: 'retain-on-failure'
	},
	projects: [
		// Chromium emulations of an iPhone and an Android tablet keep CI to one browser.
		{ name: 'phone', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
		{ name: 'tablet', use: { ...devices['Galaxy Tab S4'], browserName: 'chromium' } }
	],
	// Runs the real Worker (static assets + /api + Durable Object) under workerd.
	webServer: {
		// SHARE_LIMITS:off: every test shares one address, so a full run would trip the
		// share-code rate limits (worker/share.ts) and make share tests flaky.
		// OTHER_SITES:off: the Worker never asks BotC Scripts and the other script sites, which
		// refuse CI machines; tests that need their answers fake them with page.route.
		// ADMIN_EMAILS: admins from the start, as Trevor is in Cloudflare (e2e/reports.e2e.ts).
		// ADMINS_TRUST_PREVIEW_SIGN_IN: admin accounts count although local sign-in shows its code.
		// quiet-server-log: leaves out workerd's report of each browser that hung up mid-reply.
		// Both configs: the app's DATA binding needs the shared data Worker running beside it.
		command: `npm run build && npx wrangler dev -c wrangler.jsonc -c wrangler.data.jsonc --port ${PORT} --ip 127.0.0.1 --var SHARE_LIMITS:off --var OTHER_SITES:off --var ADMIN_EMAILS:phone-admin-1@example.com,phone-admin-2@example.com,phone-admin-3@example.com,phone-admin-4@example.com,tablet-admin-1@example.com,tablet-admin-2@example.com,tablet-admin-3@example.com,tablet-admin-4@example.com --var ADMINS_TRUST_PREVIEW_SIGN_IN:on 2>&1 | node scripts/quiet-server-log.ts --run`,
		url: `http://localhost:${PORT}/api/health`,
		reuseExistingServer: !process.env.CI,
		timeout: 180_000
	}
});
