<script lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import type { SeatId } from '#lib/core/model/index.ts';
	import { ruleCharacterUse } from '#lib/core/rules/game-end/contest.ts';
	import AnyoneUseButton from './AnyoneUseButton.svelte';
	import type { DayPort } from './day-port.ts';
	import FiddleContest from './FiddleContest.svelte';

	/**
	 * The button on the day's row of a rule character no player holds (`ruleCharacterUse`):
	 * Use for a day ability any living player may use (the Doomsayer), or Contest for a contest
	 * that ends the game (the Fiddler).
	 */
	interface Props {
		game: DayPort;
		characterId: CharacterId;
		onChoose: (seatId: SeatId) => void;
	}

	let { game, characterId, onChoose }: Props = $props();
</script>

{#if ruleCharacterUse(characterId, game.characters) === 'contest'}
	<FiddleContest {game} {characterId} />
{:else}
	<AnyoneUseButton {game} {characterId} {onChoose} />
{/if}
