import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * `grim/character-display` against the real config. The snippets are linted as if they were
 * an existing component, so its imports and the TypeScript project resolve.
 */
const root = fileURLToPath(new URL('../../', import.meta.url));
const eslint = new ESLint({ cwd: root });
const AT = 'src/lib/features/grimoire/BankReminderDialog.svelte';

const head = `<script lang="ts">
	import type { Character } from '#lib/core/data/index.ts';
	import CharacterRow from '#lib/features/characters/CharacterRow.svelte';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import { iconUrl } from '#lib/features/characters/icon-url.ts';
	interface Props { character: Character; vote: { ability: string } }
	let { character, vote }: Props = $props();
	const haystack = character.ability.toLowerCase();
</script>
`;

async function problems(template: string) {
	const [result] = await eslint.lintText(head + template, { filePath: AT });
	return result.messages
		.filter((m) => m.ruleId === 'grim/character-display')
		.map((m) => `${m.line - head.split('\n').length + 1}:${m.messageId}`);
}

describe('grim/character-display', () => {
	// Trevor, 2026-10-30: characters and their abilities show the way the Script tab does.
	it('reports an ability or icon drawn by hand', async () => {
		expect(
			await problems(`<p>{character.ability}</p>
<GlossaryText text={character.ability} />
<img src={iconUrl(character)} alt="" />`)
		).toEqual(['1:ability', '2:ability', '3:icon']);
	}, 60_000);

	it('allows CharacterRow, script code and other ability fields', async () => {
		expect(
			await problems(`<CharacterRow {character} info>
	{#snippet ability()}<GlossaryText text={character.ability} />{/snippet}
</CharacterRow>
<p>{vote.ability}</p>`)
		).toEqual([]);
	}, 60_000);

	it('keeps CharacterSummary to the character page', async () => {
		const [result] = await eslint.lintText(
			`<script lang="ts">import CharacterSummary from '#lib/features/characters/CharacterSummary.svelte';</script>\n<CharacterSummary />`,
			{ filePath: AT }
		);
		expect(
			result.messages.filter((m) => m.ruleId === 'grim/character-display').map((m) => m.messageId)
		).toEqual(['summary']);
	}, 60_000);
});
