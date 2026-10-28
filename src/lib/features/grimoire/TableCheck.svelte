<!--
	How removing a seat or a character affects the table: players (Travellers not counted) and
	whether the setup sheet still matches (board.ts `tableCheck`).
-->
<script lang="ts">
	import type { CharacterLookup, Game, SeatId } from '#lib/core/model/index.ts';
	import ChangeList from '#lib/ui/primitives/ChangeList.svelte';
	import { tableCheck } from '#lib/features/grimoire/board.ts';

	interface Props {
		game: Game;
		characters: CharacterLookup;
		kind: 'remove-seat' | 'remove-character';
		seatId: SeatId;
	}

	let { game, characters, kind, seatId }: Props = $props();

	const check = $derived(tableCheck(game, characters, { kind, seatId }));
</script>

<ChangeList testid="table-check">
	<dt>Players</dt>
	<dd>
		{check.players.before === check.players.after
			? `${check.players.after}, unchanged`
			: `${check.players.before} → ${check.players.after}`}
	</dd>
	<dt>Setup</dt>
	<dd>
		{#if check.problems.length === 0}
			Still matches the setup sheet
		{:else}
			<span class="off"
				>{check.wasOff ? 'Already did not match' : 'No longer matches'} the setup sheet:</span
			>
			{#each check.problems as problem (problem)}<span class="problem">{problem}</span>{/each}
		{/if}
	</dd>
</ChangeList>

<style>
	.off {
		color: var(--evil-text);
	}
	.problem {
		display: block;
		font-size: 0.9rem;
	}
</style>
