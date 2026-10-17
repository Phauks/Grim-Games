<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { createAttachmentKey } from 'svelte/attachments';
	import { SvelteMap } from 'svelte/reactivity';
	import { locale, t } from '#lib/i18n/locale.svelte.ts';
	import {
		editionScript,
		loadScriptText,
		type CharacterId,
		type CharacterType,
		type GameData,
		type LoadedScript,
		type ScriptLoadResult
	} from '#lib/core/data/index.ts';
	import CharacterPicker from '#lib/features/characters/CharacterPicker.svelte';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { errorMessage } from '#lib/features/errors/app-error.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import DataTable, { type DataColumn, type DataSort } from '#lib/ui/table/DataTable.svelte';
	import {
		EMPTY_QUERY,
		MAX_FILTER_CHARACTERS,
		filterCount,
		normaliseSearch,
		parseBotcScriptsRef,
		searchPath,
		type BotcScriptsQuery,
		type BotcScriptsSort
	} from './botcscripts-api.ts';
	import BotcFilter from './BotcFilter.svelte';
	import { collectionScripts } from './collection.svelte.ts';
	import { homebrewScripts } from './homebrew-scripts.svelte.ts';
	import { fetchRemote } from './remote-previews.svelte.ts';
	import { curatedScripts } from './curated.svelte.ts';
	import { worldCupScripts } from './world-cup.svelte.ts';
	import {
		chooseScript,
		currentScript,
		forgetScript,
		recentScripts,
		restoreScripts
	} from './current-script.svelte.ts';
	import {
		fetchLinkTarget,
		ScriptFetchError,
		searchBotcScripts,
		type FetchedScript
	} from './fetch-script.ts';
	import { filterRows, nextSort, sortRows, type RowSort, type SortColumn } from './picker-rows.ts';
	import { relaxJson } from './relaxed-json.ts';
	import { RemoteSearch } from './remote-search.svelte.ts';
	import { describeSource, reloadSavedScript, type ScriptSource } from './saved-scripts.ts';
	import ScriptView from './ScriptView.svelte';
	import { storedSource, type PageSource } from './search-sources.ts';
	import {
		botcProvider,
		findSaved,
		localListings,
		matchesSaved,
		SCRIPTS_PAGE_PROVIDERS,
		recentProvider,
		type LocalContext,
		type LoadTarget,
		type ScriptListing
	} from './script-providers.ts';
	import ScriptCheckDialog from './ScriptCheckDialog.svelte';
	import { CURATED_SECTIONS } from './script-tool-link.ts';

	/**
	 * The Scripts page's list and details (Trevor, 2026-10-16): search and sources on the left,
	 * the tapped script's details on the right (on a phone they slide over the list). Its job
	 * is to find, identify and save scripts; New game loads them.
	 */
	interface Props {
		/** Called after a script is saved (it is also the most recent saved script). */
		onchoose?: (script: LoadedScript) => void;
		busy?: boolean;
		/** What is typed in the page's search box. */
		term?: string;
		/** The one source listed. */
		source?: PageSource;
	}

	let {
		onchoose,
		busy = $bindable(false),
		term = $bindable(''),
		source = $bindable(storedSource())
	}: Props = $props();

	/** The row tapped; undefined shows the most recently saved script. */
	let selected = $state.raw<ScriptListing | undefined>();
	/** Phones: the details cover the list. */
	let paneOpen = $state(false);
	let removing = $state(false);
	let width = $state(0);
	/** Below 56rem the two panes don't fit side by side (matches the container query below). */
	const narrow = $derived(
		width > 0 && width < 56 * parseFloat(getComputedStyle(document.documentElement).fontSize)
	);

	let checkOpen = $state(false);

	// The search box and source live in the page's toolbar (`ScriptSearchBar`).
	let prevSource = source;
	$effect(() => {
		if (source === prevSource) return;
		prevSource = source;
		// Each source sorts its own way.
		untrack(() => (sort = undefined));
	});
	const searchingBotc = $derived(source === 'botc');
	let sort = $state<RowSort | undefined>();
	let data = $state.raw<GameData>();
	let error = $state('');

	let checking = $state.raw<{ result: ScriptLoadResult; source: ScriptSource } | undefined>();

	onMount(() => {
		void restoreScripts();
		loadOfficialData().then(
			(d) => (data = d),
			(e) => reportError(e, { area: 'scripts', notify: false })
		);
	});

	// A collection is only fetched while it is the chosen source.
	$effect(() => {
		const wanted = source;
		// Untracked: a failed load must not re-run this and try again in a loop.
		untrack(() => {
			if (wanted === 'curated' || wanted === 'month') void curatedScripts.load();
			if (wanted === 'collection') void collectionScripts.load();
			if (wanted === 'homebrew') void homebrewScripts.load();
			if (wanted === 'worldcup2023') void worldCupScripts.load('2023');
			if (wanted === 'worldcup2025') void worldCupScripts.load('2025');
		});
	});

	/** The official site's known sections in the app's words; any other heading as written. */
	function curatedSectionLabel(section: string): string {
		return CURATED_SECTIONS.some((known) => known === section)
			? t(`scripts.curated.${section as (typeof CURATED_SECTIONS)[number]}`)
			: section;
	}

	/** The month a Script of the Month was first listed, e.g. "October 2026". */
	function monthLabel(seen: string | undefined): string {
		if (!seen || !/^\d{4}-\d{2}$/.test(seen)) return t('scripts.curated.month');
		return new Date(`${seen}-01T12:00:00Z`).toLocaleDateString(locale.current, {
			month: 'long',
			year: 'numeric',
			timeZone: 'UTC'
		});
	}

	const localContext = $derived<LocalContext | undefined>(
		data && {
			data,
			curated: curatedScripts.list,
			collection: collectionScripts.list,
			homebrew: homebrewScripts.list,
			recent: recentScripts.list,
			profile: [],
			curatedLabel: curatedSectionLabel,
			monthLabel,
			describe: describeSource,
			worldCups: { '2023': worldCupScripts.list('2023'), '2025': worldCupScripts.list('2025') },
			worldCupLabel: (year, stage) =>
				`${t(`scripts.picker.source.worldcup${year}`)} · ${t(`scripts.worldCup.${stage}`)}`
		}
	);
	/** The chosen source's rows, when it is listed on the device (all but BotC Scripts). */
	const local = $derived(
		localContext
			? localListings(
					localContext,
					SCRIPTS_PAGE_PROVIDERS.filter((p) => p.id === source)
				)
			: []
	);
	/** Saved scripts: not listed here (the Library lists them), but the details show the latest. */
	const savedListings = $derived(localContext ? localListings(localContext, [recentProvider]) : []);

	/** Local rows, filtered on the device by the same header filters the site uses. */
	const shownLocal = $derived.by(() => {
		const f = botcFilters;
		const rows = filterRows(
			local.map((l) => l.row),
			{
				term,
				sources: [source],
				kind: f.type,
				author: f.author,
				include: f.include,
				exclude: f.exclude,
				oneDemon: f.oneDemon,
				officialOnly: f.officialOnly
			},
			data
		);
		const keys = new Set(rows.map((r) => r.key));
		return local.filter((l) => keys.has(l.row.key));
	});

	// ---- BotC Scripts: searched on the site, page by page ----

	type BotcFilters = Omit<BotcScriptsQuery, 'term'>;
	function noFilters(): BotcFilters {
		const blank: Partial<BotcScriptsQuery> = { ...EMPTY_QUERY };
		delete blank.term;
		return blank as BotcFilters;
	}
	let botcFilters = $state<BotcFilters>(noFilters());
	const botc = new RemoteSearch(botcProvider(searchBotcScripts), (q) => searchPath(q));
	const DEBOUNCE_MS = 400;

	const botcRef = $derived(searchingBotc ? parseBotcScriptsRef(term) : undefined);
	/** The site picks which results come first: most likes, or by upload order for No. */
	const siteSort = $derived<BotcScriptsSort>(
		sort?.column === 'number' ? (sort.descending ? 'newest' : 'oldest') : 'votes'
	);
	const botcQuery = $derived<BotcScriptsQuery>({
		...botcFilters,
		sort: siteSort,
		term: normaliseSearch(term)
	});
	const botcKey = $derived(searchPath(botcQuery));

	// A search runs after a pause in typing or a change of filters; links and numbers don't search.
	$effect(() => {
		if (!searchingBotc || !data || botcRef || botcKey === botc.searched) return;
		const q = $state.snapshot(botcQuery) as BotcScriptsQuery;
		const d = data;
		const timer = setTimeout(
			() => void botc.load(q, 1, d),
			botc.searched === undefined ? 0 : DEBOUNCE_MS
		);
		return () => clearTimeout(timer);
	});
	$effect(() => () => botc.abort());

	/** Characters chosen for Includes or Leaves out, in a full-screen list. */
	let choosing = $state<'include' | 'exclude' | undefined>();
	let choosingOpen = $state(false);
	const FILTER_TYPES: readonly CharacterType[] = [
		'townsfolk',
		'outsider',
		'minion',
		'demon',
		'traveller'
	];
	const pickable = $derived(
		data ? data.characters.filter((c) => FILTER_TYPES.includes(c.type)) : []
	);

	function toggleCharacter(list: 'include' | 'exclude', id: CharacterId) {
		const other = list === 'include' ? 'exclude' : 'include';
		const has = botcFilters[list].includes(id);
		botcFilters[list] = has
			? botcFilters[list].filter((c) => c !== id)
			: [...botcFilters[list], id];
		// A character can't be both required and ruled out.
		if (!has) botcFilters[other] = botcFilters[other].filter((c) => c !== id);
	}

	// ---- The table ----

	/**
	 * The chosen source's rows; a header tap sorts what is loaded (BotC Scripts also asks the
	 * site for its order by likes or number).
	 */
	const shown = $derived.by<ScriptListing[]>(() => {
		const all = searchingBotc ? (botcRef ? [] : botc.listings) : shownLocal;
		if (!sort) return all;
		const byKey = new Map(all.map((l) => [l.row.key, l]));
		return sortRows(
			all.map((l) => l.row),
			sort
		).map((row) => byKey.get(row.key)!);
	});

	/** The most recently saved script that is listed (base three are not). */
	const latest = $derived(
		recentScripts.list
			.map((saved) => savedListings.find((l) => l.saved?.scriptId === saved.scriptId))
			.find((l) => l !== undefined)
	);
	/** The row tapped, or the latest saved script. */
	const baseListing = $derived(selected ?? latest);

	/** The listing the details show: the base one, or a version chosen there. */
	let shownListing = $state.raw<ScriptListing | undefined>();
	const shownSaved = $derived(
		shownListing ? findSaved(recentScripts.list, shownListing) : undefined
	);

	function select(listing: ScriptListing) {
		selected = listing;
		paneOpen = true;
	}

	/** Save and Remove from saved show at once; the write finishes behind it. */
	const pendingSaved = new SvelteMap<string, boolean>();
	function setPending(key: string, value: boolean | undefined) {
		if (value === undefined) pendingSaved.delete(key);
		else pendingSaved.set(key, value);
	}
	const shownIsSaved = $derived(
		shownListing ? (pendingSaved.get(shownListing.row.key) ?? !!shownSaved) : false
	);

	async function toggleSaved() {
		const listing = shownListing;
		if (!listing) return;
		if (shownIsSaved) {
			removing = true;
			return;
		}
		selected = listing;
		setPending(listing.row.key, true);
		try {
			await loadTarget(listing.target);
		} finally {
			setPending(listing.row.key, undefined);
		}
	}

	/** The shown row, or (in another source's list) the same script there. */
	function isSelected(listing: ScriptListing): boolean {
		if (!shownListing || !baseListing) return false;
		if (baseListing.row.key === listing.row.key) return true;
		return !!shownSaved && matchesSaved(shownSaved, listing);
	}

	/** Removing keeps the script shown (Trevor), so Save can bring it straight back. */
	async function removeShown() {
		const listing = shownListing;
		const saved = shownSaved;
		removing = false;
		if (!listing || !saved) return;
		selected = listing;
		setPending(listing.row.key, false);
		try {
			await forgetScript(saved.scriptId);
		} catch (e) {
			reportError(e, { area: 'scripts' });
		} finally {
			setPending(listing.row.key, undefined);
		}
	}

	const curatedNote = $derived.by(() => {
		const year =
			source === 'worldcup2023' ? '2023' : source === 'worldcup2025' ? '2025' : undefined;
		// A list fetched from a site: loading, or failed with nothing kept from last time.
		const fetched =
			source === 'curated' || source === 'month'
				? curatedScripts
				: source === 'collection'
					? collectionScripts
					: source === 'homebrew'
						? homebrewScripts
						: undefined;
		const loading = year
			? worldCupScripts.status(year) === 'loading'
			: fetched?.status === 'loading';
		const failed = year
			? worldCupScripts.status(year) === 'error'
			: fetched?.status === 'error' && fetched.list.length === 0;
		return loading
			? t('scripts.picker.curatedLoading')
			: failed
				? t('scripts.picker.curatedFailed')
				: '';
	});
	const botcStatus = $derived(
		!searchingBotc
			? ''
			: botc.failure ||
					(botc.loading && botc.listings.length === 0
						? t('scripts.botc.searching')
						: botc.searched === undefined || botc.count === 0
							? ''
							: t('scripts.botc.count', {
									count: botc.count,
									sort: t(`scripts.botc.sort.${siteSort}`).toLowerCase()
								}))
	);
	const status = $derived(
		!data
			? t('scripts.picker.loading')
			: botcRef
				? t('scripts.botc.refHint')
				: searchingBotc
					? botcStatus || t('common.none')
					: (shown.length === 0
							? t('common.none')
							: t('scripts.picker.count', { count: shown.length })) + curatedNote
	);

	type ColumnId = SortColumn;
	const characterFilters = $derived(
		filterCount({ ...botcFilters, term: '', type: '', author: '' })
	);
	/**
	 * Name, Author, Type and a character count for every source; Likes and No. only for BotC
	 * Scripts, the one source that has them (Trevor, 2026-10-17). Author and Type are always
	 * columns of their own; Chars, Likes and No. give way on phones, where the Chars filter
	 * moves into the Name header.
	 */
	const columns = $derived<DataColumn<ColumnId>[]>([
		{ id: 'name', label: t('scripts.column.name'), sortable: true, flush: true },
		{
			id: 'author',
			label: t('scripts.column.author'),
			sortable: true,
			width: '22%',
			filterable: true,
			filtered: botcFilters.author !== ''
		},
		{
			id: 'kind',
			label: t('scripts.column.type'),
			sortable: true,
			width: '6.5rem',
			filterable: true,
			filtered: botcFilters.type !== ''
		},
		{
			id: 'characters',
			label: t('scripts.column.characters'),
			sortable: true,
			align: 'end',
			wide: true,
			width: '7rem',
			filterable: true,
			filtered: characterFilters > 0
		},
		...(searchingBotc
			? ([
					{
						id: 'likes',
						label: t('scripts.column.likes'),
						sortable: true,
						wide: true,
						align: 'end',
						width: '5rem'
					},
					{
						id: 'number',
						label: t('scripts.column.number'),
						sortable: true,
						wide: true,
						align: 'end',
						width: '5rem'
					}
				] satisfies DataColumn<ColumnId>[])
			: [])
	]);
	const tableSort = $derived<DataSort<ColumnId> | undefined>(
		sort && { column: sort.column, direction: sort.descending ? 'descending' : 'ascending' }
	);

	/**
	 * More BotC Scripts results load by themselves when the list's end comes within about a
	 * screen of view (Trevor, 2026-10-17: no More button). The last row carries the watcher;
	 * after a page arrives the new last row starts watching, so it keeps going while the end
	 * stays in view, until the site has no more.
	 */
	const NEAR_END = createAttachmentKey();

	/**
	 * Tapping anywhere in a row selects its script (Trevor, 2026-10-16), as its name button
	 * does; the button stays the row's one focus stop, so Enter still selects.
	 */
	const TAP_ROW = createAttachmentKey();
	function tapRow(row: Element) {
		const tap = (event: Event) => {
			const button = row.querySelector<HTMLButtonElement>('button.pick');
			if (!button || button.disabled) return;
			if (event.target instanceof Element && event.target.closest('button, a, input')) return;
			button.click();
		};
		row.addEventListener('click', tap);
		return () => row.removeEventListener('click', tap);
	}
	const lastKey = $derived(shown.at(-1)?.row.key);
	function loadMore() {
		if (busy || !searchingBotc || botc.loading || !botc.hasMore || botcRef || !data) return;
		void botc.load($state.snapshot(botcQuery) as BotcScriptsQuery, botc.page + 1, data);
	}
	function nearEnd(row: Element) {
		const watcher = new IntersectionObserver(
			(seen) => {
				if (seen.some((s) => s.isIntersecting)) loadMore();
			},
			{ rootMargin: '100% 0px' }
		);
		watcher.observe(row);
		return () => watcher.disconnect();
	}

	function onSort(column: ColumnId) {
		sort = nextSort(sort, column);
	}

	function clearError() {
		error = '';
	}

	/** Saves a script; the details then show it (the tapped row, if that is what was saved). */
	async function use(script: LoadedScript, source: ScriptSource) {
		await chooseScript(script, source);
		const saved = currentScript.saved;
		if (!selected || !saved || !matchesSaved(saved, selected)) selected = undefined;
		paneOpen = true;
		onchoose?.(script);
	}

	/** Parses fetched text, then loads it or asks the Storyteller to check it first. */
	async function settle(fetched: FetchedScript) {
		// Hand-edited JSON (comments, trailing commas) loads too.
		const result = loadScriptText(relaxJson(fetched.text), await loadOfficialData());
		const needsCheck = !result.script || result.problems.some((p) => p.severity !== 'info');
		if (needsCheck) {
			checking = { result, source: fetched.source };
			checkOpen = true;
		} else if (result.script) {
			await use(result.script, fetched.source);
		}
	}

	async function run(task: () => Promise<FetchedScript>) {
		clearError();
		busy = true;
		try {
			await settle(await task());
		} catch (e) {
			// A refused link or a missing script is expected; anything else is a bug worth logging.
			if (!(e instanceof ScriptFetchError)) reportError(e, { area: 'scripts', notify: false });
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}

	/** Loads a row's script: built in, saved, carried in the row, or fetched. */
	async function loadTarget(target: LoadTarget) {
		switch (target.kind) {
			case 'edition': {
				const script = editionScript(target.edition, await loadOfficialData());
				if (script) await use(script, { kind: 'edition' });
				return;
			}
			case 'saved': {
				const script = reloadSavedScript(target.saved, await loadOfficialData());
				if (script) await use(script, target.saved.source);
				return;
			}
			case 'json':
				return run(() =>
					Promise.resolve({ text: JSON.stringify(target.json), source: target.source })
				);
			case 'botcscripts':
			case 'homebrew':
				return run(() => fetchRemote(target));
		}
	}

	/** After Add script saves a script: the details show it (Trevor: saved scripts are shown). */
	export function showSaved() {
		selected = undefined;
		paneOpen = true;
	}
</script>

{#snippet backButton()}
	<button type="button" class="back" onclick={() => (paneOpen = false)}
		><Icon name="back" /><span>{t('scripts.details.back')}</span></button
	>
{/snippet}

<!-- The list on the left, the shown script's details on the right; on a phone the details
     slide over the list and Back returns to it. -->
<div class="panes" bind:clientWidth={width}>
	<div class="grid" class:open={paneOpen}>
		<div class="picker" inert={narrow && paneOpen}>
			<!-- One fixed height for every source, so switching moves nothing below. -->
			<div class="body">
				<div class="table" data-testid="picker-table">
					<DataTable
						label={t('scripts.picker.table')}
						{columns}
						rows={botcRef ? [] : shown}
						key={(listing) => listing.row.key}
						{cell}
						sort={tableSort}
						{onSort}
						{filter}
						narrow="hide"
						resizeKey="scripts"
						fill
						rowSelected={isSelected}
						rowAttrs={(listing) => ({
							[TAP_ROW]: tapRow,
							...(listing.row.key === lastKey ? { [NEAR_END]: nearEnd } : {})
						})}
						empty={botcRef ? '' : t('common.none')}
					/>
				</div>

				<!-- The count shares the line under the table with the next action; both always there. -->
				<div class="more" data-testid="picker-more">
					<p class="status" role="status" data-testid="picker-status">{status}</p>
					<!-- Always there, enabled when a BotC Scripts link was typed. -->
					<div class="buttons">
						<Button
							variant="accent"
							disabled={busy || !botcRef}
							onclick={() =>
								botcRef && run(() => fetchLinkTarget({ kind: 'botcscripts', ref: botcRef }, ''))}
							>{t('scripts.picker.save')}</Button
						>
					</div>
				</div>
			</div>

			<section>
				<!-- Load errors outside a dialog; the line is always there, so no reflow. -->
				<p class="error" role="status" data-testid="file-error">
					{error}
				</p>
			</section>
		</div>

		<aside class="pane" aria-label={t('scripts.details.label')} inert={narrow && !paneOpen}>
			<div class="pane-scroll">
				<ScriptView
					listing={baseListing}
					{data}
					onshown={(l) => (shownListing = l)}
					saved={shownIsSaved}
					{busy}
					lead={backButton}
				>
					{#snippet extraActions()}
						<!-- One button, the same size saved or not: pressed means saved. -->
						<span class="toggle" class:on={shownIsSaved}>
							<IconButton
								icon="save"
								label={t('scripts.picker.save')}
								aria-pressed={shownIsSaved}
								disabled={!shownListing}
								onclick={() => void toggleSaved()}
							/>
						</span>
					{/snippet}
				</ScriptView>
			</div>
		</aside>
	</div>
</div>

<ConfirmDialog
	bind:open={removing}
	title={t('scripts.details.removeConfirm')}
	danger
	onConfirm={() => void removeShown()}
>
	<p>{t('scripts.details.removeBody', { name: shownListing?.row.name || t('common.none') })}</p>
</ConfirmDialog>

{#snippet cell(listing: ScriptListing, column: DataColumn<ColumnId>)}
	{@const row = listing.row}
	{#if column.id === 'name'}
		<button
			type="button"
			class="pick"
			aria-pressed={isSelected(listing)}
			aria-label="{row.name} {row.note || t(`scripts.sourceLabel.${row.source}`)}"
			disabled={busy}
			onclick={() => select(listing)}
		>
			<span class="title">{row.name || t('common.none')}</span>
		</button>
	{:else if column.id === 'author'}
		<span class="text">{row.author || t('common.none')}</span>
	{:else if column.id === 'source'}
		<span class="text">{t(`scripts.sourceLabel.${row.source}`)}</span>
	{:else if column.id === 'kind'}
		<span class="text">{t(`scripts.kind.${row.kind}`)}</span>
	{:else if column.id === 'characters'}
		<span class="text numeric">{row.characters}</span>
	{:else if column.id === 'likes'}
		<span class="text numeric">{row.likes ?? 0}</span>
	{:else if column.id === 'number'}
		<span class="text numeric">{row.number ?? ''}</span>
	{/if}
{/snippet}

{#snippet filter(column: DataColumn<ColumnId>, close: () => void)}
	<BotcFilter
		column={column.id}
		bind:filters={botcFilters}
		{close}
		onchoose={(list) => {
			close();
			choosing = list;
			choosingOpen = true;
		}}
	/>
{/snippet}

<Dialog
	bind:open={choosingOpen}
	title={choosing === 'exclude' ? t('scripts.botc.leavesOut') : t('scripts.botc.includes')}
	size="full"
>
	{#if choosing}
		{@const list = choosing}
		<CharacterPicker
			characters={pickable}
			mode="multi"
			types={FILTER_TYPES}
			selected={botcFilters[list] as CharacterId[]}
			max={MAX_FILTER_CHARACTERS}
			onSelect={(id) => toggleCharacter(list, id)}
		/>
	{/if}
	{#snippet actions()}
		<Button variant="accent" onclick={() => (choosingOpen = false)}>{t('scripts.botc.done')}</Button
		>
	{/snippet}
</Dialog>

<ScriptCheckDialog
	bind:open={checkOpen}
	result={checking?.result}
	onconfirm={() => {
		const script = checking?.result.script;
		if (script && checking) void use(script, checking.source);
	}}
/>

<style>
	.panes {
		container: script-panes / inline-size;
	}
	.grid {
		position: relative;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-5);
		/* The closed pane waits off to the side; never a sideways scroll. */
		overflow-x: clip;
	}
	.picker {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-3);
		min-width: 0;
	}
	/* Its own stacking context, so the table's sticky header never shows through the pane. */
	.picker {
		isolation: isolate;
	}
	/* The list sets the height; the details scroll inside it. */
	.pane {
		z-index: 1;
		position: absolute;
		inset: 0;
		border: var(--card-border);
		border-radius: var(--card-radius);
		background: var(--card-background);
		transform: translateX(105%);
		visibility: hidden;
		transition:
			transform var(--duration-fast) var(--ease-out),
			visibility var(--duration-fast);
	}
	.grid.open .pane {
		transform: none;
		visibility: visible;
	}
	.pane-scroll {
		--pinned-inset: var(--space-4);
		position: absolute;
		inset: 0;
		overflow-y: auto;
		padding: var(--space-4);
		display: grid;
		align-content: start;
		gap: var(--space-2);
	}
	.back {
		justify-self: start;
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--tap-target);
		padding: 0 var(--space-2) 0 0;
		border: 0;
		background: none;
		color: var(--accent);
		font: inherit;
		cursor: pointer;
	}
	.toggle.on :global(.icon-button) {
		background: var(--accent);
		color: var(--on-accent);
	}
	@container script-panes (min-width: 56rem) {
		.grid {
			grid-template-columns: minmax(0, 1fr) minmax(20rem, 28rem);
		}
		.pane {
			position: relative;
			inset: auto;
			grid-column: 2;
			transform: none;
			visibility: visible;
			transition: none;
		}
		.back {
			display: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.pane {
			transition: none;
		}
	}
	/* The same height whichever source is chosen; rows scroll inside it. */
	.body {
		height: clamp(22rem, 60dvh, 36rem);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-height: 0;
	}
	.status {
		margin: 0;
		color: var(--on-surface-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.table {
		flex: 1;
		min-height: 0;
	}
	.pick {
		width: 100%;
		height: 100%;
		min-height: var(--tap-target);
		align-content: center;
		padding: var(--space-1) var(--space-2);
		display: grid;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	/* The whole row selects its script (`tapRow`). */
	.picker :global(tbody tr:has(.pick:not(:disabled))) {
		cursor: pointer;
	}
	.picker :global(tbody tr:has(.pick:not(:disabled)):hover) {
		background: var(--surface-selected);
	}
	.title {
		font-weight: 600;
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
	.numeric {
		justify-content: flex-end;
		font-variant-numeric: tabular-nums;
	}
	.more {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
	.more .status {
		flex: 1;
		min-width: 0;
	}
	.buttons {
		display: flex;
		gap: var(--space-2);
	}
	section {
		display: grid;
		gap: var(--space-2);
	}
	/* Room for three lines is always reserved, so an error never moves the buttons. */
	.error {
		min-height: 3lh;
		margin: 0;
		color: var(--evil);
		overflow-wrap: anywhere;
	}
</style>
