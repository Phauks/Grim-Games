<!--
	A seat by who sits there: their character's badge with the player's name, or the name
	alone while the seat has no character.
-->
<script lang="ts">
	import type { CharacterLookup, Game, SeatId } from '#lib/core/model/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { seatName } from '#lib/features/game/seat-label.ts';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';

	interface Props {
		game: Game;
		characters: CharacterLookup;
		seatId: SeatId | undefined;
	}

	let { game, characters, seatId }: Props = $props();

	const seat = $derived(seatId ? game.seats[seatId] : undefined);
</script>

{#if seat}
	{#if seat.characterId}
		<CharacterBadge
			characterId={seat.characterId}
			character={characters.get(seat.characterId)}
			alignment={seat.alignment}
			playerName={seatName(game, seat.seatId)}
		/>
	{:else}
		<PlayerBadge name={seatName(game, seat.seatId)} />
	{/if}
{/if}
