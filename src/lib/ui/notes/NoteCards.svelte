<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { plainText } from '#lib/core/text/rich.ts';
	import type { TitledNote } from './note.ts';

	/**
	 * Titled notes as cards, the title and the text's first line: the player's notebook and
	 * the Storyteller's game notes (Trevor, 2026-10-23). With `onAdd`, the list ends in a
	 * "+ New note" card with a dashed edge, so an empty list starts as that card alone.
	 */
	interface Props {
		notes: readonly TitledNote[];
		onOpen: (noteId: string) => void;
		onAdd?: () => void;
	}

	let { notes, onOpen, onAdd }: Props = $props();
	// The first line's words, without their formatting marks.
	const preview = (text: string) => plainText(text).trim().split('\n')[0] || t('player.empty');
</script>

{#if notes.length || onAdd}
	<ul class="cards">
		{#each notes as note (note.noteId)}
			<li>
				<button
					type="button"
					class="card"
					data-note={note.noteId}
					onclick={() => onOpen(note.noteId)}
				>
					<!-- Titles always show, so notes can be found (Trevor, 2026-10-16). -->
					<span class="title">{note.title.trim() || t('player.untitled')}</span>
					<!-- A hidden note keeps its title; the text line says Hidden, so nothing moves. -->
					{#if note.hidden}
						<span class="preview" data-hidden>{t('player.hidden')}</span>
					{:else}
						<span class="preview">{preview(note.text)}</span>
					{/if}
				</button>
			</li>
		{/each}
		{#if onAdd}
			<li>
				<button type="button" class="card add" data-testid="new-note" onclick={onAdd}>
					<span class="title"><Icon name="add" />{t('player.newNote')}</span>
				</button>
			</li>
		{/if}
	</ul>
{:else}
	<p class="none">{t('common.none')}</p>
{/if}

<style>
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, calc(18 * var(--u))), 1fr));
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: grid;
	}
	.card {
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
	.card:hover {
		background: var(--surface-selected);
	}
	/* "+ New note" (Trevor, 2026-10-23): a dashed edge and no fill, as tall as a note. */
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
	.none {
		margin: 0;
		color: var(--on-surface-muted);
	}
</style>
