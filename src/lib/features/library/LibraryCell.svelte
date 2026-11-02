<script lang="ts" module>
	import type { Character } from '#lib/core/data/index.ts';
	import type { ItemKind } from './library-items.ts';

	export type RowKind = 'folder' | ItemKind;
	/** One row of the Library's table: a folder, or an item. */
	export interface Row {
		key: string;
		kind: RowKind;
		name: string;
		sub: string;
		/** Folders: the folder's id. */
		folderId?: string;
		character?: Character;
	}
	export type ColumnId = 'name' | 'kind' | 'folder' | 'tags';
</script>

<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import type { IconSlot } from '#lib/ui/icons/catalogue.ts';
	import { dragToFolder, type DragSource } from './drag-to-folder.ts';

	/** One cell of the Library's table; the name cell selects, opens and drags its row. */
	interface Props {
		row: Row;
		column: ColumnId;
		/** Browsing one folder: the name cell's line leaves out the folder, as every row shares it. */
		browsing: boolean;
		/** The row's folder's whole path; blank at the top level. */
		where: string;
		kindName: string;
		tags: string[];
		onTap: (event: MouseEvent) => void;
		onKey: (event: KeyboardEvent) => void;
		onMove: (source: DragSource, target: string | undefined) => void;
	}

	let { row, column, browsing, where, kindName, tags, onTap, onKey, onMove }: Props = $props();

	const KIND_ICONS: Record<RowKind, IconSlot> = {
		folder: 'folder',
		script: 'script',
		character: 'buildCharacter',
		collection: 'players',
		mode: 'buildMode',
		rule: 'specialRule'
	};
</script>

{#if column === 'name'}
	<button
		type="button"
		class="pick"
		data-drop-folder={row.folderId}
		data-kind={row.kind}
		onclick={onTap}
		onkeydown={onKey}
		use:dragToFolder={{
			source: {
				id: row.folderId ?? row.key,
				folder: row.kind === 'folder',
				label: row.name || t('common.none')
			},
			onmove: onMove
		}}
	>
		<span class="icon" class:accent={row.kind === 'folder'}
			><Icon name={KIND_ICONS[row.kind]} /></span
		>
		<span class="text-block">
			<span class="title">
				{#if row.character}
					<CharacterBadge
						characterId={row.character.id}
						character={row.character}
						interactive={false}
					/>
				{:else}
					{row.name || t('common.none')}
				{/if}
			</span>
			<span class="sub">{[row.sub, browsing ? '' : where].filter(Boolean).join(' · ') || ' '}</span>
		</span>
	</button>
{:else if column === 'kind'}
	<span class="text">{kindName}</span>
{:else if column === 'folder'}
	<span class="text">{where || t('library.heading')}</span>
{:else}
	<span class="chips">
		{#each tags as name (name)}<span class="chip">{name}</span>{:else}<span class="muted"
				>{t('common.none')}</span
			>{/each}
	</span>
{/if}

<style>
	:global(.sided tr.selected) .pick {
		box-shadow: inset 0.25rem 0 0 var(--accent);
	}
	.pick {
		width: 100%;
		height: 100%;
		min-height: var(--tap-target);
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-2);
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: start;
		cursor: pointer;
		/* A held touch drags the row rather than selecting its text. */
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
	}
	.pick:hover {
		background: var(--surface-selected);
	}
	.icon {
		display: flex;
		font-size: 1.3rem;
		color: var(--on-surface-muted);
	}
	.icon.accent {
		color: var(--accent);
	}
	.text-block {
		display: grid;
		min-width: 0;
	}
	.title {
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.sub {
		min-height: 1.2em;
		font-size: 0.8rem;
		color: var(--on-surface-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.text {
		display: flex;
		align-items: center;
		min-height: var(--tap-target);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--tap-target);
	}
	/* A tag looks the same everywhere, in the font its name was typed in (Trevor, 2026-10-18). */
	.chip {
		padding: 0 var(--space-2);
		border: var(--card-border);
		border-radius: var(--radius-full);
		font-family: var(--font-control);
		font-size: 0.85rem;
		white-space: nowrap;
	}
	.muted {
		color: var(--on-surface-muted);
	}
</style>
