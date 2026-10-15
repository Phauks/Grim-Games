<script lang="ts">
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Popover from '#lib/ui/primitives/Popover.svelte';
	import { glossaryPopover } from './glossary-popover.svelte.ts';
	import { wikiGlossary } from './wiki-glossary.svelte.ts';

	const keepOpenOn = (target: Element) => target.closest('.glossary-term') !== null;
	// The wiki's own text is fetched the first time a term is opened (and cached on the device).
	$effect(() => {
		if (glossaryPopover.open) void wikiGlossary.load();
	});
	const definition = $derived(
		glossaryPopover.term ? wikiGlossary.definition(glossaryPopover.term.term) : undefined
	);
</script>

<!--
	The shared overlay for every GlossaryTerm (mounted once, in the layout): the wiki
	Glossary's own wording when it has been fetched, and always the link to the entry.
-->
<Popover
	bind:open={glossaryPopover.open}
	title={glossaryPopover.term?.term ?? ''}
	anchor={glossaryPopover.anchor}
	{keepOpenOn}
>
	{#if glossaryPopover.term}
		{#if definition}
			<blockquote class="definition" cite={glossaryPopover.term.url} data-testid="wiki-definition">
				{definition}
			</blockquote>
		{/if}
		<!-- External wiki Glossary (the rules authority), not an app route. -->
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a class="wiki" href={glossaryPopover.term.url} target="_blank" rel="noopener"
			><Icon name="wiki" /><span>Open Glossary</span></a
		>
	{/if}
</Popover>

<style>
	.definition {
		margin: var(--space-1) 0 var(--space-2);
		padding-left: var(--space-2);
		border-left: 2px solid var(--border);
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
