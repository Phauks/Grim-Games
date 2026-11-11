<script lang="ts">
	import type { SeatId } from '#lib/core/model/index.ts';
	import { borrowedAbilitiesOf } from '#lib/core/rules/abilities/borrowed-abilities.ts';
	import MarkedCharacterRows from '#lib/features/characters/MarkedCharacterRows.svelte';
	import type { DayPort } from './day-port.ts';

	/**
	 * The abilities a player has besides their own (the Hermit's every Outsider, the
	 * Philosopher's choice, Gain ability, a Boffin's gift), as character rows under their own on
	 * the day (Trevor, 2026-11-06: option A, "put it with the character component").
	 */
	interface Props {
		game: DayPort;
		seatId: SeatId | undefined;
	}

	let { game, seatId }: Props = $props();

	const rows = $derived(
		(seatId ? borrowedAbilitiesOf(game.game, seatId, game.characters) : []).flatMap(
			({ characterId, works }) => {
				const character = game.characters.get(characterId);
				return character ? [{ character, relation: 'holds' as const, faded: !works }] : [];
			}
		)
	);
</script>

<MarkedCharacterRows {rows} />
