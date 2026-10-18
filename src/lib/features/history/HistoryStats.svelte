<script lang="ts">
	/**
	 * History's stats (Trevor, 2026-10-16): a summary, then scripts, characters and players
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
		type ScriptStats
	} from '#lib/core/stats/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { TYPE_PLURALS } from '#lib/features/reference/labels.ts';
	import { intl, t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ClearableField from '#lib/ui/primitives/ClearableField.svelte';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import DataTable, { type DataColumn, type DataSort } from '#lib/ui/table/DataTable.svelte';
	import { loadGameRecords } from './records.ts';
	import { matchesText, nextSort, sortRows } from './stat-rows.ts';

	let records = $state.raw<GameRecord[]>([]);
	onMount(() => {
		loadGameRecords()
			.then((r) => (records = r))
			.catch((e: unknown) => reportError(e, { area: 'history' }));
	});
	const stats = $derived(historyStats(records));

	const count = (n: number) => intl.number(n);
	const decimal = (n: number | undefined) =>
		n === undefined ? t('common.none') : intl.number(n, { maximumFractionDigits: 1 });
	const percent = (wins: number, decided: number) => {
		const rate = winRate(wins, decided);
		return rate === undefined ? t('common.none') : intl.number(rate, { style: 'percent' });
	};
	const width = (u: number) => `calc(${u} * var(--u))`;

	// ── Scripts ──
	type ScriptColumn = 'script' | 'games' | 'good' | 'evil';
	let scriptSort = $state<DataSort<ScriptColumn> | undefined>();
	let scriptFilter = $state('');
	const scriptColumns = $derived<DataColumn<ScriptColumn>[]>([
		{
			id: 'script',
			label: t('history.script'),
			rowHeader: true,
			sortable: true,
			filterable: true,
			filtered: scriptFilter.trim() !== ''
		},
		{ id: 'games', label: t('history.games'), sortable: true, align: 'end', width: width(5) },
		{ id: 'good', label: t('history.goodWins'), sortable: true, align: 'end', width: width(5) },
		{ id: 'evil', label: t('history.evilWins'), sortable: true, align: 'end', width: width(5) }
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

	// ── Characters: by the character each player started as ──
	type CharacterColumn = 'character' | 'type' | 'games' | 'wins' | 'rate';
	let characterSort = $state<DataSort<CharacterColumn> | undefined>();
	let characterFilter = $state('');
	let typeFilter = $state<CharacterType[]>([]);
	const characterColumns = $derived<DataColumn<CharacterColumn>[]>([
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
		{ id: 'games', label: t('history.games'), sortable: true, align: 'end', width: width(5) },
		// Off on phones so the character's badge has room for its name (Trevor, 2026-10-18:
		// names ran past their badges); Win rate stays.
		{
			id: 'wins',
			label: t('history.wins'),
			sortable: true,
			align: 'end',
			wide: true,
			width: width(5)
		},
		{ id: 'rate', label: t('history.winRate'), sortable: true, align: 'end', width: width(5) }
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
	const playerColumns = $derived<DataColumn<PlayerColumn>[]>([
		{
			id: 'player',
			label: t('history.player'),
			rowHeader: true,
			sortable: true,
			filterable: true,
			filtered: playerFilter.trim() !== ''
		},
		{ id: 'games', label: t('history.games'), sortable: true, align: 'end', width: width(5) },
		{
			id: 'good',
			label: t('history.good'),
			sortable: true,
			align: 'end',
			wide: true,
			width: width(5)
		},
		{
			id: 'evil',
			label: t('history.evil'),
			sortable: true,
			align: 'end',
			wide: true,
			width: width(5)
		},
		{ id: 'wins', label: t('history.wins'), sortable: true, align: 'end', width: width(5) },
		{ id: 'rate', label: t('history.winRate'), sortable: true, align: 'end', width: width(5) },
		{
			id: 'deaths',
			label: t('history.deaths'),
			sortable: true,
			align: 'end',
			wide: true,
			width: width(5)
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
	<ClearableField {value} onclear={() => set('')}>
		<input
			class="text"
			type="search"
			aria-label={t('history.filterLabel', { column })}
			placeholder={t('history.filter')}
			enterkeyhint="done"
			{value}
			oninput={(e) => set(e.currentTarget.value)}
			onkeydown={(e) => e.key === 'Enter' && close()}
		/>
	</ClearableField>
{/snippet}

<PageSection title={t('history.summary')}>
	<dl>
		<div>
			<dt>{t('history.games')}</dt>
			<dd>{count(stats.summary.games)}</dd>
		</div>
		<div>
			<dt>{t('history.goodWins')}</dt>
			<dd>{count(stats.summary.wins.good)}</dd>
		</div>
		<div>
			<dt>{t('history.evilWins')}</dt>
			<dd>{count(stats.summary.wins.evil)}</dd>
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
				<CharacterBadge characterId={c.characterId} text={c.name} inline />
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
				<fieldset>
					<legend class="visually-hidden">{column.label}</legend>
					{#each CHARACTER_TYPES as type (type)}
						<label class="check">
							<input
								type="checkbox"
								checked={typeFilter.includes(type)}
								onchange={(e) => toggleType(type, e.currentTarget.checked)}
							/>
							{TYPE_PLURALS[type]}
						</label>
					{/each}
				</fieldset>
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
		font-family: var(--font-heading);
		font-size: 1.3rem;
		color: var(--heading);
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
	fieldset {
		display: grid;
		margin: var(--space-2) 0 0;
		padding: 0;
		border: 0;
	}
	.check {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-height: var(--tap-target);
	}
	.check input {
		width: calc(1.25 * var(--u));
		height: calc(1.25 * var(--u));
	}
	.visually-hidden {
		position: absolute;
		width: 1px; /* px-ok: hidden from sight, kept for screen readers */
		height: 1px; /* px-ok: hidden from sight, kept for screen readers */
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.text {
		width: 100%;
		box-sizing: border-box;
		min-height: var(--tap-target);
		margin-top: var(--space-2);
		padding: 0 var(--space-2);
		border: var(--card-border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: var(--on-surface);
		font: inherit;
		font-size: max(1rem, 16px); /* px-ok: iOS zooms into fields under 16px */
	}
</style>
