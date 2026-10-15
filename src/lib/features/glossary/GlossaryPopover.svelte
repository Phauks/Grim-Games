<script lang="ts">
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Popover from '#lib/ui/primitives/Popover.svelte';
	import { glossaryPopover } from './glossary-popover.svelte.ts';

	const keepOpenOn = (target: Element) => target.closest('.glossary-term') !== null;
</script>

<!-- The shared definition overlay for every GlossaryTerm (mounted once, in the layout). -->
<Popover
	bind:open={glossaryPopover.open}
	title={glossaryPopover.term?.term ?? ''}
	anchor={glossaryPopover.anchor}
	{keepOpenOn}
>
	{#if glossaryPopover.term}
		<p class="definition">{glossaryPopover.term.definition}</p>
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
