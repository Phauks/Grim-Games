import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** `grim/caret-section` against the real config: anything with a caret is the shared Collapsible. */
const root = fileURLToPath(new URL('../../', import.meta.url));
const eslint = new ESLint({ cwd: root });

async function problems(template: string) {
	const code = `<script lang="ts">
	import Icon from '#lib/ui/icons/Icon.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	let open = $state(false);
</script>

${template}
`;
	const [result] = await eslint.lintText(code, {
		filePath: 'src/lib/features/reference/CharacterTable.svelte'
	});
	return result.messages.filter((m) => m.ruleId === 'grim/caret-section').length;
}

describe('grim/caret-section', () => {
	it('reports a hand-made caret toggle', async () => {
		expect(
			await problems(
				'<button type="button" aria-expanded={open} onclick={() => (open = !open)}><Icon name="expand" />More</button>'
			)
		).toBe(1);
		expect(
			await problems(
				'<div aria-expanded={open}><span class="caret"><Icon name="expand" /></span></div>'
			)
		).toBe(1);
	}, 60_000);

	it('allows Collapsible, a drop-down caret and a caret that opens nothing', async () => {
		expect(await problems('<Collapsible title="Jinxes">None</Collapsible>')).toBe(0);
		expect(
			await problems(
				'<button type="button" aria-haspopup="listbox" aria-expanded={open}><Icon name="expand" /></button>'
			)
		).toBe(0);
		expect(await problems('<IconButton icon="expand" label="Move down" />')).toBe(0);
	}, 60_000);
});
