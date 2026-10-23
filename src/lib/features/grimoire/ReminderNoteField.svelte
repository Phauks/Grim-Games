<script lang="ts">
	import { reminderHolder, type ReminderInstance } from '#lib/core/model/index.ts';
	import GenericLookFields from './GenericLookFields.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';

	/** A placed generic reminder's own symbol, colour and text, in its reminder sheet. */
	interface Props {
		grimoire: Grimoire;
		reminder: ReminderInstance;
	}

	let { grimoire, reminder }: Props = $props();
	// Already taken off the board: nothing to save it on.
	const held = () => !!reminderHolder(grimoire.game, reminder.reminderId);
</script>

<GenericLookFields
	look={reminder}
	onNote={(note) => {
		if (held()) grimoire.run({ type: 'SetReminderNote', reminderId: reminder.reminderId, note });
	}}
	onSymbol={(symbol) => {
		if (held())
			grimoire.run({ type: 'SetReminderSymbol', reminderId: reminder.reminderId, symbol });
	}}
	onColour={(colour) => {
		if (held())
			grimoire.run({ type: 'SetReminderSymbolColour', reminderId: reminder.reminderId, colour });
	}}
	onFill={(fill) => {
		if (held())
			grimoire.run({ type: 'SetReminderSymbolFill', reminderId: reminder.reminderId, fill });
	}}
/>
