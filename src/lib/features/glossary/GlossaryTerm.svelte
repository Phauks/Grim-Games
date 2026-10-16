<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { GlossaryTerm } from '#lib/core/rules/glossary.ts';
	import { glossaryPopover } from './glossary-popover.svelte.ts';

	interface Props {
		term: GlossaryTerm;
		/** The word as written in the game text ("poisoned", "registers"). */
		text: string;
	}

	let { term, text }: Props = $props();
	let button = $state<HTMLElement>();
	const show = () => button && glossaryPopover.show(term, button);
	const open = $derived(glossaryPopover.open && glossaryPopover.anchor === button);
</script>

<!--
	A rules term in game text: dotted underline (not a link); tap for the wiki definition
	in the shared GlossaryPopover.
-->
<!-- A span with the button role, not a <button>: a button is one unbreakable box, so a
     two-word term ("start knowing", "alive neighbors") jumped whole to the next line and left
     a gap. A span wraps like the words around it. -->
<span
	bind:this={button}
	role="button"
	tabindex="0"
	class="glossary-term"
	aria-label={t('glossary.explain', { term: text })}
	aria-haspopup="dialog"
	aria-expanded={open}
	data-state={open ? 'open' : 'closed'}
	onclick={show}
	onkeydown={(event) => {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		show();
	}}>{text}</span
>

<style>
	.glossary-term {
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
		/* Below the descenders and unbroken, so g, p, q and y stay underlined in every font. */
		text-underline-position: under;
		text-underline-offset: 0.08em;
		text-decoration-skip-ink: none;
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
	.glossary-term[data-state='open'] {
		text-decoration-style: solid;
	}
	.glossary-term:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
		border-radius: var(--radius-sm);
	}
</style>
