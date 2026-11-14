<script lang="ts">
	import type { GlossarySegment } from '#lib/core/rules/glossary.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import { contextCharacters } from '#lib/features/characters/character-context.ts';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import { mentionCharacters, mentionSegments } from '#lib/features/characters/mentions.ts';
	import { explainBlock } from './glossary.svelte.ts';
	import GlossaryTerm from './GlossaryTerm.svelte';

	type Props =
		/** One whole block of text; terms are marked at their first use. */
		| {
				text: string;
				names?: readonly string[];
				/** A term id left unmarked: the Glossary entry this text defines. */
				skip?: string;
				segments?: never;
		  }
		/** A piece of a block already split with `explainBlock`. */
		| { segments: readonly GlossarySegment[]; text?: never; names?: never; skip?: never };

	let props: Props = $props();
	const parts = $derived(
		props.segments ??
			explainBlock([props.text ?? ''], props.names ?? [], props.skip ? [props.skip] : [])[0] ??
			[]
	);
	// Character names in the plain text are drawn as badges (Trevor: always mark them): the
	// game's own characters too, so a homebrew "Witch-King" is one badge, not a Witch and a King.
	const gameCharacters = contextCharacters();
	const characters = $derived(
		mentionCharacters(officialData.current?.characters ?? [], gameCharacters?.())
	);
	const mentions = (text: string) => mentionSegments(text, characters);
</script>

<!-- Game text with Glossary terms marked and character names as badges; renders inline so it
     never changes the layout. -->
{#each parts as part, i (i)}{#if part.kind === 'term'}<GlossaryTerm
			term={part.term}
			text={part.text}
		/>{:else}{#each mentions(part.text) as m, j (j)}{#if m.kind === 'character'}<CharacterPiece
					template="badge"
					characterId={m.characterId}
					text={m.text}
				/>{:else}{m.text}{/if}{/each}{/if}{/each}
