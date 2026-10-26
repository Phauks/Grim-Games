<script lang="ts">
	import { onMount } from 'svelte';
	import { createAttachmentKey } from 'svelte/attachments';
	import { SvelteMap } from 'svelte/reactivity';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import {
		editionScript,
		loadScriptText,
		type CharacterId,
		type CharacterType,
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
	import BackButton from '#lib/ui/primitives/BackButton.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import ScriptLogo from './ScriptLogo.svelte';
	import DataTable, { type DataColumn, type DataSort } from '#lib/ui/table/DataTable.svelte';
	import { MAX_FILTER_CHARACTERS } from './botcscripts-api.ts';
	import BotcFilter from './BotcFilter.svelte';
	import { fetchRemote } from './remote-previews.svelte.ts';
	import {
		chooseScript,
		currentScript,
		forgetScript,
		recentScripts,
		restoreScripts
	} from './current-script.svelte.ts';
	import { ScriptFetchError, type FetchedScript } from './fetch-script.ts';
	import { pickerColumns } from './picker-columns.ts';
	import { nextSort, type SortColumn } from './picker-rows.ts';
	import { relaxJson } from './relaxed-json.ts';
	import { reloadSavedScript, type ScriptSource } from './saved-scripts.ts';
	import ScriptView from './ScriptView.svelte';
	import { ScriptSearch } from './script-search.svelte.ts';
	import { storedSources, type PageSource } from './search-sources.ts';
	import {
		findSaved,
		matchesSaved,
		type LoadTarget,
		type ScriptListing
	} from './script-providers.ts';
	import ScriptCheckDialog from './ScriptCheckDialog.svelte';

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
		/** The sources turned on, searched together. */
		sources?: PageSource[];
	}

	let {
		onchoose,
		busy = $bindable(false),
		term = $bindable(''),
		sources = $bindable(storedSources())
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

	/**
	 * The list and details reach the bottom of the screen (Trevor, 2026-10-26): the table
	 * takes whatever height is left under the search, never less than the clamp in the styles.
	 */
	let tableBox = $state<HTMLElement>();
	let fillHeight = $state<number>();
	$effect(() => {
		const box = tableBox;
		const page = box?.closest('main');
		if (!box || !page) return;
		const measure = () => {
			const table = box.getBoundingClientRect();
			const top = table.top + window.scrollY;
			const below = page.getBoundingClientRect().bottom - table.bottom;
			fillHeight = Math.floor(document.documentElement.clientHeight - top - below);
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(page);
		window.addEventListener('resize', measure);
		return () => {
			observer.disconnect();
			window.removeEventListener('resize', measure);
		};
	});

	let checkOpen = $state(false);

	// The search box (toolbar) and sources (title row) live on the page (`ScriptSearchBar`).
	const search = new ScriptSearch(() => ({ sources, term }));
	let error = $state('');

	let checking = $state.raw<{ result: ScriptLoadResult; source: ScriptSource } | undefined>();

	onMount(() => {
		void restoreScripts();
		loadOfficialData().then(
			(d) => (search.data = d),
			(e) => reportError(e, { area: 'scripts', notify: false })
		);
	});

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
		search.data ? search.data.characters.filter((c) => FILTER_TYPES.includes(c.type)) : []
	);

	// ---- The table ----

	/** The most recently saved script that is listed (base three are not). */
	const latest = $derived(
		recentScripts.list
			.map((saved) => search.savedListings.find((l) => l.saved?.scriptId === saved.scriptId))
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
			// Saving leaves Play and the rows alone (Trevor, 2026-10-19: they flashed).
			await loadTarget(listing.target, { quiet: true });
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

	let columnFilters = $state({});
	// Other sources start with none of the last ones' column filters.
	$effect.pre(() => {
		void search.sourcesKey;
		columnFilters = {};
	});

	type ColumnId = SortColumn;
	const columns = $derived(pickerColumns(search.searchingBotc, search.botcFilters));
	const tableSort = $derived<DataSort<ColumnId> | undefined>(
		search.sort && {
			column: search.sort.column,
			direction: search.sort.descending ? 'descending' : 'ascending'
		}
	);

	/** Rows drawn at a time: Bloodstar lists thousands (Trevor, 2026-10-18: a paged table). */
	const PAGE_ROWS = 100;

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
	function loadMore() {
		if (!busy) search.loadMore();
	}
	function onSort(column: ColumnId) {
		search.sort = nextSort(search.sort, column);
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

	/** `quiet` skips `busy`, for a script that is already shown (Save). */
	async function run(task: () => Promise<FetchedScript>, { quiet = false } = {}) {
		clearError();
		if (!quiet) busy = true;
		try {
			await settle(await task());
		} catch (e) {
			// A refused link or a missing script is expected; anything else is a bug worth logging.
			if (!(e instanceof ScriptFetchError)) reportError(e, { area: 'scripts', notify: false });
			error = errorMessage(e);
		} finally {
			if (!quiet) busy = false;
		}
	}

	/** Loads a row's script: built in, saved, carried in the row, or fetched. */
	async function loadTarget(target: LoadTarget, options: { quiet?: boolean } = {}) {
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
				return run(
					() => Promise.resolve({ text: JSON.stringify(target.json), source: target.source }),
					options
				);
			case 'botcscripts':
			case 'homebrew':
			case 'bloodstar':
				return run(() => fetchRemote(target), options);
		}
	}

	/** After Add script saves a script: the details show it (Trevor: saved scripts are shown). */
	export function showSaved() {
		selected = undefined;
		paneOpen = true;
	}
</script>

{#snippet backButton()}
	<BackButton class="back" label={t('scripts.details.back')} onclick={() => (paneOpen = false)} />
{/snippet}

<!-- The list on the left, the shown script's details on the right; on a phone the details
     slide over the list and Back returns to it. -->
<div
	class="panes"
	bind:clientWidth={width}
	style:--fill-height={fillHeight === undefined ? undefined : `${fillHeight}px`}
>
	<div class="grid" class:open={paneOpen}>
		<div class="picker" inert={narrow && paneOpen}>
			<!-- One fixed height for every source, so switching moves nothing below. -->
			<div class="body">
				<div class="table" data-testid="picker-table" bind:this={tableBox}>
					<DataTable
						label={t('scripts.picker.table')}
						{columns}
						rows={search.shown}
						key={(listing) => listing.row.key}
						{cell}
						sort={tableSort}
						{onSort}
						{filter}
						narrow="hide"
						resizeKey="scripts"
						pageSize={PAGE_ROWS}
						bind:columnFilters
						oncount={(count) => (search.shownCount = count)}
						fill
						rowSelected={isSelected}
						moreRows={search.botcMore}
						onend={loadMore}
						rowAttrs={() => ({ [TAP_ROW]: tapRow })}
						empty={search.pendingSources.length > 0 ? '' : t('common.none')}
					/>
				</div>

				<!-- The count under the table; always there. -->
				<div class="more" data-testid="picker-more">
					<p class="status" role="status" data-testid="picker-status">{search.status}</p>
				</div>
			</div>

			<section>
				<!-- Load errors outside a dialog; the line is always there, so no reflow. -->
				<p class="error" role="status" data-testid="file-error">
					{error}
				</p>
			</section>
		</div>

		<aside
			class="pane"
			data-testid="script-pane"
			aria-label={t('scripts.details.label')}
			inert={narrow && !paneOpen}
		>
			<div class="pane-scroll">
				<ScriptView
					listing={baseListing}
					data={search.data}
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

{#snippet cell(listing: ScriptListing, column: DataColumn<ColumnId, ScriptListing>)}
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
			<!-- Every row keeps the logo's place, so names line up with or without one. -->
			<span class="named"
				><ScriptLogo src={row.logo} class="row-logo" /><span class="title"
					>{row.name || t('common.none')}</span
				></span
			>
		</button>
	{:else if column.id === 'author'}
		<span class="text">{row.author || t('common.none')}</span>
	{:else if column.id === 'source'}
		<span class="text">{t(`scripts.sourceLabel.${row.source}`)}</span>
	{:else if column.id === 'kind'}
		<span class="text">{row.unsized ? t('common.none') : t(`scripts.kind.${row.kind}`)}</span>
	{:else if column.id === 'characters'}
		<span class="text numeric">{row.unsized ? t('common.none') : row.characters}</span>
	{:else if column.id === 'likes'}
		<span class="text numeric">{row.likes ?? 0}</span>
	{:else if column.id === 'number'}
		<span class="text numeric">{row.number ?? ''}</span>
	{/if}
{/snippet}

{#snippet filter(column: DataColumn<ColumnId, ScriptListing>, close: () => void)}
	<BotcFilter
		column={column.id}
		bind:filters={search.botcFilters}
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
			selected={search.botcFilters[list] as CharacterId[]}
			max={MAX_FILTER_CHARACTERS}
			onSelect={(id) => search.toggleCharacter(list, id)}
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
		/* The table's height, which the details beside it share on a wide screen: down to the
		   bottom of the screen, or the clamp where that is less. */
		--table-height: max(clamp(22rem, 60dvh, 36rem), var(--fill-height, 0rem));
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
	.toggle.on :global(.icon-button) {
		background: var(--accent);
		color: var(--on-accent);
	}
	@container script-panes (min-width: 56rem) {
		/* The list and the details are one surface (Trevor, 2026-10-23): no gap, one border
		   between them, square inner corners, the same height. */
		.grid {
			grid-template-columns: minmax(0, 1fr) minmax(20rem, 28rem);
			column-gap: 0;
		}
		.table :global(.scroll) {
			border-start-end-radius: 0;
			border-end-end-radius: 0;
		}
		.pane {
			position: relative;
			inset: auto;
			grid-column: 2;
			align-self: start;
			height: var(--table-height);
			border-inline-start: 0;
			border-start-start-radius: 0;
			border-end-start-radius: 0;
			transform: none;
			visibility: visible;
			transition: none;
		}
		:global(.back-button.back) {
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
		height: var(--table-height);
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
	.named {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
	}
	.named :global(.row-logo) {
		width: 1.75em;
		height: 1.75em;
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
	/* A phone's second line (Author and Type) is text under the name; the row is the tap target. */
	@container data-table (max-width: 40rem) {
		.text {
			min-height: auto;
		}
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
