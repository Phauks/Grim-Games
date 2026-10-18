import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** `grim/clearable-field` against the real config: text fields sit in a ClearableField. */
const root = fileURLToPath(new URL('../../', import.meta.url));
const eslint = new ESLint({ cwd: root });

async function problems(template: string) {
	const code = `<script lang="ts">
	import ClearableField from '#lib/ui/primitives/ClearableField.svelte';
	let text = $state('');
	let on = $state(false);
</script>

${template}
`;
	const [result] = await eslint.lintText(code, {
		filePath: 'src/lib/features/reference/ReferenceCard.svelte'
	});
	return result.messages.filter((m) => m.ruleId === 'grim/clearable-field').length;
}

describe('grim/clearable-field', () => {
	it('reports text fields without an X', async () => {
		expect(await problems('<input bind:value={text} />')).toBe(1);
		expect(await problems('<input type="search" bind:value={text} />')).toBe(1);
		expect(await problems('<label><input type="email" bind:value={text} /></label>')).toBe(1);
	}, 60_000);

	it('allows wrapped, read-only and non-text inputs', async () => {
		expect(
			await problems(
				'<ClearableField bind:value={text}><input type="search" bind:value={text} /></ClearableField>'
			)
		).toBe(0);
		expect(await problems('<input readonly value={text} />')).toBe(0);
		expect(await problems('<input type="checkbox" bind:checked={on} />')).toBe(0);
		expect(await problems('<textarea bind:value={text}></textarea>')).toBe(0);
	}, 60_000);
});
