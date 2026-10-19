<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { OFFICIAL_EDITIONS } from '#lib/core/data/index.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import LibraryBrowser, { type LibraryPick } from '#lib/features/library/LibraryBrowser.svelte';
	import PreviewToggle from '#lib/features/library/PreviewToggle.svelte';
	import ScriptByline from '#lib/features/player/ScriptByline.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import { chooseScript, currentScript } from '#lib/features/scripts/current-script.svelte.ts';
	import { reloadSavedScript } from '#lib/features/scripts/saved-scripts.ts';
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
	 * for Custom, beside the base three, and stay disabled in place until it is chosen
	 * (Trevor, 2026-10-19), so nothing moves. Under them, on a line kept in place, the
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
	const versions = $derived(
		versioned.map((o) => ({
			value: o.value,
			label: t('player.version', { version: o.version ?? '' })
		}))
	);
	// A copy of a listed version shows as that version.
	const versionValue = $derived(versioned.find((o) => o.version === chosen?.version)?.value);
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
	<div class="search">
		<Combobox
			label={t('modes.scriptSearch.label')}
			hideLabel
			value={options.some((o) => o.value === value) ? value : undefined}
			{options}
			{onChange}
			disabled={!custom}
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
			disabled={!custom}
			onclick={() => (browsing = true)}
		/>
	</div>
	<div class="chosen" data-testid="chosen-script">
		<span class="version">
			<Select
				label={t('modes.scriptSearch.version')}
				hideLabel
				value={versionValue}
				options={versions}
				{onChange}
				disabled={!custom || versions.length < 2}
			/>
		</span>
		<ScriptByline author={chosen?.author} inline />
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
		flex: 0 0 auto;
		width: calc(9 * var(--u));
	}
	.library {
		display: grid;
		min-height: 0;
	}
</style>
