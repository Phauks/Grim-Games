<script lang="ts">
	import CounterAsk from './CounterAsk.svelte';
	import ResetReminders from './ResetReminders.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * The dialogs a new day or night may open over the board, in the order they ask: Reset
	 * Reminders at dawn, then Move counting reminders (plan M53).
	 */
	interface Props {
		grimoire: Grimoire;
	}

	let { grimoire }: Props = $props();
</script>

<ResetReminders {grimoire} />
<CounterAsk {grimoire} />
