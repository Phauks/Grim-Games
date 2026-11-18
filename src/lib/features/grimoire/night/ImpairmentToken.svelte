<script lang="ts">
	import type { Impairment } from '#lib/core/rules/abilities/ability.ts';
	import type { CharacterLookup } from '#lib/core/model/characters.ts';
	import type { Game } from '#lib/core/model/index.ts';
	import BoardReminder from '#lib/features/board/BoardReminder.svelte';
	import { onBoard } from '#lib/features/board/reminders.ts';
	import { placingAlignment } from '#lib/features/grimoire/board.ts';

	/**
	 * What makes a player drunk, poisoned or without an ability, as the board shows it: the
	 * reminder token behind it (Trevor, 2026-11-17, "B Token only"), so the Storyteller knows
	 * it at a glance. A cause with no token on the board draws its character's token with the
	 * word for it.
	 */
	interface Props {
		game: Game;
		characters: CharacterLookup;
		impairment: Impairment;
		/** Diameter in px; left out, the board's size, never under the tap target. */
		size?: number;
	}

	let { game, characters, impairment, size }: Props = $props();

	const WORD: Record<Impairment['reason'], string> = {
		drunk: 'Drunk',
		poisoned: 'Poisoned',
		'no-ability': 'No ability'
	};
	const placed = $derived(
		impairment.source.reminderId
			? onBoard(game).find((r) => r.reminderId === impairment.source.reminderId)
			: undefined
	);
	const characterId = $derived(placed?.characterId ?? impairment.source.characterId);
	const label = $derived(placed?.label ?? WORD[impairment.reason]);
	const character = $derived(characterId ? characters.get(characterId) : undefined);
</script>

<BoardReminder
	{label}
	{character}
	{size}
	alignment={placed
		? placingAlignment(game, placed, characters)
		: characterId
			? placingAlignment(game, characterId, characters)
			: undefined}
	ariaLabel={`${WORD[impairment.reason]}${character ? ` by ${character.name}` : ''}`}
/>
