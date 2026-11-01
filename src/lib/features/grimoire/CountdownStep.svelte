<script lang="ts">
	import { rulesOf } from '#lib/core/data/rules/index.ts';
	import { countdownMoves, type NightStep } from '#lib/core/rules/index.ts';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import BoardReminder from './BoardReminder.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { placingAlignment } from './board.ts';
	import { seatName } from './night-steps.ts';

	/**
	 * A step whose character's token counts down each night (`countdown`, the Courtier's Drunk
	 * 3, 2, 1: https://wiki.bloodontheclocktower.com/Courtier): each token that was on the board
	 * at dawn, with the one it becomes, and Count down to swap them (the last comes off). On
	 * other nights only, as the night text says; "None" while there is nothing to count down.
	 */
	interface Props {
		grimoire: Grimoire;
		step: NightStep;
	}

	let { grimoire, step }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const character = $derived(step.character);
	const counts = $derived(character ? !!rulesOf(character.id, characters)?.countdown : false);
	const moves = $derived(
		character && counts ? countdownMoves(game, character.id, characters, grimoire.atDawn) : []
	);
	const alignment = $derived(
		character ? placingAlignment(game, character.id, characters) : undefined
	);

	function countDown() {
		if (!character) return;
		for (const m of moves) {
			grimoire.run({ type: 'RemoveReminder', reminderId: m.reminderId });
			if (m.to)
				grimoire.run({
					type: 'AddReminder',
					seatId: m.seatId,
					reminder: { characterId: character.id, label: m.to }
				});
		}
	}
</script>

{#if counts && character}
	<h3>Count down</h3>
	<ul class="rows" data-testid="countdown">
		{#each moves as m (m.reminderId)}
			<li>
				<BoardReminder label={m.from} {character} {alignment} />
				<span class="where"
					>On <PlayerBadge name={seatName(game, m.seatId)} />{#if m.to}, becomes{:else}, comes off{/if}</span
				>
				{#if m.to}<BoardReminder label={m.to} {character} {alignment} />{/if}
			</li>
		{:else}
			<li class="none">None</li>
		{/each}
	</ul>
	<Button variant="quiet" disabled={moves.length === 0} onclick={countDown}>Count down</Button>
{/if}

<style>
	h3 {
		margin: var(--space-2) 0 var(--space-1);
		font-size: 1rem;
	}
	.rows {
		margin: 0 0 var(--space-2);
		padding: 0;
		list-style: none;
	}
	.rows li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		padding-block: var(--space-1);
	}
	.rows li + li {
		border-top: var(--card-border);
	}
	.none {
		color: var(--on-surface-muted);
	}
</style>
