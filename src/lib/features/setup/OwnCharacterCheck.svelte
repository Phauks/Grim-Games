<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import { homebrewJson } from '#lib/core/data/script.ts';
	import { editedCharacter } from '#lib/core/rules/character-builder.ts';
	import { scriptWithCharacter } from '#lib/core/rules/setup/bag-characters.ts';
	import { checkKey, customCheck } from '#lib/core/rules/setup/custom-check.ts';
	import type { HomebrewEntry } from '#lib/core/rules/setup/script-builder.ts';
	import CharacterBuilderDialog from '#lib/features/character-builder/CharacterBuilderDialog.svelte';
	import type { CharacterFormTab } from '#lib/features/character-builder/draft.ts';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import CustomCheckSheet from './CustomCheckSheet.svelte';
	import { checkedCharacters } from './checked-characters.svelte.ts';
	import type { SetupGamePort } from './game-port.ts';

	/**
	 * Checking one of the script's own characters before the game (M85): its check sheet, and
	 * the Character builder its pencils open. A change goes into this game's script, as the Bag
	 * draw's Script characters row changes it; closing the builder goes back to the check.
	 */
	interface Props {
		open?: boolean;
		characterId: CharacterId | undefined;
		port: SetupGamePort;
		/** Everything in play, as the board would run the night. */
		inPlay: readonly Character[];
		players: number;
	}

	let { open = $bindable(false), characterId, port, inPlay, players }: Props = $props();

	let builderOpen = $state(false);
	let builderTab = $state<CharacterFormTab>('character');
	const data = $derived(officialData.current);
	const game = $derived(port.game);
	const character = $derived(characterId ? port.lookup?.get(characterId) : undefined);
	const entry = $derived(character ? homebrewJson(character) : undefined);
	const check = $derived(
		character && data && game
			? customCheck(character, {
					sheet: data.nightSheet,
					official: data.byId,
					inPlay,
					players,
					script: game.script
				})
			: undefined
	);

	/** The Storyteller's change to the character: this game's script. */
	function change(changed: HomebrewEntry) {
		if (!game || !character) return;
		const next = editedCharacter(character, changed);
		const result = next
			? port.dispatch({ type: 'ChangeScript', script: scriptWithCharacter(game.script, next) })
			: undefined;
		if (!result?.ok)
			reportError(new Error(result ? result.error.message : t('setup.ownCheck.cantRead')), {
				area: 'setup'
			});
	}

	let builderWasOpen = false;
	$effect(() => {
		if (builderWasOpen && !builderOpen) open = true;
		builderWasOpen = builderOpen;
	});
</script>

<CustomCheckSheet
	bind:open
	{character}
	{check}
	checked={character ? checkedCharacters.has(checkKey(character)) : false}
	onEdit={(tab) => {
		builderTab = tab;
		open = false;
		builderOpen = true;
	}}
	onChecked={() => {
		if (character) checkedCharacters.set(checkKey(character), true);
	}}
/>
<CharacterBuilderDialog bind:open={builderOpen} {entry} tab={builderTab} onentry={change} />
