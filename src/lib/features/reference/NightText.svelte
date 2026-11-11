<script lang="ts">
	import type { Alignment, Character } from '#lib/core/data/index.ts';
	import { nightTextSegmentsFor } from '#lib/core/rules/night/night-text.ts';
	import { explainBlock } from '#lib/features/glossary/glossary.svelte.ts';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import NightTextPiece from './NightTextPiece.svelte';

	interface Props {
		text: string;
		/** The step's character; none for Dusk, Dawn and the like, whose text has no tokens. */
		character?: Character;
		/** The step's own name, never marked as a Glossary term in its own text. */
		name?: string;
		/**
		 * Which night the text is for: TPI's `:reminder:`s are then drawn as the tokens they
		 * mean (`reminderPlaceholders`), and Trevor's reviewed edits replace TPI's text.
		 */
		night?: 'first' | 'other';
		/**
		 * Alignment of the player who has the character, when one does: its tokens are drawn in
		 * it, as on the board (a turned-evil Townsfolk's are red).
		 */
		alignment?: Alignment;
	}

	let { text, character, name, night, alignment }: Props = $props();
	const segments = $derived(nightTextSegmentsFor(character, text, night));
	// Terms are marked in the text between tokens only, once per night text.
	const explained = $derived(
		explainBlock(
			segments.map((s) => (s.kind === 'text' ? s.text : '')),
			[name ?? character?.name ?? '']
		)
	);
</script>

<!-- Storyteller night text with TPI's :reminder: and *TOKEN* markup drawn as tokens. -->
<span class="night-text"
	>{#each segments as s, i (i)}{#if s.kind === 'text'}<GlossaryText
				segments={explained[i] ?? []}
			/>{:else}<NightTextPiece segment={s} {character} {alignment} />{/if}{/each}</span
>

<style>
	.night-text {
		font-family: var(--font-ability);
	}
</style>
