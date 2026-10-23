<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { loadScript, OFFICIAL_EDITIONS } from '#lib/core/data/index.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import LibraryBrowser, { type LibraryPick } from '#lib/features/library/LibraryBrowser.svelte';
	import PreviewToggle from '#lib/features/library/PreviewToggle.svelte';
	import ScriptByline from '#lib/features/player/ScriptByline.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import Spinner from '#lib/ui/primitives/Spinner.svelte';
	import { chooseScript, currentScript } from '#lib/features/scripts/current-script.svelte.ts';
	import {
		describeSource,
		reloadSavedScript,
		sourcePage
	} from '#lib/features/scripts/saved-scripts.ts';
	import { botcVersions } from '#lib/features/scripts/botc-versions.svelte.ts';
	import { compareVersions } from '#lib/features/scripts/botcscripts-api.ts';
	import { fetchLinkTarget } from '#lib/features/scripts/fetch-script.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ChoiceGroup from '#lib/ui/primitives/ChoiceGroup.svelte';
	import Combobox from '#lib/ui/primitives/Combobox.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { searchableScripts, type ScriptChoice } from './script-choices.svelte.ts';
	import { scriptVersions } from './script-versions.ts';

	/**
	 * Choosing the script on New game with any number of scripts (Trevor, 2026-10-19, mockup
	 * "Script picker"): the base three stay one tap away, every other script is found by
	 * typing its name or author, and the Library button opens the Library to pick from.
	 * Choosing one kind of script unselects the other. The search and the Library button are
	 * for Custom, beside the base three; tapping either chooses Custom (Trevor, backlog L6),
	 * so they are never disabled. Under them, on a line kept in place, the
	 * chosen script's versions are a drop-down (empty when it has none) beside its author
	 * (Trevor, 2026-10-19).
	 */
	interface Props {
		label: string;
		/** Hide the label visually, under a section header that already names it. */
		hideLabel?: boolean;
		value: ScriptChoice;
		onChange: (value: ScriptChoice) => void;
	}

	let { label, hideLabel, value, onChange }: Props = $props();

	const CUSTOM = '__custom__';
	const editions = OFFICIAL_EDITIONS.map((e) => ({ value: e.id as ScriptChoice, label: e.name }));
	const isEdition = (v: ScriptChoice) => editions.some((e) => e.value === v);
	const choices = $derived([...editions, { value: CUSTOM, label: t('modes.scriptSearch.custom') }]);
	// Custom until a base script is picked; a custom script chosen elsewhere (Play on Search) is Custom.
	let customPicked = $state(false);
	const custom = $derived(customPicked || !isEdition(value));

	function choose(next: ScriptChoice) {
		if (next !== CUSTOM) {
			customPicked = false;
			return onChange(next);
		}
		customPicked = true;
		// The most recent custom script, if there is one, so Start game plays what is shown.
		const first = others[0];
		if (first) onChange(first.value);
	}
	const others = $derived(searchableScripts());
	const GROUP = {
		recent: 'modes.scriptSearch.recent',
		library: 'modes.scriptSearch.library'
	} as const;
	const options = $derived(
		others.map((o) => ({
			value: o.value,
			label: o.label,
			...(o.author || o.version
				? {
						description: [
							o.author ? t('player.byAuthor', { author: o.author }) : undefined,
							o.version ? t('player.version', { version: o.version }) : undefined
						]
							.filter(Boolean)
							.join(' · ')
					}
				: {}),
			...(o.group ? { group: t(GROUP[o.group]) } : {})
		}))
	);
	const chosen = $derived(others.find((o) => o.value === value));
	const versioned = $derived(scriptVersions(others, chosen));
	// Every version BotC Scripts publishes for a script saved from there, not only the saved
	// ones (Trevor, backlog L14: "a script with multiple versions shows only the saved
	// version"). A version not saved yet is loaded from BotC Scripts when picked.
	const botc = $derived(chosen?.source?.kind === 'botcscripts' ? chosen.source : undefined);
	$effect(() => {
		const id = botc?.scriptId;
		if (id !== undefined) untrack(() => void botcVersions.load(id));
	});
	const ONLINE = 'botc-version:';
	const online = $derived(
		botc
			? (botcVersions.get(botc.scriptId)?.versions ?? []).filter(
					(v) => !versioned.some((o) => o.version === v)
				)
			: []
	);
	const versions = $derived(
		[
			...versioned.map((o) => ({ value: o.value, version: o.version ?? '' })),
			...online.map((v) => ({ value: `${ONLINE}${v}`, version: v }))
		]
			.sort((a, b) => compareVersions(b.version, a.version))
			.map((o) => ({ value: o.value, label: t('player.version', { version: o.version }) }))
	);
	// A copy of a listed version shows as that version.
	const listedVersion = $derived(versioned.find((o) => o.version === chosen?.version)?.value);
	// A custom script without a version says N/A (Trevor, 2026-10-19), not "None".
	const NO_VERSION = '__no-version__';
	const noVersion = $derived(custom && chosen !== undefined && versions.length === 0);
	const versionOptions = $derived(
		noVersion ? [{ value: NO_VERSION, label: t('modes.scriptSearch.noVersion') }] : versions
	);
	const versionValue = $derived(noVersion ? NO_VERSION : listedVersion);
	/** A version from BotC Scripts is being fetched: the drop-down waits, with a spinner. */
	let loadingVersion = $state(false);
	async function chooseVersion(next: string) {
		if (next === NO_VERSION) return;
		if (!next.startsWith(ONLINE) || !botc) return onChange(next);
		const version = next.slice(ONLINE.length);
		loadingVersion = true;
		try {
			const fetched = await fetchLinkTarget(
				{ kind: 'botcscripts', ref: { kind: 'script', scriptId: botc.scriptId, version } },
				''
			);
			const script = loadScript(JSON.parse(fetched.text), await loadOfficialData()).script;
			if (!script) throw new Error(`version ${version} could not be loaded`);
			await chooseScript(script, fetched.source);
			const saved = currentScript.saved;
			if (saved) onChange(`recent:${saved.scriptId}`);
		} catch (e) {
			reportError(e, { area: 'scripts' });
		} finally {
			loadingVersion = false;
		}
	}
	// The chosen script's source page opens from here (Trevor, 2026-10-22). Kept in place,
	// disabled, when there is none; then its label names the source, such as the file name.
	const shownSource = $derived(custom ? chosen?.source : undefined);
	const sourceHref = $derived(shownSource && sourcePage(shownSource));
	const sourceLabel = $derived(
		sourceHref
			? t('modes.scriptSearch.openSource')
			: shownSource
				? t('modes.scriptSearch.sourceNoPage', { source: describeSource(shownSource) })
				: t('modes.scriptSearch.openSource')
	);
	/** Tapping Custom's search or Library button chooses Custom first. */
	function toCustom() {
		if (!custom) choose(CUSTOM);
	}
	let browsing = $state(false);
	let libraryBrowser = $state<LibraryBrowser>();

	/** A script picked in the Library becomes a recent one, so New game can load it again. */
	async function picked(pick: LibraryPick) {
		if (pick.kind !== 'script') return;
		browsing = false;
		const { listing, shareable } = pick.script;
		if (listing.saved) return onChange(`recent:${listing.saved.scriptId}`);
		try {
			const script = reloadSavedScript(shareable, await loadOfficialData());
			if (!script) throw new Error('the picked script could not be loaded');
			await chooseScript(script, shareable.source);
			const saved = currentScript.saved;
			if (saved) onChange(`recent:${saved.scriptId}`);
		} catch (e) {
			reportError(e, { area: 'scripts' });
		}
	}
