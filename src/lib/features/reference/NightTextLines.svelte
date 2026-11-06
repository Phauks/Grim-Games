<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Alignment, Character } from '#lib/core/data/index.ts';
	import type { NightTextLine, NightTextSteps } from '#lib/core/rules/night-text.ts';
	import { explainBlock } from '#lib/features/glossary/glossary.svelte.ts';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import NightTextPiece from './NightTextPiece.svelte';
	import StepLine from './StepLine.svelte';
	import StepLines from './StepLines.svelte';

	interface Props {
		/** The night text split into lines and branches (`nightTextSteps`). */
		steps: NightTextSteps;
		/** The step's character, whose tokens the reminders are; none for Dusk, Dawn and the like. */
		character?: Character;
		/** The step's own name, never marked as a Glossary term in its own text. */
		name?: string;
		/**
		 * Alignment of the player who has the character, when one does: its tokens are drawn in
		 * it, as on the board (a turned-evil Townsfolk's are red).
		 */
		alignment?: Alignment;
		/**
		 * After a line, by its place in reading order (`nightTextStepLines`): the step's eye
		 * for the info token the line names.
		 */
		lineEnd?: Snippet<[index: number]>;
		/** A line drawn as done (`data-marked-row`): its card has been shown. */
		marked?: (index: number) => boolean;
		/** Under a line's words, by its place in reading order: what its card points at. */
		lineExtra?: Snippet<[index: number]>;
		/**
		 * More `StepLine`s after the text's own lines, numbered on from them: the cards Minion
		 * info and Demon info show (`EvilInfoCards`).
		 */
		after?: Snippet<[start: number]>;
	}

	let { steps, character, name, alignment, lineEnd, lineExtra, marked, after }: Props = $props();

	// Every line and condition in reading order, so terms are marked once across the text.
	const pieces = $derived([
		...steps.lines,
		...steps.branches.flatMap((b) => [b.condition, ...b.lines])
	]);
	const explained = $derived.by(() => {
		const flat = pieces.flat();
		const marks = explainBlock(
			flat.map((s) => (s.kind === 'text' ? s.text : '')),
			[name ?? character?.name ?? '']
		);
		let at = 0;
		return pieces.map((line) => line.map(() => marks[at++] ?? []));
	});
	const at = (line: NightTextLine) => pieces.indexOf(line);
	const lineIndex = (branch: number, i: number) =>
		steps.lines.length +
		steps.branches.slice(0, branch).reduce((n, b) => n + b.lines.length, 0) +
		i;
</script>

{#snippet text(line: NightTextLine)}{@const marks =
		explained[at(line)] ?? []}{#each line as s, i (i)}{#if s.kind === 'text'}<GlossaryText
				segments={marks[i] ?? []}
			/>{:else}<NightTextPiece segment={s} {character} {alignment} />{/if}{/each}{/snippet}

{#snippet list(lines: readonly NightTextLine[], first: number, lettered: boolean)}
	<StepLines {lettered}>
		{#each lines as line, i (i)}
			<StepLine marked={marked?.(first + i) ?? false}>
				{@render text(line)}{@render lineExtra?.(first + i)}
				{#snippet end()}{@render lineEnd?.(first + i)}{/snippet}
			</StepLine>
		{/each}
	</StepLines>
{/snippet}

<!--
	Storyteller night text as numbered lines (Trevor, 2026-11-06, the "Ledger"): one line per
	sentence, an "If ...:" sentence heading lettered lines. TPI's words are never changed.
-->
<div class="night-lines" data-testid="night-lines">
	{#if steps.lines.length > 0}{@render list(steps.lines, 0, false)}{/if}
	{#if after}<StepLines start={steps.lines.length}>{@render after(steps.lines.length)}</StepLines
		>{/if}
	{#each steps.branches as branch, b (b)}
		<div class="branch">
			<p class="condition">{@render text(branch.condition)}</p>
			{@render list(branch.lines, lineIndex(b, 0), true)}
		</div>
	{/each}
</div>

<style>
	.night-lines {
		font-family: var(--font-ability);
		line-height: 1.35;
		border-top: 0.0625rem solid var(--border);
	}
	.branch {
		padding-inline-start: 1.6em;
	}
	.condition {
		margin: 0;
		padding-block: var(--space-2) 0;
		color: var(--heading);
		font-style: italic;
	}
</style>
