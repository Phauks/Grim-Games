<script lang="ts">
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';
	import { onMount } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import {
		loadScript,
		scriptToJson,
		sortByStandardOrder,
		type Character,
		type CharacterId,
		type GameData,
		type LoadedScript
	} from '#lib/core/data/index.ts';
	import { builtScriptJson, scriptFacts } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import CharacterPicker from '#lib/features/characters/CharacterPicker.svelte';
	import CharacterSearchBox from '#lib/features/characters/CharacterSearchBox.svelte';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import {
		chooseScript,
		currentScript,
		recentScripts,
		restoreScripts
	} from '#lib/features/scripts/current-script.svelte.ts';
	import {
		reloadSavedScript,
		sameScript,
		type SavedScript,
		type VariationOf
	} from '#lib/features/scripts/saved-scripts.ts';
	import { shareTargetFor } from '#lib/features/scripts/share-codes.ts';
	import ShareControl from '#lib/features/scripts/ShareControl.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Page from '#lib/ui/layout/Page.svelte';
	import BuilderSave from '#lib/ui/builder/BuilderSave.svelte';
	import { timestampName } from '#lib/core/timestamp-name.ts';
	import BuilderTools from '#lib/ui/builder/BuilderTools.svelte';
	import OpenSavedDialog from '#lib/ui/builder/OpenSavedDialog.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import { downloadJson, fileNameFor } from '#lib/ui/download.ts';
	import Select from '#lib/ui/primitives/Select.svelte';
	import { errorMessage } from '#lib/features/errors/app-error.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { TYPE_PLURALS } from '#lib/features/reference/labels.ts';
	import { savedCharacters } from '#lib/features/character-builder/stores.svelte.ts';
	import { scriptBuilderDraft as draft } from './draft.svelte.ts';
	import { chosenHomebrew, isEmptyDraft } from './draft.ts';
	import { replaceBuilt } from './replace-saved.svelte.ts';
	import type { HomebrewCollection } from './homebrew-wiki-api.ts';
	import {
		homebrewCollection,
		homebrewCollections,
		homebrewFromScript,
		type HomebrewSet
	} from './homebrew-wiki.ts';

	/**
	 * Build a script (Trevor, 2026-10-16): name and author, characters by type with their
	 * ability text, and the script check as it grows. Characters come from TPI or from a BotC
	 * Homebrew Wiki collection (2026-10-17), credited to their creators. Save puts it in the
	 * same saved scripts the Scripts page and New game use.
	 */

	const TYPES = [
		'townsfolk',
		'outsider',
		'minion',
		'demon',
		'traveller',
		'fabled',
		'loric'
	] as const;

	let data = $state.raw<GameData>();
	let query = $state('');
	let saving = $state(false);
	let clearOpen = $state(false);
	let openOpen = $state(false);
	let replacing = $state.raw<SavedScript>();
	let replaceOpen = $state(false);

	/**
	 * Where the list's characters come from. 'script' is every character already on the script,
	 * whichever source it came from (Trevor, 2026-10-17), so characters from several collections
	 * or opened scripts are all in one place without switching collection.
	 */
	type Source = 'official' | 'homebrew' | 'mine' | 'script';
	let source = $state<Source>('official');
	let collections = $state.raw<HomebrewCollection[]>([]);
	let collectionId = $state('');
	let homebrewSet = $state.raw<HomebrewSet>();
	let homebrewError = $state('');

	async function showHomebrew() {
		source = 'homebrew';
		if (collections.length) return;
		try {
			collections = await homebrewCollections();
			homebrewError = '';
			if (!collectionId && collections[0]) await pickCollection(collections[0].id);
		} catch (e) {
			homebrewError = errorMessage(e);
		}
	}

	async function pickCollection(id: string) {
		collectionId = id;
		homebrewSet = undefined;
		try {
			// Homebrew can be chosen before the official characters have loaded; wait for them
			// rather than leave the collection empty.
			const set = await homebrewCollection(id, data ?? (await loadOfficialData()));
			if (collectionId === id) homebrewSet = set;
			homebrewError = '';
		} catch (e) {
			if (collectionId === id) homebrewError = errorMessage(e);
		}
	}

	/**
	 * `/build-script#edit=<scriptId>` opens that saved script here (the hash never reaches the
	 * server), e.g. from the Library. Cleared once read.
	 */
	function openFromHash() {
		const id = new URLSearchParams(location.hash.slice(1)).get('edit');
		if (!id) return;
		history.replaceState(history.state, '', location.pathname);
		// Already on the builder (perhaps with changes not saved yet): carry on with it.
		if (id === draft.current.editing) return;
		const saved = recentScripts.list.find((s) => s.scriptId === id);
		if (saved) chooseSaved(saved);
	}

	onMount(() => {
		void Promise.all([loadOfficialData(), restoreScripts()])
			.then(([d]) => {
				data = d;
				openFromHash();
			})
			.catch((e) => reportError(e, { area: 'script-builder' }));
	});

	const d = $derived(draft.current);
	/** Every official character, listed in TPI's Sort Order like the saved script. */
	const official = $derived(data ? sortByStandardOrder(data.characters) : []);
	const json = $derived(data ? builtScriptJson(d.ids, d, data, chosenHomebrew(d)) : undefined);
	/** The script as it would be saved; undefined until a character is chosen. */
	const built = $derived.by((): LoadedScript | undefined => {
		if (!data || !json || d.ids.length === 0) return undefined;
		return loadScript(json, data).script;
	});
	const builtJson = $derived(built ? scriptToJson(built) : undefined);
	const facts = $derived(
		data && built ? scriptFacts(built.characters, data.jinxes, built.homebrewJinxes) : undefined
	);
	/** The script's own characters, so homebrew ones show as badges too. */
	const onScript = $derived(new Map(built?.characters.map((c) => [c.id, c])));
	const chosenHomebrewCharacters = $derived(
		built?.characters.filter((c) => built.homebrew.includes(c.id)) ?? []
	);
	/** Characters made in the Character builder on this device (Trevor, 2026-10-17). */
	const mine = $derived.by(() => {
		if (!data || savedCharacters.list.length === 0) return { characters: [], entries: {} };
		return homebrewFromScript(
			[{ id: '_meta', name: '' }, ...savedCharacters.list.map((c) => c.entry)],
			data
		);
	});
	const characters = $derived(
		source === 'homebrew'
			? sortByStandardOrder(homebrewSet?.characters ?? [])
			: source === 'mine'
				? sortByStandardOrder(mine.characters)
				: source === 'script'
					? sortByStandardOrder(built?.characters ?? [])
					: official
	);

	function choose(id: CharacterId) {
		const entry =
			source === 'homebrew'
				? homebrewSet?.entries[id]
				: source === 'mine'
					? mine.entries[id]
					: undefined;
		if (entry && !d.ids.includes(id)) {
			draft.toggle(id, { entry, credit: homebrewSet?.credits[id] });
		} else draft.toggle(id);
	}

	function creatorOf(character: Character): string | undefined {
		const creator =
			source === 'script'
				? d.credits[character.id]?.creator
				: homebrewSet?.credits[character.id]?.creator;
		if (creator) return t('script-builder.by', { creator });
		// On the script, a homebrew character with no known creator still says it is homebrew.
		if (source === 'script' && built?.homebrew.includes(character.id)) {
			return t('script-builder.source.homebrew');
		}
		return undefined;
	}
	const counts = $derived(facts?.counts);
	const savedRecord = $derived(recentScripts.list.find((s) => s.scriptId === d.editing));
	const isSaved = $derived(
		!!savedRecord && !!builtJson && sameScript(savedRecord, { json: builtJson })
	);
	const missingNeeds = $derived(facts?.requirements.filter((r) => !r.onScript) ?? []);

	/** Saves over the script being edited, or as a new script when `asNew` (the old one stays). */
	async function save(asNew = false) {
		if (!built || saving) return;
		// Nothing is saved without a name (Trevor, 2026-10-18): a timestamp, kept in the draft.
		if (!d.name.trim()) draft.setName(timestampName());
		saving = true;
		try {
			const editing = asNew ? undefined : savedRecord;
			// A copy of a saved built script is a variation of it as it was saved. Snapshots, as
			// storage takes plain objects and these are reactive state.
			const variationOf: VariationOf | undefined = $state.snapshot(
				asNew && savedRecord
					? { name: savedRecord.name, source: { kind: 'built' }, json: savedRecord.json }
					: d.variationOf
			);
			if (!built) return;
			await chooseScript(built, { kind: 'built', ...(variationOf ? { variationOf } : {}) });
			const saved = currentScript.saved;
			if (!saved || saved.scriptId === 'unsaved') {
				toast(t('script-builder.saveFailed'));
				return;
			}
			// A script made here is replaced by its new version; one opened from elsewhere is kept.
			if (editing && editing.scriptId !== saved.scriptId && editing.source.kind === 'built') {
				await replaceBuilt(editing, saved);
			}
			draft.setEditing(saved.scriptId, variationOf);
		} catch (e) {
			reportError(e, { area: 'script-builder' });
		} finally {
			saving = false;
		}
	}

	function download() {
		if (builtJson) downloadJson(fileNameFor(d.name, 'script'), builtJson);
	}

	const shareTarget = $derived.by(() => {
		const out = builtJson;
		return out
			? () => shareTargetFor({ json: out, source: { kind: 'built' } }, location.origin)
			: undefined;
	});

	function chooseSaved(saved: SavedScript) {
		openOpen = false;
		if (isEmptyDraft(d)) openSaved(saved);
		else {
			replacing = saved;
			replaceOpen = true;
		}
	}

	/** Puts a saved script on the builder, homebrew characters included. */
	function openSaved(saved: SavedScript) {
		if (!data) return;
		const script = reloadSavedScript(saved, data);
		if (!script) return;
		const kept = draft.current.credits;
		const json = scriptToJson(script);
		const { entries } = homebrewFromScript(json, data);
		// Editing a script made elsewhere makes a variation of it; a built one keeps its own.
		const variationOf: VariationOf | undefined =
			saved.source.kind === 'built'
				? saved.source.variationOf
				: { name: script.name, source: $state.snapshot(saved.source), json };
		draft.replace({
			version: 3,
			name: script.name,
			author: script.meta.author ?? '',
			ids: script.characters.map((c) => c.id),
			homebrew: entries,
			// Credits aren't part of a script; keep the ones this device already knows.
			credits: Object.fromEntries(Object.entries(kept).filter(([id]) => id in entries)),
			...(saved.source.kind === 'built' ? { editing: saved.scriptId } : {}),
			...(variationOf ? { variationOf } : {})
		});
	}
