<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import {
		editionScript,
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
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
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
	import { botcCard } from './botcscripts-cards.ts';
	import BotcFilter from './BotcFilter.svelte';
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
		type PickerRow,
		type PickerSource,
		type RowSort,
		type ScriptKind,
		type SortColumn
	} from './picker-rows.ts';
	import { RemoteSearch } from './remote-search.svelte.ts';
	import {
		describeSource,
		reloadSavedScript,
		sameScript,
		type ScriptSource
	} from './saved-scripts.ts';
	import {
		botcProvider,
		localListings,
		type LoadTarget,
		type ScriptListing
	} from './script-providers.ts';
	import ScriptPreview from './ScriptPreview.svelte';
	import ShareCodeEntry from './ShareCodeEntry.svelte';
	import { fetchSharedCode } from './share-codes.ts';
	import ScriptCheckDialog from './ScriptCheckDialog.svelte';
	import { resolveLink } from './script-links.ts';
	import { CURATED_SECTIONS } from './script-tool-link.ts';

	interface Props {
		/** Called after a script is chosen (it is already the current script). */
		onchoose?: (script: LoadedScript) => void;
	}

	let { onchoose }: Props = $props();

	let pasteOpen = $state(false);
	let linkOpen = $state(false);
	let codeOpen = $state(false);
	let checkOpen = $state(false);

	let pasteText = $state('');
	let linkText = $state('');
	let codeText = $state('');

	/** The one search box: local scripts, or the remote source when that is chosen. */
	let term = $state('');
	let source = $state<PickerSource | 'all'>('all');
	let kind = $state<ScriptKind | ''>('');
	let sort = $state<RowSort | undefined>();
	let data = $state.raw<GameData>();
	let error = $state('');
	let errorLink = $state<string | undefined>(undefined);
	let busy = $state(false);

	let checking = $state.raw<{ result: ScriptLoadResult; source: ScriptSource } | undefined>();
	let fileInput: HTMLInputElement | undefined = $state();

	/** The row whose characters are shown before loading. */
	let previewing = $state.raw<ScriptListing | undefined>();
	let previewOpen = $state(false);

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

	// The official site is only asked when its scripts are wanted: chosen, or searched for.
	$effect(() => {
		if (source === 'curated' || (source === 'all' && term.trim() !== '')) {
			void curatedScripts.load();
		}
	});

	/** The official site's known sections in the app's words; any other heading as written. */
	function curatedSectionLabel(section: string): string {
		return CURATED_SECTIONS.some((known) => known === section)
			? t(`scripts.curated.${section as (typeof CURATED_SECTIONS)[number]}`)
			: section;
	}

	const local = $derived(
		data
			? localListings({
					data,
					curated: curatedScripts.list,
					recent: recentScripts.list,
					profile: account.user ? profileScripts.list : [],
					curatedLabel: curatedSectionLabel,
					describe: describeSource
				})
			: []
	);

	const shownLocal = $derived.by(() => {
		if (source === 'botc') return [];
		const byKey = new Map(local.map((l) => [l.row.key, l]));
		const rows = filterRows(
			local.map((l) => l.row),
			{ term, source, kind }
		);
		return sortRows(rows, sort).map((row) => byKey.get(row.key)!);
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

	const botcRef = $derived(source === 'botc' ? parseBotcScriptsRef(term) : undefined);
	const botcQuery = $derived<BotcScriptsQuery>({ ...botcFilters, term: normaliseSearch(term) });
	const botcKey = $derived(searchPath(botcQuery));

	// A search runs after a pause in typing or a change of filters; links and numbers don't search.
	$effect(() => {
		if (source !== 'botc' || !data || botcRef || botcKey === botc.searched) return;
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

	/** Header sorts the site supports: Likes (most first) and No. (upload order, both ways). */
	const BOTC_SORT_OF: Record<BotcScriptsSort, DataSort<ColumnId> | undefined> = {
		votes: { column: 'likes', direction: 'descending' },
		newest: { column: 'number', direction: 'descending' },
		oldest: { column: 'number', direction: 'ascending' },
		match: undefined
	};
	const effectiveBotcSort = $derived<BotcScriptsSort>(
		botcFilters.sort === 'match' && !botcQuery.term ? 'votes' : botcFilters.sort
	);

	function sortBotc(column: ColumnId) {
		const current = effectiveBotcSort;
		if (column === 'likes') {
			// Most likes, then (with a search) the closest names.
			botcFilters.sort = current === 'votes' && botcQuery.term ? 'match' : 'votes';
		} else if (column === 'number') {
			botcFilters.sort =
				current === 'newest' ? 'oldest' : current === 'oldest' ? 'votes' : 'newest';
		}
	}

	// ---- The table ----

	const shown = $derived<ScriptListing[]>(source === 'botc' ? botc.listings : shownLocal);

	const isCurrent = (listing: ScriptListing) =>
		!!currentScript.saved &&
		(listing.identity
			? sameScript(currentScript.saved, listing.identity)
			: currentScript.saved.source.kind === 'botcscripts' &&
				listing.row.source === 'botc' &&
				currentScript.saved.source.scriptId === listing.row.number &&
				currentScript.saved.source.version === listing.row.version);

	const curatedNote = $derived(
		(source === 'all' || source === 'curated') && curatedScripts.status === 'loading'
			? t('scripts.picker.curatedLoading')
			: source === 'curated' &&
				  curatedScripts.status === 'error' &&
				  curatedScripts.list.length === 0
				? t('scripts.picker.curatedFailed')
				: ''
	);
	const botcSortLabel = $derived(t(`scripts.botc.sort.${effectiveBotcSort}`).toLowerCase());
	const status = $derived(
		!data
			? t('scripts.picker.loading')
			: source === 'botc'
				? botcRef
					? t('scripts.botc.refHint')
					: botc.failure ||
						(botc.loading && botc.listings.length === 0
							? t('scripts.botc.searching')
							: botc.searched === undefined
								? ''
								: botc.listings.length === 0
									? t('common.none')
									: t('scripts.botc.count', { count: botc.count, sort: botcSortLabel }))
				: (shown.length === 0
						? t('common.none')
						: t('scripts.picker.count', { count: shown.length })) + curatedNote
	);

	const SOURCE_OPTIONS = $derived<{ value: PickerSource | 'all'; label: string }[]>(
		(['all', 'official', 'curated', 'recent', 'profile', 'botc'] as const).map((value) => ({
			value,
			label: t(`scripts.picker.source.${value}`)
		}))
	);
	const KIND_OPTIONS = $derived<{ value: ScriptKind | ''; label: string }[]>([
		{ value: '', label: t('scripts.picker.type.any') },
		{ value: 'Full', label: t('scripts.kind.Full') },
		{ value: 'Teensyville', label: t('scripts.kind.Teensyville') }
	]);

	type ColumnId = SortColumn | 'remove';
	const LOCAL_COLUMNS = $derived<DataColumn<ColumnId>[]>([
		{ id: 'name', label: t('scripts.column.name'), sortable: true, flush: true },
		{
			id: 'author',
			label: t('scripts.column.author'),
			sortable: true,
			wide: true,
			width: '20%'
		},
		{ id: 'source', label: t('scripts.column.source'), sortable: true, width: '6rem' },
		{
			id: 'kind',
			label: t('scripts.column.type'),
			sortable: true,
			wide: true,
			width: '8.5rem',
			filterable: true,
			filtered: kind !== ''
		},
		{
			id: 'characters',
			label: t('scripts.column.characters'),
			sortable: true,
			align: 'end',
			width: '6rem'
		},
		{
			id: 'remove',
			label: t('scripts.picker.remove'),
			hideLabel: true,
			flush: true,
			width: 'var(--tap-target)'
		}
	]);
	/** BotC Scripts: the site's own columns (Name, Author, Type, Likes) plus character counts. */
	const characterFilters = $derived(
		filterCount({ ...botcFilters, term: '', type: '', author: '' })
	);
	const BOTC_COLUMNS = $derived<DataColumn<ColumnId>[]>([
		{ id: 'name', label: t('scripts.column.name'), flush: true },
		{
			id: 'author',
			label: t('scripts.column.author'),
			wide: true,
			width: '20%',
			filterable: true,
			filtered: botcQuery.author !== ''
		},
		{
			id: 'kind',
			label: t('scripts.column.type'),
			wide: true,
			width: '8.5rem',
			filterable: true,
			filtered: botcFilters.type !== ''
		},
		{
			id: 'characters',
			label: t('scripts.column.characters'),
			align: 'end',
			width: '6rem',
			filterable: true,
			filtered: characterFilters > 0
		},
		{
			id: 'likes',
			label: t('scripts.column.likes'),
			sortable: true,
			align: 'end',
			width: '6rem'
		},
		{
			id: 'number',
			label: t('scripts.column.number'),
			sortable: true,
			wide: true,
			align: 'end',
			width: '6rem'
		}
	]);
	const columns = $derived(source === 'botc' ? BOTC_COLUMNS : LOCAL_COLUMNS);
	const tableSort = $derived<DataSort<ColumnId> | undefined>(
		source === 'botc'
			? BOTC_SORT_OF[effectiveBotcSort]
			: sort && {
					column: sort.column,
					direction: sort.descending ? 'descending' : 'ascending'
				}
	);

	function onSort(column: ColumnId) {
		if (column === 'remove') return;
		if (source === 'botc') sortBotc(column);
		else sort = nextSort(sort, column);
	}

	/** Counts under the name on narrow tables: good and evil characters. */
	function makeup(row: PickerRow): string {
		if (!data || row.source !== 'botc') return '';
		const c = botcCard(row.entries, data).counts;
		return [c.townsfolk, c.outsider, c.minion, c.demon].map((n) => n ?? 0).join('/');
	}

	function clearError() {
		error = '';
		errorLink = undefined;
	}

	function closeAll() {
		pasteOpen = linkOpen = codeOpen = false;
	}

	async function use(script: LoadedScript, source: ScriptSource) {
		await chooseScript(script, source);
		onchoose?.(script);
	}

	/** Parses fetched text, then loads it or asks the Storyteller to check it first. */
	async function settle(fetched: FetchedScript) {
		const result = loadScriptText(fetched.text, await loadOfficialData());
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
				return run(() => fetchLinkTarget({ kind: 'botcscripts', ref: target.ref }, ''));
		}
	}

	function preview(listing: ScriptListing) {
		previewing = listing;
		previewOpen = true;
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

	function open(which: 'paste' | 'link' | 'code') {
		clearError();
		pasteOpen = which === 'paste';
		linkOpen = which === 'link';
		codeOpen = which === 'code';
		if (codeOpen) codeText = '';
	}
</script>

<div class="picker">
	<div class="search">
		<label class="term">
			<span class="visually-hidden">{t('scripts.picker.search')}</span>
			<input
				type="search"
				autocomplete="off"
				enterkeyhint="search"
				placeholder={source === 'botc'
					? t('scripts.picker.searchBotc')
					: t('scripts.picker.searchLocal')}
				bind:value={term}
			/>
		</label>
		<Select
			label={t('scripts.picker.source')}
			hideLabel
			value={source}
			options={SOURCE_OPTIONS}
			onChange={(v) => (source = v)}
		/>
	</div>

	<!-- One fixed height for every source, so switching moves nothing below. -->
	<div class="body">
		<div class="table" data-testid="picker-table" data-source={source}>
			<DataTable
				label={source === 'botc' ? t('scripts.botc.results') : t('scripts.picker.table')}
				{columns}
				rows={botcRef ? [] : shown}
				key={(listing) => listing.row.key}
				{cell}
				sort={tableSort}
				{onSort}
				{filter}
				narrow="hide"
				fill
				rowSelected={isCurrent}
				empty={botcRef ? '' : t('common.none')}
			/>
		</div>

		<!-- The count shares the line under the table with the next action; both always there. -->
		<div class="more">
			<p class="status" role="status" data-testid="picker-status">{status}</p>
			{#if source === 'botc'}
				<div class="buttons">
					<Button
						variant="quiet"
						disabled={busy || botc.loading || !botc.hasMore || !!botcRef || !data}
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
						>{t('scripts.picker.load')}</Button
					>
				</div>
			{:else}
				<Button variant="quiet" onclick={() => (source = 'botc')}
					>{t('scripts.picker.searchBotcButton')}</Button
				>
			{/if}
		</div>
	</div>

	<section aria-labelledby="custom-heading">
		<h2 id="custom-heading" class="visually-hidden">{t('scripts.picker.add')}</h2>
		<div class="row custom">
			<Button onclick={() => open('paste')}>{t('scripts.picker.paste')}</Button>
			<Button onclick={() => fileInput?.click()} disabled={busy}>{t('scripts.picker.file')}</Button>
			<Button onclick={() => open('link')}>{t('scripts.picker.link')}</Button>
			<Button onclick={() => open('code')}>{t('scripts.picker.code')}</Button>
		</div>
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
			{#if !pasteOpen && !linkOpen && !codeOpen}{error}{/if}
		</p>
	</section>
</div>

{#snippet cell(listing: ScriptListing, column: DataColumn<ColumnId>)}
	{@const row = listing.row}
	{#if column.id === 'name'}
		<button
			type="button"
			class="pick"
			aria-pressed={isCurrent(listing)}
			aria-label="{row.name} {row.note || t(`scripts.sourceLabel.${row.source}`)}"
			aria-haspopup="dialog"
			disabled={busy}
			onclick={() => preview(listing)}
		>
			<span class="title">{row.name || t('common.none')}</span>
			<span class="sub"
				>{[
					row.note,
					row.author || t('scripts.picker.noAuthor'),
					t(`scripts.kind.${row.kind}`),
					makeup(row)
				]
					.filter(Boolean)
					.join(' · ')}</span
			>
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
	{:else if listing.saved}
		{@const saved = listing.saved}
		<IconButton
			icon="close"
			label={t('scripts.picker.removeRecent', { name: saved.name })}
			onclick={() => forgetScript(saved.scriptId).catch((e) => reportError(e, { area: 'scripts' }))}
		/>
	{/if}
{/snippet}

{#snippet filter(column: DataColumn<ColumnId>, close: () => void)}
	{#if source === 'botc'}
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
	{:else}
		<fieldset class="kinds" data-col={column.id}>
			<legend class="visually-hidden">{t('scripts.picker.type')}</legend>
			{#each KIND_OPTIONS as option (option.value)}
				<label class="check">
					<input
						type="radio"
						name="script-kind"
						value={option.value}
						checked={kind === option.value}
						onchange={() => {
							kind = option.value;
							close();
						}}
					/>
					{option.label}
				</label>
			{/each}
		</fieldset>
	{/if}
{/snippet}

<ScriptPreview
	bind:open={previewOpen}
	row={previewing?.row}
	{data}
	disabled={busy}
	onload={() => previewing && void loadTarget(previewing.target)}
/>

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
			>{t('scripts.picker.load')}</Button
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
			disabled={busy || linkText.trim() === ''}>{t('scripts.picker.load')}</Button
		>
	{/snippet}
</Dialog>

<Dialog bind:open={codeOpen} title={t('scripts.code.title')}>
	{#if codeOpen}
		<ShareCodeEntry
			bind:value={codeText}
			disabled={busy}
			onsubmit={(code) => run(() => fetchSharedCode(code))}
		/>
	{/if}
	{@render errorLine()}
	{#snippet actions()}
		<Button
			variant="accent"
			onclick={() => run(() => fetchSharedCode(codeText))}
			disabled={busy || codeText === ''}>{t('scripts.picker.load')}</Button
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
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.picker {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-3);
		min-width: 0;
	}
	.search {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: var(--space-2);
		align-items: end;
	}
	.term input {
		width: 100%;
		box-sizing: border-box;
		min-height: var(--tap-target);
		padding: var(--space-2);
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
	.pick:hover:not(:disabled) {
		background: var(--surface-selected);
	}
	.title {
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.sub {
		display: none;
		font-size: 0.8rem;
		color: var(--on-surface-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	/* Narrow tables: author and type sit under the name instead of in columns of their own. */
	@container data-table (max-width: 40rem) {
		.sub {
			display: block;
		}
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
	.kinds {
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
	section {
		display: grid;
		gap: var(--space-2);
	}
	.row {
		display: grid;
		gap: var(--space-2);
	}
	.custom {
		grid-template-columns: repeat(4, minmax(0, 1fr));
	}
	/* Narrow screens and large text: the search and source stack, the buttons go two by two. */
	@media (max-width: 30rem) {
		.search {
			grid-template-columns: minmax(0, 1fr);
		}
		.custom {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
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
