<script lang="ts">
	import { rise } from '#lib/ui/motion.ts';
	import StepIcon from './StepIcon.svelte';
	import NightAlerts from './NightAlerts.svelte';
	import NightSuggested from './NightSuggested.svelte';
	import type { Night, NightStep } from '#lib/core/rules/index.ts';
	import NightText from '#lib/features/reference/NightText.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Popover from '#lib/ui/primitives/Popover.svelte';
	import StepFocusSetting from './StepFocusSetting.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { seatName, stepHolders, stepName } from './night-steps.ts';

	/**
	 * Walking through the night (Trevor, 2026-10-16): the current step under the board, with
	 * TPI's text, and Previous and Next. Next ticks the step; tapping the step opens it to be
	 * filled in. A fixed height, so moving between steps never moves the board.
	 */
	interface Props {
		grimoire: Grimoire;
		steps: readonly NightStep[];
		night: Night;
		index: number;
		onIndex: (index: number) => void;
		onOpen: (step: NightStep) => void;
		onClose: () => void;
		/** Next on the last step: nothing is left, so the board points at End night. */
		onPastEnd?: () => void;
		/**
		 * A special rule keeps this step's player asleep (I See Dead People: poisoned players
		 * don't wake), named by the rule. The board works it out, so night steps stay mode-free.
		 */
		asleepBy?: string;
		/** A special rule leaves this step's seat to no one (The Ballad of Seat 7), named by the rule. */
		emptySeatBy?: string;
	}

	let {
		grimoire,
		steps,
		night,
		index,
		onIndex,
		onOpen,
		onClose,
		onPastEnd,
		asleepBy,
		emptySeatBy
	}: Props = $props();

	const game = $derived(grimoire.game);
	const step = $derived(steps[index]);
	const holders = $derived(step ? stepHolders(game, step, grimoire.open.characters) : []);
	const ticked = $derived(step ? grimoire.isNightStepDone(night, step) : false);

	// The step's reminders in the bank: ringed, alone or first (Trevor, 2026-10-17).
	let focusOpen = $state(false);
	let focusButton = $state<HTMLElement>();

	const last = $derived(index >= steps.length - 1);
	function next() {
		if (step && !ticked) grimoire.toggleNightStep(night, step, { startDay: false });
		if (!last) onIndex(index + 1);
		// Nothing after it: show where the night ends (Trevor, 2026-10-19).
		else onPastEnd?.();
	}
</script>

<!-- Rises into place under the board rather than appearing at once (Trevor, 2026-10-19); it is
     positioned over the space below, so nothing moves. `global`: it plays when the board's
     walk-through starts or ends, not only inside this component. -->
<section
	class="strip"
	aria-label="Night walk-through"
	data-testid="night-strip"
	in:rise|global
	out:rise|global={{ speed: 'fast' }}
