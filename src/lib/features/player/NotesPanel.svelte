<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ScratchThumb from '#lib/ui/scratch/ScratchThumb.svelte';
	import type { ScratchPadState } from '#lib/ui/scratch/scratch-store.svelte.ts';
	import type { PlayerNote } from './notebook.ts';
	import { playerSettings } from './player-settings.svelte.ts';

	interface Props {
		notes: readonly PlayerNote[];
		/** Handwriting scratch pads, oldest first; undefined while they load. */
		pads: readonly ScratchPadState[] | undefined;
		onAdd: () => void;
		onOpenNote: (noteId: string) => void;
		onAddScratch: () => void;
		onOpenScratch: (pad: ScratchPadState) => void;
	}

	let { notes, pads, onAdd, onOpenNote, onAddScratch, onOpenScratch }: Props = $props();
	const preview = (text: string) => text.trim().split('\n')[0] || t('player.empty');
	// "Hide note contents" setting: titles stay, the text is replaced, so nothing reflows.
	const hidden = $derived(playerSettings.current.hideNoteContents);
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

	<!-- For writing by hand with a finger or pen (Trevor, 2026-10-16). Several pads, kept like
	     notes; one opens full screen only when tapped, never by itself (Trevor, 2026-10-17). -->
	<section aria-labelledby="scratch-pads">
		<div class="head">
			<h2 id="scratch-pads">{t('scratch.pads')}</h2>
			<Button icon="add" disabled={!pads} onclick={onAddScratch}>{t('scratch.newPad')}</Button>
		</div>
		{#if pads?.length}
			<ul>
				{#each pads as pad (pad.key)}
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
			</ul>
		{:else}
			<p class="none">{t('common.none')}</p>
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
	.thumb {
		position: relative;
		display: grid;
		place-items: center;
		height: calc(6 * var(--u));
	}
	/* Out of the flow, so the canvas's own size never stretches the row. */
	.thumb :global(canvas) {
		position: absolute;
		inset: 0;
	}
	.none {
		margin: 0;
		color: var(--on-surface-muted);
	}
</style>
