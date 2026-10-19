import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** `grim/dropdown-choice` against the real config: one-of-a-few choices are a Select. */
const root = fileURLToPath(new URL('../../', import.meta.url));
const eslint = new ESLint({ cwd: root });

async function problems(template: string) {
	const code = `<script lang="ts">
	import ChoiceGroup from '#lib/ui/primitives/ChoiceGroup.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	let tool = $state('pen');
	const set = (v: string) => (tool = v);
</script>

${template}
`;
	const [result] = await eslint.lintText(code, {
		filePath: 'src/lib/features/reference/CharacterTable.svelte'
	});
	return result.messages.filter((m) => m.ruleId === 'grim/dropdown-choice').length;
}

const options = "[{ value: 'pen', label: 'Pen' }, { value: 'eraser', label: 'Eraser' }]";

describe('grim/dropdown-choice', () => {
	it('reports toggle buttons and hand-built radio groups', async () => {
		expect(
			await problems(
				`<div><button type="button" aria-pressed={tool === 'pen'} onclick={() => set('pen')}>Pen</button><button type="button" aria-pressed={tool === 'eraser'} onclick={() => set('eraser')}>Eraser</button></div>`
			)
		).toBe(1);
		expect(
			await problems(
				`<div role="radiogroup" aria-label="Tool"><button type="button" role="radio" aria-checked={tool === 'pen'}>Pen</button></div>`
			)
		).toBe(2);
		expect(
			await problems(
				`<ChoiceGroup label="Tool" value={tool} options={${options}} onChange={set} />`
			)
		).toBe(1);
	}, 60_000);

	it('allows a Select and single toggles', async () => {
		expect(
			await problems(`<Select label="Tool" value={tool} options={${options}} onChange={set} />`)
		).toBe(0);
		expect(await problems(`<button type="button" aria-pressed={tool === 'pen'}>Pen</button>`)).toBe(
			0
		);
	}, 60_000);
});
