<script lang="ts" module>
	import type { ScriptListing } from '#lib/features/scripts/script-providers.ts';
	import type { Shareable } from '#lib/features/scripts/share-codes.ts';

	export interface ScriptRow {
		key: string;
		listing: ScriptListing;
		shareable: Shareable;
	}
</script>

<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { account } from '#lib/features/account/account.svelte.ts';
	import { profileScripts } from '#lib/features/account/profile-scripts.svelte.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { loadScriptText, type GameData } from '#lib/core/data/index.ts';
	import {
		chooseScript,
		forgetScript,
		recentScripts
	} from '#lib/features/scripts/current-script.svelte.ts';
	import { fetchLinkTarget } from '#lib/features/scripts/fetch-script.ts';
	import { relaxJson } from '#lib/features/scripts/relaxed-json.ts';
	import { sameScript, type VariationOf } from '#lib/features/scripts/saved-scripts.ts';
	import { findSaved } from '#lib/features/scripts/script-providers.ts';
	import ScriptView from '#lib/features/scripts/ScriptView.svelte';
	import { shareTargetFor } from '#lib/features/scripts/share-codes.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import ItemPane from './ItemPane.svelte';
	import LabelRows from './LabelRows.svelte';
	import VariationChanges from './VariationChanges.svelte';

	/**
	 * A script in the Library's pane: Search's own script view (Trevor, 2026-10-17: "exact same
	 * info and style"), its controls in the header (Trevor, 2026-10-18), and the Library's
	 * folder and tags as rows of its main info.
	 */
	interface Props {
		open?: boolean;
		row: ScriptRow;
		data: GameData | undefined;
		inline: boolean;
	}

	let { open = $bindable(false), row, data, inline }: Props = $props();

	/**
	 * The version shown: the saved one, or another BotC Scripts version picked in the details
	 * (Trevor, 2026-10-17: a saved script still offers all its versions). Another version stays
	 * a preview until Save; the saved one stays in the Library either way.
	 */
	let viewed = $state.raw<ScriptListing>();
	// Another script opened: what was shown for the last one no longer applies.
	$effect.pre(() => {
		void row.key;
		viewed = undefined;
	});
	const viewingUnsaved = $derived(
		!!viewed && viewed.row.key !== row.listing.row.key && !findSaved(recentScripts.list, viewed)
	);
	let saving = $state(false);
	async function saveViewed() {
		const listing = viewed;
		if (!listing || listing.target.kind !== 'botcscripts') return;
		saving = true;
		try {
			const fetched = await fetchLinkTarget(listing.target, '');
			const loaded = loadScriptText(relaxJson(fetched.text), await loadOfficialData()).script;
			if (loaded) await chooseScript(loaded, fetched.source);
		} catch (e) {
			reportError(e, { area: 'library' });
		} finally {
			saving = false;
		}
	}

	/** The Script builder opens a saved script from its id in the hash (never sent to the server). */
	function editInBuilder(scriptId: string) {
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- the path is resolved; only the hash is added
		void goto(`${resolve('/build-script')}#edit=${encodeURIComponent(scriptId)}`);
	}

	/**
	 * A script edited from another one says so (Trevor, 2026-10-17), with what changed. The
	 * Script builder stores the original on the saved script's source as `variationOf`.
	 */
	const variation = $derived.by((): VariationOf | undefined => {
		const source = row.listing.saved?.source;
		const of = source?.kind === 'built' ? source.variationOf : undefined;
		return of && Array.isArray(of.json) ? of : undefined;
	});
	let changesOpen = $state(false);

	let removing = $state(false);
	async function remove() {
		const identity = row.listing.identity;
		const saved = row.listing.saved;
		open = false;
		try {
			if (saved) await forgetScript(saved.scriptId);
			if (account.user && identity) {
				for (const entry of profileScripts.list) {
					if (sameScript({ json: entry.script.json }, identity)) {
						await profileScripts.remove(entry);
					}
				}
			}
		} catch (e) {
			reportError(e, { area: 'library' });
		}
	}

	const shareable = $derived(row.shareable);
	// Any saved script opens in the Script builder (Trevor, 2026-10-17); a profile-only script
	// has no copy on this device yet, so Edit stays there but disabled.
	const editable = $derived(row.listing.saved);
</script>

<ItemPane bind:open title={row.listing.row.name || t('common.none')} {inline}>
	<!-- One place for Save and Remove, since only one ever applies (Trevor, 2026-10-18): Save
	     while another version is previewed, then Remove once what is shown is in the Library. -->
	{#snippet headActions()}
		{#if viewingUnsaved}
			<IconButton
				icon="save"
				label={t('scripts.picker.save')}
				disabled={saving}
				onclick={() => void saveViewed()}
			/>
		{:else}
			<DeleteButton label={t('library.remove')} onclick={() => (removing = true)} />
		{/if}
	{/snippet}
	{#key row.key}
		<ScriptView
			listing={row.listing}
			{data}
			share={row.listing.saved ? undefined : () => shareTargetFor(shareable, location.origin)}
			labels={labelRows}
			busy={saving}
			actionsInTop
			onshown={(listing) => (viewed = listing)}
		>
			{#snippet extraActions()}
				<IconButton
					icon="buildScript"
					label={t('library.edit')}
					disabled={!editable || viewingUnsaved}
					onclick={() => editable && editInBuilder(editable.scriptId)}
				/>
			{/snippet}
		</ScriptView>
	{/key}
</ItemPane>

{#snippet labelRows()}
	{#if variation}
		<dt class="term">{t('library.variationOf')}</dt>
		<dd class="value variation" data-testid="variation-of">
			<span>{variation.name || t('common.none')}</span>
			<Button icon="history" onclick={() => (changesOpen = true)}>{t('library.whatChanged')}</Button
			>
		</dd>
	{/if}
	<LabelRows itemKey={row.key} />
{/snippet}

<ConfirmDialog
	bind:open={removing}
	title={t('library.removeConfirm')}
	danger
	onConfirm={() => void remove()}
>
	<p>{t('library.removeBody', { name: row.listing.row.name || t('common.none') })}</p>
</ConfirmDialog>

{#if variation && row.listing.saved}
	<VariationChanges
		bind:open={changesOpen}
		original={variation.json}
		variation={row.listing.saved.json}
		{data}
	/>
{/if}

<style>
	.term {
		color: var(--on-surface-muted);
	}
	.value {
		margin: 0;
		min-width: 0;
	}
	.variation {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
</style>
