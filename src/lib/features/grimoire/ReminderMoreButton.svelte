<script lang="ts">
	import type { Reminder, ReminderId } from '#lib/core/model/index.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Popover from '#lib/ui/primitives/Popover.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { onBoard } from './reminders.ts';

	/**
	 * A reminder's ⋯ (Trevor, 2026-10-18), beside its delete in a placed reminder's sheet and
	 * in the bank's "Put on" (Trevor, 2026-10-20): Duplicate reminder adds another copy to the
	 * reminder bank, never to the board. More copies than the game gives is unusual, so a toast
	 * says so; never blocked.
	 */
	interface Props {
		grimoire: Grimoire;
		/** A placed reminder, by id. */
		reminderId?: ReminderId;
		/** Or a bank token, by what it is. */
		reminder?: Pick<Reminder, 'characterId' | 'label'>;
		/** After duplicating, so the sheet can close. */
		onDone?: () => void;
	}

	let { grimoire, reminderId, reminder, onDone }: Props = $props();
	let open = $state(false);
	let anchor = $state<HTMLElement>();

	function duplicate() {
		open = false;
		const token =
			reminder ??
			(reminderId ? onBoard(grimoire.game).find((r) => r.reminderId === reminderId) : undefined);
		if (!token) return;
		grimoire.addBankCopy({ characterId: token.characterId, label: token.label });
		toast('Uncommon', 'More copies of this reminder than the game gives. The copy is in the bank.');
		onDone?.();
	}
</script>

<span bind:this={anchor}
	><IconButton icon="more" label="More reminder actions" onclick={() => (open = !open)} /></span
>
<Popover bind:open title="Reminder" {anchor}>
	<Button variant="quiet" icon="add" onclick={duplicate}>Duplicate reminder</Button>
</Popover>
