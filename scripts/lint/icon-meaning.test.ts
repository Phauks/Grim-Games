import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** `grim/icon-meaning` against the real config: one catalogue icon per meaning. */
const root = fileURLToPath(new URL('../../', import.meta.url));
const eslint = new ESLint({ cwd: root });

async function problems(
	template: string,
	filePath = 'src/lib/features/grimoire/ReminderBank.svelte'
) {
	const code = `<script lang="ts">
	import Button from '#lib/ui/primitives/Button.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	const go = () => {};
</script>

${template}
`;
	const [result] = await eslint.lintText(code, { filePath });
	return result.messages.filter((m) => m.ruleId === 'grim/icon-meaning').length;
}

async function scriptProblems(code: string, filePath = 'src/lib/features/shell/nav.ts') {
	const [result] = await eslint.lintText(code, { filePath });
	return result.messages.filter((m) => m.ruleId === 'grim/icon-meaning').length;
}

describe('grim/icon-meaning', () => {
	it('reports an edit button without the pencil', async () => {
		// The infinite reminder's edit button was the scratch pad's pen (Trevor, 2026-10-23).
		expect(await problems('<IconButton icon="pen" label="Edit token" onclick={go} />')).toBe(2);
		expect(
			await problems(
				`<IconButton icon="buildCharacter" label={t('library.editCharacter')} onclick={go} />`
			)
		).toBe(1);
		expect(await problems('<Button icon="notes" onclick={go}>Rename</Button>')).toBe(1);
		expect(
			await problems('<button type="button" onclick={go}><Icon name="add" /> Edit seats</button>')
		).toBe(1);
	}, 60_000);

	it('allows the pencil, and buttons that say something else', async () => {
		expect(await problems('<IconButton icon="edit" label="Edit token" onclick={go} />')).toBe(0);
		expect(
			await problems(`<IconButton icon="edit" label={t('library.editCharacter')} onclick={go} />`)
		).toBe(0);
		expect(await problems('<IconButton icon="add" label="Add a seat" onclick={go} />')).toBe(0);
		expect(await problems('<Button onclick={go}>Edit</Button>')).toBe(0);
	}, 60_000);

	it('keeps a tool’s icon in the files that own it', async () => {
		expect(await problems('<Icon name="pen" />')).toBe(1);
		expect(await problems('<Icon name="pen" />', 'src/lib/ui/scratch/ScratchPad.svelte')).toBe(0);
		expect(await scriptProblems("export const item = { icon: 'eraser' };\n")).toBe(1);
		expect(await scriptProblems("export const item = { icon: 'notes' };\n")).toBe(0);
	}, 60_000);

	it('reports icon packages outside the icon module', async () => {
		expect(
			await scriptProblems("import Pencil from '~icons/ph/pen-nib';\nexport { Pencil };\n")
		).toBe(1);
		expect(
			await scriptProblems(
				"import Pencil from '~icons/ph/pen-nib';\nexport { Pencil };\n",
				'src/lib/ui/icons/sets.svelte.ts'
			)
		).toBe(0);
	}, 60_000);
});
