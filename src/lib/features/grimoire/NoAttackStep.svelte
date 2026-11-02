<script lang="ts">
	import { nightKiller, noAttackState, type NightStep } from '#lib/core/rules/index.ts';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import BoardReminder from './BoardReminder.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { placingAlignment } from './board.ts';
	import { seatName, stepHolders } from './night-steps.ts';

	/**
	 * M15a: the Demon's step while a rule lets it choose not to attack (`demonAttack`, the
	 * Toymaker: https://wiki.bloodontheclocktower.com/Toymaker). Each Demon still marked with
	 * the rule's reminder (it hasn't chosen not to attack yet) is listed, and No attack takes
	 * that reminder off, which is how the choice is recorded. "None" once every Demon has; the
	 * reminders to skip at least once are the step's alerts (`NightAlerts`). Never locks.
	 */
	interface Props {
		grimoire: Grimoire;
		step: NightStep;
	}

	let { grimoire, step }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const killsAsDemon = $derived(
		!!step.character && nightKiller(step.character.id, characters)?.by === 'demon'
	);
	const states = $derived(
		killsAsDemon
			? stepHolders(game, step, characters).flatMap((seatId) => {
					const state = noAttackState(game, seatId, characters);
					return state ? [{ seatId, state }] : [];
				})
			: []
	);
	const pending = $derived(states.filter(({ state }) => state.pending !== undefined));
	const source = $derived(states[0] && characters.get(states[0].state.rule.characterId));
	const alignment = $derived(source ? placingAlignment(game, source.id, characters) : undefined);

	function noAttack() {
		for (const { state } of pending)
			if (state.pending) grimoire.run({ type: 'RemoveReminder', reminderId: state.pending });
	}
</script>

{#if states.length > 0}
	<h3>No attack</h3>
	<ul class="rows" data-testid="no-attack">
		{#each pending as { seatId, state } (seatId)}
			<li>
				{#if source && state.rule.mustSkipOnce}<BoardReminder
						label={state.rule.mustSkipOnce}
						character={source}
						{alignment}
					/>{/if}
				<span class="where">On <PlayerBadge name={seatName(game, seatId)} />, comes off</span>
			</li>
		{:else}
			<li class="none">None</li>
		{/each}
	</ul>
	<Button variant="quiet" disabled={pending.length === 0} onclick={noAttack}>No attack</Button>
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
