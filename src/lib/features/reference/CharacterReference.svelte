<script lang="ts">
	import type { Character } from '#lib/core/data/index.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import Sentence from '#lib/features/characters/Sentence.svelte';
	import type { ReferenceEntry } from '#lib/core/rules/reference.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import CharacterTable, { type TableLab } from './CharacterTable.svelte';

	interface Props {
		entries: readonly ReferenceEntry[];
		/** The Character Lab's Lock column (plan M45). */
		lab: TableLab;
		/** Only these characters, besides the locked ones (the lab's jinx filter). */
		only?: readonly string[];
		/** Told the rows as shown, in order. */
		onrows?: (rows: readonly ReferenceEntry[]) => void;
	}

	let { entries, lab, only, onrows }: Props = $props();

	// One shared details overlay, so extra detail never expands a row inline.
	// `title` may hold the `character` slot (slots.ts), shown as `character`'s badge.
	let details = $state<{ title: string; text: string; character?: Character }>();
	let detailsOpen = $state(false);
	function explain(title: string, text: string, character?: Character) {
		details = { title, text, character };
		detailsOpen = true;
	}

	// The lab's rows only, with no search, sort or filters (plan M47, Trevor 2026-11-04: "remove
	// all those useless table controls ... do not list all on the left side when none are
	// selected"): the locked characters first, then the rest in `roles.json` order.
	const rows = $derived(
		lab.locked.length === 0
			? []
			: [
					...lab.locked.flatMap((id) => entries.filter((e) => e.character.id === id)),
					...entries.filter(
						(e) => !lab.locked.includes(e.character.id) && (!only || only.includes(e.character.id))
					)
				]
	);
</script>

<CharacterTable {rows} onExplain={explain} {onrows} {lab} />

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
