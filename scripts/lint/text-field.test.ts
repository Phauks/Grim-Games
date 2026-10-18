import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** `grim/text-field` against the real config: labelled text fields are the shared TextField. */
const root = fileURLToPath(new URL('../../', import.meta.url));
const eslint = new ESLint({ cwd: root });

async function problems(template: string) {
	const code = `<script lang="ts">
	import ClearableField from '#lib/ui/primitives/ClearableField.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	let text = $state('');
	let on = $state(false);
</script>

${template}
`;
	const [result] = await eslint.lintText(code, {
		filePath: 'src/lib/features/character-builder/SavedCharacterList.svelte'
	});
	return result.messages.filter((m) => m.ruleId === 'grim/text-field').length;
}

describe('grim/text-field', () => {
	it('reports hand-built labelled text fields', async () => {
		expect(
			await problems(
				'<label><span>Name</span><ClearableField bind:value={text}><input bind:value={text} /></ClearableField></label>'
			)
		).toBe(1);
		expect(await problems('<label>Notes <textarea bind:value={text}></textarea></label>')).toBe(1);
	}, 60_000);

	it('allows TextField and labelled checkboxes', async () => {
		expect(await problems('<TextField label="Name" bind:value={text} />')).toBe(0);
		expect(await problems('<label><input type="checkbox" bind:checked={on} /> On</label>')).toBe(0);
	}, 60_000);
});
