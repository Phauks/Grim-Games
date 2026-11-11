<!--
	A seat by who sits there, on the Storyteller's screens: the badge with its player (their
	character with the player's name), or the name alone while the seat has no character.
	Only the board itself shows the bare player badge (Trevor, 2026-11-02). Never on a phone:
	it shows the seat's character.
-->
<script lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import type { CharacterLookup, Game, SeatId } from '#lib/core/model/index.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import { seatName } from '#lib/features/game/seat-label.ts';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';

	interface Props {
		game: Game;
		/** The game's characters (a custom script's); official data otherwise. */
		characters?: CharacterLookup;
		seatId: SeatId | undefined;
		/** The character to show, when not the seat's token (a night step's true character). */
		characterId?: CharacterId;
		/** False inside a button or an option, so the badge does not open the character. */
		interactive?: boolean;
	}

	let { game, characters, seatId, characterId, interactive = true }: Props = $props();

	const seat = $derived(seatId ? game.seats[seatId] : undefined);
	const shown = $derived(characterId ?? seat?.characterId);
</script>

{#if seat}
	{#if shown}
		<CharacterPiece
			template="badge"
			characterId={shown}
			character={characters?.get(shown)}
			alignment={seat.alignment}
			playerName={seatName(game, seat.seatId)}
			{interactive}
		/>
	{:else}
		<PlayerBadge name={seatName(game, seat.seatId)} />
	{/if}
{/if}
