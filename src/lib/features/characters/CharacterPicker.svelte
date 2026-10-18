<script lang="ts" module>
	export interface PickerItemState {
		selected: boolean;
		/** Why it can't be chosen; undefined when it can. */
		disabledReason: string | undefined;
	}
</script>

<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Snippet } from 'svelte';
	import {
		defaultAlignment,
		type Character,
		type CharacterId,
		type CharacterType
	} from '#lib/core/data/index.ts';
	import { TYPE_PLURALS } from '#lib/features/reference/labels.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import CharacterSearchBox from './CharacterSearchBox.svelte';
	import CharacterToken from './CharacterToken.svelte';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import { PICKER_TYPES, searchGroups, type CharacterGroup } from './character-search.ts';

	interface Props {
		/** The characters to choose from, in the order to show them (usually script order). */
		characters: readonly Character[];
		/** `single`: a tap picks one. `multi`: a tap toggles (aria-pressed rows). */
		mode?: 'single' | 'multi';
		selected?: readonly CharacterId[];
		onSelect: (id: CharacterId) => void;
		/** Which characters to list at all, e.g. "not in play" or "Fabled and Loric only". */
		filter?: (character: Character) => boolean;
		/** Listed but not choosable, with the reason shown on the row. */
		disabledReason?: (character: Character) => string | undefined;
		/** Multi mode: once this many are chosen, the rest are disabled until one is removed. */
		max?: number;
		/** A short note on the row that doesn't stop the choice, e.g. "In play". */
		marker?: (character: Character) => string | undefined;
		/** Group order; types not listed are left out. */
		types?: readonly CharacterType[];
		/** The search text; bind it to keep it, or to drive it from your own box. */
		query?: string;
		/** False when the page shows its own `CharacterSearchBox` bound to `query`. */
		showSearch?: boolean;
		/**
		 * True (default): the list fills the picker's fixed height and scrolls inside it, for
		 * sheets and dialogs. False: the list grows with the page.
		 */
		contained?: boolean;
		/**
		 * Each type group opens and closes from its header (Trevor, 2026-10-16), remembered on
		 * the device under this key plus the type. While searching, every group shows open.
		 */
		collapsibleKey?: string;
		/**
		 * `sheet` (default): takes the colours of the sheet, dialog or panel it sits in.
		 * `page`: the page's own character cards (the Characters screen).
		 */
		surface?: 'sheet' | 'page';
		/** Custom row (the setup screen adds copies); the default is token, name and ability. */
		item?: Snippet<[Character, PickerItemState]>;
		/**
		 * Adds a "None" row first, for clearing the choice (Trevor, 2026-10-17: a seat's
		 * character is cleared through Change character). Shown as chosen when nothing is.
		 */
		onNone?: () => void;
		/** Types whose group is listed even with nothing in it, showing "None", unless searching. */
		keepTypes?: readonly CharacterType[];
		/** Extra controls in a type group's header, e.g. setup's All Travellers. */
		groupAside?: Snippet<[CharacterType]>;
	}

	let {
		characters,
		mode = 'single',
		selected = [],
		onSelect,
		filter,
		disabledReason,
		max,
		marker,
		types = PICKER_TYPES,
		query = $bindable(''),
		showSearch = true,
		contained = true,
		collapsibleKey = 'picker',
		surface = 'sheet',
		item,
		onNone,
		keepTypes = [],
		groupAside
	}: Props = $props();

	const groups = $derived.by(() => {
		const found = searchGroups(characters, query, filter, types);
		if (keepTypes.length === 0 || query.trim() !== '') return found;
		return types
			.map((type) => found.find((g) => g.type === type) ?? { type, characters: [] })
			.filter((g) => g.characters.length > 0 || keepTypes.includes(g.type));
	});
	const chosen = $derived(new Set(selected));
	const searching = $derived(query.trim() !== '');
	const full = $derived(mode === 'multi' && max !== undefined && chosen.size >= max);
	// The note line is reserved on every row when any row may show one, so nothing reflows.
	const notes = $derived(disabledReason !== undefined || marker !== undefined || max !== undefined);

	function reasonFor(character: Character, isChosen: boolean): string | undefined {
		return (
			disabledReason?.(character) ??
			(full && !isChosen ? t('picker.full', { max: max ?? 0 }) : undefined)
		);
	}
</script>

