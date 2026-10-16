<script lang="ts">
	import StepIcon from './StepIcon.svelte';
	import type { Alignment } from '#lib/core/data/index.ts';
	import { TRAVELLER_ALIGNMENT_STEP, type Night, type NightStep } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import NightText from '#lib/features/reference/NightText.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import Segmented from '#lib/ui/primitives/Segmented.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import {
		boardNightSteps,
		doneKey as keyFor,
		seatName as nameOf,
		stepHolders,
		stepName,
		tonight
	} from './night-steps.ts';

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
	}

	let { open = $bindable(), grimoire, onGuide, onWalk }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	let night = $state<Night>('first');
	// Opens on tonight's list.
	$effect(() => {
		if (open) night = tonight(game);
	});
	const assistance = $derived(preferences.current.assistance);

	const steps = $derived.by((): NightStep[] => {
		const data = officialData.current;
		if (!data || !open) return [];
		return boardNightSteps(game, characters, night, data);
	});

	function setAlignment(seatId: string, alignment: Alignment) {
		grimoire.run({ type: 'SetAlignment', seatId, alignment });
	}

	const holders = (step: NightStep) => stepHolders(game, step, grimoire.open.characters);
	const seatName = (seatId: string) => nameOf(game, seatId);
	const done = $derived(grimoire.nightDone);
	const doneKey = (step: NightStep) => keyFor(game, night, step);
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
			{@const ticked = done.includes(doneKey(step))}
			<li class:ticked>
				<button
					type="button"
					class="tick"
					aria-pressed={ticked}
					aria-label={`Done: ${stepName(step)}`}
					onclick={() => grimoire.toggleNightStep(doneKey(step))}>{ticked ? '✓' : ''}</button
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
						<ul class="travellers">
							{#each step.travellers ?? [] as seatId (seatId)}
								{@const id = game.seats[seatId]?.characterId}
								<li>
									{#if id}
										<CharacterBadge
											characterId={id}
											character={characters.get(id)}
											playerName={seatName(seatId)}
											inline
										/>
									{/if}
									<span class="spacer"></span>
									<Button variant="quiet" onclick={() => setAlignment(seatId, 'good')}>Good</Button>
									<Button variant="quiet" onclick={() => setAlignment(seatId, 'evil')}>Evil</Button>
								</li>
							{/each}
						</ul>
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
		grid-template-columns: var(--tap-target) 48px 1fr;
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
		width: 48px;
		height: 48px;
		--icon-size: 32px;
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
	.travellers {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.travellers li {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		border-bottom: none;
	}
	.spacer {
		flex: 1;
	}
	.none {
		display: block;
		color: var(--on-surface-muted);
	}
</style>
