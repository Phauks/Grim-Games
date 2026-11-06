<script lang="ts">
	import type { Character } from '#lib/core/data/index.ts';
	import { nightTextSegmentsFor } from '#lib/core/rules/night-text.ts';
	import { explainBlock } from '#lib/features/glossary/glossary.svelte.ts';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import NightTextPiece from './NightTextPiece.svelte';

	interface Props {
		text: string;
		character: Character;
		/**
		 * Which night the text is for: TPI's `:reminder:`s are then drawn as the tokens they
		 * mean (`reminderPlaceholders`), and Trevor's reviewed edits replace TPI's text.
		 */
		night?: 'first' | 'other';
	}

	let { text, character, night }: Props = $props();
	const segments = $derived(nightTextSegmentsFor(character, text, night));
	// Terms are marked in the text between tokens only, once per night text.
	const explained = $derived(
		explainBlock(
			segments.map((s) => (s.kind === 'text' ? s.text : '')),
			[character.name]
		)
	);
</script>

<!-- Storyteller night text with TPI's :reminder: and *TOKEN* markup drawn as tokens. -->
<span class="night-text"
	>{#each segments as s, i (i)}{#if s.kind === 'text'}<GlossaryText
				segments={explained[i] ?? []}
			/>{:else}<NightTextPiece segment={s} {character} />{/if}{/each}</span
>

<style>
	.night-text {
		font-family: var(--font-ability);
	}
</style>
