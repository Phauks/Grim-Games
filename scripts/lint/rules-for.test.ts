import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** `grim/rules-for` against the real config: game rules read rules through rulesFor. */
const root = fileURLToPath(new URL('../../', import.meta.url));
const eslint = new ESLint({ cwd: root });

async function problems(code: string, filePath: string) {
	const [result] = await eslint.lintText(code, { filePath });
	return result.messages.filter((m) => m.ruleId === 'grim/rules-for').length;
}

describe('grim/rules-for', () => {
	it('reports a static rules reader imported by game rules or the engine', async () => {
		const code = `import { rulesOf, rulesIn } from '#lib/core/data/rules/index.ts';\nexport const r = [rulesOf, rulesIn];\n`;
		expect(await problems(code, 'src/lib/core/rules/protection.ts')).toBe(2);
		expect(await problems(code, 'src/lib/core/engine/decide/votes.ts')).toBe(2);
	}, 60_000);

	it('allows rulesFor, tests, and readers outside a game', async () => {
		expect(
			await problems(
				`import { rulesFor } from '#lib/core/rules/rules-for.ts';\nexport const r = rulesFor;\n`,
				'src/lib/core/rules/protection.ts'
			)
		).toBe(0);
		const code = `import { rulesOf } from '#lib/core/data/rules/index.ts';\nexport const r = rulesOf;\n`;
		expect(await problems(code, 'src/lib/core/rules/ability.test.ts')).toBe(0);
		expect(await problems(code, 'src/lib/core/rules/night-order.ts')).toBe(0);
	}, 60_000);
});
