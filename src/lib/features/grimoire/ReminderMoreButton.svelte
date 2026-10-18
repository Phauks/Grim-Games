<script lang="ts">
	import { reminderHolder, type ReminderId } from '#lib/core/model/index.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Popover from '#lib/ui/primitives/Popover.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { onBoard } from './reminders.ts';

	/**
	 * A placed reminder's ⋯ (Trevor, 2026-10-18), beside its delete in the reminder's sheet:
	 * Duplicate reminder puts another copy beside it. More copies than the game gives is
	 * unusual, so the copy is marked on the board and a toast says so; never blocked.
	 */
	interface Props {
		grimoire: Grimoire;
		reminderId: ReminderId | undefined;
		/** After duplicating, so the sheet can close. */
		onDone?: () => void;
	}

	let { grimoire, reminderId, onDone }: Props = $props();
	let open = $state(false);
	let anchor = $state<HTMLElement>();

	function duplicate() {
		open = false;
		const game = grimoire.game;
		const reminder = reminderId
			? onBoard(game).find((r) => r.reminderId === reminderId)
			: undefined;
		const holder = reminderId ? reminderHolder(game, reminderId) : undefined;
		if (!reminder || !holder) return;
		const copy = { characterId: reminder.characterId, label: reminder.label };
		let done = false;
		if ('seatId' in holder)
			done = grimoire.run({ type: 'AddReminder', seatId: holder.seatId, reminder: copy });
		else if ('characterId' in holder)
			done = grimoire.run({
				type: 'AddRuleReminder',
				characterId: holder.characterId,
				reminder: copy
			});
		else if (grimoire.run({ type: 'PlaceLooseReminder', reminder: copy })) {
			done = true;
			// Just beside the original.
			const at = grimoire.reminderSpots[reminder.reminderId];
			const added = grimoire.game.looseReminders?.at(-1);
			if (at && added) grimoire.setReminderSpot(added.reminderId, { x: at.x + 4, y: at.y + 4 });
		}
		if (!done) return;
		toast('Uncommon', 'More copies of this reminder than the game gives. The copy is marked.');
		onDone?.();
	}
</script>

<span bind:this={anchor}
	><IconButton icon="more" label="More reminder actions" onclick={() => (open = !open)} /></span
>
<Popover bind:open title="Reminder" {anchor}>
	<Button variant="quiet" icon="add" onclick={duplicate}>Duplicate reminder</Button>
</Popover>
