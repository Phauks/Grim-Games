<!--
	The day's Execution on the board (Trevor, 2026-11-06: "make the storyteller pick the player
	who dies on the screen, then confirm it", option B): over the bank's strip, the bar asks for the executed player; a tap on a seat picks them, and the bar
	asks to execute them with Cancel and Confirm at the bottom right. No execution (and the
	Storyteller, with the Atheist on the script) are picked here. When executing the player has
	more to decide, the board opens the Execution sheet instead (`PhaseFlow.pick`).
-->
<script lang="ts">
	import type { CharacterLookup, Game, SeatId } from '#lib/core/model/index.ts';
	import Sentence from '#lib/features/characters/Sentence.svelte';
	import { slot } from '#lib/features/characters/slots.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Chip from '#lib/ui/primitives/Chip.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import { NO_EXECUTION, STORYTELLER, type PhaseFlow } from './phase-flow.svelte.ts';
	import SeatBadge from './SeatBadge.svelte';

	interface Props {
		flow: PhaseFlow;
		game: Game;
		characters: CharacterLookup;
	}

	let { flow, game, characters }: Props = $props();

	const picked = $derived(flow.picked);
	const seatId = $derived(
		picked !== undefined && picked !== NO_EXECUTION && picked !== STORYTELLER
			? (picked as SeatId)
			: undefined
	);
	const question = $derived(
		seatId
			? t('day.executePick', { name: slot('player') })
			: picked === NO_EXECUTION
				? t('day.executePickNone')
				: picked === STORYTELLER
					? t('day.executePickStoryteller')
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

<div class="pick" role="group" aria-label={t('day.execution')} data-testid="execution-pick">
	<!-- The question and No execution on one line, Cancel and Confirm under them, so the bar
	     fits the bank's strip on a phone. -->
	<div class="top">
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
		<Chip pressed={picked === NO_EXECUTION} onclick={() => flow.pick(NO_EXECUTION)}
			>{t('day.noExecution')}</Chip
		>
	</div>
	<ModalActions
		onCancel={() => flow.cancelPick()}
		onConfirm={() => flow.confirmPick()}
		disabled={picked === undefined}
		start={flow.storytellerPickable ? storyteller : undefined}
	/>
</div>

{#snippet storyteller()}
	<Chip pressed={picked === STORYTELLER} onclick={() => flow.pick(STORYTELLER)}
		>{t('day.storyteller')}</Chip
	>
{/snippet}

<style>
	/* Over the bank's own strip, not the board, so no seat near the foot is covered. */
	.pick {
		position: absolute;
		inset: auto 0 0;
		min-height: 100%;
		z-index: 4;
		box-sizing: border-box;
		display: grid;
		align-content: center;
		gap: var(--space-1);
		padding: var(--space-1) var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		--modal-actions-background: var(--surface-raised);
		--modal-actions-inset: 0;
	}
	.top {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.top :global(.chip) {
		flex: none;
		white-space: nowrap;
	}
	/* One line held for the question, so picking never moves the buttons (no reflow). */
	.question {
		display: flex;
		flex: 1;
		align-items: center;
		gap: var(--space-1);
		min-width: 0;
		min-height: 1lh;
		margin: 0;
		overflow: hidden;
		white-space: nowrap;
	}
	.pick :global(.modal-actions) {
		flex-wrap: nowrap;
		padding-top: 0;
		box-shadow: none;
	}
</style>
