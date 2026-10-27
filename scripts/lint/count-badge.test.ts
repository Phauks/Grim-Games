import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** `grim/count-badge` against the real config: worked-out numbers sit in a CountBadge. */
const root = fileURLToPath(new URL('../../', import.meta.url));
const eslint = new ESLint({ cwd: root });

async function problems(template: string) {
	const code = `<script lang="ts">
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';
	const items = [1, 2];
	const count = (n: number) => n;
	const seatCount = 8;
</script>

${template}
`;
	const [result] = await eslint.lintText(code, {
		filePath: 'src/lib/features/reference/CharacterTable.svelte'
	});
	return result.messages.filter((m) => m.ruleId === 'grim/count-badge').length;
}

describe('grim/count-badge', () => {
	it('reports a loose count', async () => {
		expect(await problems('<span class="count">{items.length}</span>')).toBe(1);
		expect(await problems('<span>{count(3)}</span>')).toBe(1);
		expect(await problems('<span>({seatCount})</span>')).toBe(1);
		expect(await problems('<span>{seatCount} of {items.length}</span>')).toBe(2);
	}, 60_000);

	it('allows a badge, a sentence, a table cell and a value under its label', async () => {
		expect(await problems('<CountBadge count={items.length} />')).toBe(0);
		expect(await problems('<p>{seatCount} seats around the table</p>')).toBe(0);
		expect(await problems('<table><tbody><tr><td>{items.length}</td></tr></tbody></table>')).toBe(
			0
		);
		expect(await problems('<dl><dt>Games</dt><dd>{count(4)}</dd></dl>')).toBe(0);
		expect(await problems('<div style:--count={items.length}></div>')).toBe(0);
	}, 60_000);
});
