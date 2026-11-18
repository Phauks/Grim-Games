<script lang="ts">
	import Button from '#lib/ui/primitives/Button.svelte';
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
		/** Ends tonight, as the bank's End night does: on the last step (Dawn) it takes Next's
		 *  place (Trevor, 2026-11-17: "on the last screen, dawn, change arrow into an end night
		 *  button"). */
		onEndNight?: () => void;
	}

	let { index, count, go, onNext, onEndNight }: Props = $props();
	const last = $derived(index >= 0 && index === count - 1);
</script>

<footer class="foot">
	<IconButton
		icon="back"
		label="Previous step"
		outlined
		disabled={index <= 0}
		onclick={() => go(-1)}
	/>
	{#if onEndNight && last}<Button icon="day" data-testid="step-end-night" onclick={onEndNight}
			>End night</Button
		>{:else}<IconButton
			icon="forward"
			label="Next step"
			outlined
			disabled={onNext ? index < 0 : index < 0 || index >= count - 1}
			onclick={() => (onNext ? onNext() : go(1))}
		/>{/if}
</footer>

<style>
	.foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		/* The pane's side inset (StorytellerPane), so the two arrows sit as far in from each
		   side (Trevor, 2026-11-17). */
		margin-inline: var(--pane-gutter, 0rem);
		padding-block: var(--space-2);
		border-top: var(--card-border);
	}
</style>
