/**
 * The Scripts page's search (`ScriptPicker.svelte`): the sources turned on, each source's rows,
 * the BotC Scripts query and its pages, and the one list the table shows. Made while the picker
 * starts, so its effects belong to the picker.
 */
import { untrack } from 'svelte';
import { locale, t } from '#lib/i18n/locale.svelte.ts';
import { loadScriptText, type CharacterId, type GameData } from '#lib/core/data/index.ts';
import {
	EMPTY_QUERY,
	normaliseSearch,
	parseBotcScriptsRef,
	scriptPageUrl,
	searchPath,
	type BotcScriptsQuery,
	type BotcScriptsSort
} from './botcscripts-api.ts';
import { collectionScripts } from './collection.svelte.ts';
import { bloodstarScripts } from './bloodstar.svelte.ts';
import { homebrewScripts } from './homebrew-scripts.svelte.ts';
import { fetchRemote, remotePreviews } from './remote-previews.svelte.ts';
import { curatedScripts } from './curated.svelte.ts';
import { worldCupScripts } from './world-cup.svelte.ts';
import { recentScripts } from './current-script.svelte.ts';
import { searchBotcScripts } from './fetch-script.ts';
import { filterRows, pickerRow, sortRows, type RowSort } from './picker-rows.ts';
import { RemoteSearch } from './remote-search.svelte.ts';
import { describeSource } from './saved-scripts.ts';
import type { PageSource } from './search-sources.ts';
import {
	botcProvider,
	localListings,
	SCRIPTS_PAGE_PROVIDERS,
	recentProvider,
	type LocalContext,
	type ScriptListing
} from './script-providers.ts';
import { CURATED_SECTIONS } from './script-tool-link.ts';

export type BotcFilters = Omit<BotcScriptsQuery, 'term'>;

/**
 * Each source turned on: still loading, loaded, or failed (with nothing kept from last
 * time). A failed source doesn't hold up the others.
 */
type SourceState = 'loading' | 'done' | 'failed';

const DEBOUNCE_MS = 400;

function noFilters(): BotcFilters {
	const blank: Partial<BotcScriptsQuery> = { ...EMPTY_QUERY };
	delete blank.term;
	return blank as BotcFilters;
}

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

function listState(status: string, kept: number): SourceState {
	if (status === 'ready') return 'done';
	if (status === 'error') return kept > 0 ? 'done' : 'failed';
	return 'loading';
}

/** Source names in a sentence: "BotC Scripts and Bloodstar Clocktica". */
function sourceNames(list: readonly PageSource[]): string {
	const names = list.map((s) => t(`scripts.picker.source.${s}`));
	return new Intl.ListFormat(locale.current, { type: 'conjunction' }).format(names);
}

export class ScriptSearch {
	readonly #input: () => { sources: PageSource[]; term: string };

	sort = $state<RowSort | undefined>();
	data = $state.raw<GameData>();
	botcFilters = $state<BotcFilters>(noFilters());
	/** Rows left after the table's own column filters (Name, Likes, No.). */
	shownCount = $state(0);
	readonly botc = new RemoteSearch(botcProvider(searchBotcScripts), (q) => searchPath(q));

