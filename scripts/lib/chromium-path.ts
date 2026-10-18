import { existsSync } from 'node:fs';

/**
 * The Chromium for Playwright and Vitest browser tests: PLAYWRIGHT_CHROMIUM_PATH when set,
 * else the cloud sandboxes' preinstalled one, else Playwright's own download.
 */
export function chromiumPath(): string | undefined {
	if (process.env.PLAYWRIGHT_CHROMIUM_PATH) return process.env.PLAYWRIGHT_CHROMIUM_PATH;
	const sandbox = '/opt/pw-browsers/chromium';
	return existsSync(sandbox) ? sandbox : undefined;
}
