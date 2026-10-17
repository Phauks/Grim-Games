<script lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import {
		alignmentOf,
		trueCharacter,
		type CharacterLookup,
		type Game,
		type SeatId
	} from '#lib/core/model/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';

	/**
	 * Whose a reminder is (Trevor, 2026-10-17: "show character and player name"): its
	 * character with the name of each player who has it, and, given `on`, the seat it sits on.
	 */
	interface Props {
		game: Game;
		characters: CharacterLookup;
		characterId: CharacterId;
		/** The seat the reminder is on. */
		on?: SeatId;
		/** False inside another button. */
		interactive?: boolean;
	}

	let { game, characters, characterId, on, interactive = true }: Props = $props();

	const holders = $derived(
		game.seating.filter(
			(s) =>
				game.seats[s].characterId === characterId ||
				trueCharacter(game, s, characters) === characterId
		)
	);
	const seatName = (s: SeatId) => game.seats[s].playerName ?? `Seat ${game.seating.indexOf(s) + 1}`;
</script>

<span class="origin" data-testid="reminder-origin"
	>{#each holders as s (s)}<CharacterBadge
			{characterId}
			character={characters.get(characterId)}
			alignment={alignmentOf(game, s)}
			playerName={seatName(s)}
			inline
			{interactive}
		/>{:else}<CharacterBadge
			{characterId}
			character={characters.get(characterId)}
			inline
			{interactive}
		/>{/each}{#if on}{@const onId = game.seats[on]?.characterId}
		on {#if onId}<CharacterBadge
				characterId={onId}
				character={characters.get(onId)}
				alignment={alignmentOf(game, on)}
				playerName={seatName(on)}
				inline
				{interactive}
			/>{:else}<strong>{seatName(on)}</strong>{/if}{/if}</span
>

<style>
	.origin {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
		min-width: 0;
	}
</style>
