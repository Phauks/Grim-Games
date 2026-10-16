<script lang="ts">
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import { linkTarget, type WikiEntry } from './wiki-glossary.ts';
	import { wikiGlossary } from './wiki-glossary.svelte.ts';

	interface Props {
		entry: WikiEntry;
		/** The entry's address on the wiki, for `cite`. */
		cite: string;
		/** Follows a "see …" link to another Glossary entry, by `glossaryKey`. */
		onTerm: (key: string) => void;
	}

	let { entry, cite, onTerm }: Props = $props();
	const characters = $derived(officialData.current?.characters ?? []);
	const names = $derived(characters.map((c) => c.name));
	const idOf = (name: string) => characters.find((c) => c.name === name)?.id ?? name;
</script>

<!--
	One wiki Glossary entry, word for word (the popover and the Glossary dialog). Links in the
	wording ("see Drunk") open that entry, show a character's badge, or open the wiki page.
-->
<!-- Links in the wording go to the external wiki, not app routes. -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->
<blockquote class="definition" {cite} data-testid="wiki-definition">
	{#each entry.parts as part, i (i)}{#if !part.href}{part.text}{:else}{@const target = linkTarget(
				part.href,
				wikiGlossary.entries,
				names
			)}{#if target.kind === 'term'}<button
					type="button"
					class="see"
					onclick={() => onTerm(target.key)}>{part.text}</button
				>{:else if target.kind === 'character'}<CharacterBadge
					characterId={idOf(target.name)}
					text={part.text}
					inline
				/>{:else}<a class="see" href={target.url} target="_blank" rel="noopener">{part.text}</a
				>{/if}{/if}{/each}
</blockquote>

<!-- eslint-enable svelte/no-navigation-without-resolve -->

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
</style>
