<script lang="ts">
	import type { ReminderId, SeatId } from '#lib/core/model/index.ts';
	import {
		fixedReminderMove,
		fixedReminderReason,
		type FixedReminderMove
	} from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * Moving a reminder that normally stays where it was put (an "Is The Drunk", a Poisoned
	 * on the Poisoner's target) asks first (Trevor, 2026-10-16), with why it stays and any
	 * character in play that does move tokens. Taking one off its seat, back to the reminder
	 * bank, asks the same way. Confirming does it as usual (History can undo it); nothing is
	 * locked.
	 */
	interface Props {
		grimoire: Grimoire;
	}

	let { grimoire }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	let open = $state(false);
	/** A move to another seat, or back to the bank when `toSeatId` is left out. */
	let pending = $state<{
		reminderId: ReminderId;
		move: Omit<FixedReminderMove, 'toSeatId'> & { toSeatId?: SeatId };
	}>();
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

	/** Takes the reminder off its seat, back to the bank, asking first when it stays put. */
	export function requestReturn(reminderId: ReminderId): void {
		for (const seatId of game.seating) {
			const reminder = game.seats[seatId].reminders.find((r) => r.reminderId === reminderId);
			if (!reminder) continue;
			const why = fixedReminderReason(reminder);
			if (why === undefined) break;
			pending = {
				reminderId,
				move: {
					reminder: { characterId: reminder.characterId, label: reminder.label },
					fromSeatId: seatId,
					why,
					relocators: []
				}
			};
			open = true;
			return;
		}
		grimoire.run({ type: 'RemoveReminder', reminderId });
	}

	function confirm() {
		open = false;
		const to = pending?.move.toSeatId;
		if (pending && to)
			grimoire.run({ type: 'MoveReminder', reminderId: pending.reminderId, toSeatId: to });
		else if (pending) grimoire.run({ type: 'RemoveReminder', reminderId: pending.reminderId });
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
			<dd>{move.toSeatId ? `On ${seatLabel(move.toSeatId)}` : 'Back in the reminder bank'}</dd>
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
