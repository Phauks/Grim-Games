<script lang="ts">
	import type { Snippet } from 'svelte';
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import {
		editionScript,
		loadScript,
		loadScriptText,
		type GameData,
		type LoadedScript
	} from '#lib/core/data/index.ts';
	import PrintScriptButton from '#lib/features/player/PrintScriptButton.svelte';
	import ScriptCopy from '#lib/features/player/ScriptCopy.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import { compareVersions, scriptPageUrl } from './botcscripts-api.ts';
	import { fetchRemote, isRemote, remotePreviews } from './remote-previews.svelte.ts';
	import { botcVersions } from './botc-versions.svelte.ts';
	import { playScript, recentScripts } from './current-script.svelte.ts';
	import {
		describeSource,
		reloadSavedScript,
		sourcePage,
		type ScriptSource
	} from './saved-scripts.ts';
	import ScriptChecks from './ScriptChecks.svelte';
	import ScriptDetails, { type ScriptFact } from './ScriptDetails.svelte';
	import { findSaved, type ScriptListing } from './script-providers.ts';
	import ShareControl from './ShareControl.svelte';
	import { shareTargetFor, type ShareTarget } from './share-codes.ts';

	/**
	 * One script's details, the same wherever a script is looked at (Trevor, 2026-10-17: the
	 * Library shows exactly what Search shows): source, name, the main info with versions and
	 * checks, Play, Print and Share, then the script as players see it. Pages add their own
	 * rows (`labels`) and buttons (`extraActions`).
	 */
	interface Props {
		/** The script to show; another BotC Scripts version can be chosen in the details. */
		listing: ScriptListing | undefined;
		data: GameData | undefined;
		/** Told the listing actually shown: `listing`, or the version chosen in the details. */
		onshown?: (shown: ScriptListing | undefined) => void;
		/** Whether the shown script is saved, when the page knows sooner than the store. */
		saved?: boolean;
		/** Shares something other than the saved script, e.g. a profile script. */
		share?: () => Promise<ShareTarget>;
		busy?: boolean;
		/** Above the heading, e.g. Back; given, the heading and name stay pinned. */
		lead?: Snippet;
		/** More rows of the main info (`dt`/`dd` pairs), after the checks: e.g. Folder, Tags. */
		labels?: Snippet;
		/** More buttons in the action row, after Play, Print and Share. */
		extraActions?: Snippet;
	}

	let {
		listing,
		data,
		onshown,
		saved,
		share,
		busy = false,
		lead,
		labels,
		extraActions
	}: Props = $props();

	// ---- Versions: BotC Scripts publishes them (and the World Cups load from it) ----

	/** The script's number and version on BotC Scripts, when it came from there. */
	const baseBotc = $derived.by(() => {
		if (!listing) return undefined;
		if (listing.row.number !== undefined && listing.row.version !== undefined) {
			return { scriptId: listing.row.number, version: listing.row.version };
		}
		const source = findSaved(recentScripts.list, listing)?.source;
		return source?.kind === 'botcscripts'
			? { scriptId: source.scriptId, version: source.version }
			: undefined;
	});
	$effect(() => {
		const id = baseBotc?.scriptId;
		if (id !== undefined) untrack(() => void botcVersions.load(id));
	});
	const versionList = $derived(baseBotc ? botcVersions.get(baseBotc.scriptId) : undefined);
	/** Another version chosen in the details, for the row it was chosen on. */
	let picked = $state<{ key: string; version: string } | undefined>();
	const pickedVersion = $derived(
		listing && picked?.key === listing.row.key ? picked.version : undefined
	);
	/** The chosen version as a row of its own: previewed, saved and shared as that version. */
	const versionListing = $derived.by((): ScriptListing | undefined => {
		const base = listing;
		const botcInfo = baseBotc;
		if (!base || !botcInfo || !pickedVersion || pickedVersion === botcInfo.version) {
			return undefined;
		}
		const { scriptId } = botcInfo;
		return {
			row: {
				...base.row,
				key: `botc-version:${scriptId}:${pickedVersion}`,
				source: 'botc',
				number: scriptId,
				version: pickedVersion,
				page: scriptPageUrl(scriptId, pickedVersion)
			},
			target: { kind: 'botcscripts', ref: { kind: 'script', scriptId, version: pickedVersion } }
		};
	});
	const shownVersion = $derived(pickedVersion ?? baseBotc?.version);
	const latestVersion = $derived(versionList?.latest);
	/** A newer version than the one shown (e.g. a saved 1.2.0 when 1.3.0 is out). */
	const newer = $derived(
		latestVersion && shownVersion && compareVersions(latestVersion, shownVersion) > 0
			? latestVersion
			: undefined
	);
	function chooseVersion(version: string) {
		if (!listing) return;
		picked = { key: listing.row.key, version };
	}

	const shownListing = $derived(versionListing ?? listing);
	$effect(() => {
		const l = shownListing;
		untrack(() => onshown?.(l));
	});
	const shownSaved = $derived(
		shownListing ? findSaved(recentScripts.list, shownListing) : undefined
	);
	const isSaved = $derived(saved ?? !!shownSaved);

	// A script from a site is fetched when shown, so its abilities (and Save) don't wait on it.
	$effect(() => {
		const target = shownListing?.target;
		if (isRemote(target)) untrack(() => void fetchRemote(target).catch(() => {}));
	});

	/**
	 * The shown script as players see it (Trevor, 2026-10-16): names and abilities by type,
	 * with jinxes. A BotC Scripts row has it once its fetch arrives. Until then the space
	 * stays empty (Trevor, 2026-10-17: only the abilities, never a line of characters that
	 * then changes); only a script that can't be loaded lists its characters as badges.
	 */
	const preview = $derived.by((): LoadedScript | undefined => {
		const l = shownListing;
		if (!data || !l) return undefined;
		if (shownSaved) return reloadSavedScript(shownSaved, data);
		const target = l.target;
		switch (target.kind) {
			case 'edition':
				return editionScript(target.edition, data);
			case 'saved':
				return reloadSavedScript(target.saved, data);
			case 'json':
				return loadScript(target.json, data).script;
			case 'botcscripts':
			case 'homebrew':
			case 'bloodstar': {
				const fetched = remotePreviews.get(target);
				return fetched && loadScriptText(fetched.text, data).script;
			}
		}
	});

	const previewPending = $derived.by(() => {
		const l = shownListing;
		if (!l || preview) return false;
		if (!data) return true;
		return isRemote(l.target) && !remotePreviews.failed(l.target);
	});

	/** Where the shown script came from, as it is recorded when played or saved. */
	const shownSource = $derived.by((): ScriptSource | undefined => {
		if (shownSaved) return shownSaved.source;
		const target = shownListing?.target;
		switch (target?.kind) {
			case 'edition':
				return { kind: 'edition' };
			case 'saved':
				return target.saved.source;
			case 'json':
				return target.source;
			case 'botcscripts':
			case 'homebrew':
			case 'bloodstar':
				return remotePreviews.get(target)?.source;
		}
		return undefined;
	});

	/** Play: a new game with the shown script, without saving it (Trevor, 2026-10-17). */
	async function play() {
		if (!preview || !shownSource) return;
		playScript(preview, shownSource);
		await goto(resolve('/new'));
	}

	const facts = $derived.by((): ScriptFact[] => {
		const row = shownListing?.row;
		const none = t('common.none');
		const source: ScriptSource | undefined =
			shownSaved?.source ??
			(row?.source === 'botc' && row.number !== undefined
				? { kind: 'botcscripts', scriptId: row.number, version: row.version ?? '' }
				: undefined);
		// The Source opens the script's own page where it came from (Trevor, 2026-10-16).
		const page = (source && sourcePage(source)) ?? row?.page;
		return [
			{ label: t('scripts.current.author'), value: row ? row.author || none : none },
			{ label: t('scripts.column.type'), value: row ? t(`scripts.kind.${row.kind}`) : none },
			{
				label: t('scripts.current.source'),
				value: source
					? describeSource(source)
					: row
						? row.note || t(`scripts.sourceLabel.${row.source}`)
						: none,
				href: page
			}
		];
	});

	const shareTarget = $derived.by(() => {
		if (share) return share;
		const s = shownSaved;
		return isSaved && s && s.scriptId !== 'unsaved'
			? () => shareTargetFor(s, location.origin)
			: undefined;
	});