	readonly sources = $derived.by(() => this.#input().sources);
	readonly term = $derived.by(() => this.#input().term);
	readonly sourcesKey = $derived(this.sources.join(','));
	readonly searchingBotc = $derived(this.sources.includes('botc'));

	constructor(input: () => { sources: PageSource[]; term: string }) {
		this.#input = input;

		let prevSources = untrack(() => this.sourcesKey);
		$effect(() => {
			if (this.sourcesKey === prevSources) return;
			prevSources = this.sourcesKey;
			// Likes and No. come and go with BotC Scripts, so the sort starts again.
			untrack(() => (this.sort = undefined));
		});

		// A list is only fetched once its source is turned on.
		$effect(() => {
			const wanted = this.sources;
			// Untracked: a failed load must not re-run this and try again in a loop.
			untrack(() => {
				if (wanted.includes('curated') || wanted.includes('month')) void curatedScripts.load();
				if (wanted.includes('collection')) void collectionScripts.load();
				if (wanted.includes('homebrew')) void homebrewScripts.load();
				if (wanted.includes('bloodstar')) void bloodstarScripts.load();
				if (wanted.includes('worldcup2023')) void worldCupScripts.load('2023');
				if (wanted.includes('worldcup2025')) void worldCupScripts.load('2025');
			});
		});

		// A search runs after a pause in typing or a change of filters; links and numbers don't search.
		$effect(() => {
			if (!this.searchingBotc || !this.data || this.botcRef || this.botcKey === this.botc.searched)
				return;
			const q = $state.snapshot(this.botcQuery) as BotcScriptsQuery;
			const d = this.data;
			const timer = setTimeout(
				() => void this.botc.load(q, 1, d),
				this.botc.searched === undefined ? 0 : DEBOUNCE_MS
			);
			return () => clearTimeout(timer);
		});
		$effect(() => () => this.botc.abort());

		$effect(() => {
			const target = this.refTarget;
			if (target) untrack(() => void fetchRemote(target).catch(() => {}));
		});
	}

	readonly #localContext = $derived.by((): LocalContext | undefined => {
		const data = this.data;
		return (
			data && {
				data,
				curated: curatedScripts.list,
				collection: collectionScripts.list,
				homebrew: homebrewScripts.list,
				bloodstar: bloodstarScripts.list,
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
	});
	/**
	 * The rows of the sources listed on the device (all but BotC Scripts). Each source keeps its
	 * own rows: a script two sources list shows twice, once with each Source.
	 */
	readonly #local = $derived.by(() => {
		const context = this.#localContext;
		if (!context) return [];
		return SCRIPTS_PAGE_PROVIDERS.filter((p) =>
			(this.sources as readonly string[]).includes(p.id)
		).flatMap((provider) => localListings(context, [provider]));
	});
	/** Saved scripts: not listed here (the Library lists them), but the details show the latest. */
	readonly savedListings = $derived(
		this.#localContext ? localListings(this.#localContext, [recentProvider]) : []
	);

