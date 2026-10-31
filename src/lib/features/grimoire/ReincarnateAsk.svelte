<script lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import { charactersInPlay, trueCharacter, type SeatId } from '#lib/core/model/index.ts';
	import { demonHeirs } from '#lib/core/rules/index.ts';
	import { seatName } from '#lib/features/game/seat-label.ts';
	import CharacterPicker from './CharacterPicker.svelte';
	import NewDemonDialog from './NewDemonDialog.svelte';
	import { recommendedTravellers } from './board.ts';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * A player just marked dead who is reborn as a Traveller (the Hindu's first four deaths,
	 * https://wiki.bloodontheclocktower.com/Hindu): the Storyteller picks the Traveller, the
	 * script's recommended ones first. Picking brings the player back alive with their
	 * alignment; closing leaves the death as marked. A Demon is offered the rebirth only when
	 * the game plays with the Hindu's optional rule (chosen at the start): picking a Traveller
	 * then asks which living Minion becomes that Demon; closing leaves the Demon dead, so good
	 * wins. Rules: `reincarnatedBy` and `demonHeirs` in core.
	 */
	interface Props {
		grimoire: Grimoire;
	}

	let { grimoire }: Props = $props();

	const ask = $derived(grimoire.reincarnateAsk);
	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	// eslint-disable-next-line grim/names-as-badges -- a dialog title is plain text, as the seat's "Character for …" picker's is
	const title = $derived(ask ? `Reincarnate ${seatName(game, ask.seatId)} as` : '');

	let open = $state(false);
	$effect(() => {
		if (ask) open = true;
	});
	// Closed any way (Escape, the close button): the death stays as marked.
	$effect(() => {
		if (!open) grimoire.reincarnateAsk = undefined;
	});

	/** The Demon a reborn Demon leaves behind, and the players who may take it on. */
	let passing = $state.raw<{ characterId: CharacterId; heirs: SeatId[] }>();
	let passOpen = $state(false);

	function pick(characterId: CharacterId) {
		if (ask) {
			const heirs = demonHeirs(game, ask.seatId, ask.via, characters);
			const demon = trueCharacter(game, ask.seatId, characters);
			grimoire.run({ type: 'Reincarnate', seatId: ask.seatId, characterId });
			if (demon && heirs.length > 0) {
				passing = { characterId: demon, heirs };
				passOpen = true;
			}
		}
		open = false;
	}
</script>

<CharacterPicker
	bind:open
	{title}
	{characters}
	script={game.script}
	types={['traveller']}
	alwaysAll
	exclude={charactersInPlay(game)}
	recommended={recommendedTravellers(game.script, characters)}
	onPick={pick}
/>
{#if passing}
	<NewDemonDialog
		{grimoire}
		bind:open={passOpen}
		characterId={passing.characterId}
		heirs={passing.heirs}
	/>
{/if}
