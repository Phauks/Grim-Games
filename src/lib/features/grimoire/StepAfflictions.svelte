<script lang="ts">
	import type { NightStep, Impairment } from '#lib/core/rules/index.ts';
	import { nightStepAlerts } from '#lib/core/rules/index.ts';
	import { alignmentOf, type SeatId } from '#lib/core/model/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * The waking players' afflictions, as their own section laid out like the step's
	 * reminders (Trevor, 2026-10-17): drunk, poisoned or without an ability, the player, and
	 * the character (with its player) causing it. From core's `nightStepAlerts`; "None" holds
	 * the place when nobody is afflicted.
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

	const WORD: Record<Impairment['reason'], string> = {
		drunk: 'Drunk',
		poisoned: 'Poisoned',
		'no-ability': 'No ability'
	};
	const playerName = (seatId: SeatId) =>
		game.seats[seatId]?.playerName ?? `Seat ${game.seating.indexOf(seatId) + 1}`;
</script>

{#snippet seatBadge(seatId: SeatId, characterId: string | undefined)}
	{#if characterId}<CharacterBadge
			{characterId}
			character={characters.get(characterId)}
			alignment={alignmentOf(game, seatId)}
			playerName={playerName(seatId)}
			inline
		/>{:else}<strong>{playerName(seatId)}</strong>{/if}
{/snippet}

<h3>Afflictions</h3>
{#if rows.length === 0}
	<p class="none">None</p>
{:else}
	<ul class="afflictions" data-testid="step-afflictions">
		{#each rows as { seatId, impairment }, i (i)}
			<li>
				<span class="what"
					><Icon name={impairment.reason === 'drunk' ? 'drunk' : 'poisoned'} />{WORD[
						impairment.reason
					]}</span
				>
				<span class="who">
					{@render seatBadge(seatId, game.seats[seatId]?.characterId)}
					{#if impairment.source.characterId}
						by {#if impairment.source.seatId}{@render seatBadge(
								impairment.source.seatId,
								impairment.source.characterId
							)}{:else}<CharacterBadge
								characterId={impairment.source.characterId}
								character={characters.get(impairment.source.characterId)}
								inline
							/>{/if}
					{/if}
				</span>
			</li>
		{/each}
	</ul>
{/if}

<style>
	h3 {
		margin: var(--space-3) 0 var(--space-1);
		font-size: 0.95rem;
	}
	.none {
		margin: 0;
		color: var(--on-surface-muted);
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
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
	}
	.what {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-width: 6rem;
		font-weight: 600;
		--icon-size: 1.1em;
	}
	.who {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
		min-width: 0;
	}
</style>
