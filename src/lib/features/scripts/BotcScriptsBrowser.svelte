<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
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
	/** Catalog names for the site's edition filter values (0, 1, 2). */
	const EDITION_NAMES = ['base', 'kickstarter', 'carousel'] as const;
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

	const SORTS = $derived<{ value: BotcScriptsSort; label: string }[]>(
		(['votes', 'newest', 'oldest', 'match'] as const).map((value) => ({
			value,
			label: t(`scripts.botc.sort.${value}`)
		}))
	);
	const sortLabel = $derived(
		SORTS.find(
			(s) => s.value === (current.term || current.sort !== 'match' ? current.sort : 'votes')
		)?.label ?? t('scripts.botc.sort.votes')
	);

	const status = $derived(
		ref
			? t('scripts.botc.refHint')
			: failure ||
					(loading && results.length === 0
						? t('scripts.botc.searching')
						: searched === undefined
							? ''
							: results.length === 0
								? t('common.none')
								: t('scripts.botc.count', { count, sort: sortLabel.toLowerCase() }))
	);

	function countsLabel(card: BotcCard): string {
		return (['townsfolk', 'outsider', 'minion', 'demon'] as const)
			.map((type) => {
				const n = card.counts[type] ?? 0;
				return `${n} ${n === 1 ? TYPE_LABELS[type] : TYPE_PLURALS[type]}`;
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
			label={t('scripts.botc.sort')}
			hideLabel
			value={filters.sort}
			options={SORTS}
			onChange={(v) => (filters.sort = v)}
		/>
		<Button onclick={() => (filtersOpen = true)} disabled={disabled || !!ref}
			>{activeFilters
				? t('scripts.botc.filtersCount', { count: activeFilters })
				: t('scripts.botc.filters')}</Button
		>
	</div>

	<p class="status" role="status" data-testid="botc-status">{status}</p>

	<!-- Fixed height: results scroll inside it, so loading or paging never moves anything. -->
	<ul class="results" aria-label={t('scripts.botc.results')} aria-busy={loading}>
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
						<span class="name">{row.name || t('common.none')}</span>
						<span class="score" aria-label={t('scripts.botc.votes', { count: row.score })}
							>{row.score}</span
						>
						<span class="details"
							>{row.author || t('common.none')} · {row.type || t('common.none')} · {row.version}</span
						>
						<span class="makeup" data-testid="botc-makeup">
							{#if card}
								<span class="counts" aria-label={countsLabel(card)}>
									<span class="good">{card.counts.townsfolk ?? 0}</span> ·
									<span class="good">{card.counts.outsider ?? 0}</span> ·
									<span class="evil">{card.counts.minion ?? 0}</span> ·
									<span class="evil">{card.counts.demon ?? 0}</span>
								</span>
								<span class="demons"
									>{card.demons.map((d) => d.name).join(', ') || t('common.none')}</span
								>
								{#if card.homebrew}<span class="tag">{t('scripts.botc.homebrew')}</span>{/if}
							{/if}
						</span>
					</button>
					<IconButton
						icon="info"
						label={t('scripts.botc.details', { name: row.name })}
						onclick={() => showDetails(row)}
					/>
				</li>
			{/each}
		{/if}
	</ul>

	<!-- Both always there: More pages a search, Load opens a typed link or number. -->
	<div class="more">
		<Button
			variant="quiet"
			disabled={disabled || loading || !hasMore || !!ref}
			onclick={() => load($state.snapshot(current) as BotcScriptsQuery, page + 1)}
			>{t('scripts.botc.more')}</Button
		>
		<Button variant="accent" disabled={disabled || !ref} onclick={() => ref && onpick(ref)}
			>{t('scripts.picker.load')}</Button
		>
	</div>
</div>

<Dialog bind:open={filtersOpen} title={t('scripts.botc.filters')} size="full">
	<div class="filters">
		<fieldset>
			<legend>{t('scripts.botc.scriptType')}</legend>
			<div class="choices">
				{#each [['', t('scripts.botc.type.any')], ['Full', t('scripts.kind.Full')], ['Teensyville', t('scripts.kind.Teensyville')]] as [value, label] (value)}
					<Button
						variant={filters.type === value ? 'accent' : 'solid'}
						aria-pressed={filters.type === value}
						onclick={() => (filters.type = value as Filters['type'])}>{label}</Button
					>
				{/each}
			</div>
		</fieldset>

		<Select
			label={t('scripts.botc.charactersFrom')}
			value={filters.edition === undefined ? 'any' : String(filters.edition)}
			options={[
				{ value: 'any', label: t('scripts.botc.anyEdition') },
				...BOTC_EDITIONS.map((e) => ({
					value: String(e),
					label: t(`scripts.botc.edition.${EDITION_NAMES[e]}`)
				}))
			]}
			onChange={(v) => (filters.edition = v === 'any' ? undefined : Number(v))}
		/>

		{#each [['include', t('scripts.botc.includes')], ['exclude', t('scripts.botc.leavesOut')]] as const as [list, label] (list)}
			<section class="chosen" aria-label={t('scripts.botc.listCharacters', { list: label })}>
				<div class="chosen-head">
					<h3>{label}</h3>
					<Button
						onclick={() => {
							picking = list;
							pickerOpen = true;
						}}
						disabled={!data}>{t('scripts.botc.choose')}</Button
					>
				</div>
				<p class="badges" data-testid="filter-{list}">
					{#each filters[list] as id (id)}
						<CharacterBadge characterId={id as CharacterId} inline />
					{:else}
						<span class="muted">{t('common.none')}</span>
					{/each}
				</p>
			</section>
		{/each}

		<label class="field">
			<span>{t('scripts.botc.author')}</span>
			<input type="text" autocomplete="off" bind:value={filters.author} />
		</label>

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
	</div>
	{#snippet actions()}
		<Button variant="quiet" onclick={clearFilters} disabled={activeFilters === 0}
			>{t('scripts.botc.clear')}</Button
		>
		<Button variant="accent" onclick={() => (filtersOpen = false)}>{t('scripts.botc.show')}</Button>
	{/snippet}
</Dialog>

<Dialog
	bind:open={pickerOpen}
	title={picking === 'exclude' ? t('scripts.botc.leavesOut') : t('scripts.botc.includes')}
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
		<Button variant="accent" onclick={() => (pickerOpen = false)}>{t('scripts.botc.done')}</Button>
	{/snippet}
</Dialog>

<Dialog
	bind:open={detailsOpen}
	title={details?.name || t('scripts.current.defaultName')}
	size="full"
>
	{#if details}
		<dl class="facts">
			<dt>{t('scripts.botc.author')}</dt>
			<dd>{details.author || t('common.none')}</dd>
			<dt>{t('scripts.botc.type')}</dt>
			<dd>{details.type || t('common.none')}</dd>
			<dt>{t('scripts.botc.version')}</dt>
			<dd>{details.version}</dd>
			<dt>{t('scripts.botc.votesLabel')}</dt>
			<dd>{details.score}</dd>
		</dl>
		<div class="groups">
			{#each detailsCard?.groups ?? [] as group (group.type ?? 'unknown')}
				<section>
					<h3>{group.type ? TYPE_PLURALS[group.type] : t('scripts.botc.unknownType')}</h3>
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
				<p class="muted">{t('common.none')}</p>
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
				rel="noopener noreferrer">{t('scripts.botc.open')}</a
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
			}}>{t('scripts.picker.load')}</Button
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
