<script lang="ts">
	/**
	 * History's stats (Trevor, 2026-10-16): a summary, then scripts, Storytellers, characters and players
	 * worked out from the games ended on this device (`#lib/core/stats`).
	 */
	import { onMount } from 'svelte';
	import { CHARACTER_TYPES, type CharacterType } from '#lib/core/data/index.ts';
	import {
		historyStats,
		winRate,
		type CharacterStats,
		type GameRecord,
		type PlayerStats,
		type ScriptStats,
		type StorytellerStats
	} from '#lib/core/stats/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { TYPE_PLURALS } from '#lib/features/reference/labels.ts';
	import { intl, t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import SearchField from '#lib/ui/primitives/SearchField.svelte';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import DataTable, { type DataColumn, type DataSort } from '#lib/ui/table/DataTable.svelte';
	import FilterOptions from '#lib/ui/table/FilterOptions.svelte';
	import { loadGameRecords } from './records.ts';
	import { matchesText, nextSort, sortRows } from './stat-rows.ts';

	let records = $state.raw<GameRecord[]>([]);
	onMount(() => {
		loadGameRecords()
			.then((r) => (records = r))
			.catch((e: unknown) => reportError(e, { area: 'history' }));
	});
	const stats = $derived(historyStats(records));
	// Shares of the games with a recorded winner (Trevor, 2026-10-18), as win rates count them.
	const decided = $derived(stats.summary.wins.good + stats.summary.wins.evil);
	const finalThreeDecided = $derived(
		stats.summary.finalThree.wins.good + stats.summary.finalThree.wins.evil
	);

	const count = (n: number) => intl.number(n);
	const decimal = (n: number | undefined) =>
		n === undefined ? t('common.none') : intl.number(n, { maximumFractionDigits: 1 });
	const percent = (wins: number, decided: number) => {
		const rate = winRate(wins, decided);
		return rate === undefined ? t('common.none') : intl.number(rate, { style: 'percent' });
	};
	const width = (u: number) => `calc(${u} * var(--u))`;
	/** A win rate as a whole percentage, for the column's filter. */
	const percentOf = (wins: number, decided: number) => {
		const rate = winRate(wins, decided);
		return rate === undefined ? undefined : Math.round(rate * 100);
	};

	// ── Scripts ──
	type ScriptColumn = 'script' | 'games' | 'good' | 'evil';
	let scriptSort = $state<DataSort<ScriptColumn> | undefined>();
	let scriptFilter = $state('');
	const scriptColumns = $derived<DataColumn<ScriptColumn, ScriptStats>[]>([
		{
			id: 'script',
			label: t('history.script'),
			rowHeader: true,
			sortable: true,
			filterable: true,
			filtered: scriptFilter.trim() !== ''
		},
		{
			id: 'games',
			label: t('history.games'),
			sortable: true,
			align: 'end',
			width: width(5),
			value: (s) => scriptValue(s, 'games')
		},
		{
			id: 'good',
			label: t('history.goodWins'),
			sortable: true,
			align: 'end',
			width: width(5),
			value: (s) => scriptValue(s, 'good')
		},
		{
			id: 'evil',
			label: t('history.evilWins'),
			sortable: true,
			align: 'end',
			width: width(5),
			value: (s) => scriptValue(s, 'evil')
		}
	]);
	const scriptValue = (s: ScriptStats, c: ScriptColumn) =>
		c === 'script' ? (s.name ?? '') : c === 'games' ? s.games : s.wins[c];
	const scriptRows = $derived(
		sortRows(
			stats.scripts.filter((s) => matchesText(s.name, scriptFilter)),
			scriptSort,
			scriptValue
		)
	);

	// ── Storytellers: who ran each game (Game.storytellerName); unnamed games show as None ──
	type StorytellerColumn = 'storyteller' | 'games' | 'good' | 'evil';
	let storytellerSort = $state<DataSort<StorytellerColumn> | undefined>();
	let storytellerFilter = $state('');
	const storytellerColumns = $derived<DataColumn<StorytellerColumn, StorytellerStats>[]>([
		{
			id: 'storyteller',
			label: t('history.storyteller'),
			rowHeader: true,
			sortable: true,
			filterable: true,
			filtered: storytellerFilter.trim() !== ''
		},
		{
			id: 'games',
			label: t('history.games'),
			sortable: true,
			align: 'end',
			width: width(5),
			value: (s) => storytellerValue(s, 'games')
		},
		{
			id: 'good',
			label: t('history.goodWins'),
			sortable: true,
			align: 'end',
			width: width(5),
			value: (s) => storytellerValue(s, 'good')
		},
		{
			id: 'evil',
			label: t('history.evilWins'),
			sortable: true,
			align: 'end',
			width: width(5),
			value: (s) => storytellerValue(s, 'evil')
		}
	]);
	const storytellerValue = (s: StorytellerStats, c: StorytellerColumn) =>
		c === 'storyteller' ? (s.name ?? '') : c === 'games' ? s.games : s.wins[c];
	const storytellerRows = $derived(
		sortRows(
			stats.storytellers.filter((s) => matchesText(s.name ?? t('common.none'), storytellerFilter)),
			storytellerSort ?? { column: 'games', direction: 'descending' },
			storytellerValue
		)
	);

	// ── Characters: by the character each player started as ──
	type CharacterColumn = 'character' | 'type' | 'games' | 'wins' | 'rate';
	let characterSort = $state<DataSort<CharacterColumn> | undefined>();
	let characterFilter = $state('');
	let typeFilter = $state<CharacterType[]>([]);
	const characterColumns = $derived<DataColumn<CharacterColumn, CharacterStats>[]>([
		{
			id: 'character',
			label: t('history.character'),
			rowHeader: true,
			sortable: true,
			filterable: true,
			filtered: characterFilter.trim() !== ''
		},
		{
			id: 'type',
			label: t('history.type'),
			sortable: true,
			filterable: true,
			filtered: typeFilter.length > 0,
			wide: true,
			width: width(7)
		},
		{
			id: 'games',
			label: t('history.games'),
			sortable: true,
			align: 'end',
			width: width(5),
			value: (c) => characterValue(c, 'games')
		},
		// Off on phones so the character's badge has room for its name (Trevor, 2026-10-18:
		// names ran past their badges); Win rate stays.
		{
			id: 'wins',
			label: t('history.wins'),
			sortable: true,
			align: 'end',
			wide: true,
			width: width(5),
			value: (c) => characterValue(c, 'wins')
		},
		{
			id: 'rate',
			label: t('history.winRate'),
			sortable: true,
			align: 'end',
			width: width(5),
			value: (c) => percentOf(c.wins, c.decided)
		}
	]);
	const characterValue = (c: CharacterStats, column: CharacterColumn) =>
		column === 'character'
			? c.name
			: column === 'type'
				? CHARACTER_TYPES.indexOf(c.type)
				: column === 'rate'
					? winRate(c.wins, c.decided)
					: c[column];
	const characterRows = $derived(
		sortRows(
			stats.characters.filter(
				(c) =>
					matchesText(c.name, characterFilter) &&
					(typeFilter.length === 0 || typeFilter.includes(c.type))
			),
			characterSort ?? { column: 'games', direction: 'descending' },
			characterValue
		)
	);
	function toggleType(type: CharacterType, on: boolean) {
		typeFilter = on ? [...typeFilter, type] : typeFilter.filter((x) => x !== type);
	}

	// ── Players: matched by name ──
	type PlayerColumn = 'player' | 'games' | 'good' | 'evil' | 'wins' | 'rate' | 'deaths';
	let playerSort = $state<DataSort<PlayerColumn> | undefined>();
	let playerFilter = $state('');
	const playerColumns = $derived<DataColumn<PlayerColumn, PlayerStats>[]>([
		{
			id: 'player',
			label: t('history.player'),
			rowHeader: true,
			sortable: true,
			filterable: true,
			filtered: playerFilter.trim() !== ''
		},
		{
			id: 'games',
			label: t('history.games'),
			sortable: true,
			align: 'end',
			width: width(5),
			value: (p) => playerValue(p, 'games')
		},
		{
			id: 'good',
			label: t('history.good'),
			sortable: true,
			align: 'end',
			wide: true,
			width: width(5),
			value: (p) => playerValue(p, 'good')
		},
		{
			id: 'evil',
			label: t('history.evil'),
			sortable: true,
			align: 'end',
			wide: true,
			width: width(5),
			value: (p) => playerValue(p, 'evil')
		},
		{
			id: 'wins',
			label: t('history.wins'),
			sortable: true,
			align: 'end',
			width: width(5),
			value: (p) => playerValue(p, 'wins')
		},
		{
			id: 'rate',
			label: t('history.winRate'),
			sortable: true,
			align: 'end',
			width: width(5),
			value: (p) => percentOf(p.wins, p.decided)
		},
		{
			id: 'deaths',
			label: t('history.deaths'),
			sortable: true,
			align: 'end',
			wide: true,
			width: width(5),
			value: (p) => playerValue(p, 'deaths')
		}
	]);
	const playerValue = (p: PlayerStats, column: PlayerColumn) =>
		column === 'player'
			? p.name
			: column === 'good' || column === 'evil'
				? p.teams[column]
				: column === 'rate'
					? winRate(p.wins, p.decided)
					: p[column];
	const playerRows = $derived(
		sortRows(
			stats.players.filter((p) => matchesText(p.name, playerFilter)),
			playerSort ?? { column: 'games', direction: 'descending' },
			playerValue
		)
	);
</script>

{#snippet textFilter(column: string, value: string, set: (v: string) => void, close: () => void)}
	<div class="text">
		<SearchField
			label={t('history.filterLabel', { column })}
			placeholder={t('history.filter')}
			{value}
			oninput={set}
			oncommit={() => (close(), false)}
		/>
	</div>
{/snippet}

<PageSection title={t('history.summary')}>
	<dl>
		<div>
			<dt>{t('history.games')}</dt>
			<dd>{count(stats.summary.games)}</dd>
		</div>
		<div>
			<dt>{t('history.goodWins')}</dt>
			<dd>
				{count(stats.summary.wins.good)}
				<span class="share">({percent(stats.summary.wins.good, decided)})</span>
			</dd>
		</div>
		<div>
			<dt>{t('history.evilWins')}</dt>
			<dd>
				{count(stats.summary.wins.evil)}
				<span class="share">({percent(stats.summary.wins.evil, decided)})</span>
			</dd>
		</div>
		<div>
			<dt>{t('history.alternateWins')}</dt>
			<dd>
				{count(stats.summary.alternateWins)}
				<span class="share">({percent(stats.summary.alternateWins, decided)})</span>
			</dd>
		</div>
		<div>
			<dt>{t('history.finalThree')}</dt>
			<dd>
				{count(stats.summary.finalThree.games)}
				<span class="share">({percent(stats.summary.finalThree.games, stats.summary.games)})</span>
			</dd>
		</div>
		<div>
			<dt>{t('history.finalThreeGood')}</dt>
			<dd>
				{count(stats.summary.finalThree.wins.good)}
				<span class="share">({percent(stats.summary.finalThree.wins.good, finalThreeDecided)})</span
				>
			</dd>
		</div>
		<div>
			<dt>{t('history.finalThreeEvil')}</dt>
			<dd>
				{count(stats.summary.finalThree.wins.evil)}
				<span class="share">({percent(stats.summary.finalThree.wins.evil, finalThreeDecided)})</span
				>
			</dd>
		</div>
		<div>
			<dt>{t('history.averageDays')}</dt>
			<dd>{decimal(stats.summary.averageDays)}</dd>
		</div>
		<div>
			<dt>{t('history.averagePlayers')}</dt>
			<dd>{decimal(stats.summary.averagePlayers)}</dd>
		</div>
	</dl>
</PageSection>

<PageSection title={t('history.scripts')} collapsible storageKey="history.scripts">
	<DataTable
		label={t('history.scripts')}
		testid="history-scripts"
		columns={scriptColumns}
		rows={scriptRows}
		key={(s) => s.key}
		sort={scriptSort}
		onSort={(c) => (scriptSort = nextSort(scriptSort, c, ['script']))}
		narrow="stack"
		empty={records.length > 0 ? t('history.noMatch') : t('common.none')}
	>
		{#snippet cell(s, column)}
			{#if column.id === 'script'}
				<span class="script">{s.name || t('common.none')}</span>
				{#if s.author}<span class="author">{t('history.byAuthor', { author: s.author })}</span>{/if}
			{:else}
				{count(scriptValue(s, column.id) as number)}
			{/if}
		{/snippet}
		{#snippet filter(column, close)}
			{@render textFilter(column.label, scriptFilter, (v) => (scriptFilter = v), close)}
		{/snippet}
	</DataTable>
</PageSection>

<PageSection title={t('history.storytellers')} collapsible storageKey="history.storytellers">
	<DataTable
		label={t('history.storytellers')}
		testid="history-storytellers"
		columns={storytellerColumns}
		rows={storytellerRows}
		key={(s) => s.key}
		sort={storytellerSort}
		onSort={(c) => (storytellerSort = nextSort(storytellerSort, c, ['storyteller']))}
		narrow="stack"
		empty={records.length > 0 ? t('history.noMatch') : t('common.none')}
	>
		{#snippet cell(s, column)}
			{#if column.id === 'storyteller'}
				{s.name ?? t('common.none')}
			{:else}
				{count(storytellerValue(s, column.id) as number)}
			{/if}
		{/snippet}
		{#snippet filter(column, close)}
			{@render textFilter(column.label, storytellerFilter, (v) => (storytellerFilter = v), close)}
		{/snippet}
	</DataTable>
</PageSection>

<PageSection title={t('history.characters')} collapsible storageKey="history.characters">
	<DataTable
		label={t('history.characters')}
		testid="history-characters"
		columns={characterColumns}
		rows={characterRows}
		key={(c) => c.characterId}
		sort={characterSort}
		onSort={(c) => (characterSort = nextSort(characterSort, c, ['character', 'type']))}
		narrow="hide"
		empty={records.length > 0 ? t('history.noMatch') : t('common.none')}
	>
		{#snippet cell(c, column)}
			{#if column.id === 'character'}
				<CharacterBadge characterId={c.characterId} text={c.name} />
			{:else if column.id === 'type'}
				{TYPE_PLURALS[c.type]}
			{:else if column.id === 'rate'}
				{percent(c.wins, c.decided)}
			{:else}
				{count(c[column.id])}
			{/if}
		{/snippet}
		{#snippet filter(column, close)}
			{#if column.id === 'type'}
				<FilterOptions
					legend={column.label}
					hideLegend
					options={CHARACTER_TYPES.map((type) => ({ value: type, label: TYPE_PLURALS[type] }))}
					values={typeFilter}
					ontoggle={(type, on) => toggleType(type as CharacterType, on)}
				/>
				<Button variant="quiet" onclick={() => (typeFilter = [])}>{t('history.allTypes')}</Button>
			{:else}
				{@render textFilter(column.label, characterFilter, (v) => (characterFilter = v), close)}
			{/if}
		{/snippet}
	</DataTable>
</PageSection>

<PageSection title={t('history.players')} collapsible storageKey="history.players">
	<DataTable
		label={t('history.players')}
		testid="history-players"
		columns={playerColumns}
		rows={playerRows}
		key={(p) => p.name.toLocaleLowerCase()}
		sort={playerSort}
		onSort={(c) => (playerSort = nextSort(playerSort, c, ['player']))}
		narrow="hide"
		empty={records.length > 0 ? t('history.noMatch') : t('common.none')}
	>
		{#snippet cell(p, column)}
			{#if column.id === 'player'}
				<span class="pill">{p.name}</span>
			{:else if column.id === 'rate'}
				{percent(p.wins, p.decided)}
			{:else}
				{count(playerValue(p, column.id) as number)}
			{/if}
		{/snippet}
		{#snippet filter(column, close)}
			{@render textFilter(column.label, playerFilter, (v) => (playerFilter = v), close)}
		{/snippet}
	</DataTable>
</PageSection>

<style>
	dl {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(calc(7 * var(--u)), 1fr));
		gap: var(--space-2);
		margin: 0;
	}
	dl div {
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
	}
	dt {
		font-size: 0.85rem;
		color: var(--on-surface-muted);
	}
	dd {
		margin: 0;
		white-space: nowrap;
		font-family: var(--font-heading);
		font-size: 1.3rem;
		color: var(--heading);
	}
	.share {
		font-size: 0.7em;
		color: var(--on-surface-muted);
	}
	.script {
		display: block;
	}
	.author {
		font-size: 0.85rem;
		color: var(--on-surface-muted);
	}
	.pill {
		display: inline-block;
		padding: 0 var(--space-2);
		border-radius: 999em;
		background: var(--surface-selected);
	}
	.text {
		margin-top: var(--space-2);
	}
</style>
