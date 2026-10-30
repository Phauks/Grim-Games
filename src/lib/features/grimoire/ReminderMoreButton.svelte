<script lang="ts">
	import type { ReminderId } from '#lib/core/model/index.ts';
	import Menu from '#lib/ui/primitives/Menu.svelte';
	import { duplicateReminder } from './duplicate-reminder.ts';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { onBoard } from './reminders.ts';

	/**
	 * A placed reminder's ⋯ (Trevor, 2026-10-18), beside its delete in its sheet: a menu whose
	 * Duplicate reminder is a row, not a button (Trevor, 2026-10-30).
	 */
	interface Props {
		grimoire: Grimoire;
		reminderId?: ReminderId;
		/** After duplicating, so the sheet can close. */
		onDone?: () => void;
	}

	let { grimoire, reminderId, onDone }: Props = $props();

	function duplicate() {
		const token = reminderId
			? onBoard(grimoire.game).find((r) => r.reminderId === reminderId)
			: undefined;
		if (!token) return;
		duplicateReminder(grimoire, token);
		onDone?.();
	}
</script>

<Menu
	label="More reminder actions"
	items={[{ value: 'duplicate', label: 'Duplicate reminder', onSelect: duplicate }]}
/>
