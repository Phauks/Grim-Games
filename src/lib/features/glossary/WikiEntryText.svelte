<script lang="ts">
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import { linkTarget, type WikiEntry } from './wiki-glossary.ts';
	import { wikiGlossary } from './wiki-glossary.svelte.ts';
	import GlossaryText from './GlossaryText.svelte';

	interface Props {
		entry: WikiEntry;
		/** The entry's address on the wiki, for `cite`. */
		cite: string;
		/** Follows a "see …" link to another Glossary entry, by `glossaryKey`, from `link`. */
		onTerm: (key: string, link: HTMLElement) => void;
		/** The term this entry defines, by id: never marked in its own wording (it would link to itself). */
		term?: string;
	}

	let { entry, cite, onTerm, term }: Props = $props();
	const characters = $derived(officialData.current?.characters ?? []);
	const names = $derived(characters.map((c) => c.name));
	const idOf = (name: string) => characters.find((c) => c.name === name)?.id ?? name;
</script>

<!--
	One wiki Glossary entry, word for word (the popover and the Glossary dialog). Links in the
	wording ("see Drunk") open that entry, show a character's badge, or open the wiki page;
	other rules terms and character names are marked as in any game text.
-->
<!-- Links in the wording go to the external wiki, not app routes. -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->
<blockquote class="definition" {cite} data-testid="wiki-definition">
	{#each entry.parts as part, i (i)}{#if !part.href}<GlossaryText
				text={part.text}
				skip={term}
			/>{:else}{@const target = linkTarget(
				part.href,
				wikiGlossary.entries,
				names
			)}{#if target.kind === 'term'}<button
					type="button"
					class="see"
					onclick={(event) => onTerm(target.key, event.currentTarget)}>{part.text}</button
				>{:else if target.kind === 'character'}<CharacterBadge
					characterId={idOf(target.name)}
					text={part.text}
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
	/* A 44px-tall hit area that never reaches past the words sideways (see GlossaryTerm). */
	.see::after {
		content: '';
		position: absolute;
		inset-inline: 0;
		top: 50%;
		height: var(--tap-target);
		translate: 0 -50%;
	}
</style>
