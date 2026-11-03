<script lang="ts">
	import SeatBadge from './SeatBadge.svelte';
	import type { SeatId } from '#lib/core/model/index.ts';
	import type { NightStep, NightAlert, Impairment } from '#lib/core/rules/index.ts';
	import { IF_CHOSEN_KINDS, nightStepAlerts } from '#lib/core/rules/index.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * Game state that matters for a night step (Trevor, 2026-10-16): who is drunk or
	 * poisoned, who doesn't wake tonight (the Exorcist's Demon), who acts twice (the Barista's),
	 * what a jinx changes about the Grimoire a player sees (the Spy's with the Poppy Grower or the
	 * Magician), a partner a jinx's night choice picked (the Leviathan's Sage), what a jinx has
	 * a player learn about an ability gained today (the Cannibal's Butler) or keeps true (the
	 * Vortox's Banshee), a jinxed player who wakes too or keeps their protection (the Vizier's),
	 * learns they have no ability or might learn a player is a jinxed partner (Legion's), whose
	 * ability the Storyteller has while they have none (the Summoner's with the Courtier), a
	 * guess that makes the Demon choose a jinxed partner, a gained ability not shown, a madness
	 * a jinx allows, a Scarlet Woman who is herself again, or a setup change made on gaining an
	 * ability (L119). Short state lines with badges; the rules are core's `nightStepAlerts`,
	 * worked out from the tokens on the board. What a killing step's choice would do to each
	 * player (protected, bounced, sets something off) is `StepIfChosen`'s own section.
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
			(a) => (!withoutImpaired || a.kind !== 'impaired') && !IF_CHOSEN_KINDS.has(a.kind)
		)
	);

	const WORD: Record<Impairment['reason'], string> = {
		drunk: 'drunk',
		poisoned: 'poisoned',
		'no-ability': 'without an ability'
	};
	const ICON = {
		impaired: 'poisoned',
		blocked: 'warning',
		'acts-twice': 'warning',
		'no-kill': 'protected',
		'may-skip-attack': 'night',
		'must-skip-attack': 'warning',
		'final-night': 'warning',
		'no-grimoire': 'warning',
		'grimoire-hides': 'warning',
		'jinx-chosen': 'warning',
		'learns-gained': 'info',
		'true-info': 'info',
		seating: 'warning',
		'wakes-with': 'night',
		'keeps-protection': 'protected',
		'learns-no-ability': 'info',
		'might-learn': 'info',
		'storyteller-has': 'warning',
		guessed: 'warning',
		'not-shown-given': 'info',
		'may-mad-as': 'info',
		reverts: 'warning',
		'partner-setup': 'warning'
	} as const;
	const sourceId = (alert: NightAlert) =>
		alert.source === 'override' ? undefined : alert.source.characterId;
</script>

