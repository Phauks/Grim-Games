<script lang="ts">
	import type { GlossaryTerm } from '#lib/core/rules/glossary.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Popover from '#lib/ui/primitives/Popover.svelte';

	interface Props {
		term: GlossaryTerm;
		/** The word as written in the game text ("poisoned", "registers"). */
		text: string;
	}

	let { term, text }: Props = $props();
</script>

<!-- A rules term in game text: dotted underline (not a link); tap for our short definition. -->
<Popover
	title={term.term}
	triggerClass="glossary-term"
	triggerLabel={`${text}: explain rules term`}
>
	{#snippet trigger()}{text}{/snippet}
	<p class="definition">{term.definition}</p>
	<!-- External wiki Glossary (the rules authority), not an app route. -->
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
	<a class="wiki" href={term.url} target="_blank" rel="noopener"
		><Icon name="wiki" /><span>Open Glossary</span></a
	>
</Popover>

<style>
	:global(.glossary-term) {
		position: relative;
		display: inline;
		/* The line keeps its height; the ::after below is the tap target. */
		min-height: 0;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		letter-spacing: inherit;
		text-transform: inherit;
		text-align: inherit;
		text-decoration: underline dotted;
		text-decoration-thickness: 1.5px;
		text-underline-offset: 0.2em;
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
	}
	/* A 44px hit area around the word without changing the line's layout. */
	:global(.glossary-term)::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 50%;
		width: max(calc(100% + var(--space-2)), var(--tap-target));
		height: var(--tap-target);
		translate: -50% -50%;
	}
	:global(.glossary-term[data-state='open']) {
		text-decoration-style: solid;
	}
	:global(.glossary-term:focus-visible) {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
		border-radius: var(--radius-sm);
	}
	.definition {
		margin: var(--space-1) 0 var(--space-2);
	}
	.wiki {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
		color: inherit;
		font-weight: 600;
		--icon-size: 1.1rem;
	}
</style>
