import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** `grim/close-button` against the real config: every X outside the primitives is IconButton. */
const root = fileURLToPath(new URL('../../', import.meta.url));
const eslint = new ESLint({ cwd: root });

async function problems(template: string) {
	const code = `<script lang="ts">
	import Icon from '#lib/ui/icons/Icon.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	const go = () => {};
</script>

${template}
`;
	const [result] = await eslint.lintText(code, {
		filePath: 'src/lib/features/show/ShowToPlayer.svelte'
	});
	return result.messages.filter((m) => m.ruleId === 'grim/close-button').length;
}

describe('grim/close-button', () => {
	it('reports a hand-rolled X', async () => {
		expect(
			await problems(
				'<button type="button" aria-label="Close" onclick={go}><Icon name="close" /></button>'
			)
		).toBe(1);
		expect(
			await problems(
				'<button type="button" aria-label="Close" onclick={go}><span><Icon name="close" /></span></button>'
			)
		).toBe(1);
	}, 60_000);

	it('allows IconButton and other icons', async () => {
		expect(await problems('<IconButton icon="close" label="Close" onclick={go} />')).toBe(0);
		expect(
			await problems(
				'<button type="button" aria-label="Back" onclick={go}><Icon name="back" /></button>'
			)
		).toBe(0);
	}, 60_000);
});
