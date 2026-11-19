<script lang="ts">
	import Button from '#lib/ui/primitives/Button.svelte';
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import type { NightStep } from '#lib/core/rules/night/night-order.ts';
	import { countedPlace } from './night-steps.ts';

	/**
	 * Previous and Next at the foot of the pane's night step, where a sheet's Cancel and Confirm
	 * sit: two matching arrows, no words (Trevor, 2026-11-16). Between them, how far through the
	 * night it is: a thin line, the count small under it (Trevor, 2026-11-17, "D Progress line"),
	 * as plain muted text (Trevor, 2026-11-18, "A Line, plain text"). The count leaves out Dusk
	 * and Dawn, the night's bookends, and shows nothing on them (Trevor, 2026-11-18).
	 */
	interface Props {
		/** Tonight's steps, Dusk to Dawn. */
		steps: readonly NightStep[];
		/** The open step's place in the night, from 0; -1 for a step not in it. */
		index: number;
		go: (by: -1 | 1) => void;
		/** Tonight's Next, which ticks the step and, past the last, shows where the night ends. */
		onNext?: () => void;
		/** Ends tonight, as the bank's End night does: on the last step (Dawn) it takes Next's
		 *  place (Trevor, 2026-11-17: "on the last screen, dawn, change arrow into an end night
		 *  button"). */
		onEndNight?: () => void;
	}

	let { steps, index, go, onNext, onEndNight }: Props = $props();
	const count = $derived(steps.length);
	/** The count leaves out Dusk and Dawn (night-steps.ts `countedPlace`). */
	const counted = $derived(countedPlace(steps, steps[index]));
	const last = $derived(index >= 0 && index === count - 1);
	const shown = $derived(count > 0 && index >= 0);
</script>

<footer class="foot">
	<IconButton
		icon="back"
		label="Previous step"
		outlined
		disabled={index <= 0}
		onclick={() => go(-1)}
	/>
	<!-- Reserved when the step isn't in tonight's list, so the arrows never move. -->
	<span class="progress" aria-hidden={!shown}
		><span class="track"
			><span class="done" style:inline-size="{shown ? ((index + 1) / count) * 100 : 0}%"
			></span></span
		><span class="step-of"
			>{#if counted.place >= 0}<CountBadge
					count={counted.place + 1}
					total={counted.of}
					plain
					testid="step-count"
				/>{/if}</span
		></span
	>
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
	.progress {
		display: grid;
		flex: 1;
		justify-items: center;
		gap: var(--space-1);
		min-width: 0;
		padding-inline: var(--space-2);
	}
	.track {
		position: relative;
		overflow: hidden;
		inline-size: 100%;
		block-size: 0.35rem;
		border-radius: var(--radius-full);
		background: var(--surface-selected);
	}
	.done {
		position: absolute;
		inset-block: 0;
		inset-inline-start: 0;
		background: var(--heading);
	}
	/* The badge's height kept on a step not in tonight's list, so nothing moves. */
	.step-of {
		display: flex;
		justify-content: center;
		min-block-size: 1.6em;
		font-size: 0.8rem;
	}
</style>
