<script lang="ts">
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import type { CharacterId } from '#lib/core/data/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import FilterOptions from '#lib/ui/table/FilterOptions.svelte';
	import {
		BOTC_EDITION_GROUPS,
		type BotcEditionGroup,
		type BotcScriptsQuery
	} from './botcscripts-api.ts';

	/**
	 * One column's BotC Scripts filters, in the popover from its table header (filters sit in
	 * the header row, not a separate sheet). They apply as they change; typing waits for a pause.
	 */
	type Filters = Omit<BotcScriptsQuery, 'term'>;

	interface Props {
		column: string;
		filters: Filters;
		/** Characters are chosen in a full-screen list, which the picker opens. */
		onchoose: (list: 'include' | 'exclude') => void;
		close: () => void;
	}

	let { column, filters = $bindable(), onchoose, close }: Props = $props();

	const KINDS = [
		['', 'scripts.botc.type.any'],
		['Full', 'scripts.kind.Full'],
		['Teensyville', 'scripts.kind.Teensyville']
	] as const;

	const chosenGroups = $derived(filters.editions ?? BOTC_EDITION_GROUPS);

	function setGroup(group: BotcEditionGroup, on: boolean) {
		const next = BOTC_EDITION_GROUPS.filter((g) => (g === group ? on : chosenGroups.includes(g)));
		// Every group, or none, means no edition filter.
		filters.editions =
			next.length === 0 || next.length === BOTC_EDITION_GROUPS.length ? undefined : next;
	}

	function clearCharacters() {
		filters.editions = undefined;
		filters.include = [];
		filters.exclude = [];
		filters.oneDemon = false;
		filters.officialOnly = false;
	}
</script>

<div class="filter" data-testid="botc-filter-{column}">
	{#if column === 'author'}
		<TextField
			label={t('scripts.botc.author')}
			bind:value={filters.author}
			enterkeyhint="search"
			oncommit={close}
		/>
	{:else if column === 'kind'}
		<FilterOptions
			legend={t('scripts.botc.scriptType')}
			hideLegend
			name="botc-kind"
			options={KINDS.map(([value, key]) => ({ value, label: t(key) }))}
			value={filters.type}
			onpick={(value) => {
				filters.type = value as typeof filters.type;
				close();
			}}
		/>
	{:else}
		<fieldset>
			<legend>{t('scripts.botc.charactersFrom')}</legend>
			{#each BOTC_EDITION_GROUPS as group (group)}
				<Toggle
					label={t(`scripts.botc.edition.${group}`)}
					checked={chosenGroups.includes(group)}
					onChange={(on) => setGroup(group, on)}
				/>
			{/each}
		</fieldset>
		{#each [['include', 'scripts.botc.includes'], ['exclude', 'scripts.botc.leavesOut']] as const as [list, key] (list)}
			<section class="chosen" aria-label={t('scripts.botc.listCharacters', { list: t(key) })}>
				<div class="chosen-head">
					<h3>{t(key)}</h3>
					<Button onclick={() => onchoose(list)}>{t('scripts.botc.choose')}</Button>
				</div>
				<p class="badges" data-testid="filter-{list}">
					{#each filters[list] as id (id)}
						<CharacterBadge characterId={id as CharacterId} />
					{:else}
						<span class="muted">{t('common.none')}</span>
					{/each}
				</p>
			</section>
		{/each}
		<Toggle
			label={t('scripts.botc.oneDemon')}
			checked={filters.oneDemon}
			onChange={(v) => (filters.oneDemon = v)}
		/>
		<Toggle
			label={t('scripts.botc.officialOnly')}
			checked={filters.officialOnly}
			onChange={(v) => (filters.officialOnly = v)}
		/>
		<!-- Clearing a filter deletes nothing, so it is the clear-X, not the trash can. -->
		<IconButton icon="close" label={t('scripts.botc.clear')} onclick={clearCharacters} />
	{/if}
</div>

<style>
	.filter {
		display: grid;
		gap: var(--space-3);
		margin-top: var(--space-2);
	}
	fieldset {
		margin: 0;
		padding: 0;
		border: 0;
		display: grid;
		gap: var(--space-1);
	}
	legend,
	h3 {
		margin: 0 0 var(--space-1);
		font-size: 1rem;
	}
	.chosen-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.badges {
		margin: 0;
		min-height: var(--tap-target);
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-2);
		align-items: center;
	}
	.muted {
		color: var(--on-surface-muted);
	}
</style>
