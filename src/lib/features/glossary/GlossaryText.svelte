<script lang="ts">
	import type { GlossarySegment } from '#lib/core/rules/glossary.ts';
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
</script>

<!-- Game text with Glossary terms marked; renders inline so it never changes the layout. -->
{#each parts as part, i (i)}{#if part.kind === 'term'}<GlossaryTerm
			term={part.term}
			text={part.text}
		/>{:else}{part.text}{/if}{/each}
