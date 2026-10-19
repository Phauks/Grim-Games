<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { OFFICIAL_EDITIONS } from '#lib/core/data/index.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import LibraryBrowser, { type LibraryPick } from '#lib/features/library/LibraryBrowser.svelte';
	import PreviewToggle from '#lib/features/library/PreviewToggle.svelte';
	import ScriptByline from '#lib/features/player/ScriptByline.svelte';
	import { chooseScript, currentScript } from '#lib/features/scripts/current-script.svelte.ts';
	import { reloadSavedScript } from '#lib/features/scripts/saved-scripts.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ChoiceGroup from '#lib/ui/primitives/ChoiceGroup.svelte';
	import Combobox from '#lib/ui/primitives/Combobox.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { searchableScripts, type ScriptChoice } from './script-choices.svelte.ts';

	/**
	 * Choosing the script on New game with any number of scripts (Trevor, 2026-10-19, mockup
	 * "Script picker"): the base three stay one tap away, every other script is found by
	 * typing its name or author, and the Library button opens the Library to pick from.
	 * Choosing one kind of script unselects the other. The chosen script's author and version
	 * show under it (Trevor, 2026-10-19), on a line kept in place so nothing moves.
	 */
	interface Props {
		label: string;
		value: ScriptChoice;
		onChange: (value: ScriptChoice) => void;
	}

	let { label, value, onChange }: Props = $props();

	const editions = OFFICIAL_EDITIONS.map((e) => ({ value: e.id as ScriptChoice, label: e.name }));
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
	<ChoiceGroup {label} {value} options={editions} {onChange} />
	<div class="search">
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
	<p class="chosen" data-testid="chosen-script">
		<ScriptByline author={chosen?.author} version={chosen?.version} inline />
	</p>
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
		margin: 0;
		min-height: 1.5em;
	}
	.library {
		display: grid;
		min-height: 0;
	}
</style>
