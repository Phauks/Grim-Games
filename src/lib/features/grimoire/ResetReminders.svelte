<script lang="ts">
	import type { ReminderId, SeatId } from '#lib/core/model/index.ts';
	import { seatName } from '#lib/features/game/seat-label.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import BoardReminder from './BoardReminder.svelte';
	import SeatBadge from './SeatBadge.svelte';
	import { placingAlignment } from './board.ts';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * At dawn, with Settings' Remove reminders that run out on Ask at dawn to remove (Trevor,
	 * 2026-11-03): the reminders that ran out, each as its board token beside its seat, with a
	 * switch, on by default. Confirm takes off the ones switched on (History can undo it);
	 * Cancel leaves them all. Which ran out: `remindersRunOutByDawn` in core.
	 */
	interface Props {
		grimoire: Grimoire;
	}

	let { grimoire }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const rows = $derived(
		game.seating.flatMap((seatId) =>
			game.seats[seatId].reminders
				.filter((r) => grimoire.dawnAsk.includes(r.reminderId))
				.map((reminder) => ({ seatId, reminder }))
		)
	);

	let open = $state(false);
	/** The reminders switched off, to stay on the board. */
	let kept = $state<readonly ReminderId[]>([]);
	$effect(() => {
		if (grimoire.dawnAsk.length > 0) {
			kept = [];
			open = true;
		}
	});
	// Closed any way (Cancel, Escape, the close button): the question is answered.
	$effect(() => {
		if (!open && grimoire.dawnAsk.length > 0) grimoire.dawnAnswered();
	});

	function keep(reminderId: ReminderId, remove: boolean) {
		kept = remove ? kept.filter((id) => id !== reminderId) : [...kept, reminderId];
	}

	function removeChosen() {
		for (const { reminder } of rows) {
			if (!kept.includes(reminder.reminderId))
				grimoire.run({ type: 'RemoveReminder', reminderId: reminder.reminderId });
		}
		grimoire.dawnAnswered();
	}

	function switchLabel(label: string, seatId: SeatId): string {
		// eslint-disable-next-line grim/names-as-badges -- the switch's hidden accessible name; the row shows the seat's badge
		return `Remove ${label}, ${seatName(game, seatId)}`;
	}
</script>

<ConfirmDialog bind:open title="Reset Reminders" onConfirm={removeChosen}>
	<ul class="rows">
		{#each rows as { seatId, reminder } (reminder.reminderId)}
			<li>
				<BoardReminder
					label={reminder.label}
					character={characters.get(reminder.characterId)}
					alignment={placingAlignment(game, reminder, characters)}
				/>
				<span class="seat"><SeatBadge {game} {characters} {seatId} /></span>
				<span class="switch">
					<Toggle
						label={switchLabel(reminder.label, seatId)}
						hideLabel
						checked={!kept.includes(reminder.reminderId)}
						onChange={(on) => keep(reminder.reminderId, on)}
					/>
				</span>
			</li>
		{/each}
	</ul>
</ConfirmDialog>

<style>
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.rows li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding-block: var(--space-2);
		border-bottom: 1px solid var(--border);
	}
	/* The seat's badge a step under the dialog's text, so the token leads the row (Trevor, 2026-11-03). */
	.seat {
		min-width: 0;
		font-size: 0.85em;
	}
	.switch {
		margin-inline-start: auto;
	}
</style>
