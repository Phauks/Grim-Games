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
	import type { Reminder, Seat } from '#lib/core/model/index.ts';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { intl, t } from '#lib/i18n/locale.svelte.ts';
	interface Props { character: Character; reminder: Reminder; list: Character[]; seat: Seat }
	let { character, reminder, list, seat }: Props = $props();
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
<p>{'Is the ' + character.name}</p>
<p>{t('common.seat', { number: character.name })}</p>
<p>{intl.list(list.map((c) => c.name))}</p>`)
		).toEqual(['1:plain', '2:plain', '3:plain', '4:plain', '5:plain', '6:plain', '7:plain']);
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

	// Trevor, 2026-10-24: "wherever we invoke a player name, we should use the player name
	// badge that is on the grim".
	it('reports player names as text and allows them in PlayerBadge or a badge prop', async () => {
		expect(
			await problems(`<p>{seat.playerName}</p>
<p>{\`Note: \${seat.playerName ?? 'Seat 1'}\`}</p>
<PlayerBadge name={seat.playerName ?? 'Seat 1'} />
<CharacterBadge characterId={character.id} playerName={seat.playerName} />
<span aria-label={\`Notes for \${seat.playerName}\`}></span>`)
		).toEqual(['1:plain', '2:plain']);
	}, 60_000);
});
