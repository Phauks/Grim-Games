import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** `grim/script-name` against the real config: only ScriptName and the logo's owners draw it. */
const root = fileURLToPath(new URL('../../', import.meta.url));
const eslint = new ESLint({ cwd: root });

async function problems(code: string, filePath = 'src/lib/features/room/YourGames.svelte') {
	const [result] = await eslint.lintText(`<script lang="ts">\n${code}\n</script>\n`, { filePath });
	return result.messages.filter((m) => m.ruleId === 'grim/script-name').length;
}

describe('grim/script-name', () => {
	it('reports the logo or the name mark imported outside their owners', async () => {
		expect(
			await problems(`import ScriptLogo from '#lib/features/scripts/ScriptLogo.svelte';`)
		).toBe(1);
		expect(
			await problems(
				`import ScriptNameMark from './ScriptNameMark.svelte';`,
				'src/lib/features/scripts/ScriptPicker.svelte'
			)
		).toBe(1);
	}, 60_000);

	it('allows ScriptName, the owners, and ScriptName itself', async () => {
		expect(
			await problems(`import ScriptName from '#lib/features/scripts/ScriptName.svelte';`)
		).toBe(0);
		expect(
			await problems(
				`import ScriptLogo from './ScriptLogo.svelte';`,
				'src/lib/features/scripts/ScriptName.svelte'
			)
		).toBe(0);
		expect(
			await problems(
				`import ScriptNameMark from './ScriptNameMark.svelte';`,
				'src/lib/features/scripts/BoardLogo.svelte'
			)
		).toBe(0);
	}, 60_000);
});
