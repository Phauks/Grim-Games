<script lang="ts">
	import { onDestroy } from 'svelte';
	import { reminderHolder, type ReminderInstance } from '#lib/core/model/index.ts';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * The generic reminder's own text (Trevor, 2026-10-18: "if you touch it, you can add more
	 * information"), in its reminder sheet. Enter saves it, and so does closing the sheet;
	 * emptied, the token goes back to a plain ∞.
	 */
	interface Props {
		grimoire: Grimoire;
		reminder: ReminderInstance;
	}

	let { grimoire, reminder }: Props = $props();
	// eslint-disable-next-line svelte/prefer-writable-derived -- edited here, saved on commit
	let text = $state('');
	$effect.pre(() => {
		text = reminder.note ?? '';
	});

	function save() {
		const note = text.trim();
		// Already taken off the board: nothing to save it on.
		if (note === (reminder.note ?? '') || !reminderHolder(grimoire.game, reminder.reminderId))
			return;
		grimoire.run({ type: 'SetReminderNote', reminderId: reminder.reminderId, note });
	}
	onDestroy(save);
</script>

<TextField
	label="Text"
	bind:value={text}
	maxlength={60}
	enterkeyhint="done"
	oncommit={save}
	testid="reminder-note"
/>
