<script lang="ts">
	import SeatBadge from './SeatBadge.svelte';
	import type { CharacterId } from '#lib/core/data/index.ts';
	import {
		reminderHolder,
		type GenericLook,
		type Reminder,
		type ReminderInstance,
		type ReminderId,
		type SeatId
	} from '#lib/core/model/index.ts';
	import { fixedReminderMove, fixedReminderReason } from '#lib/core/rules/index.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import BoardReminder from './BoardReminder.svelte';
	import { reminderPlacing } from './board.ts';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { onBoard, placedLook } from './reminders.ts';

	/**
	 * Moving a reminder that normally stays where it was put (an "Is The Drunk", a Poisoned
	 * on the Poisoner's target) asks first (Trevor, 2026-10-16), with why it stays and any
	 * character in play that does move tokens. Taking one off its seat, back to the reminder
	 * bank, asks the same way, and so does giving a Fabled or Loric a
	 * reminder that isn't its own (Trevor, 2026-10-17). Confirming does it as usual (History
	 * can undo it); nothing is locked.
	 */
	interface Props {
		grimoire: Grimoire;
	}

	let { grimoire }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	let open = $state(false);

	/** Where a reminder is, or goes. */
	type Place = { seatId: SeatId } | { characterId: CharacterId } | { loose: true } | { bank: true };
	interface Pending {
		reminder: ReminderInstance | Reminder;
		from: Place;
		to: Place;
		why?: string;
		relocators: { characterId: CharacterId; does: string }[];
		run: () => void;
	}
	let pending = $state<Pending>();

	/** The reminder and where it is now; undefined when it is not on the board. */
	function find(
		reminderId: ReminderId
	): { reminder: ReminderInstance | Reminder; from: Place } | undefined {
		const from = reminderHolder(game, reminderId);
		if (!from) return undefined;
		const reminder = onBoard(game).find((r) => r.reminderId === reminderId);
		return reminder && { reminder, from };
	}

	function ask(next: Pending) {
		pending = next;
		open = true;
	}

	/** Moves the reminder onto a seat, or asks first when it normally stays put. */
	export function request(reminderId: ReminderId, toSeatId: SeatId): void {
		const run = () => grimoire.run({ type: 'MoveReminder', reminderId, toSeatId });
		const move = fixedReminderMove(game, reminderId, toSeatId, characters);
		if (!move) return void run();
		ask({
			reminder: move.reminder,
			from: { seatId: move.fromSeatId },
			to: { seatId: toSeatId },
			why: move.why,
			relocators: move.relocators,
			run
		});
	}

	/** Asks first when a reminder that stays put leaves its seat. */
	function fromSeat(reminderId: ReminderId, to: Place, run: () => void): void {
		const found = find(reminderId);
		const why =
			found && 'seatId' in found.from ? fixedReminderReason(found.reminder, characters) : undefined;
		if (!found || why === undefined) return void run();
		ask({ ...found, to, why, relocators: [], run });
	}

	/** Takes the reminder off the board, back to the bank, asking first when it stays put. */
	export function requestReturn(reminderId: ReminderId): void {
		fromSeat(reminderId, { bank: true }, () =>
			grimoire.run({ type: 'RemoveReminder', reminderId })
		);
	}

	/**
	 * Gives a Fabled or Loric a reminder: one already on the board (by id) or a new one from
	 * the bank. One that isn't a Fabled or Loric reminder asks first (Trevor, 2026-10-17).
	 */
	export function requestRule(
		what: ReminderId | Reminder,
		characterId: CharacterId,
		/** A copy of one of the bank's ∞ tokens (plan B9). */
		tokenId?: string,
		/** A generic reminder's own starting look (the bank's # token, plan M35). */
		look?: GenericLook
	): void {
		const found: { reminder: ReminderInstance | Reminder; from: Place } | undefined =
			typeof what === 'string' ? find(what) : { reminder: what, from: { bank: true } };
		if (!found) return;
		const run = () =>
			typeof what === 'string'
				? grimoire.run({ type: 'MoveReminderToRuleCharacter', reminderId: what, characterId })
				: grimoire.run({ type: 'AddRuleReminder', characterId, reminder: what, tokenId, look });
		const type = characters.get(found.reminder.characterId)?.type;
		const seatWhy =
			'seatId' in found.from ? fixedReminderReason(found.reminder, characters) : undefined;
		if (type === 'fabled' || type === 'loric') {
			if (seatWhy === undefined) return void run();
			return ask({ ...found, to: { characterId }, why: seatWhy, relocators: [], run });
		}
		ask({
			...found,
			to: { characterId },
			why: seatWhy ?? 'Not a Fabled or Loric reminder.',
			relocators: [],
			run
		});
	}

	function confirm() {
		pending?.run();
		pending = undefined;
	}
</script>

{#snippet place(at: Place, back = false)}
	{#if 'seatId' in at}On <SeatBadge {game} seatId={at.seatId} />
	{:else if 'characterId' in at}On <CharacterPiece
			template="badge"
			characterId={at.characterId}
			character={characters.get(at.characterId)}
		/>
	{:else if 'loose' in at}Loose on the board
	{:else}{back ? 'Back in' : 'In'} the reminder bank{/if}
{/snippet}

<ConfirmDialog
	bind:open
	title="Confirm change?"
	onConfirm={confirm}
	onCancel={() => (pending = undefined)}
>
	{#if pending}
		{@const owner = characters.get(pending.reminder.characterId)}
		<!--
			Which token, from which character, and both places (Trevor, 2026-10-16). The token is
			the round one the board draws, not the in-text chip (Trevor, 2026-11-03).
		-->
		<div class="what">
			<BoardReminder
				{...'reminderId' in pending.reminder
					? placedLook(pending.reminder, characters)
					: { label: pending.reminder.label, character: owner }}
				{...reminderPlacing(game, pending.reminder, characters)}
			/>
			<span
				><CharacterPiece
					template="badge"
					characterId={pending.reminder.characterId}
					character={owner}
				/>'s reminder</span
			>
		</div>
		<dl class="change">
			<dt>Now</dt>
			<dd>{@render place(pending.from)}</dd>
			<dt>Becomes</dt>
			<dd>{@render place(pending.to, true)}</dd>
		</dl>
		{#if pending.why}<p class="why">{pending.why}</p>{/if}
		{#each pending.relocators as relocator (relocator.characterId)}
			<p class="note">
				<CharacterPiece
					template="badge"
					characterId={relocator.characterId}
					character={characters.get(relocator.characterId)}
				/> is in play: {relocator.does}
			</p>
		{/each}
	{/if}
</ConfirmDialog>

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
		display: flex;
		align-items: center;
		gap: var(--space-3);
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