</script>

<svelte:window onhashchange={openFromHash} />

<Page title={t('script-builder.heading')}>
	{#snippet actions()}
		<BuilderTools
			openLabel={t('script-builder.open')}
			openDisabled={!data || recentScripts.list.length === 0}
			onOpen={() => (openOpen = true)}
			downloadLabel={t('script-builder.download')}
			downloadDisabled={!builtJson}
			onDownload={download}
			clearLabel={t('script-builder.clear')}
			clearDisabled={isEmptyDraft(d)}
			onClear={() => (clearOpen = true)}
		>
			<ShareControl what="script" title={d.name || t('common.none')} target={shareTarget} />
		</BuilderTools>
	{/snippet}

	{#snippet side()}
		<ErrorBoundary area="script-builder">
			<section class="details" aria-label={t('script-builder.details')}>
				<TextField
					label={t('script-builder.name')}
					value={d.name}
					oninput={(v) => draft.setName(v)}
				/>
				<TextField
					label={t('script-builder.author')}
					value={d.author}
					oninput={(v) => draft.setAuthor(v)}
				/>
				<!-- Always shown, so opening a script never moves the page. -->
				<p class="variation" data-testid="variation-of">
					<span>{t('script-builder.variationOf')}</span>
					{d.variationOf?.name || t('common.none')}
				</p>
				<BuilderSave
					ready={!!built}
					saved={isSaved}
					editing={!!savedRecord}
					busy={saving}
					onSave={() => save()}
					onSaveNew={() => save(true)}
				/>
			</section>

			<div class="source">
				<Select
					label={t('script-builder.source')}
					hideLabel
					value={source}
					options={[
						{ value: 'official', label: t('script-builder.source.official') },
						{ value: 'homebrew', label: t('script-builder.source.homebrew') },
						{ value: 'mine', label: t('script-builder.source.mine') },
						{ value: 'script', label: t('script-builder.source.script') }
					]}
					onChange={(value) => (value === 'homebrew' ? void showHomebrew() : (source = value))}
				/>
				<!-- Always in place, so switching source never moves the page. -->
				<div class="collection" data-disabled={source !== 'homebrew' ? '' : undefined}>
					<Select
						label={t('script-builder.collection')}
						hideLabel
						value={collectionId}
						options={collections.length
							? collections.map((c) => ({ value: c.id, label: c.name }))
							: [{ value: '', label: t('common.none') }]}
						onChange={(id) => id && void pickCollection(id)}
					/>
				</div>
			</div>
			<p class="source-error" role="status" data-testid="homebrew-error">
				{source === 'homebrew' ? homebrewError : ''}
			</p>
			<section class="check" aria-label={t('script-builder.check')} data-testid="builder-check">
				<Collapsible
					title={t('script-builder.jinxes')}
					level={3}
					storageKey="script-builder:jinxes"
					empty={!facts?.jinxes.length}
				>
					{#snippet aside()}<CountBadge
							count={facts?.jinxes.length ?? 0}
							testid="jinx-count"
						/>{/snippet}
					{#if facts?.jinxes.length}
						<ul>
							{#each facts.jinxes as jinx (jinx.characters.join('+'))}
								<li>
									<CharacterBadge
										characterId={jinx.characters[0]}
										character={onScript.get(jinx.characters[0])}
										inline
									/>
									{t('script-builder.and')}
									<CharacterBadge
										characterId={jinx.characters[1]}
										character={onScript.get(jinx.characters[1])}
										inline
									/>: {jinx.reason}
								</li>
							{/each}
						</ul>
					{:else}<p>{t('common.none')}</p>{/if}
				</Collapsible>
				<Collapsible
					title={t('script-builder.setupChanges')}
					level={3}
					storageKey="script-builder:setup"
					empty={!facts?.modifiers.length}
				>
					{#snippet aside()}<CountBadge count={facts?.modifiers.length ?? 0} />{/snippet}
					{#if facts?.modifiers.length}
						<ul>
							{#each facts.modifiers as modifier (modifier.id)}
								<li>
									<CharacterBadge
										characterId={modifier.id}
										character={onScript.get(modifier.id)}
										inline
									/>
									{modifier.summary}
								</li>
							{/each}
						</ul>
					{:else}<p>{t('common.none')}</p>{/if}
				</Collapsible>
				<Collapsible
					title={t('script-builder.needs')}
					level={3}
					storageKey="script-builder:needs"
					empty={!missingNeeds.length}
				>
					{#snippet aside()}<CountBadge
							count={missingNeeds.length}
							warn={missingNeeds.length > 0}
						/>{/snippet}
					{#if missingNeeds.length}
						<ul>
							{#each missingNeeds as need (need.id)}
								<li>
									<CharacterBadge characterId={need.id} character={onScript.get(need.id)} inline />
									{t('script-builder.needsChar')}
									<CharacterBadge characterId={need.requires} inline />
									<Button variant="quiet" onclick={() => draft.toggle(need.requires)}
										>{t('script-builder.add')}</Button
									>
								</li>
							{/each}
						</ul>
					{:else}<p>{t('common.none')}</p>{/if}
				</Collapsible>
				<Collapsible
					title={t('script-builder.homebrew')}
					level={3}
					storageKey="script-builder:homebrew"
					empty={!chosenHomebrewCharacters.length}
				>
					{#snippet aside()}<CountBadge
							count={chosenHomebrewCharacters.length}
							testid="homebrew-count"
						/>{/snippet}
					{#if chosenHomebrewCharacters.length}
						<ul class="credits">
							{#each chosenHomebrewCharacters as character (character.id)}
								{@const credit = d.credits[character.id]}
								<li>
									<CharacterBadge characterId={character.id} {character} inline />
									<span class="creator">{credit?.creator || t('common.none')}</span>
									{#if credit?.url}
										<!-- eslint-disable svelte/no-navigation-without-resolve -->
										<a
											class="wiki"
											href={credit.url}
											target="_blank"
											rel="noopener noreferrer"
											aria-label={t('script-builder.wikiPage', { name: character.name })}
											title={t('script-builder.wikiPage', { name: character.name })}
											><Icon name="wiki" /></a
										>
										<!-- eslint-enable svelte/no-navigation-without-resolve -->
									{/if}
								</li>
							{/each}
						</ul>
					{:else}<p>{t('common.none')}</p>{/if}
				</Collapsible>
			</section>
		</ErrorBoundary>
	{/snippet}

	<ErrorBoundary area="script-builder">
		<!-- The counts and search stay in view while the list scrolls. -->
		<div class="list">
			<div class="counts">
				<ul class="types" aria-label={t('script-builder.counts')} data-testid="builder-counts">
					{#each TYPES as type (type)}
						<li data-type={type}>
							<span class="label">{TYPE_PLURALS[type]}</span>
							<span class="n" data-testid="count-{type}">{counts?.[type] ?? 0}</span>
						</li>
					{/each}
				</ul>
				<CharacterSearchBox bind:query shortcut />
			</div>
			<CharacterPicker
				{characters}
				mode="multi"
				selected={d.ids}
				bind:query
				showSearch={false}
				collapsibleKey="script-builder"
				surface="page"
				contained={false}
				types={TYPES}
				marker={source === 'official' ? undefined : creatorOf}
				onSelect={choose}
			/>
		</div>
	</ErrorBoundary>
</Page>

<OpenSavedDialog
	bind:open={openOpen}
	title={t('script-builder.openTitle')}
	items={recentScripts.list}
	key={(saved) => saved.scriptId}
	onChoose={chooseSaved}
	testid="builder-saved-list"
>
	{#snippet row(saved)}{saved.name || t('common.none')}{/snippet}
</OpenSavedDialog>

<ConfirmDialog
	bind:open={replaceOpen}
	title={t('script-builder.openReplace', { name: replacing?.name || t('common.none') })}
	danger
	onConfirm={() => replacing && openSaved(replacing)}
>
	<p>{t('script-builder.openReplaceBody')}</p>
</ConfirmDialog>

<ConfirmDialog
	bind:open={clearOpen}
	title={t('script-builder.clearTitle')}
	danger
	onConfirm={() => draft.clear()}
>
	<p>{t('script-builder.clearBody')}</p>
</ConfirmDialog>

<style>
	.details {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-2);
	}
	.variation {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: 0;
		overflow-wrap: anywhere;
	}
	.variation span {
		color: var(--on-surface-muted);
	}
	.list {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
	}
	/* The counts and search stay in view, just below the sticky app header, while the list scrolls. */
	.counts {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-2);
		position: sticky;
		top: calc(var(--tap-target) + env(safe-area-inset-top));
		z-index: var(--z-raised);
		padding: var(--space-2) 0;
		background: var(--page-background, var(--surface));
	}
	/* Compact, so the counts and search stay a short bar while the list scrolls under. */
	.types {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 0.85rem;
	}
	.types li {
		display: flex;
		align-items: baseline;
		gap: var(--space-1);
		padding: 0 var(--space-2);
		border-radius: var(--radius-full);
		background: var(--surface-raised);
	}
	.types .label {
		color: var(--on-surface-muted);
	}
	.types .n {
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	/* Sources on one row, the collection under them, so three choices fit a phone. */
	.source {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-2);
	}
	.collection[data-disabled] {
		opacity: 0.5;
		pointer-events: none;
	}
	.source-error {
		margin: 0;
		min-height: 1.4em;
		color: var(--evil);
		font-size: 0.85rem;
	}
	.credits {
		padding: 0;
		list-style: none;
	}
	.credits li {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-2);
	}
	.creator {
		color: var(--on-surface-muted);
		overflow-wrap: anywhere;
	}
	.wiki {
		display: grid;
		place-items: center;
		width: var(--tap-target);
		height: var(--tap-target);
		color: inherit;
	}
	.check {
		display: grid;
		gap: var(--space-1);
		padding: var(--space-1) var(--space-3) var(--space-3);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		font-size: 0.9rem;
	}
	.check p,
	.check ul {
		margin: 0;
	}
	.check ul {
		display: grid;
		gap: var(--space-2);
		padding-inline-start: 1.2em;
	}
</style>
