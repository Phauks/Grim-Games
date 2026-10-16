<script lang="ts">
	import StepIcon from './StepIcon.svelte';
	import { TRAVELLER_ALIGNMENT_STEP, type Night, type NightStep } from '#lib/core/rules/index.ts';
	import TravellerAlignment from './TravellerAlignment.svelte';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import NightText from '#lib/features/reference/NightText.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import Segmented from '#lib/ui/primitives/Segmented.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { boardNightSteps, seatName as nameOf, stepHolders, stepName } from './night-steps.ts';
	import { untrack } from 'svelte';

	/**
	 * The night order for this game: the characters in play that wake tonight, in order,
	 * with TPI's night text. Each row is the character's icon (two lines tall), its name and
	 * who has it on the first line, and what happens beneath. The Storyteller ticks steps off
	 * by hand; a new day starts with no ticks. With "Guide night steps" on, tapping a step
	 * opens it to be filled in; with "Walk me through the night" on, the night can be walked
	 * through one step at a time under the board.
	 */
	interface Props {
		open: boolean;
		grimoire: Grimoire;
		onGuide: (step: NightStep, night: Night) => void;
		onWalk: (night: Night) => void;
		/** A Traveller's alignment by draw. */
		onDraw: (seatId: string) => void;
	}

	let { open = $bindable(), grimoire, onGuide, onWalk, onDraw }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	let night = $state<Night>('first');
	// Opens on the list of the night being run; ticking Dawn (a new day) doesn't switch it.
	$effect(() => {
		if (open) night = untrack(() => (grimoire.nightDay === 0 ? 'first' : 'other'));
	});
	const assistance = $derived(preferences.current.assistance);

	const steps = $derived.by((): NightStep[] => {
		const data = officialData.current;
		if (!data || !open) return [];
		return boardNightSteps(game, characters, night, data);
	});

	const holders = (step: NightStep) => stepHolders(game, step, grimoire.open.characters);
	const seatName = (seatId: string) => nameOf(game, seatId);
</script>

<Dialog bind:open title="Night order" size="full">
	<div class="head">
		{#if assistance.nightWalkthrough}
			<Button
				variant="accent"
				icon="forward"
				disabled={steps.length === 0}
				onclick={() => {
					open = false;
					onWalk(night);
				}}>Walk through</Button
			>
		{/if}
		<Segmented
			label="Night"
			hideLabel
			value={night}
			options={[
				{ value: 'first', label: 'First night' },
				{ value: 'other', label: 'Other nights' }
			]}
			onChange={(n) => (night = n)}
		/>
	</div>
	<ol class="steps">
		{#each steps as step (step.id)}
			{@const ticked = grimoire.isNightStepDone(night, step)}
			<li class:ticked>
				<button
					type="button"
					class="tick"
					aria-pressed={ticked}
					aria-label={`Done: ${stepName(step)}`}
					onclick={() => grimoire.toggleNightStep(night, step)}>{ticked ? '✓' : ''}</button
				>
				<span class="icon">
					<StepIcon {step} size={48} />
				</span>
				<div class="body">
					{#if assistance.nightGuide && step.id !== TRAVELLER_ALIGNMENT_STEP}
						<button
							type="button"
							class="guide"
							aria-label={`Guide: ${stepName(step)}`}
							onclick={() => {
								open = false;
								onGuide(step, night);
							}}
						></button>
					{/if}
					<p class="name">
						<strong>{stepName(step)}</strong>
						{#if step.character}
							{#each holders(step) as seatId (seatId)}
								<span class="who">· {seatName(seatId)}</span>
							{/each}
						{/if}
					</p>
					{#if step.id === TRAVELLER_ALIGNMENT_STEP}
						<TravellerAlignment
							{grimoire}
							travellers={step.travellers ?? []}
							onDraw={(seatId) => {
								open = false;
								onDraw(seatId);
							}}
						/>
					{:else if step.reminder}
						<p class="text">
							{#if step.character}
								<NightText text={step.reminder} character={step.character} {night} />
							{:else}
								{step.reminder}
							{/if}
						</p>
					{/if}
				</div>
			</li>
		{:else}
			<li class="none">None</li>
		{/each}
	</ol>
</Dialog>

<style>
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		padding-bottom: var(--space-2);
		border-bottom: 1px solid var(--border);
	}
	.steps {
		flex: 1;
		min-height: 0;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		list-style: none;
	}
	li {
		display: grid;
		grid-template-columns: var(--tap-target) calc(3 * var(--u)) 1fr;
		gap: var(--space-2);
		align-items: start;
		padding: var(--space-1) 0;
		border-bottom: 1px solid var(--border);
	}
	li.ticked .icon,
	li.ticked .body {
		opacity: 0.45;
	}
	.tick {
		width: var(--tap-target);
		height: var(--tap-target);
		border: 2px solid var(--border);
		border-radius: var(--radius-md);
		background: none;
		color: var(--accent);
		font: 700 1.2rem / 1 var(--font-control);
		cursor: pointer;
	}
	.tick:hover {
		background: var(--surface-selected);
	}
	/* The icon is as tall as the name line and the first line of text together. */
	.icon {
		display: grid;
		place-items: center;
		width: calc(3 * var(--u));
		height: calc(3 * var(--u));
		--icon-size: calc(2 * var(--u));
		color: var(--heading);
	}
	.body {
		position: relative;
	}
	.body p {
		margin: 0;
	}
	/* The whole step is the tap target that opens it to be filled in. */
	.guide {
		position: absolute;
		inset: 0;
		z-index: 1;
		border: 0;
		border-radius: var(--radius-md);
		background: none;
		cursor: pointer;
	}
	.guide:hover {
		background: var(--surface-selected);
	}
	.name {
		font-family: var(--font-character);
		line-height: 1.5;
	}
	.who {
		color: var(--on-surface-muted);
	}
	.text {
		font-family: var(--font-ability);
		font-size: 0.95rem;
		line-height: 1.35;
	}
	.none {
		display: block;
		color: var(--on-surface-muted);
	}
</style>
