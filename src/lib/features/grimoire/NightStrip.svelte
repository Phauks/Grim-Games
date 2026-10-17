<script lang="ts">
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
	}

	let { grimoire, steps, night, index, onIndex, onOpen, onClose }: Props = $props();

	const game = $derived(grimoire.game);
	const step = $derived(steps[index]);
	const holders = $derived(step ? stepHolders(game, step, grimoire.open.characters) : []);
	const ticked = $derived(step ? grimoire.isNightStepDone(night, step) : false);

	// The step's reminders in the bank: ringed, alone or first (Trevor, 2026-10-17).
	let focusOpen = $state(false);
	let focusButton = $state<HTMLElement>();

	function next() {
		if (step && !ticked) grimoire.toggleNightStep(night, step);
		if (index < steps.length - 1) onIndex(index + 1);
		else onClose();
	}
</script>

<section class="strip" aria-label="Night walk-through" data-testid="night-strip">
	<IconButton
		icon="back"
		label="Previous step"
		disabled={index === 0}
		onclick={() => onIndex(index - 1)}
	/>
	{#if step}
		<button type="button" class="step" class:ticked onclick={() => onOpen(step)}>
			<span class="icon">
				<StepIcon {step} size={40} />
			</span>
			<span class="body">
				<span class="name">
					<strong>{stepName(step)}</strong>
					{#each holders as seatId (seatId)}<span class="who">
							· {seatName(game, seatId)}</span
						>{/each}
					<span class="count">{index + 1} of {steps.length}</span>
				</span>
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
	<IconButton
		icon="forward"
		label={index < steps.length - 1 ? 'Next step' : 'Finish the night'}
		onclick={next}
	/>
	<!-- In the top corner (Trevor, 2026-10-16), so Previous and Next own the sides. -->
	<span class="corner">
		<span bind:this={focusButton}
			><IconButton
				icon="filter"
				label="Step reminders"
				onclick={() => (focusOpen = !focusOpen)}
			/></span
		>
		<IconButton icon="close" label="Stop the walk-through" onclick={onClose} />
	</span>
</section>

<Popover bind:open={focusOpen} title="Step reminders" anchor={focusButton}>
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
	/* Clear of the buttons in the corner. */
	.name {
		padding-inline-end: calc(2 * var(--tap-target));
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
	.step.ticked .body {
		opacity: 0.6;
	}
	.icon {
		display: grid;
		flex: none;
		place-items: center;
		width: calc(2.5 * var(--u));
		height: calc(2.5 * var(--u));
		--icon-size: calc(1.75 * var(--u));
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
	.name {
		font-family: var(--font-character);
	}
	.who,
	.count {
		color: var(--on-surface-muted);
	}
	.count {
		margin-inline-start: var(--space-2);
		font-size: 0.8rem;
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
