<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import ScratchActions from '#lib/ui/scratch/ScratchActions.svelte';
	import ScratchPad from '#lib/ui/scratch/ScratchPad.svelte';
	import type { ScratchPadState } from '#lib/ui/scratch/scratch-store.svelte.ts';
	import type { PlayerNote } from './notebook.ts';
	import { playerSettings } from './player-settings.svelte.ts';

	interface Props {
		notes: readonly PlayerNote[];
		/** The handwriting scratch pad, drawn on right here; undefined while it loads. */
		scratch: ScratchPadState | undefined;
		onAdd: () => void;
		onOpenNote: (noteId: string) => void;
		onOpenScratch: () => void;
	}

	let { notes, scratch, onAdd, onOpenNote, onOpenScratch }: Props = $props();
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

	<!-- For writing by hand with a finger or pen (Trevor, 2026-10-16): a big page to write on
	     here, or the whole screen (Trevor, 2026-10-17). -->
	<section aria-labelledby="scratch-pad">
		<div class="head">
			<h2 id="scratch-pad">{t('scratch.title')}</h2>
			<span class="actions">
				{#if scratch && !hidden}<ScratchActions pad={scratch} />{/if}
				<IconButton
					icon="fullScreen"
					label={t('scratch.open')}
					data-testid="open-scratch-pad"
					disabled={!scratch}
					onclick={onOpenScratch}
				/>
			</span>
		</div>
		<!-- The same space whether loading, hidden or drawn on, so nothing below moves. -->
		<div class="scratch">
			{#if hidden}
				<button type="button" class="hidden" onclick={onOpenScratch}>
					<span class="preview" data-hidden>{t('player.hidden')}</span>
				</button>
			{:else if scratch}
				<ScratchPad pad={scratch} />
			{/if}
		</div>
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
	.actions {
		display: flex;
		align-items: center;
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
	/* Most of the screen, so it writes like a pad of paper (Trevor, 2026-10-17). */
	.scratch {
		display: flex;
		flex-direction: column;
		height: 80dvh;
	}
	.hidden {
		flex: 1;
		display: grid;
		place-items: center;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: var(--on-surface);
		font: inherit;
		cursor: pointer;
		touch-action: manipulation;
	}
	.none {
		margin: 0;
		color: var(--on-surface-muted);
	}
</style>
