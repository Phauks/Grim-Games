<script lang="ts">
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import { intl, t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import type { ScratchStroke } from '#lib/core/scratch/scratch.ts';
	import ScratchPreview from '#lib/ui/scratch/ScratchPreview.svelte';
	import type { NotebookSeat, PlayerNote } from './notebook.ts';
	import { playerSettings } from './player-settings.svelte.ts';

	interface Props {
		notes: readonly PlayerNote[];
		seats: readonly NotebookSeat[];
		/** The script's characters, to name each seat's claims in the player list. */
		characters: ReadonlyMap<CharacterId, Character>;
		/** The handwriting scratch pad, shown small; tapping it opens the pad. */
		scratch: readonly ScratchStroke[];
		onAdd: () => void;
		onOpenNote: (noteId: string) => void;
		onOpenSeat: (seatId: string) => void;
		onOpenScratch: () => void;
	}

	let { notes, seats, characters, scratch, onAdd, onOpenNote, onOpenSeat, onOpenScratch }: Props =
		$props();
	// Notes written on a player in the circle, in seat order (Trevor, 2026-10-15).
	const playerNotes = $derived(
		seats.map((seat, i) => ({ seat, number: i + 1 })).filter((s) => s.seat.note.trim())
	);
	const preview = (text: string) => text.trim().split('\n')[0] || t('player.empty');
	// "Hide note contents" setting: titles stay, the text is replaced, so nothing reflows.
	const hidden = $derived(playerSettings.current.hideNoteContents);

	// A player's note from here (Trevor, 2026-10-16): ask which player, then open their seat,
	// where the Notes field is. Players with a note already are marked and open that note.
	let choosing = $state(false);
	function choose(seatId: string) {
		choosing = false;
		onOpenSeat(seatId);
	}
	const claimNames = (seat: NotebookSeat) =>
		intl.list(
			seat.claims.map((id) => characters.get(id)?.name).filter((n): n is string => Boolean(n))
		);
</script>

<div class="notes">
	<section aria-labelledby="my-notes">
		<div class="head">
			<h2 id="my-notes">{t('player.myNotes')}</h2>
			<Button icon="add" onclick={onAdd}>{t('player.newNote')}</Button>
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
							<!-- Titles always show, so notes can be found (Trevor, 2026-10-16). -->
							<span class="title">{note.title.trim() || t('player.untitled')}</span>
							{#if hidden}
								<span class="preview" data-hidden>{t('player.hidden')}</span>
							{:else}
								<span class="preview">{preview(note.text)}</span>
							{/if}
						</button>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="none">{t('common.none')}</p>
		{/if}
	</section>

	<!-- For writing by hand with a finger or pen (Trevor, 2026-10-16). -->
	<section aria-labelledby="scratch-pad">
		<h2 id="scratch-pad">{t('scratch.title')}</h2>
		<button
			type="button"
			class="scratch"
			data-testid="open-scratch-pad"
			aria-label={t('scratch.open')}
			onclick={onOpenScratch}
		>
			{#if hidden}
				<span class="preview" data-hidden>{t('player.hidden')}</span>
			{:else}
				<ScratchPreview strokes={scratch} />
			{/if}
		</button>
	</section>

	<section aria-labelledby="player-notes">
		<div class="head">
			<h2 id="player-notes">{t('player.players')}</h2>
			<Button icon="add" onclick={() => (choosing = true)}>{t('player.newPlayerNote')}</Button>
		</div>
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
							<span class="title"
								>{t('common.seat', { number })}{seat.name ? ` · ${seat.name}` : ''}</span
							>
							{#if hidden}
								<span class="preview" data-hidden>{t('player.hidden')}</span>
							{:else}
								<span class="preview">{preview(seat.note)}</span>
							{/if}
						</button>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="none" data-testid="no-player-notes">{t('common.none')}</p>
		{/if}
	</section>
</div>

<Dialog bind:open={choosing} title={t('player.whichPlayer')}>
	<ul class="choices">
		{#each seats as seat, i (seat.seatId)}
			<li>
				<button
					type="button"
					class="row"
					data-choose-seat={seat.seatId}
					onclick={() => choose(seat.seatId)}
				>
					<span class="title"
						>{t('common.seat', { number: i + 1 })}{seat.name ? ` · ${seat.name}` : ''}</span
					>
					<span class="preview">
						{claimNames(seat) || t('player.noClaim')}{#if seat.note.trim()}
							· <span class="has-note">{t('player.hasNote')}</span>{/if}
					</span>
				</button>
			</li>
		{/each}
	</ul>
</Dialog>

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
	.choices {
		grid-template-columns: 1fr;
	}
	.has-note {
		color: var(--on-surface);
		font-weight: 600;
	}
	#scratch-pad {
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
	/* A fixed-size page, so drawing on it never moves anything below. */
	.scratch {
		display: grid;
		place-items: center;
		width: calc(9 * var(--u));
		aspect-ratio: 3 / 4;
		padding: 0;
		border: 0;
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
		color: var(--on-surface);
		cursor: pointer;
		touch-action: manipulation;
	}
	.scratch :global(canvas) {
		width: 100%;
	}
	.none {
		margin: 0;
		color: var(--on-surface-muted);
	}
</style>
