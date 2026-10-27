<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import SectionStack from '#lib/ui/layout/SectionStack.svelte';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import ScratchThumb from '#lib/ui/scratch/ScratchThumb.svelte';
	import { padShape } from '#lib/ui/scratch/pad-shape.svelte.ts';
	import type { ScratchPadState } from '#lib/ui/scratch/scratch-store.svelte.ts';
	import NoteCards from '#lib/ui/notes/NoteCards.svelte';
	import type { TitledNote } from '#lib/ui/notes/note.ts';
	import type { CharacterId } from '#lib/core/data/index.ts';
	import SeatNoteEntry from '#lib/features/grimoire/SeatNoteEntry.svelte';
	import type { PlayerNote } from './notebook.ts';

	interface Props {
		notes: readonly PlayerNote[];
		/** Handwriting scratch pads, oldest first; undefined while they load. */
		pads: readonly ScratchPadState[] | undefined;
		onAdd: () => void;
		onOpenNote: (noteId: string) => void;
		onAddScratch: () => void;
		onOpenScratch: (pad: ScratchPadState) => void;
		/** The seats of the game this phone is in, with the player's notes on each. */
		seats?: readonly {
			seatId: string;
			name: string;
			notes: readonly TitledNote[];
			/** The seat's characters as this player sees them, shown after its name. */
			characterIds: readonly CharacterId[];
		}[];
		/** Opens a seat's note, or a new one without `noteId`. */
		onOpenSeatNote?: (seatId: string, noteId?: string) => void;
	}

	let {
		notes,
		pads,
		onAdd,
		onOpenNote,
		onAddScratch,
		onOpenScratch,
		seats,
		onOpenSeatNote
	}: Props = $props();

	/** The notes written on players, not the number of seats (Trevor, 2026-10-27). */
	const seatNoteCount = $derived(seats?.reduce((sum, seat) => sum + seat.notes.length, 0));
</script>

<!-- Each section closes from its header and stays as left on this device, as the Script tab's
     do (Trevor, 2026-10-26). -->
<SectionStack>
	<!-- New ones start from a dashed card in the list itself, not a button in the header
	     (Trevor, 2026-10-24). -->
	<Collapsible title={t('player.myNotes')} storageKey="play:notes:mine" count={notes.length}>
		<NoteCards {notes} onOpen={onOpenNote} {onAdd} />
	</Collapsible>

	<!-- For writing by hand with a finger or pen (Trevor, 2026-10-16). Several pads, kept like
	     notes; one opens full screen only when tapped, never by itself (Trevor, 2026-10-17). -->
	<Collapsible title={t('scratch.pads')} storageKey="play:notes:pads" count={pads?.length}>
		<ul class="pads" style:--pad-shape={padShape.ratio}>
			{#each pads ?? [] as pad (pad.key)}
				<li>
					<button type="button" class="row" data-pad={pad.key} onclick={() => onOpenScratch(pad)}>
						<span class="title">{pad.title.trim() || t('scratch.untitled')}</span>
						<!-- The same box whether drawn on or hidden, so nothing moves. -->
						<span class="thumb">
							{#if pad.hidden}
								<span class="preview" data-hidden>{t('scratch.hidden')}</span>
							{:else}
								<ScratchThumb {pad} />
							{/if}
						</span>
					</button>
				</li>
			{/each}
			<!-- As the notes' "+ New note" (NoteCards): a dashed edge, as tall as a pad. -->
			<li>
				<button
					type="button"
					class="row add"
					data-testid="new-pad"
					disabled={!pads}
					onclick={onAddScratch}
					><span class="title"><Icon name="add" />{t('scratch.newPad')}</span></button
				>
			</li>
		</ul>
	</Collapsible>

	<!-- Notes on each player, written here or from the Grim tab, as the Storyteller's Notes
	     list them per player (Trevor, 2026-10-24). Only while this phone is in a game. -->
	{#if seats}
		<Collapsible
			title={t('player.seatNotes')}
			storageKey="play:notes:players"
			count={seatNoteCount}
		>
			<ul class="seat-notes">
				{#each seats as seat (seat.seatId)}
					<li data-seat-note={seat.seatId}>
						<SeatNoteEntry
							guesses={seat.characterIds}
							label={seat.name}
							notes={seat.notes}
							onOpen={(noteId) => onOpenSeatNote?.(seat.seatId, noteId)}
							onAdd={() => onOpenSeatNote?.(seat.seatId)}
						/>
					</li>
				{/each}
			</ul>
		</Collapsible>
	{/if}
</SectionStack>

<style>
	ul {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, calc(18 * var(--u))), 1fr));
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.row {
		display: grid;
		gap: calc(0.125 * var(--u));
		width: 100%;
		min-height: var(--tap-target);
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: var(--on-surface);
		font: inherit;
		text-align: left;
		cursor: pointer;
		touch-action: manipulation;
	}
	.row:hover {
		background: var(--surface-selected);
	}
	li {
		display: grid;
	}
	.add {
		align-content: center;
		border-style: dashed;
		background: transparent;
		color: var(--on-surface-muted);
	}
	.add .title {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}
	.title {
		font-family: var(--font-control);
		font-weight: 600;
	}
	.title,
	.preview {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.preview {
		color: var(--on-surface-muted);
		font-size: 0.9rem;
	}
	.preview[data-hidden] {
		font-style: italic;
	}
	/* Pads two to a row on a phone, each preview the shape of this screen's pad: tall on a
	   phone (Trevor, 2026-10-19: "2x2 on mobile"), wide on a desktop (Trevor, 2026-10-23), so
	   no paper shows that could never be written on. */
	.seat-notes {
		display: grid;
		grid-template-columns: none;
		gap: 0;
	}
	.pads {
		grid-template-columns: repeat(auto-fill, minmax(min(45%, calc(12 * var(--u))), 1fr));
	}
	.thumb {
		position: relative;
		display: grid;
		place-items: center;
		aspect-ratio: var(--pad-shape, 3 / 4);
	}
	/* Out of the flow, so the canvas's own size never stretches the row. */
	.thumb :global(canvas) {
		position: absolute;
		inset: 0;
	}
</style>
