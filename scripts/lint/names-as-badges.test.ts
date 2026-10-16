import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * `grim/names-as-badges` against the real config. The snippets are linted as if they were
 * an existing component, so its imports and the TypeScript project resolve.
 */
const root = fileURLToPath(new URL('../../', import.meta.url));
const eslint = new ESLint({ cwd: root });
const AT = 'src/lib/features/grimoire/ReminderMoveConfirm.svelte';

const head = `<script lang="ts">
	import type { Character } from '#lib/core/data/index.ts';
	import type { Reminder } from '#lib/core/model/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	interface Props { character: Character; reminder: Reminder; list: Character[] }
	let { character, reminder, list }: Props = $props();
	let open = $state(false);
</script>
`;

async function problems(template: string) {
	const [result] = await eslint.lintText(head + template, { filePath: AT });
	return result.messages
		.filter((m) => m.ruleId === 'grim/names-as-badges')
		.map((m) => `${m.line - head.split('\n').length + 1}:${m.messageId}`);
}

describe('grim/names-as-badges', () => {
	it('reports names written as text, in sentences, joined or passed to plain props', async () => {
		expect(
			await problems(`<p>{reminder.label}</p>
<p>{character.name}</p>
<p>{list.map((c) => c.name).join(', ')}</p>
<Dialog bind:open title={character.name}>x</Dialog>
<p>{'Is the ' + character.name}</p>`)
		).toEqual(['1:plain', '2:plain', '3:plain', '4:plain', '5:plain']);
	}, 60_000);

	it('allows badges, chips and plain-text attributes', async () => {
		expect(
			await problems(`<CharacterBadge characterId={character.id} text={character.name} inline />
<ReminderToken label={reminder.label} />
<ReminderToken label={\`\${reminder.label} (global)\`} />
<span aria-label={\`\${character.name} token\`} title={reminder.label}></span>
<IconButton icon="close" label={\`Remove \${reminder.label}\`} />
<input value={character.name} />`)
		).toEqual([]);
	}, 60_000);
});