>
	<IconButton
		icon="back"
		label="Previous step"
		disabled={index === 0}
		onclick={() => onIndex(index - 1)}
	/>
	{#if step}
		<!-- Above Previous, where the side is free (Trevor, 2026-10-18). -->
		<span class="icon">
			<StepIcon {step} size={44} details />
		</span>
		<button type="button" class="step" class:ticked onclick={() => onOpen(step)}>
			<span class="body">
				<!-- The character on the first line, its player on the second, and the count at the
				     right of the top row, before ⋯ and X (Trevor, 2026-10-20). -->
				<span class="name">
					<strong>{stepName(step)}</strong>
					<span class="count">{index + 1} of {steps.length}</span>
				</span>
				{#if holders.length > 0}<span class="who"
						>{holders.map((seatId) => seatName(game, seatId)).join(', ')}</span
					>{/if}
				<!-- Inside the strip's fixed height, which scrolls, so nothing outside moves. -->
				{#if asleepBy}<span class="asleep" data-testid="step-asleep"
						>Poisoned: doesn’t wake ({asleepBy})</span
					>{/if}
				{#if emptySeatBy}<span class="empty-seat" data-testid="step-empty-seat"
						>No player: make its choices ({emptySeatBy})</span
					>{/if}
				<NightAlerts {grimoire} {step} compact />
				<NightSuggested {grimoire} {step} compact />
				<span class="text">
					{#if step.reminder}
						{#if step.character}
							<NightText text={step.reminder} character={step.character} {night} />
						{:else}
							{step.reminder}
						{/if}
					{/if}
				</span>
			</span>
		</button>
	{:else}
		<span class="step none">None</span>
	{/if}
	<!-- Next ticks the step; the bank's End night ends the night (Trevor, 2026-10-18), and Next
	     past the last step lights it up (Trevor, 2026-10-19). -->
	<IconButton icon="forward" label="Next step" onclick={next} />
	<!-- In the top corner (Trevor, 2026-10-16), so Previous and Next own the sides. The step
	     reminders setting is behind ⋯, the app's icon for more choices (Trevor, 2026-10-18). -->
	<span class="corner">
		<span bind:this={focusButton}
			><IconButton
				icon="more"
				label="Character reminders"
				onclick={() => (focusOpen = !focusOpen)}
			/></span
		>
		<IconButton icon="close" label="Stop the walk-through" onclick={onClose} />
	</span>
</section>

<Popover bind:open={focusOpen} title="Character reminders" anchor={focusButton}>
	<StepFocusSetting />
</Popover>

<style>
	.strip {
		position: absolute;
		left: 0;
		right: 0;
		/* Under the step's reminders tray (NightTray). */
		top: calc(100% + 2 * var(--space-2) + var(--tray-h));
		z-index: 2;
		display: flex;
		align-items: stretch;
		gap: var(--space-1);
		height: var(--strip-h);
		box-sizing: border-box;
		padding: var(--space-1);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
	}
	/* Previous and Next are the big targets down each side, under the Stop corner. */
	.strip > :global(button:not(.step)) {
		align-self: stretch;
		height: auto;
		margin-top: var(--tap-target);
	}
	.corner {
		position: absolute;
		top: 0;
		right: 0;
		z-index: 1;
		display: flex;
	}
	/* Clear of the count and the buttons in the corner. */
	.name {
		padding-inline-end: calc(2 * var(--tap-target) + 4.5rem);
	}
	.step {
		flex: 1;
		min-width: 0;
		display: flex;
		gap: var(--space-2);
		align-items: flex-start;
		padding: var(--space-1);
		border: 0;
		border-radius: var(--radius-md);
		background: none;
		color: inherit;
		font: inherit;
		text-align: start;
		cursor: pointer;
	}
	.step:hover {
		background: var(--surface-selected);
	}
	.step.ticked .body,
	.strip:has(.step.ticked) .icon {
		opacity: 0.6;
	}
	/* In the free space above Previous, as wide as it. */
	.icon {
		position: absolute;
		top: var(--space-1);
		left: var(--space-1);
		display: grid;
		place-items: center;
		width: var(--tap-target);
		height: var(--tap-target);
		--icon-size: var(--tap-target);
		color: var(--heading);
	}
	.body {
		display: grid;
		min-width: 0;
		max-height: 100%;
		overflow-y: auto;
		/* Scrolls by swipe or wheel, with no bar drawn (Trevor, 2026-10-16). */
		scrollbar-width: none;
	}
	.body::-webkit-scrollbar {
		display: none;
	}
	.name,
	.who {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.name {
		font-family: var(--font-character);
	}
	.who {
		font-family: var(--font-player);
	}
	.who,
	.count {
		color: var(--on-surface-muted);
	}
	/* Always at the right of the top row, never under the name. */
	.count {
		position: absolute;
		top: var(--space-1);
		right: calc(2 * var(--tap-target));
		display: grid;
		align-items: center;
		height: var(--tap-target);
		font-size: 0.8rem;
		white-space: nowrap;
	}
	.asleep {
		color: var(--evil);
		font-size: 0.9rem;
	}
	.empty-seat {
		color: var(--on-surface-muted);
		font-size: 0.9rem;
	}
	.text {
		font-family: var(--font-ability);
		font-size: 0.9rem;
		line-height: 1.3;
	}
	.none {
		display: grid;
		place-items: center;
		color: var(--on-surface-muted);
	}
</style>
