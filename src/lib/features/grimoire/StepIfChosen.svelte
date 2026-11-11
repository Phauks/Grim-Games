<script lang="ts">
	import type { NightStep } from '#lib/core/rules/night/night-order.ts';
	import type { NightAlert } from '#lib/core/rules/night/night-alert.ts';
	import type { Impairment } from '#lib/core/rules/abilities/ability.ts';
	import { nightStepAlerts } from '#lib/core/rules/night/night-alerts.ts';
	import { IF_CHOSEN_KINDS } from '#lib/core/rules/night/night-alert.ts';
	import type { AbilitySource } from '#lib/core/rules/abilities/ability.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import SeatBadge from '#lib/features/board/SeatBadge.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * What happens to each player a killing step might choose (Trevor, 2026-11-03, option B):
	 * one row per player, their badge once, then the outcome in words, with no icons. A source
	 * that is not the player's own ability is named after "by"; one that doesn't work tonight
	 * dims the row's badge and says why. Nothing at all when no player has anything to say:
	 * a step only shows sections with something in them (Trevor, 2026-11-02). The rules are
	 * core's `nightStepAlerts` (`IF_CHOSEN_KINDS`); this only words them.
	 */
	interface Props {
		grimoire: Grimoire;
		step: NightStep | undefined;
		/** In the walk-through strip: inside its step button, so badges that don't open. */
		compact?: boolean;
	}

	let { grimoire, step, compact = false }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const rows = $derived(
		(step?.character ? nightStepAlerts(game, step.character.id, characters) : []).filter((a) =>
			IF_CHOSEN_KINDS.has(a.kind)
		)
	);

	const OUTCOME: Partial<Record<NightAlert['kind'], string>> = {
		protected: "Can't die",
		'may-bounce': 'May bounce the death',
		'survives-first-death': 'Survives the first death',
		'on-death': 'Sets off its ability'
	};
	const WORD: Record<Impairment['reason'], string> = {
		drunk: 'drunk',
		poisoned: 'poisoned',
		'no-ability': 'without an ability'
	};

	/** Why the source's ability doesn't work tonight, when it doesn't. */
	const failing = (alert: NightAlert): readonly Impairment[] =>
		alert.works ? [] : alert.impairments;

	/** The player's own ability: said as "its ability", not named again. */
	const own = (alert: NightAlert): boolean =>
		alert.source !== 'override' &&
		(alert.source.seatId === alert.seatId ||
			(alert.source.seatId === undefined &&
				alert.source.characterId === game.seats[alert.seatId]?.characterId));
</script>

<!-- A source with its player where the board knows who holds it, as the step's Afflictions do. -->
{#snippet source(from: AbilitySource)}
	{#if from.seatId}<SeatBadge
			{game}
			{characters}
			seatId={from.seatId}
			characterId={from.characterId}
			interactive={!compact}
		/>{:else}<CharacterPiece
			template="badge"
			characterId={from.characterId}
			character={characters.get(from.characterId)}
			interactive={!compact}
		/>{/if}
{/snippet}

{#snippet row(alert: NightAlert)}
	<span class="who" class:off={!alert.works}
		><SeatBadge {game} {characters} seatId={alert.seatId} interactive={!compact} /></span
	>
	<span class="what">
		{#if alert.source === 'override'}
			Can't die, set by hand
		{:else if own(alert)}
			{OUTCOME[alert.kind]}
		{:else if alert.kind === 'on-death'}
			Sets off {@render source(alert.source)}
		{:else}
			{OUTCOME[alert.kind]}, by {@render source(alert.source)}
		{/if}{#each failing(alert) as impairment, i (i)}, {WORD[
				impairment.reason
			]}{#if impairment.source.characterId}, by {@render source(impairment.source)}{/if}{/each}
	</span>
{/snippet}

{#if rows.length > 0}
	{#if compact}
		<span class="compact" data-testid="step-if-chosen">
			<strong>If chosen</strong>
			{#each rows as alert, i (i)}<span class="line">{@render row(alert)}</span>{/each}
		</span>
	{:else}
		<h3>If chosen</h3>
		<ul class="rows" data-testid="step-if-chosen">
			{#each rows as alert, i (i)}<li>{@render row(alert)}</li>{/each}
		</ul>
	{/if}
{/if}

<style>
	/* The same heading as the step's Reminders and Jinxes (GuidedStep). */
	h3 {
		margin: var(--space-2) 0 var(--space-1);
		font-size: 1rem;
	}
	.rows {
		display: grid;
		margin: 0 0 var(--space-2);
		padding: 0;
		list-style: none;
	}
	li,
	.line {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-2);
		line-height: 1.5;
	}
	li {
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--border); /* px-ok: a hairline divider */
	}
	.what {
		min-width: 0;
	}
	.off {
		opacity: 0.6;
	}
	.compact {
		display: grid;
		gap: var(--space-1);
		margin: 0 0 var(--space-2);
		font-size: 0.85rem;
		line-height: 1.4;
	}
</style>
