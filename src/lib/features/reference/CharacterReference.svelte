<script lang="ts">
	import type { Character } from '#lib/core/data/index.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import Sentence from '#lib/features/characters/Sentence.svelte';
	import type { ReferenceEntry } from '#lib/core/rules/reference.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import CharacterTable from './CharacterTable.svelte';

	interface Props {
		entries: readonly ReferenceEntry[];
		/** The Character Lab's core character, shown alone (plan M47). */
		core: string;
	}

	let { entries, core }: Props = $props();

	// One shared details overlay, so extra detail never expands a row inline.
	// `title` may hold the `character` slot (slots.ts), shown as `character`'s badge.
	let details = $state<{ title: string; text: string; character?: Character }>();
	let detailsOpen = $state(false);
	function explain(title: string, text: string, character?: Character) {
		details = { title, text, character };
		detailsOpen = true;
	}

	// The core character only (Trevor, 2026-11-05: "don't list the jinxed counter characters
	// beneath the character"); its jinx partners are on the right.
	const rows = $derived(entries.filter((e) => e.character.id === core));
</script>

<CharacterTable {rows} onExplain={explain} />

<Dialog bind:open={detailsOpen} title={details?.title ?? ''}>
	{#snippet heading()}
		<Sentence text={details?.title ?? ''}
			>{#snippet fill()}{#if details?.character}<CharacterPiece
						template="badge"
						characterId={details.character.id}
						character={details.character}
					/>{/if}{/snippet}</Sentence
		>
	{/snippet}
	{#if details}<p>{details.text}</p>{/if}
</Dialog>
