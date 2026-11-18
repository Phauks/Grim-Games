<script lang="ts">
	import type { NightStep } from '#lib/core/rules/night/night-order.ts';
	import { nightStepAlerts } from '#lib/core/rules/night/night-alerts.ts';
	import { alignmentOf, type SeatId } from '#lib/core/model/index.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import ImpairmentToken from './ImpairmentToken.svelte';
	import type { Grimoire } from '#lib/features/grimoire/grimoire.svelte.ts';

	/**
	 * The waking players' afflictions, as their own section laid out like the step's
	 * reminders (Trevor, 2026-10-17): the token causing it, as on the board, then the player
	 * (Trevor, 2026-11-17, "B Token only": no "by"). From core's `nightStepAlerts`. Nothing at
	 * all when nobody is afflicted: a step only shows sections with something in them (Trevor,
	 * 2026-11-02).
	 */
	interface Props {
		grimoire: Grimoire;
		step: NightStep;
	}

	let { grimoire, step }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const rows = $derived(
		(step.character ? nightStepAlerts(game, step.character.id, characters) : [])
			.filter((a) => a.kind === 'impaired')
			.flatMap((a) => a.impairments.map((impairment) => ({ seatId: a.seatId, impairment })))
	);

	const playerName = (seatId: SeatId) =>
		game.seats[seatId]?.playerName ?? `Seat ${game.seating.indexOf(seatId) + 1}`;
</script>

{#if rows.length > 0}
	<!-- "Status" (Trevor, 2026-11-17: rename afflictions to status). -->
	<h3>Status</h3>
	<ul class="afflictions" data-testid="step-afflictions">
		{#each rows as { seatId, impairment }, i (i)}
			{@const characterId = game.seats[seatId]?.characterId}
			<li>
				<span class="token"><ImpairmentToken {game} {characters} {impairment} /></span>
				<span class="who"
					>{#if characterId}<CharacterPiece
							template="badge"
							{characterId}
							character={characters.get(characterId)}
							alignment={alignmentOf(game, seatId)}
							playerName={playerName(seatId)}
						/>{:else}<strong>{playerName(seatId)}</strong>{/if}</span
				>
			</li>
		{/each}
	</ul>
{/if}

<style>
	h3 {
		margin: var(--space-3) 0 var(--space-1);
		font-size: 0.95rem;
	}
	.afflictions {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
	}
	.token {
		display: inline-flex;
		flex: none;
	}
	.who {
		display: inline-flex;
		align-items: center;
		min-width: 0;
	}
</style>
