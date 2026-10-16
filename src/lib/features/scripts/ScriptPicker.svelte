<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import {
		editionScript,
		loadScript,
		loadScriptText,
		type CharacterId,
		type CharacterType,
		type GameData,
		type LoadedScript,
		type ScriptLoadResult
	} from '#lib/core/data/index.ts';
	import { account } from '#lib/features/account/account.svelte.ts';
	import { profileScripts } from '#lib/features/account/profile-scripts.svelte.ts';
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
		type BotcScriptsRef,
		type BotcScriptsSort
	} from './botcscripts-api.ts';
	import { scriptPageUrl } from './botcscripts-api.ts';
	import BotcFilter from './BotcFilter.svelte';
	import { collectionScripts } from './collection.svelte.ts';
	import { curatedScripts } from './curated.svelte.ts';
	import {
		chooseScript,
		currentScript,
		forgetScript,
		recentScripts,
		restoreScripts
	} from './current-script.svelte.ts';
	import {
		fetchLinkTarget,
		readScriptFile,
		ScriptFetchError,
		searchBotcScripts,
		type FetchedScript
	} from './fetch-script.ts';
	import {
		filterRows,
		nextSort,
		sortRows,
		type PickerSource,
		type RowSort,
		type SortColumn
	} from './picker-rows.ts';
	import { relaxJson } from './relaxed-json.ts';
	import { RemoteSearch } from './remote-search.svelte.ts';
	import { describeSource, reloadSavedScript, type ScriptSource } from './saved-scripts.ts';
	import ScriptCopy from '#lib/features/player/ScriptCopy.svelte';
	import ScriptChecks from './ScriptChecks.svelte';
	import ScriptDetails, { type ScriptFact } from './ScriptDetails.svelte';
	import {
		botcProvider,
		findSaved,
		localListings,
		matchesSaved,
		SCRIPTS_PAGE_PROVIDERS,
		type LoadTarget,
		type ScriptListing
	} from './script-providers.ts';
	import SearchSources, { type SearchSourceOption } from './SearchSources.svelte';
	import ShareControl from './ShareControl.svelte';
	import { shareTargetFor } from './share-codes.ts';
	import ScriptCheckDialog from './ScriptCheckDialog.svelte';
	import { resolveLink } from './script-links.ts';
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
	}

	let { onchoose, busy = $bindable(false) }: Props = $props();

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

	let pasteOpen = $state(false);
	let linkOpen = $state(false);
	let checkOpen = $state(false);

	let pasteText = $state('');
	let linkText = $state('');

	/** The one search box, looking in every source switched on under it (`SearchSources`). */
	let term = $state('');
	const SEARCHABLE = [
		'curated',
		'collection',
		'recent',
		'profile',
		'botc'
	] as const satisfies readonly PickerSource[];
	let sources = $state<PickerSource[]>([...SEARCHABLE]);
	const searchingBotc = $derived(sources.includes('botc'));
	let sort = $state<RowSort | undefined>();
	let data = $state.raw<GameData>();
	let error = $state('');
	let errorLink = $state<string | undefined>(undefined);

	let checking = $state.raw<{ result: ScriptLoadResult; source: ScriptSource } | undefined>();
	let fileInput: HTMLInputElement | undefined = $state();

	const canReadClipboard =
		typeof navigator !== 'undefined' && typeof navigator.clipboard?.readText === 'function';

	onMount(() => {
		void restoreScripts();
		loadOfficialData().then(
			(d) => (data = d),
			(e) => reportError(e, { area: 'scripts', notify: false })
		);
	});

	// Profile scripts are listed for a signed-in user (fetched once; the Account page refreshes).
	$effect(() => {
		if (account.user && profileScripts.status === 'idle') void profileScripts.refresh();
	});

	// The official site is only asked while its scripts are being searched.
	$effect(() => {
		const wanted = {
			curated: sources.includes('curated'),
			collection: sources.includes('collection')
		};
		// Untracked: a failed load must not re-run this and try again in a loop.
		untrack(() => {
			if (wanted.curated) void curatedScripts.load();
			if (wanted.collection) void collectionScripts.load();
		});
	});

	/** The official site's known sections in the app's words; any other heading as written. */
	function curatedSectionLabel(section: string): string {
		return CURATED_SECTIONS.some((known) => known === section)
			? t(`scripts.curated.${section as (typeof CURATED_SECTIONS)[number]}`)
			: section;
	}

	const local = $derived(
		data
			? localListings(
					{
						data,
						curated: curatedScripts.list,
						collection: collectionScripts.list,
						recent: recentScripts.list,
						profile: account.user ? profileScripts.list : [],
						curatedLabel: curatedSectionLabel,
						describe: describeSource
					},
					SCRIPTS_PAGE_PROVIDERS
				)
			: []
	);

	/** Local rows, filtered on the device by the same header filters the site uses. */
	const shownLocal = $derived.by(() => {
		const f = botcFilters;
		const rows = filterRows(
			local.map((l) => l.row),
			{
				term,
				sources,
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

	/** Every source's rows in one table; a header sort orders everything loaded so far. */
	const shown = $derived.by<ScriptListing[]>(() => {
		const all = [...shownLocal, ...(searchingBotc && !botcRef ? botc.listings : [])];
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
			.map((saved) => local.find((l) => l.saved?.scriptId === saved.scriptId))
			.find((l) => l !== undefined)
	);
	const shownListing = $derived(selected ?? latest);
	const shownSaved = $derived(
		shownListing ? findSaved(recentScripts.list, shownListing) : undefined
	);

	function select(listing: ScriptListing) {
		selected = listing;
		paneOpen = true;
		if (listing.target.kind === 'botcscripts') void fetchBotc(listing.target.ref).catch(() => {});
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

	/** A BotC Scripts row is fetched when tapped, so Save doesn't wait on the site. */
	const botcFetches = new SvelteMap<string, Promise<FetchedScript>>();
	/** Fetched BotC Scripts text by ref, for the details' player sheet. */
	const botcTexts = new SvelteMap<string, string>();
	function fetchBotc(ref: BotcScriptsRef): Promise<FetchedScript> {
		const key = JSON.stringify(ref);
		let fetching = botcFetches.get(key);
		if (!fetching) {
			fetching = fetchLinkTarget({ kind: 'botcscripts', ref }, '');
			botcFetches.set(key, fetching);
			fetching.then(
				(fetched) => botcTexts.set(key, fetched.text),
				() => botcFetches.delete(key)
			);
		}
		return fetching;
	}

	/**
	 * The shown script as players see it (Trevor, 2026-10-16): names and abilities by type,
	 * with jinxes. A BotC Scripts row has it once its fetch arrives; until then (or if the
	 * script doesn't load) the details list its characters as badges.
	 */
	const preview = $derived.by((): LoadedScript | undefined => {
		const listing = shownListing;
		if (!data || !listing) return undefined;
		if (shownSaved) return reloadSavedScript(shownSaved, data);
		const target = listing.target;
		switch (target.kind) {
			case 'edition':
				return editionScript(target.edition, data);
			case 'saved':
				return reloadSavedScript(target.saved, data);
			case 'json':
				return loadScript(target.json, data).script;
			case 'botcscripts': {
				const text = botcTexts.get(JSON.stringify(target.ref));
				return text === undefined ? undefined : loadScriptText(text, data).script;
			}
		}
	});

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
		if (!shownListing) return false;
		if (shownListing.row.key === listing.row.key) return true;
		return !!shownSaved && matchesSaved(shownSaved, listing);
	}

	function factsFor(listing: ScriptListing | undefined): ScriptFact[] {
		const row = listing?.row;
		const saved = listing && findSaved(recentScripts.list, listing);
		const none = t('common.none');
		const botcSource =
			row?.source === 'botc' && row.number !== undefined
				? { kind: 'botcscripts' as const, scriptId: row.number, version: row.version ?? '' }
				: saved?.source.kind === 'botcscripts'
					? saved.source
					: undefined;
		return [
			{ label: t('scripts.current.author'), value: row ? row.author || none : none },
			{ label: t('scripts.column.type'), value: row ? t(`scripts.kind.${row.kind}`) : none },
			botcSource
				? {
						label: t('scripts.current.source'),
						value: describeSource(botcSource),
						href: scriptPageUrl(botcSource.scriptId, botcSource.version)
					}
				: {
						label: t('scripts.current.source'),
						value: saved
							? describeSource(saved.source)
							: row
								? row.note || t(`scripts.sourceLabel.${row.source}`)
								: none
					}
		];
	}

	/** The player link for a saved script, made only when Share is tapped. */
	const shareTarget = $derived.by(() => {
		const saved = shownSaved;
		return saved && saved.scriptId !== 'unsaved'
			? () => shareTargetFor(saved, location.origin)
			: undefined;
	});

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

	const curatedNote = $derived(
		!sources.includes('curated')
			? ''
			: curatedScripts.status === 'loading'
				? t('scripts.picker.curatedLoading')
				: curatedScripts.status === 'error' && curatedScripts.list.length === 0
					? t('scripts.picker.curatedFailed')
					: ''
	);
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
				: [
						shown.length === 0
							? t('common.none')
							: t('scripts.picker.count', { count: shown.length }),
						botcStatus
					]
						.filter(Boolean)
						.join(' · ') + curatedNote
	);

	const SOURCE_OPTIONS = $derived<SearchSourceOption<PickerSource>[]>(
		SEARCHABLE.map((id) => ({
			id,
			label: t(`scripts.picker.source.${id}`),
			available: id !== 'profile' || !!account.user
		}))
	);

	type ColumnId = SortColumn;
	const characterFilters = $derived(
		filterCount({ ...botcFilters, term: '', type: '', author: '' })
	);
	/**
	 * The site's own columns (Name, Author, Type, Likes, No.), plus Source and a character count.
	 * Author and Type are always columns of their own (Trevor); Source, Chars, Likes and No.
	 * give way on phones, where the Chars filter moves into the Name header.
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
		{ id: 'source', label: t('scripts.column.source'), sortable: true, wide: true, width: '6rem' },
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
	]);
	const tableSort = $derived<DataSort<ColumnId> | undefined>(
		sort && { column: sort.column, direction: sort.descending ? 'descending' : 'ascending' }
	);

	function onSort(column: ColumnId) {
		sort = nextSort(sort, column);
	}

	function clearError() {
		error = '';
		errorLink = undefined;
	}

	function closeAll() {
		pasteOpen = linkOpen = false;
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
		closeAll();
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
			errorLink = e instanceof ScriptFetchError ? e.openUrl : undefined;
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
				return run(() => fetchBotc(target.ref));
		}
	}

	function isLink(text: string): boolean {
		return /^https?:\/\//i.test(text.trim()) || parseBotcScriptsRef(text) !== undefined;
	}

	function loadPaste() {
		const text = pasteText;
		void run(() =>
			isLink(text)
				? fetchLinkTarget(resolveLink(text), text)
				: Promise.resolve({ text, source: { kind: 'paste' } })
		);
	}

	async function pasteFromClipboard() {
		clearError();
		try {
			pasteText = await navigator.clipboard.readText();
		} catch {
			error = t('scripts.paste.clipboardFailed');
		}
	}

	function onFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (file) void run(() => readScriptFile(file));
	}

	/** Loads script text that arrived another way (a share link), through the same checks. */
	export function loadFetched(fetched: FetchedScript): Promise<void> {
		return run(() => Promise.resolve(fetched));
	}

	/** A file dropped on the page: loaded like the File button. */
	export function loadFile(file: File): Promise<void> {
		closeAll();
		return run(() => readScriptFile(file));
	}

	/** Text dropped on the page (a link or script JSON): loaded like Paste. */
	export function loadText(text: string): Promise<void> {
		closeAll();
		return run(() =>
			isLink(text)
				? fetchLinkTarget(resolveLink(text), text)
				: Promise.resolve({ text, source: { kind: 'paste' } })
		);
	}

	function open(which: 'paste' | 'link') {
		clearError();
		pasteOpen = which === 'paste';
		linkOpen = which === 'link';
	}

	/** The page's Add script button: paste, a file from the device, or a link. */
	export function add(which: 'paste' | 'file' | 'link') {
		if (which === 'file') {
			clearError();
			fileInput?.click();
		} else open(which);
	}
</script>

{#snippet playerSheet()}
	{#if preview && data}
		<div class="sheet-stack">
			<ScriptChecks script={preview} {data} />
			<ScriptCopy script={preview} />
		</div>
	{/if}
{/snippet}

<!-- The list on the left, the shown script's details on the right; on a phone the details
     slide over the list and Back returns to it. -->
<div class="panes" bind:clientWidth={width}>
	<div class="grid" class:open={paneOpen}>
		<div class="picker" inert={narrow && paneOpen}>
			<div class="search">
				<label class="term">
					<span class="visually-hidden">{t('scripts.picker.search')}</span>
					<span class="magnifier" aria-hidden="true"><Icon name="search" /></span>
					<input
						type="search"
						autocomplete="off"
						enterkeyhint="search"
						placeholder={t('scripts.picker.searchPlaceholder')}
						bind:value={term}
					/>
				</label>
				<SearchSources
					options={SOURCE_OPTIONS}
					selected={sources}
					onChange={(next) => (sources = next)}
				/>
			</div>

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
						empty={botcRef ? '' : t('common.none')}
					/>
				</div>

				<!-- The count shares the line under the table with the next action; both always there. -->
				<div class="more" data-testid="picker-more">
					<p class="status" role="status" data-testid="picker-status">{status}</p>
					<!-- Always there, enabled when BotC Scripts has more or a link was typed. -->
					<div class="buttons">
						<Button
							variant="quiet"
							disabled={busy ||
								!searchingBotc ||
								botc.loading ||
								!botc.hasMore ||
								!!botcRef ||
								!data}
							onclick={() =>
								data &&
								botc.load($state.snapshot(botcQuery) as BotcScriptsQuery, botc.page + 1, data)}
							>{t('scripts.botc.more')}</Button
						>
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
				<!-- Not limited to application/json: some iPad and Android file providers don't label
		     .json files with that type, which greyed them out in Pocket Grimoire (PG 126, PG 162). -->
				<input
					bind:this={fileInput}
					class="file"
					type="file"
					accept=".json,application/json,text/plain"
					aria-label={t('scripts.picker.fileLabel')}
					onchange={onFile}
				/>
				<!-- Load errors outside a dialog; the line is always there, so no reflow. -->
				<p class="error" role="status" data-testid="file-error">
					{#if !pasteOpen && !linkOpen}{error}{/if}
				</p>
			</section>
		</div>

		<aside class="pane" aria-label={t('scripts.details.label')} inert={narrow && !paneOpen}>
			<div class="pane-scroll">
				<button type="button" class="back" onclick={() => (paneOpen = false)}
					><Icon name="back" /><span>{t('scripts.details.back')}</span></button
				>
				<ScriptDetails
					heading={shownListing
						? t(`scripts.sourceLabel.${shownListing.row.source}`)
						: t('scripts.current.defaultName')}
					name={shownListing?.row.name ?? ''}
					facts={factsFor(shownListing)}
					entries={shownListing?.row.entries ?? []}
					{data}
					sheet={preview ? playerSheet : undefined}
				>
					{#snippet actions()}
						<ShareControl
							what="script"
							title={shownListing?.row.name || t('scripts.current.defaultName')}
							target={shownIsSaved ? shareTarget : undefined}
						/>
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
				</ScriptDetails>
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

{#snippet errorLine()}
	<p class="error" role="status">{error}</p>
{/snippet}

<Dialog bind:open={pasteOpen} title={t('scripts.paste.title')}>
	<label class="field">
		<span>{t('scripts.paste.label')}</span>
		<textarea bind:value={pasteText} rows="8" spellcheck="false" autocomplete="off"></textarea>
	</label>
	{@render errorLine()}
	{#snippet actions()}
		<Button variant="quiet" onclick={pasteFromClipboard} disabled={!canReadClipboard}
			>{t('scripts.paste.fromClipboard')}</Button
		>
		<Button variant="accent" onclick={loadPaste} disabled={busy || pasteText.trim() === ''}
			>{t('scripts.picker.save')}</Button
		>
	{/snippet}
</Dialog>

<Dialog bind:open={linkOpen} title={t('scripts.link.title')}>
	<label class="field">
		<span>{t('scripts.link.label')}</span>
		<input
			type="url"
			inputmode="url"
			autocomplete="off"
			placeholder="https://"
			bind:value={linkText}
		/>
	</label>
	{@render errorLine()}
	{#snippet actions()}
		<!-- Always there, enabled once a site refuses to share its file (no reflow). -->
		<Button
			variant="quiet"
			disabled={!errorLink}
			onclick={() => errorLink && window.open(errorLink, '_blank', 'noopener,noreferrer')}
			>{t('scripts.link.open')}</Button
		>
		<Button
			variant="accent"
			onclick={() => run(() => fetchLinkTarget(resolveLink(linkText), linkText))}
			disabled={busy || linkText.trim() === ''}>{t('scripts.picker.save')}</Button
		>
	{/snippet}
</Dialog>

<ScriptCheckDialog
	bind:open={checkOpen}
	action="save"
	result={checking?.result}
	onconfirm={() => {
		const script = checking?.result.script;
		if (script && checking) void use(script, checking.source);
	}}
/>

<style>
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
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
	.sheet-stack {
		display: grid;
		gap: var(--space-4);
		min-width: 0;
	}
	/* The list sets the height; the details scroll inside it. */
	.pane {
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
	.search {
		display: grid;
		gap: var(--space-1);
	}
	.term {
		position: relative;
	}
	.magnifier {
		position: absolute;
		inset-block: 0;
		inset-inline-start: var(--space-2);
		display: grid;
		place-items: center;
		color: var(--on-surface-muted);
		pointer-events: none;
	}
	.term input {
		width: 100%;
		box-sizing: border-box;
		min-height: var(--tap-target);
		padding: var(--space-2);
		padding-inline-start: calc(2 * var(--space-2) + 1.25em);
		border: var(--card-border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		font-size: max(1rem, 16px); /* px-ok: iOS zooms into fields under 16px */
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
	/*
	 * The whole row selects its script (Trevor, 2026-10-16): the name button's tap area is
	 * stretched over the row (the row contains layout, so it holds the overlay). It stays one
	 * button, so the row is still one focus stop and Enter selects it.
	 */
	.pick::after {
		content: '';
		position: absolute;
		inset: 0;
	}
	.picker :global(tbody tr:has(.pick:hover:not(:disabled))) {
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
	.file {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
		pointer-events: none;
	}
	.field {
		display: grid;
		gap: var(--space-1);
		margin: var(--space-3) 0 0;
	}
	.field input,
	.field textarea {
		width: 100%;
		box-sizing: border-box;
		min-height: var(--tap-target);
		padding: var(--space-2);
		border: var(--card-border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		font-size: max(1rem, 16px); /* px-ok: iOS zooms into fields under 16px */
	}
	.field textarea {
		resize: vertical;
		font-size: max(0.9rem, 16px); /* px-ok: iOS zooms into fields under 16px */
	}
	/* Room for three lines is always reserved, so an error never moves the buttons. */
	.error {
		min-height: 3lh;
		margin: 0;
		color: var(--evil);
		overflow-wrap: anywhere;
	}
</style>
