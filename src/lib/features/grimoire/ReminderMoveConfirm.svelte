<script lang="ts">
	import type { ReminderId, SeatId } from '#lib/core/model/index.ts';
	import { fixedReminderMove, type FixedReminderMove } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * Moving a reminder that normally stays where it was put (an "Is The Drunk", a Poisoned
	 * on the Poisoner's target) asks first (Trevor, 2026-10-16), with why it stays and any
	 * character in play that does move tokens. Confirming moves it as usual; nothing is locked.
	 */
	interface Props {
		grimoire: Grimoire;
	}

	let { grimoire }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	let open = $state(false);
	let pending = $state<{ reminderId: ReminderId; move: FixedReminderMove }>();
	/** "Seat 3 (Alex)", or "Seat 3" without a name. */
	function seatLabel(seatId: SeatId) {
		const n = `Seat ${game.seating.indexOf(seatId) + 1}`;
		const name = game.seats[seatId]?.playerName;
		return name ? `${n} (${name})` : n;
	}

	/** Moves the reminder, or asks first when it normally stays put. */
	export function request(reminderId: ReminderId, toSeatId: SeatId): void {
		const move = fixedReminderMove(game, reminderId, toSeatId);
		if (!move) {
			grimoire.run({ type: 'MoveReminder', reminderId, toSeatId });
			return;
		}
		pending = { reminderId, move };
		open = true;
	}

	function confirm() {
		open = false;
		if (pending)
			grimoire.run({
				type: 'MoveReminder',
				reminderId: pending.reminderId,
				toSeatId: pending.move.toSeatId
			});
		pending = undefined;
	}
</script>

<Dialog bind:open title="Confirm change?" role="alertdialog">
	{#if pending}
		{@const move = pending.move}
		{@const owner = characters.get(move.reminder.characterId)}
		<!-- Which token, from which character, and both seats (Trevor, 2026-10-16). -->
		<p class="what">
			<CharacterBadge characterId={move.reminder.characterId} character={owner} inline />'s
			<strong>{move.reminder.label}</strong> reminder
		</p>
		<dl class="change">
			<dt>Now</dt>
			<dd>On {seatLabel(move.fromSeatId)}</dd>
			<dt>Becomes</dt>
			<dd>On {seatLabel(move.toSeatId)}</dd>
		</dl>
		<p class="why">{move.why}</p>
		{#each move.relocators as relocator (relocator.characterId)}
			<p class="note">
				<CharacterBadge
					characterId={relocator.characterId}
					character={characters.get(relocator.characterId)}
					inline
				/> is in play: {relocator.does}
			</p>
		{/each}
	{/if}
	{#snippet actions()}
		<Button
			variant="quiet"
			onclick={() => {
				open = false;
				pending = undefined;
			}}>Cancel</Button
		>
		<Button variant="accent" icon="check" onclick={confirm}>Confirm change</Button>
	{/snippet}
</Dialog>

<style>
	.change {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-1) var(--space-3);
		align-items: center;
		margin: 0 0 var(--space-2);
	}
	.change dt {
		color: var(--on-surface-muted);
		font-size: 0.85rem;
	}
	.change dd {
		margin: 0;
	}
	.what {
		margin: 0 0 var(--space-2);
	}
	.why {
		margin: 0 0 var(--space-2);
	}
	.note {
		margin: 0 0 var(--space-1);
		color: var(--on-surface-muted);
		font-size: 0.9rem;
	}
</style>
