<script lang="ts">
	import type { GlossarySegment } from '#lib/core/rules/glossary.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import { mentionSegments } from '#lib/features/characters/mentions.ts';
	import { explainBlock } from './glossary.svelte.ts';
	import GlossaryTerm from './GlossaryTerm.svelte';

	type Props =
		/** One whole block of text; terms are marked at their first use. */
		| { text: string; names?: readonly string[]; segments?: never }
		/** A piece of a block already split with `explainBlock`. */
		| { segments: readonly GlossarySegment[]; text?: never; names?: never };

	let props: Props = $props();
	const parts = $derived(
		props.segments ?? explainBlock([props.text ?? ''], props.names ?? [])[0] ?? []
	);
	// Character names in the plain text are drawn as badges (Trevor: always mark them).
	const characters = $derived(officialData.current?.characters ?? []);
	const mentions = (text: string) => mentionSegments(text, characters);
</script>

<!-- Game text with Glossary terms marked and character names as badges; renders inline so it
     never changes the layout. -->
{#each parts as part, i (i)}{#if part.kind === 'term'}<GlossaryTerm
			term={part.term}
			text={part.text}
		/>{:else}{#each mentions(part.text) as m, j (j)}{#if m.kind === 'character'}<CharacterBadge
					characterId={m.characterId}
					text={m.text}
					inline
				/>{:else}{m.text}{/if}{/each}{/if}{/each}