	/** Local rows, filtered on the device by the same header filters the site uses. */
	readonly #shownLocal = $derived.by(() => {
		const f = this.botcFilters;
		const rows = filterRows(
			this.#local.map((l) => l.row),
			{
				term: this.term,
				sources: this.sources,
				kind: f.type,
				author: f.author,
				include: f.include,
				exclude: f.exclude,
				oneDemon: f.oneDemon,
				officialOnly: f.officialOnly
			},
			this.data
		);
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- built and read inside one derived
		const keys = new Set(rows.map((r) => r.key));
		return this.#local.filter((l) => keys.has(l.row.key));
	});

	// ---- BotC Scripts: searched on the site, page by page ----

	readonly botcRef = $derived(this.searchingBotc ? parseBotcScriptsRef(this.term) : undefined);
	/** The site picks which results come first: most likes, or by upload order for No. */
	readonly siteSort = $derived<BotcScriptsSort>(
		this.sort?.column === 'number' ? (this.sort.descending ? 'newest' : 'oldest') : 'votes'
	);
	readonly botcQuery = $derived<BotcScriptsQuery>({
		...this.botcFilters,
		sort: this.siteSort,
		term: normaliseSearch(this.term)
	});
	readonly botcKey = $derived(searchPath(this.botcQuery));

	toggleCharacter(list: 'include' | 'exclude', id: CharacterId) {
		const other = list === 'include' ? 'exclude' : 'include';
		const has = this.botcFilters[list].includes(id);
		this.botcFilters[list] = has
			? this.botcFilters[list].filter((c) => c !== id)
			: [...this.botcFilters[list], id];
		// A character can't be both required and ruled out.
		if (!has) this.botcFilters[other] = this.botcFilters[other].filter((c) => c !== id);
	}

	/**
	 * A typed BotC Scripts link or number is fetched and listed as its own row, so it opens
	 * and saves like any other (Save lives in the details' header, Trevor 2026-10-18).
	 */
	readonly refTarget = $derived(
		this.botcRef ? ({ kind: 'botcscripts', ref: this.botcRef } as const) : undefined
	);
	readonly #refListing = $derived.by((): ScriptListing | undefined => {
		const target = this.refTarget;
		const fetched = target && remotePreviews.get(target);
		if (!target || !fetched || !this.data) return undefined;
		const script = loadScriptText(fetched.text, this.data).script;
		if (!script) return undefined;
		const source = fetched.source;
		const botcSource = source.kind === 'botcscripts' ? source : undefined;
		return {
			row: {
				...pickerRow(script, `botc-ref:${JSON.stringify(target.ref)}`, 'botc'),
				...(botcSource
					? {
							number: botcSource.scriptId,
							version: botcSource.version,
							page: scriptPageUrl(botcSource.scriptId, botcSource.version)
						}
					: {})
			},
			target
		};
	});
	readonly #refFailed = $derived(!!this.refTarget && remotePreviews.failed(this.refTarget));

	readonly #botcState = $derived<SourceState>(
		this.botcRef
			? this.#refFailed
				? 'failed'
				: this.#refListing
					? 'done'
					: 'loading'
			: this.botc.failure
				? 'failed'
				: this.botc.searched === this.botcKey
					? 'done'
					: 'loading'
	);
	stateOf(source: PageSource): SourceState {
		switch (source) {
			case 'botc':
				return this.#botcState;
			case 'curated':
			case 'month':
				return listState(curatedScripts.status, curatedScripts.list.length);
			case 'collection':
				return listState(collectionScripts.status, collectionScripts.list.length);
			case 'homebrew':
				return listState(homebrewScripts.status, homebrewScripts.list.length);
			case 'bloodstar':
				return listState(bloodstarScripts.status, bloodstarScripts.list.length);
			case 'worldcup2023':
				return listState(worldCupScripts.status('2023'), worldCupScripts.list('2023').length);
			case 'worldcup2025':
				return listState(worldCupScripts.status('2025'), worldCupScripts.list('2025').length);
		}
	}
	readonly pendingSources = $derived(this.sources.filter((s) => this.stateOf(s) === 'loading'));
	readonly #failedSources = $derived(this.sources.filter((s) => this.stateOf(s) === 'failed'));

	/**
	 * Every source's rows in one list, shown only once every source has answered (Trevor,
	 * 2026-10-18), so rows never jump about as each one arrives. BotC Scripts comes last, so
	 * its further pages add to the end.
	 */
	readonly shown = $derived.by<ScriptListing[]>(() => {
		if (!this.data || this.pendingSources.length > 0) return [];
		const botcRows = !this.searchingBotc
			? []
			: this.botcRef
				? this.#refListing
					? [this.#refListing]
					: []
				: this.botc.listings;
		const all = [...this.#shownLocal, ...botcRows];
		if (!this.sort) return all;
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- built and read inside one derived
		const byKey = new Map(all.map((l) => [l.row.key, l]));
		return sortRows(
			all.map((l) => l.row),
			this.sort
		).map((row) => byKey.get(row.key)!);
	});

	readonly #botcStatus = $derived(
		!this.searchingBotc
			? ''
			: this.botc.failure ||
					(this.botc.loading && this.botc.listings.length === 0
						? t('scripts.botc.searching')
						: this.botc.searched === undefined || this.botc.count === 0
							? ''
							: t('scripts.botc.count', {
									count: this.botc.count,
									sort: t(`scripts.botc.sort.${this.siteSort}`).toLowerCase()
								}))
	);
	readonly #failedNote = $derived(
		this.#failedSources.length > 0
			? t('scripts.sources.failed', { names: sourceNames(this.#failedSources) })
			: ''
	);
	/** The line under the table. */
	readonly status = $derived(
		!this.data
			? t('scripts.picker.loading')
			: this.pendingSources.length > 0
				? t('scripts.sources.searching', { names: sourceNames(this.pendingSources) })
				: this.sources.length === 1 && this.searchingBotc && !this.botcRef
					? this.#botcStatus || t('common.none')
					: (this.shownCount === 0
							? t('common.none')
							: t('scripts.picker.count', { count: this.shownCount })) + this.#failedNote
	);

	/**
	 * More BotC Scripts results load by themselves when the list's end comes near (Trevor,
	 * 2026-10-17: no More button). The table keeps the space of the results still to come, so
	 * scrolling never stops at the end of a page, and asks again after each page arrives.
	 */
	readonly botcMore = $derived(
		this.searchingBotc && !this.botcRef && this.botc.hasMore
			? Math.max(1, this.botc.count - this.botc.listings.length)
			: 0
	);
	loadMore() {
		const { botc, data } = this;
		if (!this.searchingBotc || botc.loading || !botc.hasMore || this.botcRef || !data) return;
		void botc.load($state.snapshot(this.botcQuery) as BotcScriptsQuery, botc.page + 1, data);
	}
}
