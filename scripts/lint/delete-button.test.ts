import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** `grim/delete-button` against the real config: deletes, removes and clears are the red trash can. */
const root = fileURLToPath(new URL('../../', import.meta.url));
const eslint = new ESLint({ cwd: root });

async function problems(template: string) {
	const code = `<script lang="ts">
	import Button from '#lib/ui/primitives/Button.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	const go = () => {};
</script>

${template}
`;
	const [result] = await eslint.lintText(code, {
		filePath: 'src/lib/features/reference/ReferenceCard.svelte'
	});
	return result.messages.filter((m) => m.ruleId === 'grim/delete-button').length;
}

describe('grim/delete-button', () => {
	it('reports text and icon deletes', async () => {
		expect(await problems('<Button onclick={go}>Delete</Button>')).toBe(1);
		expect(await problems('<Button onclick={go}>Remove seat</Button>')).toBe(1);
		expect(await problems('<button type="button" onclick={go}>Clear</button>')).toBe(1);
		expect(await problems(`<Button onclick={go}>{t('reports.delete')}</Button>`)).toBe(1);
		expect(await problems('<IconButton icon="remove" label="Bin it" onclick={go} />')).toBe(1);
	}, 60_000);

	it('allows the trash can and other actions', async () => {
		expect(await problems('<DeleteButton label="Delete note" onclick={go} />')).toBe(0);
		expect(await problems('<IconButton icon="close" label="Clear filters" onclick={go} />')).toBe(
			0
		);
		expect(await problems('<Button onclick={go}>Confirm</Button>')).toBe(0);
		expect(await problems('<Button onclick={go}>Removed list</Button>')).toBe(0);
	}, 60_000);
});
