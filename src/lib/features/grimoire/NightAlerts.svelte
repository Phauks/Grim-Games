<script lang="ts">
	import { seatLabel } from '#lib/features/game/seat-label.ts';
	import type { NightStep, NightAlert, Impairment } from '#lib/core/rules/index.ts';
	import { nightStepAlerts } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * Game state that matters for a night step (Trevor, 2026-10-16): who is drunk or
	 * poisoned, and for a step that can kill, who is protected, may bounce the death, survives
	 * it or sets something off by dying. Short state lines with badges; the rules are core's
	 * `nightStepAlerts`, worked out from the tokens on the board.
	 */
	interface Props {
		grimoire: Grimoire;
		step: NightStep | undefined;
		compact?: boolean;
		/** Leaves out who is drunk or poisoned, shown in the step's own Afflictions section. */
		withoutImpaired?: boolean;
	}

	let { grimoire, step, compact = false, withoutImpaired = false }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const alerts = $derived(
		(step?.character ? nightStepAlerts(game, step.character.id, characters) : []).filter(
			(a) => !withoutImpaired || a.kind !== 'impaired'
		)
	);

	const WORD: Record<Impairment['reason'], string> = {
		drunk: 'drunk',
		poisoned: 'poisoned',
		'no-ability': 'without an ability'
	};
	const ICON = {
		impaired: 'poisoned',
		protected: 'protected',
		'may-bounce': 'warning',
		'survives-first-death': 'protected',
		'on-death': 'dead'
	} as const;
	const sourceId = (alert: NightAlert) =>
		alert.source === 'override' ? undefined : alert.source.characterId;
</script>

<!-- In the walk-through strip the lines sit inside its step button: badges that don't open. -->
{#snippet badge(id: string | undefined)}
	{#if id}<CharacterBadge
			characterId={id}
			character={characters.get(id)}
			inline
			interactive={!compact}
		/>{/if}
{/snippet}

{#snippet why(impairments: readonly Impairment[])}
	{#each impairments as impairment, i (i)}
		{i === 0 ? '' : ', '}{WORD[impairment.reason]}{#if impairment.source.characterId}
			({@render badge(impairment.source.characterId)}){/if}
	{/each}
{/snippet}

{#if alerts.length > 0}
	<svelte:element
		this={compact ? 'span' : 'ul'}
		class="alerts"
		class:compact
		aria-label="Game state for this step"
		data-testid="night-alerts"
	>
		{#each alerts as alert, i (i)}
			<svelte:element
				this={compact ? 'span' : 'li'}
				class="alert"
				class:off={!alert.works && alert.kind !== 'impaired'}
			>
				<Icon name={alert.impairments[0]?.reason === 'drunk' ? 'drunk' : ICON[alert.kind]} />
				<span>
					{#if alert.kind === 'impaired'}
						{@render badge(sourceId(alert))} in {seatLabel(game, alert.seatId)} is {@render why(
							alert.impairments
						)}
					{:else if alert.kind === 'protected'}
						{seatLabel(game, alert.seatId)} can't die{#if alert.source === 'override'}
							(set by hand){:else}: {@render badge(sourceId(alert))}{/if}
					{:else if alert.kind === 'may-bounce'}
						{seatLabel(game, alert.seatId)}: {@render badge(sourceId(alert))} may bounce the death
					{:else if alert.kind === 'survives-first-death'}
						{seatLabel(game, alert.seatId)}: {@render badge(sourceId(alert))} survives the first death
					{:else}
						{seatLabel(game, alert.seatId)} dying sets off {@render badge(sourceId(alert))}
					{/if}
					{#if !alert.works && alert.kind !== 'impaired'}
						<strong class="not">Not working:</strong> {@render why(alert.impairments)}
					{/if}
				</span>
			</svelte:element>
		{/each}
	</svelte:element>
{/if}

<style>
	.alerts {
		display: grid;
		gap: var(--space-1);
		margin: 0 0 var(--space-2);
		padding: 0;
		list-style: none;
	}
	.alert {
		display: flex;
		align-items: baseline;
		gap: var(--space-1);
		line-height: 1.6;
		--icon-size: 1em;
	}
	.compact .alert {
		font-size: 0.85rem;
		line-height: 1.4;
	}
	.alert.off {
		opacity: 0.75;
	}
	.not {
		color: var(--evil);
	}
</style>