</script>

<!-- Every BotC Scripts version, newest first; "None" where the source publishes none. -->
{#snippet version()}
	{#if versionList && versionList.versions.length > 0 && shownVersion}
		<!-- Its own line, the full width: "Newer" sits under it, never squeezing it. -->
		<span class="version-pick">
			<Select
				label={t('scripts.details.version')}
				hideLabel
				value={shownVersion}
				options={versionList.versions.map((v) => ({
					value: v,
					label:
						v === latestVersion
							? t('scripts.details.latestVersion', { version: v })
							: v === baseBotc?.version && shownSaved
								? t('scripts.details.savedVersion', { version: v })
								: v
				}))}
				onChange={chooseVersion}
			/>
		</span>
	{:else}
		<span data-testid="script-version">{shownVersion ?? t('common.none')}</span>
	{/if}
	<!-- Space kept whether or not there is a newer version, so nothing moves when it arrives. -->
	<span class="newer" class:none={!newer} data-testid="newer-version">
		<Button variant="quiet" disabled={!newer} onclick={() => newer && chooseVersion(newer)}
			>{t('scripts.details.newerVersion', { version: newer ?? latestVersion ?? '' })}</Button
		>
	</span>
{/snippet}

{#snippet rows()}
	{#if data && (preview || previewPending)}
		<ScriptChecks script={preview} {data} />
	{/if}
	{@render labels?.()}
{/snippet}

{#snippet playerSheet()}
	{#if preview && data}
		<!-- Author and version are already in the details above. -->
		<ScriptCopy script={preview} byline={false} />
	{:else}
		<!-- Never blank while a script or version loads (Trevor, 2026-10-17); it holds the
		     sheet's place, which only grows downward when the abilities arrive. -->
		<p class="loading" role="status" aria-busy="true" data-testid="script-loading">
			<span class="spin"><Icon name="loading" /></span>
			<span>{t('scripts.details.loading')}</span>
		</p>
	{/if}
{/snippet}

<ScriptDetails
	heading={shownListing
		? t(`scripts.sourceLabel.${shownListing.row.source}`)
		: t('scripts.current.defaultName')}
	name={shownListing?.row.name ?? ''}
	{facts}
	entries={shownListing?.row.entries ?? []}
	{data}
	sheet={preview || previewPending ? playerSheet : undefined}
	extra={rows}
	{lead}
	{version}
>
	{#snippet actions()}
		<IconButton
			icon="quickPlay"
			label={t('scripts.details.play')}
			disabled={!preview || !shownSource || busy}
			onclick={() => void play()}
		/>
		<PrintScriptButton script={preview} version={shownVersion} />
		<ShareControl
			what="script"
			title={shownListing?.row.name || t('scripts.current.defaultName')}
			author={preview?.meta.author}
			version={shownVersion ?? preview?.meta.version}
			target={shareTarget}
		/>
		{@render extraActions?.()}
	{/snippet}
</ScriptDetails>

<style>
	.version-pick {
		display: block;
		width: 100%;
		max-width: 22rem;
	}
	.newer.none {
		visibility: hidden;
	}
	.loading {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		min-height: 12rem;
		margin: 0;
		color: var(--on-surface-muted);
	}
	.spin {
		display: inline-grid;
		font-size: 1.5rem;
		animation: spin 1s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.spin {
			animation-duration: 3s;
		}
	}
</style>
