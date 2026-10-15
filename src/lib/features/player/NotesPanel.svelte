<script lang="ts">
	import Button from '#lib/ui/primitives/Button.svelte';
	import type { NotebookSeat, PlayerNote } from './notebook.ts';

	interface Props {
		notes: readonly PlayerNote[];
		seats: readonly NotebookSeat[];
		onAdd: () => void;
		onOpenNote: (noteId: string) => void;
		onOpenSeat: (seatId: string) => void;
	}

	let { notes, seats, onAdd, onOpenNote, onOpenSeat }: Props = $props();
	// Notes written on a player in the circle, in seat order (Trevor, 2026-10-15).
	const playerNotes = $derived(
		seats.map((seat, i) => ({ seat, number: i + 1 })).filter((s) => s.seat.note.trim())
	);
	const preview = (text: string) => text.trim().split('\n')[0] || 'Empty';
</script>

<div class="notes">
	<section aria-labelledby="my-notes">
		<div class="head">
			<h2 id="my-notes">My notes</h2>
			<Button icon="add" onclick={onAdd}>New note</Button>
		</div>
		{#if notes.length}
			<ul>
				{#each notes as note (note.noteId)}
					<li>
						<button
							type="button"
							class="row"
							data-note={note.noteId}
							onclick={() => onOpenNote(note.noteId)}
						>
							<span class="title">{note.title.trim() || 'Untitled'}</span>
							<span class="preview">{preview(note.text)}</span>
						</button>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="none">None</p>
		{/if}
	</section>

	<section aria-labelledby="player-notes">
		<h2 id="player-notes">Players</h2>
		{#if playerNotes.length}
			<ul>
				{#each playerNotes as { seat, number } (seat.seatId)}
					<li>
						<button
							type="button"
							class="row"
							data-player-note={seat.seatId}
							onclick={() => onOpenSeat(seat.seatId)}
						>
							<span class="title">Seat {number}{seat.name ? ` · ${seat.name}` : ''}</span>
							<span class="preview">{preview(seat.note)}</span>
						</button>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="none" data-testid="no-player-notes">None</p>
		{/if}
	</section>
</div>

<style>
	.notes {
		display: grid;
		gap: var(--space-4);
	}
	section {
		display: grid;
		gap: var(--space-2);
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		border-bottom: 1px solid var(--border);
		padding-bottom: var(--space-1);
	}
	h2 {
		margin: 0;
		font-size: 1.1rem;
		color: var(--heading);
	}
	#player-notes {
		border-bottom: 1px solid var(--border);
		padding-bottom: var(--space-1);
	}
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
		gap: 2px;
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
	.none {
		margin: 0;
		color: var(--on-surface-muted);
	}
</style>