<!-- In the walk-through strip the lines sit inside its step button: badges that don't open. -->
<!-- A seat as its player name badge, as on the board. -->
{#snippet player(seatId: SeatId)}<SeatBadge
		{game}
		{characters}
		{seatId}
		interactive={!compact}
	/>{/snippet}

{#snippet badge(id: string | undefined)}
	{#if id}<CharacterPiece
			template="badge"
			characterId={id}
			character={characters.get(id)}
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
				<Icon
					name={alert.impairments[0]?.reason === 'drunk'
						? 'drunk'
						: ICON[alert.kind as keyof typeof ICON]}
				/>
				<span>
					{#if alert.kind === 'impaired'}
						{@render badge(sourceId(alert))} in {@render player(alert.seatId)} is {@render why(
							alert.impairments
						)}
					{:else if alert.kind === 'blocked'}
						{@render player(alert.seatId)}: chosen by {@render badge(sourceId(alert))}, doesn't wake
						tonight
					{:else if alert.kind === 'acts-twice'}
						{@render player(alert.seatId)}: {@render badge(sourceId(alert))}, acts twice tonight
					{:else if alert.kind === 'no-kill'}
						{@render player(alert.seatId)}: {@render badge(sourceId(alert))}, doesn't kill tonight
					{:else if alert.kind === 'may-skip-attack'}
						{@render player(alert.seatId)}: {@render badge(sourceId(alert))}, may choose not to
						attack
					{:else if alert.kind === 'must-skip-attack'}
						{@render player(alert.seatId)}: {@render badge(sourceId(alert))}, hasn't chosen not to
						attack yet, must once this game
					{:else if alert.kind === 'final-night'}
						{@render player(alert.seatId)}: {@render badge(sourceId(alert))}, final night, doesn't
						wake or attack tonight
					{:else if alert.kind === 'no-grimoire'}
						{@render player(alert.seatId)}: doesn't see the Grimoire while {@render badge(
							sourceId(alert)
						)} has its ability
					{:else if alert.kind === 'grimoire-hides'}
						{@render player(alert.seatId)}: token off while the Grimoire is shown ({@render badge(
							sourceId(alert)
						)})
					{:else if alert.kind === 'jinx-chosen'}
						{@render player(alert.seatId)}: chosen by {@render badge(sourceId(alert))}, {alert.outcome ===
						'dies'
							? 'dies and gains their ability'
							: "uses their ability but doesn't die"}
					{:else if alert.kind === 'learns-gained'}
						{@render player(alert.seatId)}: {alert.learns === 'answer'
							? 'learns what the'
							: 'learns they have the'}
						{@render badge(sourceId(alert))}{alert.learns === 'answer'
							? ' would learn tonight'
							: ' ability'}
					{:else if alert.kind === 'true-info'}
						{@render player(alert.seatId)}: given truly, {@render badge(sourceId(alert))} doesn't make
						it false
					{:else if alert.kind === 'seating'}
						{@render player(alert.seatId)}: the evil players don't sit in one line with {@render badge(
							sourceId(alert)
						)} inside it
					{:else if alert.kind === 'wakes-with'}
						{@render player(alert.seatId)}: {@render badge(sourceId(alert))}, wakes too and learns
						the choice
					{:else if alert.kind === 'keeps-protection'}
						{@render player(alert.seatId)}: {@render badge(sourceId(alert))}, learns they lost their
						ability, which still protects them
					{:else if alert.kind === 'learns-no-ability'}
						{@render player(alert.seatId)}: {@render badge(sourceId(alert))}, learns they have no
						ability ({@render badge(alert.partner)})
					{:else if alert.kind === 'might-learn'}
						{@render player(alert.seatId)}: {@render badge(sourceId(alert))}, might learn a player
						is
						{@render badge(alert.partner)}, who keeps their ability
					{:else if alert.kind === 'storyteller-has'}
						{@render player(alert.seatId)}: {@render badge(sourceId(alert))} has no ability, so the Storyteller
						has it and makes the choice ({@render badge(alert.partner)})
					{:else if alert.kind === 'guessed'}
						{@render player(alert.seatId)}: {@render badge(sourceId(alert))} may have guessed a living
						player as {@render badge(alert.partner)} after today's execution; if right, the Demon must
						choose that player tonight
					{:else if alert.kind === 'not-shown-given'}
						{@render player(alert.seatId)}: {@render badge(sourceId(alert))} with the {@render badge(
							alert.partner
						)} ability, isn't shown the ability it gave
					{:else if alert.kind === 'may-mad-as'}
						{@render player(alert.seatId)}: {@render badge(sourceId(alert))}, may make a player mad
						that they are {@render badge(alert.partner)}
					{:else if alert.kind === 'reverts'}
						{@render player(alert.seatId)}: {@render badge(sourceId(alert))} again, as a living player
						is
						{@render badge(alert.partner)}
					{:else if alert.kind === 'partner-setup'}
						{@render player(alert.seatId)}: {@render badge(sourceId(alert))} has the {@render badge(
							alert.partner
						)} ability, so its setup change may be made now
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
		color: var(--evil-text);
	}
</style>
