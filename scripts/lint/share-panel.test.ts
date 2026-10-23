import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** `grim/share-panel` against the real config: only the share screen calls the share sheet. */
const root = fileURLToPath(new URL('../../', import.meta.url));
const eslint = new ESLint({ cwd: root });

async function problems(code: string, filePath = 'src/lib/features/history/RecapPage.svelte') {
	const [result] = await eslint.lintText(`<script lang="ts">\n${code}\n</script>\n`, { filePath });
	return result.messages.filter((m) => m.ruleId === 'grim/share-panel').length;
}

describe('grim/share-panel', () => {
	it('reports the share sheet called outside the share screen', async () => {
		expect(await problems(`void navigator.share({ url: 'https://example.com' });`)).toBe(1);
		expect(await problems(`const ok = navigator.canShare?.({ files: [] });`)).toBe(1);
	}, 60_000);

	it('allows the share screen itself and other navigator calls', async () => {
		expect(
			await problems(
				`void navigator.share({ url: 'https://example.com' });`,
				'src/lib/ui/share/SharePanel.svelte'
			)
		).toBe(0);
		expect(await problems(`const lang = navigator.language;`)).toBe(0);
	}, 60_000);
});
