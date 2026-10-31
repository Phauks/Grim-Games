<script lang="ts">
	import { defaultAlignment, type CharacterId } from '#lib/core/data/index.ts';
	import { alignmentOf, charactersInPlay, typeOf } from '#lib/core/model/index.ts';
	import { seatName } from '#lib/features/game/seat-label.ts';
	import CharacterPicker from './CharacterPicker.svelte';
	import { recommendedTravellers } from './board.ts';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * A player just marked dead who is reborn as a Traveller (the Hindu's first four deaths,
	 * https://wiki.bloodontheclocktower.com/Hindu): the Storyteller picks the Traveller, the
	 * script's recommended ones first, each in the player's alignment colours (Trevor,
	 * 2026-10-31: not the Travellers' mixed colours). Picking brings the player back alive with their
	 * alignment; closing leaves the death as marked. Rules: `reincarnatedBy` in core.
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
	const alignment = $derived.by(() => {
		if (!ask) return undefined;
		const type = typeOf(game, ask.seatId, characters);
		return alignmentOf(game, ask.seatId) ?? (type ? defaultAlignment(type) : undefined);
	});

	let open = $state(false);
	$effect(() => {
		if (ask) open = true;
	});
	// Closed any way (Escape, the close button): the death stays as marked.
	$effect(() => {
		if (!open) grimoire.reincarnateAsk = undefined;
	});

	function pick(characterId: CharacterId) {
		if (ask) grimoire.run({ type: 'Reincarnate', seatId: ask.seatId, characterId });
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
	{alignment}
	onPick={pick}
/>
