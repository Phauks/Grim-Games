<script lang="ts">
	import { onMount } from 'svelte';
	import type { CharacterId, CharacterType, GameData } from '#lib/core/data/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import CharacterPicker from '#lib/features/characters/CharacterPicker.svelte';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { errorMessage } from '#lib/features/errors/app-error.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { TYPE_LABELS, TYPE_PLURALS } from '#lib/features/reference/labels.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import {
		BOTC_EDITIONS,
		EMPTY_QUERY,
		MAX_FILTER_CHARACTERS,
		filterCount,
		normaliseSearch,
		parseBotcScriptsRef,
		scriptPageUrl,
		searchPath,
		type BotcScriptsQuery,
		type BotcScriptsRef,
		type BotcScriptsSort,
		type BotcScriptsSummary
	} from './botcscripts-api.ts';
	import { botcCard, type BotcCard } from './botcscripts-cards.ts';
	import { ScriptFetchError, searchBotcScripts } from './fetch-script.ts';

	/**
	 * Search and browse BotC Scripts through our Worker, with the site's own filters and
	 * sorts. Sits inside the script picker, which owns the search box (`query`). Polite to the site: one request per pause in typing, per change of filters or
	 * sort, or per tap on More; never prefetched, and the Worker caches answers.
	 */
	interface Props {
		/** What's typed: a search, or a botcscripts.com link or script number. */
		query?: string;
		/** Called when a result is chosen. */
		onpick: (ref: BotcScriptsRef) => void;
		disabled?: boolean;
	}

	let { query = $bindable(''), onpick, disabled = false }: Props = $props();

	const DEBOUNCE_MS = 400;
	const FILTER_TYPES: readonly CharacterType[] = [
		'townsfolk',
		'outsider',
		'minion',
		'demon',
		'traveller'
	];

	type Filters = Omit<BotcScriptsQuery, 'term'>;
	function noFilters(): Filters {
		const blank: Partial<BotcScriptsQuery> = { ...EMPTY_QUERY };
		delete blank.term;
		return blank as Filters;
	}
	let filters = $state<Filters>(noFilters());

	let data = $state.raw<GameData>();
	let results = $state.raw<BotcScriptsSummary[]>([]);
	let count = $state(0);
	let page = $state(0);
	let hasMore = $state(false);
	let loading = $state(false);
	let failure = $state('');
	let searched = $state<string | undefined>(undefined);
	let controller: AbortController | undefined;

	let filtersOpen = $state(false);
	let picking = $state<'include' | 'exclude' | undefined>();
	let pickerOpen = $state(false);
	let details = $state.raw<BotcScriptsSummary | undefined>();
	let detailsOpen = $state(false);

	onMount(() => {
		loadOfficialData().then(
			(d) => (data = d),
			(e) => reportError(e, { area: 'scripts', notify: false })
		);
	});

	const ref = $derived(parseBotcScriptsRef(query));
	const current = $derived<BotcScriptsQuery>({ ...filters, term: normaliseSearch(query) });
	const key = $derived(searchPath(current));
	const activeFilters = $derived(filterCount(current));
	const cards = $derived(
		data ? new Map(results.map((r) => [r.versionId, botcCard(r.characters, data!)])) : undefined
	);

	async function load(q: BotcScriptsQuery, next: number) {
		controller?.abort();
		const mine = new AbortController();
		controller = mine;
		loading = true;
		failure = '';
		try {
			const found = await searchBotcScripts(q, next, mine.signal);
			if (controller !== mine) return;
			results = next === 1 ? found.results : [...results, ...found.results];
			count = found.count;
			page = found.page;
			hasMore = found.hasMore;
			searched = searchPath(q);
		} catch (e) {
			if (e instanceof DOMException && e.name === 'AbortError') return;
			if (!(e instanceof ScriptFetchError)) reportError(e, { area: 'scripts', notify: false });
			failure = errorMessage(e);
			if (next === 1) results = [];
		} finally {
			if (controller === mine) loading = false;
		}
	}

	// A search runs after a pause in typing or a change of filters; links and numbers don't search.
	$effect(() => {
		const q = $state.snapshot(current) as BotcScriptsQuery;
		// Filters apply when their sheet closes, not on every tap inside it.
		if (ref || key === searched || filtersOpen || pickerOpen) return;
		const timer = setTimeout(() => void load(q, 1), searched === undefined ? 0 : DEBOUNCE_MS);
		return () => clearTimeout(timer);
	});

	$effect(() => () => controller?.abort());

	const SORTS: { value: BotcScriptsSort; label: string }[] = [
		{ value: 'votes', label: 'Most votes' },
		{ value: 'newest', label: 'Newest' },
		{ value: 'oldest', label: 'Oldest' },
		{ value: 'match', label: 'Best match' }
	];
	const sortLabel = $derived(
		SORTS.find(
			(s) => s.value === (current.term || current.sort !== 'match' ? current.sort : 'votes')
		)?.label ?? 'Most votes'
	);

	const status = $derived(
		ref
			? 'A BotC Scripts link or number: tap Load.'
			: failure ||
					(loading && results.length === 0
						? 'Searching…'
						: searched === undefined
							? ''
							: results.length === 0
								? 'None'
								: `${count} ${count === 1 ? 'script' : 'scripts'} · ${sortLabel.toLowerCase()}`)
	);

	function countsLabel(card: BotcCard): string {
		return (['townsfolk', 'outsider', 'minion', 'demon'] as const)
			.map((t) => {
				const n = card.counts[t] ?? 0;
				return `${n} ${n === 1 ? TYPE_LABELS[t] : TYPE_PLURALS[t]}`;
			})
			.join(', ');
	}

	function toggleCharacter(list: 'include' | 'exclude', id: CharacterId) {
		const other = list === 'include' ? 'exclude' : 'include';
		const has = filters[list].includes(id);
		filters[list] = has ? filters[list].filter((c) => c !== id) : [...filters[list], id];
		// A character can't be both required and ruled out.
		if (!has) filters[other] = filters[other].filter((c) => c !== id);
	}

	function clearFilters() {
		filters = { ...noFilters(), sort: filters.sort };
	}

	function showDetails(row: BotcScriptsSummary) {
		details = row;
		detailsOpen = true;
	}

	const pickable = $derived(
		data ? data.characters.filter((c) => FILTER_TYPES.includes(c.type)) : []
	);
	const detailsCard = $derived(details && cards?.get(details.versionId));