{#snippet rows(group: CharacterGroup)}
	<ul role="list">
		{#each group.characters as character (character.id)}
			{@const state = {
				selected: chosen.has(character.id),
				disabledReason: reasonFor(character, chosen.has(character.id))
			}}
			{@const note = state.disabledReason ?? marker?.(character)}
			<li>
				{#if item}
					{@render item(character, state)}
				{:else}
					<button
						type="button"
						class="row"
						data-character-id={character.id}
						aria-label={note ? `${character.name}, ${note}` : character.name}
						aria-pressed={mode === 'multi' ? state.selected : undefined}
						aria-current={mode === 'single' && state.selected ? 'true' : undefined}
						disabled={state.disabledReason !== undefined}
						onclick={() => onSelect(character.id)}
					>
						<CharacterToken {character} alignment={defaultAlignment(character.type)} size={44} />
						<span class="text">
							<!-- eslint-disable-next-line grim/names-as-badges -- caption beside its own token; a badge would repeat the icon -->
							<span class="name">{character.name}</span>
							{#if notes}<span class="note">{note ?? ''}</span>{/if}
							<span class="ability">{character.ability}</span>
						</span>
						<span class="check" aria-hidden="true"
							>{#if state.selected}<Icon name="check" />{/if}</span
						>
					</button>
				{/if}
			</li>
		{/each}
	</ul>
{/snippet}

<!--
	The shared way to choose characters: a search box that stays put, then characters by type
	with their ability text. Single or multi select, an optional filter, and rows that are
	shown disabled with a reason rather than hidden.
-->
<div class="picker" data-contained={contained ? '' : undefined} data-surface={surface}>
	{#if showSearch}<CharacterSearchBox bind:query />{/if}
	<div class="list" data-testid="character-picker">
		{#if onNone}
			<button
				type="button"
				class="row none-row"
				data-testid="picker-none"
				aria-current={mode === 'single' && selected.length === 0 ? 'true' : undefined}
				onclick={onNone}
			>
				<span class="text"><span class="name">{t('common.none')}</span></span>
				<span class="check" aria-hidden="true"
					>{#if mode === 'single' && selected.length === 0}<Icon name="check" />{/if}</span
				>
			</button>
		{/if}
		{#each groups as group (group.type)}
			<Collapsible
				title={TYPE_PLURALS[group.type]}
				level={3}
				tone={group.type === 'townsfolk' || group.type === 'outsider'
					? 'good'
					: group.type === 'minion' || group.type === 'demon'
						? 'evil'
						: undefined}
				storageKey="{collapsibleKey}:{group.type}"
				forceOpen={searching}
				empty={group.characters.length === 0}
			>
				{#snippet aside()}{@render groupAside?.(group.type)}{/snippet}
				{#if group.characters.length > 0}{@render rows(group)}{:else}<p class="none">
						{t('common.none')}
					</p>{/if}
			</Collapsible>
		{:else}
			{#if !onNone}<p class="none">{t('common.none')}</p>{/if}
		{/each}
	</div>
</div>

<style>
	.picker {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-height: 0;
	}
	.picker[data-contained] {
		flex: 1;
		height: var(--picker-height, 100%);
	}
	.picker[data-contained] .list {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
	}
	/* In a sheet or dialog the headings take the panel's own text colour. */
	.picker[data-surface='sheet'] {
		--collapsible-heading: currentColor;
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
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		width: 100%;
		min-height: var(--tap-target);
		padding: var(--space-1) var(--space-2);
		border: 0;
		border-radius: var(--radius-md);
		background: var(--choice-background);
		color: var(--choice-color);
		box-shadow: inset 0 0 0 1px var(--border);
		font: inherit;
		text-align: start;
		cursor: pointer;
		touch-action: manipulation;
	}
	/* Every surface's own colours: a sheet sets them to parchment (tokens/components.css). */
	@media (hover: hover) {
		.row:hover:not(:disabled):not([aria-pressed='true']):not([aria-current='true']) {
			background: var(--surface-selected);
		}
	}
	.row[aria-pressed='true'],
	.row[aria-current='true'] {
		background: var(--choice-selected-background);
		box-shadow: inset 0 0 0 2px var(--focus);
	}
	.row:disabled {
		opacity: 0.55;
		cursor: default;
	}
	.text {
		display: grid;
		flex: 1;
		min-width: 0;
	}
	.name {
		font-family: var(--font-character);
		font-weight: var(--font-character-weight);
		overflow-wrap: anywhere;
	}
	.note {
		min-height: 1.2em;
		font-size: 0.75rem;
		font-weight: 600;
		line-height: 1.2;
		color: var(--accent);
	}
	.ability {
		font-family: var(--font-ability);
		font-size: 0.8rem;
		line-height: 1.3;
		opacity: 0.9;
	}
	.check {
		display: grid;
		place-items: center;
		flex: none;
		width: 1.25em;
		align-self: center;
	}
	.none {
		margin: 0;
	}
	.none-row {
		align-items: center;
		margin-bottom: var(--space-2);
	}
</style>
