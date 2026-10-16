<script lang="ts">
	import { GLOSSARY, glossaryEntryUrl, type GlossaryTerm } from '#lib/core/rules/glossary.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Popover from '#lib/ui/primitives/Popover.svelte';
	import { glossaryPopover } from './glossary-popover.svelte.ts';
	import { glossaryKey, linkTarget } from './wiki-glossary.ts';
	import { wikiGlossary } from './wiki-glossary.svelte.ts';

	const keepOpenOn = (target: Element) => target.closest('.glossary-term') !== null;
	// The wiki's own text is fetched the first time a term is opened (and cached on the device).
	$effect(() => {
		if (glossaryPopover.open) void wikiGlossary.load();
	});
	const entry = $derived(
		glossaryPopover.term ? wikiGlossary.definition(glossaryPopover.term.term) : undefined
	);
	const characters = $derived(officialData.current?.characters ?? []);
	const names = $derived(characters.map((c) => c.name));
	const previous = $derived(glossaryPopover.history.at(-1));

	/** Our term for a Glossary entry, or one made from the wiki's entry name. */
	function termFor(key: string): GlossaryTerm {
		const ours = GLOSSARY.find((t) => glossaryKey(t.term) === key);
		if (ours) return ours;
		const name = wikiGlossary.entries.get(key)?.name ?? key;
		return { id: `wiki:${key}`, term: name, variants: [], url: glossaryEntryUrl(name) };
	}
	const idOf = (name: string) => characters.find((c) => c.name === name)?.id ?? name;
</script>

<!--
	The shared overlay for every GlossaryTerm (mounted once, in the layout): the wiki
	Glossary's own wording when it has been fetched, and always the link to the entry. Links
	in the wording ("see Drunk") open that entry here, show a character's badge, or open the
	wiki page; the words themselves stay exactly as the wiki has them.
-->
<Popover
	bind:open={glossaryPopover.open}
	title={glossaryPopover.term?.term ?? ''}
	anchor={glossaryPopover.anchor}
	{keepOpenOn}
>
	{#if glossaryPopover.term}
		{#if previous}
			<button type="button" class="back" onclick={() => glossaryPopover.back()}
				><Icon name="back" /><span>Back to {previous.term}</span></button
			>
		{/if}
		{#if entry}
			<!-- Links in the wording go to the external wiki, not app routes. -->
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<blockquote class="definition" cite={glossaryPopover.term.url} data-testid="wiki-definition">
				{#each entry.parts as part, i (i)}{#if !part.href}{part.text}{:else}{@const target =
							linkTarget(part.href, wikiGlossary.entries, names)}{#if target.kind === 'term'}<button
								type="button"
								class="see"
								onclick={() => glossaryPopover.go(termFor(target.key))}>{part.text}</button
							>{:else if target.kind === 'character'}<CharacterBadge
								characterId={idOf(target.name)}
								text={part.text}
								inline
							/>{:else}<a class="see" href={target.url} target="_blank" rel="noopener"
								>{part.text}</a
							>{/if}{/if}{/each}
			</blockquote>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
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
	}
	/* A followable reference inside the wiki's wording: looks like a link, sits in the line. */
	.see {
		position: relative;
		display: inline;
		min-height: 0;
		padding: 0;
		border: 0;
		background: none;
		color: var(--heading);
		font: inherit;
		text-decoration: underline;
		text-underline-offset: 0.15em;
		cursor: pointer;
	}
	/* A 44px hit area without changing the line. */
	.see::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 50%;
		width: max(100%, var(--tap-target));
		height: var(--tap-target);
		translate: -50% -50%;
	}
	.back {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--tap-target);
		padding: 0;
		border: 0;
		background: none;
		color: var(--on-surface-muted);
		font: inherit;
		cursor: pointer;
		--icon-size: 1rem;
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
