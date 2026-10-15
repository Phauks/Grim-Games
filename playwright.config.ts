import { defineConfig, devices } from '@playwright/test';

// Touch-first (ROADMAP.md Phase 0): every e2e test runs on an emulated phone and tablet.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
const PORT = Number(process.env.E2E_PORT) || 8787;

export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.e2e.ts',
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
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
		command: `npm run build && npx wrangler dev --port ${PORT} --ip 127.0.0.1`,
		url: `http://localhost:${PORT}/api/health`,
		reuseExistingServer: !process.env.CI,
		timeout: 180_000
	}
});
