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
		// REPORTS_ADMIN_KEY: a test key, so the /reports inbox can be read (worker/reports.ts).
		// ADMINS_TRUST_PREVIEW_SIGN_IN: admin accounts count although local sign-in shows its code.
		command: `npm run build && npx wrangler dev --port ${PORT} --ip 127.0.0.1 --var SHARE_LIMITS:off --var REPORTS_ADMIN_KEY:e2e-admin-key --var ADMINS_TRUST_PREVIEW_SIGN_IN:on`,
		url: `http://localhost:${PORT}/api/health`,
		reuseExistingServer: !process.env.CI,
		timeout: 180_000
	}
});
