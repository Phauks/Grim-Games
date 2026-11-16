<script lang="ts">
	import IconButton from '#lib/ui/primitives/IconButton.svelte';

	/**
	 * Previous and Next at the foot of the pane's night step, where a sheet's Cancel and Confirm
	 * sit: two matching arrows, no words; which step it is shows by the night's name at the top
	 * (Trevor, 2026-11-16).
	 */
	interface Props {
		/** The open step's place in the night, from 0; -1 for a step not in it. */
		index: number;
		count: number;
		go: (by: -1 | 1) => void;
		/** Tonight's Next, which ticks the step and, past the last, shows where the night ends. */
		onNext?: () => void;
	}

	let { index, count, go, onNext }: Props = $props();
</script>

<footer class="foot">
	<IconButton
		icon="back"
		label="Previous step"
		outlined
		disabled={index <= 0}
		onclick={() => go(-1)}
	/>
	<IconButton
		icon="forward"
		label="Next step"
		outlined
		disabled={onNext ? index < 0 : index < 0 || index >= count - 1}
		onclick={() => (onNext ? onNext() : go(1))}
	/>
</footer>

<style>
	.foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		padding-block: var(--space-2);
		border-top: var(--card-border);
	}
</style>
