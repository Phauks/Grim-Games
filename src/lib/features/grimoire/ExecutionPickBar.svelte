<!--
	The day's Execution on the board (Trevor, 2026-11-06: "make the storyteller pick the player
	who dies on the screen, then confirm it", option B). It lies over the bank's strip of tokens
	and nothing else, so no seat is covered: its question on the strip's top edge where the
	captions sit, No execution and Cancel in the strip, and the bank's own button turned into
	Confirm (`PhaseFlow.run`). A tap on a seat picks it. When executing the player has more to
	decide, the board opens the Execution sheet instead (`PhaseFlow.pick`).
-->
<script lang="ts">
	import type { CharacterLookup, Game } from '#lib/core/model/index.ts';
	import Sentence from '#lib/features/characters/Sentence.svelte';
	import { slot } from '#lib/features/characters/slots.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Chip from '#lib/ui/primitives/Chip.svelte';
	import { NO_EXECUTION, type PhaseFlow } from './phase-flow.svelte.ts';
	import SeatBadge from './SeatBadge.svelte';

	interface Props {
		flow: PhaseFlow;
		game: Game;
		characters: CharacterLookup;
	}

	let { flow, game, characters }: Props = $props();

	const seatId = $derived(flow.pickedSeat);
	const question = $derived(
		seatId
			? t('day.executePick', { name: slot('player') })
			: flow.picked === NO_EXECUTION
				? t('day.executePickNone')
				: t('day.executePickAsk')
	);
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key !== 'Escape' || event.defaultPrevented) return;
		event.preventDefault();
		flow.cancelPick();
	}}
/>

<div
	class="pick"
	data-execution-pick
	role="group"
	aria-label={t('day.execution')}
	data-testid="execution-pick"
>
	<p class="question" role="status" data-testid="execution-pick-question">
		<Sentence text={question}
			>{#snippet fill()}<SeatBadge
					{game}
					{characters}
					{seatId}
					interactive={false}
				/>{/snippet}</Sentence
		>
	</p>
	<Chip pressed={flow.picked === NO_EXECUTION} onclick={() => flow.pick(NO_EXECUTION)}
		>{t('day.noExecution')}</Chip
	>
	<!-- Cancel at the end, beside the bank's button, which is Confirm while this shows. -->
	<span class="cancel"
		><Button variant="quiet" onclick={() => flow.cancelPick()}>{t('common.cancel')}</Button></span
	>
</div>

<style>
	/* The strip of tokens only: the bank's button stays beside it, as Confirm. */
	.pick {
		position: absolute;
		inset: 0 var(--run-w, 5.5rem) 0 0;
		z-index: 4;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-2);
		border-start-start-radius: inherit;
		border-end-start-radius: inherit;
		/* Opaque, so the tokens under it don't show through. */
		background: var(--surface);
	}
	/* The strip's captions and handle bar go while it asks: its question is on that edge. */
	:global([data-tray]:has([data-execution-pick]) :is(.caption, .grab)) {
		visibility: hidden;
	}
	.pick :global(.chip) {
		flex: none;
		white-space: nowrap;
	}
	.cancel {
		margin-inline-start: auto;
	}
	/* On the strip's top edge, as its captions are; one line, so nothing moves (no reflow). */
	.question {
		position: absolute;
		top: 0;
		left: var(--space-2);
		right: var(--space-2);
		z-index: 1;
		display: flex;
		align-items: center;
		gap: var(--space-1);
		width: fit-content;
		max-width: calc(100% - 2 * var(--space-2));
		margin: 0;
		padding: 0 var(--space-2);
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: var(--radius-full);
		background: var(--surface-raised);
		font-size: 0.8rem;
		white-space: nowrap;
		transform: translateY(-50%);
	}
</style>
