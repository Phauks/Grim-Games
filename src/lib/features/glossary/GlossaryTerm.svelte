<script lang="ts">
	import type { GlossaryTerm } from '#lib/core/rules/glossary.ts';

	interface Props {
		term: GlossaryTerm;
		/** The word as written in the game text ("poisoned", "registers"). */
		text: string;
	}

	let { term, text }: Props = $props();
</script>

<!--
	A rules term in game text: dotted underline; tapping opens the wiki Glossary at the entry.
	Our own definitions (GlossaryPopover) are parked: Trevor asked to stop adding our own
	information for now (2026-10-15).
-->
<!-- External wiki Glossary (the rules authority), not an app route. -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->
<a
	href={term.url}
	class="glossary-term"
	target="_blank"
	rel="noopener"
	aria-label={`${text}: open in the wiki Glossary`}>{text}</a
>

<!-- eslint-enable svelte/no-navigation-without-resolve -->

<style>
	.glossary-term {
		position: relative;
		display: inline;
		/* The line keeps its height; the ::after below is the tap target. */
		min-height: 0;
		padding: 0;
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
	.glossary-term::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 50%;
		width: max(calc(100% + var(--space-2)), var(--tap-target));
		height: var(--tap-target);
		translate: -50% -50%;
	}
	.glossary-term:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
		border-radius: var(--radius-sm);
	}
</style>