</script>

<div class="picker">
	<ChoiceGroup
		{label}
		{hideLabel}
		value={custom ? CUSTOM : value}
		options={choices}
		onChange={choose}
	/>
	<div class="search" onpointerdown={toCustom} onfocusin={toCustom}>
		<Combobox
			label={t('modes.scriptSearch.label')}
			hideLabel
			value={options.some((o) => o.value === value) ? value : undefined}
			{options}
			{onChange}
			placeholder={t('modes.scriptSearch.placeholder')}
			empty={t('modes.scriptSearch.none')}
			action={() => ({
				value: '__online__',
				label: t('modes.scriptSearch.online'),
				run: () => void goto(resolve('/scripts'))
			})}
			testid="script-search"
		/>
		<IconButton
			icon="library"
			label={t('modes.scriptSearch.browse')}
			onclick={() => (browsing = true)}
		/>
	</div>
	<div class="chosen" data-testid="chosen-script">
		<span class="version">
			<Select
				label={t('modes.scriptSearch.version')}
				hideLabel
				value={versionValue}
				options={versionOptions}
				onChange={(v) => void chooseVersion(v)}
				disabled={!custom || versions.length < 2 || loadingVersion}
			/>
			<!-- Over the drop-down's own caret, so nothing moves while it loads. -->
			{#if loadingVersion}<span class="version-loading"
					><Spinner label={t('modes.scriptSearch.loadingVersion')} testid="version-loading" /></span
				>{/if}
		</span>
		<ScriptByline author={chosen?.author} inline />
		<span class="source">
			{#if sourceHref}
				<IconButton
					icon="openInNewTab"
					label={sourceLabel}
					href={sourceHref}
					rel="noopener noreferrer"
				/>
			{:else}
				<IconButton icon="openInNewTab" label={sourceLabel} disabled />
			{/if}
		</span>
	</div>
</div>

<!-- The Library's own file manager, scripts only, as the Script builder opens it. -->
<Dialog bind:open={browsing} title={t('modes.scriptSearch.browse')} size="max">
	{#snippet headActions()}<PreviewToggle browser={libraryBrowser} />{/snippet}
	<div class="library">
		<LibraryBrowser
			bind:this={libraryBrowser}
			kind="script"
			pickLabel={t('modes.scriptSearch.pick')}
			onpick={(pick) => void picked(pick)}
		/>
	</div>
</Dialog>

<style>
	.picker {
		display: grid;
		gap: var(--space-2);
		min-width: 0;
	}
	.search {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		min-width: 0;
	}
	.search > :global(:first-child) {
		flex: 1;
		min-width: 0;
	}
	.chosen {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
	}
	.version {
		position: relative;
		flex: 0 0 auto;
		width: calc(9 * var(--u));
	}
	.version-loading {
		position: absolute;
		inset-block: 0;
		right: var(--space-2);
		display: grid;
		place-items: center;
		padding-inline: var(--space-1);
		background: var(--choice-background);
		font-size: 1.25rem;
		pointer-events: none;
	}
	.source {
		margin-inline-start: auto;
	}
	.library {
		display: grid;
		min-height: 0;
	}
</style>
