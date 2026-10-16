<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import {
		editionScript,
		loadScript,
		loadScriptText,
		OFFICIAL_EDITIONS,
		type GameData,
		type LoadedScript,
		type ScriptLoadResult
	} from '#lib/core/data/index.ts';
	import { account } from '#lib/features/account/account.svelte.ts';
	import { profileScripts } from '#lib/features/account/profile-scripts.svelte.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { errorMessage } from '#lib/features/errors/app-error.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import DataTable, { type DataColumn } from '#lib/ui/table/DataTable.svelte';
	import { parseBotcScriptsRef } from './botcscripts-api.ts';
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
		type FetchedScript
	} from './fetch-script.ts';
	import {
		filterRows,
		nextSort,
		pickerRow,
		sortRows,
		type PickerRow,
		type PickerSource,
		type RowSort,
		type ScriptKind,
		type SortColumn
	} from './picker-rows.ts';
	import {
		describeSource,
		reloadSavedScript,
		sameScript,
		type SavedScript,
		type ScriptSource
	} from './saved-scripts.ts';
	import BotcScriptsBrowser from './BotcScriptsBrowser.svelte';
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

	/** The one search box: local scripts, or BotC Scripts when that is the source. */
	let term = $state('');
	let source = $state<PickerSource | 'all' | 'botc'>('all');
	let kind = $state<ScriptKind | ''>('');
	let sort = $state<RowSort | undefined>();
	let data = $state.raw<GameData>();
	let error = $state('');
	let errorLink = $state<string | undefined>(undefined);
	let busy = $state(false);

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

	// The official site is only asked when its scripts are wanted: chosen, or searched for.
	$effect(() => {
		if (source === 'curated' || (source === 'all' && term.trim() !== '')) {
			void curatedScripts.load();
		}
	});

	/** One table row, with how to load it and what it is, to mark the current script. */
	interface Entry {
		row: PickerRow;
		script: Pick<SavedScript, 'edition' | 'json'>;
		load: () => Promise<void>;
		/** Set for Recent rows, which can be removed. */
		saved?: SavedScript;
	}

	/** Loads script JSON through the usual checks, remembering where it came from. */
	const fromJson = (json: unknown[], from: ScriptSource) => () =>
		run(() => Promise.resolve({ text: JSON.stringify(json), source: from }));

	const entries = $derived.by((): Entry[] => {
		if (!data) return [];
		const d = data;
		const list: Entry[] = [];
		const seen: Pick<SavedScript, 'edition' | 'json'>[] = [];
		const add = (entry: Entry) => {
			if (seen.some((other) => sameScript(other, entry.script))) return;
			seen.push(entry.script);
			list.push(entry);
		};
		for (const edition of OFFICIAL_EDITIONS) {
			const script = editionScript(edition.id, d);
			if (!script) continue;
			add({
				row: pickerRow(script, `official:${edition.id}`, 'official'),
				script: { edition: edition.id, json: [] },
				load: () => chooseEdition(edition.id)
			});
		}
		for (const [i, curated] of curatedScripts.list.entries()) {
			const script = loadScript(curated.json, d).script;
			if (!script) continue;
			add({
				row: pickerRow(script, `curated:${i}`, 'curated', curatedSectionLabel(curated.section)),
				script: { json: curated.json },
				load: fromJson(curated.json, { kind: 'link', url: curated.link })
			});
		}
		for (const saved of recentScripts.list) {
			if (saved.edition) continue;
			const script = reloadSavedScript(saved, d);
			if (!script) continue;
			add({
				row: pickerRow(script, `recent:${saved.scriptId}`, 'recent', describeSource(saved.source)),
				script: saved,
				load: () => chooseRecent(saved),
				saved
			});
		}
		if (account.user) {
			for (const entry of profileScripts.list) {
				const script = loadScript(entry.script.json, d).script;
				if (!script) continue;
				add({
					row: pickerRow(
						script,
						`profile:${entry.id}`,
						'profile',
						describeSource(entry.script.source)
					),
					script: { json: entry.script.json },
					load: fromJson(entry.script.json, entry.script.source)
				});
			}
		}
		return list;
	});

	const shown = $derived.by(() => {
		if (source === 'botc') return [];
		const byKey = new Map(entries.map((e) => [e.row.key, e]));
		const rows = filterRows(
			entries.map((e) => e.row),
			{ term, source, kind }
		);
		return sortRows(rows, sort).map((row) => byKey.get(row.key)!);
	});

	const isCurrent = (entry: Entry) =>
		!!currentScript.saved && sameScript(currentScript.saved, entry.script);

	const curatedNote = $derived(
		(source === 'all' || source === 'curated') && curatedScripts.status === 'loading'
			? t('scripts.picker.curatedLoading')
			: source === 'curated' &&
				  curatedScripts.status === 'error' &&
				  curatedScripts.list.length === 0
				? t('scripts.picker.curatedFailed')
				: ''
	);
	const status = $derived(
		!data
			? t('scripts.picker.loading')
			: (shown.length === 0
					? t('common.none')
					: t('scripts.picker.count', { count: shown.length })) + curatedNote
	);

	const SOURCE_OPTIONS = $derived<{ value: PickerSource | 'all' | 'botc'; label: string }[]>(
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

	/** The official site's known sections in the app's words; any other heading as written. */
	function curatedSectionLabel(section: string): string {
		return CURATED_SECTIONS.some((known) => known === section)
			? t(`scripts.curated.${section as (typeof CURATED_SECTIONS)[number]}`)
			: section;
	}

	type ColumnId = SortColumn | 'remove';
	const COLUMNS: readonly DataColumn<ColumnId>[] = [
		{ id: 'name', label: 'Name', sortable: true, flush: true },
		{ id: 'author', label: 'Author', sortable: true, wide: true, width: '20%' },
		{ id: 'source', label: 'Source', sortable: true, width: '6rem' },
		{ id: 'kind', label: 'Type', sortable: true, wide: true, width: '8.5rem', filterable: true },
		{ id: 'characters', label: 'Chars', sortable: true, align: 'end', width: '6rem' },
		{
			id: 'remove',
			label: t('scripts.picker.remove'),
			hideLabel: true,
			flush: true,
			width: 'var(--tap-target)'
		}
	];
	const columns = $derived(
		COLUMNS.map((c) => (c.id === 'kind' ? { ...c, filtered: kind !== '' } : c))
	);
	const tableSort = $derived(
		sort && {
			column: sort.column as ColumnId,
			direction: sort.descending ? ('descending' as const) : ('ascending' as const)
		}
	);

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

	async function chooseEdition(id: string) {
		const script = editionScript(id, await loadOfficialData());
		if (script) await use(script, { kind: 'edition' });
	}

	async function chooseRecent(saved: SavedScript) {
		const script = reloadSavedScript(saved, await loadOfficialData());
		if (script) await use(script, saved.source);
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

	<!-- One fixed height for both views, so switching to BotC Scripts moves nothing below. -->
	<div class="body">
		{#if source === 'botc'}
			<BotcScriptsBrowser
				bind:query={term}
				disabled={busy}
				onpick={(ref) => run(() => fetchLinkTarget({ kind: 'botcscripts', ref }, ''))}
			/>
		{:else}
			<div class="table">
				<DataTable
					label={t('scripts.picker.table')}
					{columns}
					rows={shown}
					key={(entry) => entry.row.key}
					{cell}
					sort={tableSort}
					onSort={(column) => column !== 'remove' && (sort = nextSort(sort, column))}
					{filter}
					narrow="hide"
					fill
					rowSelected={isCurrent}
				/>
			</div>

			<!-- The count shares the line under the table with the BotC Scripts link. -->
			<div class="more">
				<p class="status" role="status" data-testid="picker-status">{status}</p>
				<Button variant="quiet" onclick={() => (source = 'botc')}
					>{t('scripts.picker.searchBotcButton')}</Button
				>
			</div>
		{/if}
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

{#snippet cell(entry: Entry, column: DataColumn<ColumnId>)}
	{@const row = entry.row}
	{#if column.id === 'name'}
		<button
			type="button"
			class="pick"
			aria-pressed={isCurrent(entry)}
			aria-label="{row.name} {row.note || t(`scripts.sourceLabel.${row.source}`)}"
			disabled={busy}
			onclick={() => void entry.load()}
		>
			<span class="title">{row.name}</span>
			<span class="sub"
				>{[row.note, row.author || t('scripts.picker.noAuthor'), t(`scripts.kind.${row.kind}`)]
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
	{:else if entry.saved}
		{@const saved = entry.saved}
		<IconButton
			icon="close"
			label={t('scripts.picker.removeRecent', { name: saved.name })}
			onclick={() => forgetScript(saved.scriptId).catch((e) => reportError(e, { area: 'scripts' }))}
		/>
	{/if}
{/snippet}

{#snippet filter(column: DataColumn<ColumnId>, close: () => void)}
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
{/snippet}

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
