<script lang="ts">
	import type { Character } from '#lib/core/data/index.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import Sentence from '#lib/features/characters/Sentence.svelte';
	import { matchesReference, type ReferenceEntry } from '#lib/core/rules/reference.ts';
	import { tableRows } from '#lib/core/rules/reference-table.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import CharacterTable, { type TableLab } from './CharacterTable.svelte';
	import type { ReferenceQuery } from './query.svelte.ts';
	import { referenceTable } from './table-state.svelte.ts';

	interface Props {
		entries: readonly ReferenceEntry[];
		query: ReferenceQuery;
		/** The Character Lab's Lock column (plan M45). */
		lab?: TableLab;
		/** Only these characters, besides the locked ones (the lab's jinx filter). */
		only?: readonly string[];
		/** Told the rows as shown, in order. */
		onrows?: (rows: readonly ReferenceEntry[]) => void;
	}

	let { entries, query, lab, only, onrows }: Props = $props();

	// One shared details overlay, so extra detail never expands a row inline.
	// `title` may hold the `character` slot (slots.ts), shown as `character`'s badge.
	let details = $state<{ title: string; text: string; character?: Character }>();
	let detailsOpen = $state(false);
	function explain(title: string, text: string, character?: Character) {
		details = { title, text, character };
		detailsOpen = true;
	}

	// The table is the only view (Trevor, 2026-10-19: "remove card mode"). Its column filters
	// and sort apply on top of the search; both are set in the page's title row
	// (ReferenceControls).
	const isLocked = (e: ReferenceEntry) => !!lab?.locked.includes(e.character.id);
	const shown = $derived(
		entries.filter(
			(e) =>
				!isLocked(e) &&
				(!only || only.includes(e.character.id)) &&
				matchesReference(e, { search: query.search })
		)
	);
	// Locked characters stay at the top, whatever the search, filters and sort (plan M45).
	const rows = $derived([
		...(lab?.locked.flatMap((id) => entries.filter((e) => e.character.id === id)) ?? []),
		...tableRows(shown, referenceTable.current)
	]);
</script>

<CharacterTable
	{rows}
	onExplain={explain}
	bind:columnFilters={query.columnFilters}
	oncount={(count) => (query.tableShown = count)}
	{onrows}
	{lab}
/>

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
