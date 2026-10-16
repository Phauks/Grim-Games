<script lang="ts">
	import StepIcon from './StepIcon.svelte';
	import type { Night, NightStep } from '#lib/core/rules/index.ts';
	import NightText from '#lib/features/reference/NightText.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { doneKey, seatName, stepHolders, stepName } from './night-steps.ts';

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
	const holders = $derived(step ? stepHolders(game, step) : []);
	const ticked = $derived(step ? grimoire.nightDone.includes(doneKey(game, night, step)) : false);

	function next() {
		if (step && !ticked) grimoire.toggleNightStep(doneKey(game, night, step));
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
	<IconButton icon="close" label="Stop the walk-through" onclick={onClose} />
</section>

<style>
	.strip {
		position: absolute;
		left: 0;
		right: 0;
		top: calc(100% + var(--space-2));
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
	.strip > :global(button:not(.step)) {
		align-self: center;
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
		width: 40px;
		height: 40px;
		--icon-size: 28px;
		color: var(--heading);
	}
	.body {
		display: grid;
		min-width: 0;
		max-height: 100%;
		overflow-y: auto;
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