</script>

<div class="browser">
	<div class="tools">
		<Select
			label="Sort"
			hideLabel
			value={filters.sort}
			options={SORTS}
			onChange={(v) => (filters.sort = v)}
		/>
		<Button onclick={() => (filtersOpen = true)} disabled={disabled || !!ref}
			>{activeFilters ? `Filters · ${activeFilters}` : 'Filters'}</Button
		>
	</div>

	<p class="status" role="status" data-testid="botc-status">{status}</p>

	<!-- Fixed height: results scroll inside it, so loading or paging never moves anything. -->
	<ul class="results" aria-label="BotC Scripts results" aria-busy={loading}>
		{#if !ref}
			{#each results as row (row.versionId)}
				{@const card = cards?.get(row.versionId)}
				<li>
					<button
						type="button"
						class="row"
						{disabled}
						onclick={() => onpick({ kind: 'version', versionId: row.versionId })}
					>
						<span class="name">{row.name || 'None'}</span>
						<span class="score" aria-label="{row.score} votes">{row.score}</span>
						<span class="details"
							>{row.author || 'None'} · {row.type || 'None'} · {row.version}</span
						>
						<span class="makeup" data-testid="botc-makeup">
							{#if card}
								<span class="counts" aria-label={countsLabel(card)}>
									<span class="good">{card.counts.townsfolk ?? 0}</span> ·
									<span class="good">{card.counts.outsider ?? 0}</span> ·
									<span class="evil">{card.counts.minion ?? 0}</span> ·
									<span class="evil">{card.counts.demon ?? 0}</span>
								</span>
								<span class="demons">{card.demons.map((d) => d.name).join(', ') || 'None'}</span>
								{#if card.homebrew}<span class="tag">Homebrew</span>{/if}
							{/if}
						</span>
					</button>
					<IconButton icon="info" label="Details of {row.name}" onclick={() => showDetails(row)} />
				</li>
			{/each}
		{/if}
	</ul>

	<!-- Both always there: More pages a search, Load opens a typed link or number. -->
	<div class="more">
		<Button
			variant="quiet"
			disabled={disabled || loading || !hasMore || !!ref}
			onclick={() => load($state.snapshot(current) as BotcScriptsQuery, page + 1)}>More</Button
		>
		<Button variant="accent" disabled={disabled || !ref} onclick={() => ref && onpick(ref)}
			>Load</Button
		>
	</div>
</div>

<Dialog bind:open={filtersOpen} title="Filters" size="full">
	<div class="filters">
		<fieldset>
			<legend>Script type</legend>
			<div class="choices">
				{#each [['', 'Any'], ['Full', 'Full'], ['Teensyville', 'Teensyville']] as [value, label] (value)}
					<Button
						variant={filters.type === value ? 'accent' : 'solid'}
						aria-pressed={filters.type === value}
						onclick={() => (filters.type = value as Filters['type'])}>{label}</Button
					>
				{/each}
			</div>
		</fieldset>

		<Select
			label="Characters from"
			value={filters.edition === undefined ? 'any' : String(filters.edition)}
			options={[
				{ value: 'any', label: 'Any edition' },
				...BOTC_EDITIONS.map((e) => ({ value: String(e.value), label: e.label }))
			]}
			onChange={(v) => (filters.edition = v === 'any' ? undefined : Number(v))}
		/>

		{#each [['include', 'Includes'], ['exclude', 'Leaves out']] as const as [list, label] (list)}
			<section class="chosen" aria-label="{label} characters">
				<div class="chosen-head">
					<h3>{label}</h3>
					<Button
						onclick={() => {
							picking = list;
							pickerOpen = true;
						}}
						disabled={!data}>Choose</Button
					>
				</div>
				<p class="badges" data-testid="filter-{list}">
					{#each filters[list] as id (id)}
						<CharacterBadge characterId={id as CharacterId} inline />
					{:else}
						<span class="muted">None</span>
					{/each}
				</p>
			</section>
		{/each}

		<label class="field">
			<span>Author</span>
			<input type="text" autocomplete="off" bind:value={filters.author} />
		</label>

		<Toggle
			label="Exactly one Demon"
			checked={filters.oneDemon}
			onChange={(v) => (filters.oneDemon = v)}
		/>
		<Toggle
			label="Official characters only"
			checked={filters.officialOnly}
			onChange={(v) => (filters.officialOnly = v)}
		/>
	</div>
	{#snippet actions()}
		<Button variant="quiet" onclick={clearFilters} disabled={activeFilters === 0}>Clear</Button>
		<Button variant="accent" onclick={() => (filtersOpen = false)}>Show scripts</Button>
	{/snippet}
</Dialog>

<Dialog
	bind:open={pickerOpen}
	title={picking === 'exclude' ? 'Leaves out' : 'Includes'}
	size="full"
>
	{#if picking}
		{@const list = picking}
		<CharacterPicker
			characters={pickable}
			mode="multi"
			types={FILTER_TYPES}
			selected={filters[list] as CharacterId[]}
			max={MAX_FILTER_CHARACTERS}
			onSelect={(id) => toggleCharacter(list, id)}
		/>
	{/if}
	{#snippet actions()}
		<Button variant="accent" onclick={() => (pickerOpen = false)}>Done</Button>
	{/snippet}
</Dialog>

<Dialog bind:open={detailsOpen} title={details?.name || 'Script'} size="full">
	{#if details}
		<dl class="facts">
			<dt>Author</dt>
			<dd>{details.author || 'None'}</dd>
			<dt>Type</dt>
			<dd>{details.type || 'None'}</dd>
			<dt>Version</dt>
			<dd>{details.version}</dd>
			<dt>Votes</dt>
			<dd>{details.score}</dd>
		</dl>
		<div class="groups">
			{#each detailsCard?.groups ?? [] as group (group.type ?? 'unknown')}
				<section>
					<h3>{group.type ? TYPE_PLURALS[group.type] : 'Unknown type'}</h3>
					<p class="badges">
						{#each group.characters as c (c.id)}
							{#if c.official}
								<CharacterBadge characterId={c.official.id} inline />
							{:else}
								<span class="homebrew">{c.name}</span>
							{/if}
						{/each}
					</p>
				</section>
			{:else}
				<p class="muted">None</p>
			{/each}
		</div>
	{/if}
	{#snippet actions()}
		{#if details}
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<a
				class="external"
				href={scriptPageUrl(details.scriptId, details.version)}
				target="_blank"
				rel="noopener noreferrer">Open on BotC Scripts</a
			>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{/if}
		<Button
			variant="accent"
			{disabled}
			onclick={() => {
				const chosen = details;
				detailsOpen = false;
				if (chosen) onpick({ kind: 'version', versionId: chosen.versionId });
			}}>Load</Button
		>
	{/snippet}
</Dialog>

<style>
	.browser {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-height: 0;
		flex: 1;
	}
	.field {
		display: grid;
		gap: var(--space-1);
	}
	.field input {
		width: 100%;
		box-sizing: border-box;
		min-height: var(--tap-target);
		padding: var(--space-2);
		border: var(--card-border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		font-size: max(1rem, 16px); /* px-ok: iOS zooms into fields under 16px */
	}
	.tools {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: var(--space-2);
		align-items: end;
	}
	.status {
		margin: 0;
		min-height: 1lh;
		color: var(--on-surface-muted);
		overflow-wrap: anywhere;
	}
	.results {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		align-content: start;
		gap: var(--space-1);
		overscroll-behavior: contain;
	}
	.results li {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
	.row {
		flex: 1;
		min-width: 0;
		min-height: var(--tap-target);
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0 var(--space-2);
		padding: var(--space-2) var(--space-3);
		border: var(--card-border);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		text-align: left;
	}
	.row:hover:not(:disabled) {
		background: var(--surface-selected);
	}
	.name {
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.score {
		color: var(--on-surface-muted);
	}
	.details,
	.makeup {
		grid-column: 1 / -1;
		font-size: 0.85rem;
		color: var(--on-surface-muted);
		overflow-wrap: anywhere;
	}
	/* One line, always there, so cards keep their height while characters load. */
	.makeup {
		min-height: 1lh;
		display: flex;
		gap: var(--space-2);
		align-items: baseline;
		white-space: nowrap;
		overflow: hidden;
	}
	.demons {
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.good {
		color: var(--good);
		font-weight: 600;
	}
	.evil {
		color: var(--evil);
		font-weight: 600;
	}
	.tag {
		margin-left: auto;
		padding: 0 var(--space-1);
		border: var(--card-border);
		border-radius: var(--radius-sm);
	}
	.more {
		display: flex;
		justify-content: space-between;
		gap: var(--space-2);
	}
	.filters {
		display: grid;
		gap: var(--space-4);
		margin-top: var(--space-3);
		overflow-y: auto;
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
	.choices {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--space-2);
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
	.homebrew {
		padding: 0 var(--space-1);
		border: var(--card-border);
		border-radius: var(--radius-sm);
	}
	.facts {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-1) var(--space-3);
		margin: var(--space-3) 0;
	}
	.facts dt {
		color: var(--on-surface-muted);
	}
	.facts dd {
		margin: 0;
	}
	.groups {
		display: grid;
		gap: var(--space-3);
		overflow-y: auto;
	}
	.groups h3 {
		margin: 0 0 var(--space-1);
	}
	.external {
		display: inline-flex;
		align-items: center;
		min-height: var(--tap-target);
		margin-right: auto;
	}
</style>
