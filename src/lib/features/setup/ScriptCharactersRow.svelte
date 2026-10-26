<script lang="ts">
	import type { Character } from '#lib/core/data/index.ts';
	import { bagRoleOf, scriptWithBagRole, type BagRole } from '#lib/core/rules/bag-characters.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import SettingRow from '#lib/ui/settings/SettingRow.svelte';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import type { SetupGamePort } from './game-port.ts';

	/**
	 * A custom script's parts the Storyteller can't otherwise reach (Trevor, backlog L25): how
	 * each of its own characters goes in the bag. A row of the Bag draw sheet, shown only when
	 * the script has characters of its own (Trevor, 2026-10-26: no ⋯ on the title row). Some scripts leave out TPI's
	 * `special` data, so a character that thinks it is another (Blood on Hope's Peak's
	 * Ultimate Imposter, like the Drunk) was dealt as itself. Changes this game's script.
	 */
	let { port }: { port: SetupGamePort } = $props();
	let open = $state(false);

	const SEATED = new Set(['townsfolk', 'outsider', 'minion', 'demon']);
	const own = $derived(
		(port.game?.script.entries ?? []).flatMap((e): Character[] =>
			e.kind === 'custom' && SEATED.has(e.character.type) ? [e.character] : []
		)
	);
	const roles = $derived(
		(['dealt', 'replaces', 'not-dealt'] as const).map((r) => ({
			value: r,
			label: t(`setup.bagRole.${r}`)
		}))
	);

	function change(id: string, role: BagRole) {
		const game = port.game;
		if (!game) return;
		const result = port.dispatch({
			type: 'ChangeScript',
			script: scriptWithBagRole(game.script, id, role)
		});
		if (!result.ok) reportError(new Error(result.error.message), { area: 'setup' });
	}
</script>

{#if own.length > 0}
	<SettingRow label={t('setup.scriptCharacters')}>
		{#snippet control()}
			<IconButton icon="edit" label={t('setup.scriptCharacters')} onclick={() => (open = true)} />
		{/snippet}
	</SettingRow>
{/if}
<Dialog bind:open title={t('setup.scriptCharacters')}>
	<div class="roles" data-testid="script-characters">
		{#each own as character (character.id)}
			{@const labelId = `bag-role-${character.id}`}
			<div class="row">
				<span id={labelId}
					><CharacterBadge characterId={character.id} {character} interactive={false} /></span
				>
				<Select
					label={t('setup.scriptCharacters')}
					labelledBy={labelId}
					value={bagRoleOf(character)}
					options={roles}
					onChange={(role) => change(character.id, role)}
				/>
			</div>
		{/each}
	</div>
</Dialog>

<style>
	.roles {
		display: grid;
		gap: var(--space-2);
	}
	.row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
		align-items: center;
		gap: var(--space-2);
	}
</style>
