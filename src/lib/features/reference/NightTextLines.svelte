<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Character } from '#lib/core/data/index.ts';
	import type { NightTextLine, NightTextSteps } from '#lib/core/rules/night-text.ts';
	import { explainBlock } from '#lib/features/glossary/glossary.svelte.ts';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import NightTextPiece from './NightTextPiece.svelte';

	interface Props {
		/** The night text split into lines and branches (`nightTextSteps`). */
		steps: NightTextSteps;
		/** The step's character, whose tokens the reminders are. */
		character: Character;
		/**
		 * After a line, by its place in reading order (`nightTextStepLines`): the step's eye
		 * for the info token the line names.
		 */
		lineEnd?: Snippet<[index: number]>;
		/** A line drawn as done (`data-marked-row`): its card has been shown. */
		marked?: (index: number) => boolean;
	}

	let { steps, character, lineEnd, marked }: Props = $props();

	// Every line and condition in reading order, so terms are marked once across the text.
	const pieces = $derived([
		...steps.lines,
		...steps.branches.flatMap((b) => [b.condition, ...b.lines])
	]);
	const explained = $derived.by(() => {
		const flat = pieces.flat();
		const marks = explainBlock(
			flat.map((s) => (s.kind === 'text' ? s.text : '')),
			[character.name]
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
			/>{:else}<NightTextPiece segment={s} {character} />{/if}{/each}{/snippet}

{#snippet list(lines: readonly NightTextLine[], first: number, lettered: boolean)}
	<ol class="lines" class:lettered>
		{#each lines as line, i (i)}
			<li data-marked-row={marked?.(first + i) ? '' : undefined}>
				<span class="line">{@render text(line)}</span>
				{#if lineEnd}<span class="end">{@render lineEnd(first + i)}</span>{/if}
			</li>
		{/each}
	</ol>
{/snippet}

<!--
	Storyteller night text as numbered lines (Trevor, 2026-11-06, the "Ledger"): one line per
	sentence, an "If ...:" sentence heading lettered lines. TPI's words are never changed.
-->
<div class="night-lines" data-testid="night-lines">
	{#if steps.lines.length > 0}{@render list(steps.lines, 0, false)}{/if}
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
	.lines {
		margin: 0;
		padding: 0;
		list-style: none;
		counter-reset: line;
	}
	.lines li {
		counter-increment: line;
		display: grid;
		grid-template-columns: 1.6em minmax(0, 1fr) auto;
		align-items: baseline;
		column-gap: var(--space-2);
		min-height: var(--tap-target);
		padding-block: var(--space-1);
		border-bottom: 0.0625rem solid var(--border);
	}
	.lines li::before {
		content: counter(line);
		color: var(--heading);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.lettered li::before {
		content: counter(line, lower-alpha);
	}
	.line {
		grid-column: 2;
	}
	.end {
		grid-column: 3;
		align-self: center;
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
