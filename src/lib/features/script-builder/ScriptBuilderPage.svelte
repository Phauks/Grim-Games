<script lang="ts">
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
		forgetScript,
		recentScripts,
		restoreScripts
	} from '#lib/features/scripts/current-script.svelte.ts';
	import {
		reloadSavedScript,
		sameScript,
		type SavedScript
	} from '#lib/features/scripts/saved-scripts.ts';
	import { shareTargetFor } from '#lib/features/scripts/share-codes.ts';
	import ShareControl from '#lib/features/scripts/ShareControl.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Segmented from '#lib/ui/primitives/Segmented.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import { errorMessage } from '#lib/features/errors/app-error.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { TYPE_PLURALS } from '#lib/features/reference/labels.ts';
	import { scriptBuilderDraft as draft } from './draft.svelte.ts';
	import { chosenHomebrew, isEmptyDraft } from './draft.ts';
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

	type Source = 'official' | 'homebrew';
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
		if (!data) return;
		try {
			const set = await homebrewCollection(id, data);
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
	const characters = $derived(
		source === 'homebrew' ? sortByStandardOrder(homebrewSet?.characters ?? []) : official
	);
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

	function choose(id: CharacterId) {
		const entry = source === 'homebrew' ? homebrewSet?.entries[id] : undefined;
		if (entry && !d.ids.includes(id)) {
			draft.toggle(id, { entry, credit: homebrewSet?.credits[id] });
		} else draft.toggle(id);
	}

	function creatorOf(character: Character): string | undefined {
		const creator = homebrewSet?.credits[character.id]?.creator;
		return creator ? t('script-builder.by', { creator }) : undefined;
	}
	const counts = $derived(facts?.counts);
	const savedRecord = $derived(recentScripts.list.find((s) => s.scriptId === d.editing));
	const isSaved = $derived(
		!!savedRecord && !!builtJson && sameScript(savedRecord, { json: builtJson })
	);
	const missingNeeds = $derived(facts?.requirements.filter((r) => !r.onScript) ?? []);

	async function save() {
		if (!built || saving) return;
		saving = true;
		try {
			const editing = savedRecord;
			await chooseScript(built, { kind: 'built' });
			const saved = currentScript.saved;
			if (!saved || saved.scriptId === 'unsaved') {
				toast(t('script-builder.saveFailed'));
				return;
			}
			// A script made here is replaced by its new version; one opened from elsewhere is kept.
			if (editing && editing.scriptId !== saved.scriptId && editing.source.kind === 'built') {
				await forgetScript(editing.scriptId);
			}
			draft.setEditing(saved.scriptId);
		} catch (e) {
			reportError(e, { area: 'script-builder' });
		} finally {
			saving = false;
		}
	}

	function download() {
		if (!builtJson) return;
		const blob = new Blob([JSON.stringify(builtJson, null, '\t')], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		const base = d.name
			.trim()
			.toLowerCase()
			.replace(/[^\p{L}\p{N}]+/gu, '-')
			.replace(/^-|-$/g, '');
		a.download = `${base || 'script'}.json`;
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
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
		const { entries } = homebrewFromScript(scriptToJson(script), data);
		draft.replace({
			version: 2,
			name: script.name,
			author: script.meta.author ?? '',
			ids: script.characters.map((c) => c.id),
			homebrew: entries,
			// Credits aren't part of a script; keep the ones this device already knows.
			credits: Object.fromEntries(Object.entries(kept).filter(([id]) => id in entries)),
			...(saved.source.kind === 'built' ? { editing: saved.scriptId } : {})
		});
	}
</script>

<svelte:window onhashchange={openFromHash} />

<main>
	<header class="title">
		<h1>{t('script-builder.heading')}</h1>
		<div class="tools">
			<IconButton
				icon="open"
				label={t('script-builder.open')}
				disabled={!data || recentScripts.list.length === 0}
				onclick={() => (openOpen = true)}
			/>
			<IconButton
				icon="download"
				label={t('script-builder.download')}
				disabled={!builtJson}
				onclick={download}
			/>
			<ShareControl what="script" title={d.name || t('common.none')} target={shareTarget} />
			<IconButton
				icon="remove"
				class="icon-button danger"
				label={t('script-builder.clear')}
				disabled={isEmptyDraft(d)}
				onclick={() => (clearOpen = true)}
			/>
		</div>
	</header>

	<ErrorBoundary area="script-builder">
		<div class="layout">
			<div class="side">
				<section class="details" aria-label={t('script-builder.details')}>
					<label>
						<span>{t('script-builder.name')}</span>
						<input
							value={d.name}
							autocomplete="off"
							enterkeyhint="done"
							oninput={(e) => draft.setName(e.currentTarget.value)}
							onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
						/>
					</label>
					<label>
						<span>{t('script-builder.author')}</span>
						<input
							value={d.author}
							autocomplete="off"
							enterkeyhint="done"
							oninput={(e) => draft.setAuthor(e.currentTarget.value)}
							onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
						/>
					</label>
					<Button variant="accent" disabled={!built || isSaved || saving} onclick={save}
						>{isSaved ? t('script-builder.saved') : t('script-builder.save')}</Button
					>
				</section>

				<div class="counts">
					<ul class="types" aria-label={t('script-builder.counts')} data-testid="builder-counts">
						{#each TYPES as type (type)}
							<li data-type={type}>
								<span class="label">{TYPE_PLURALS[type]}</span>
								<span class="n" data-testid="count-{type}">{counts?.[type] ?? 0}</span>
							</li>
						{/each}
					</ul>
					<div class="source">
						<Segmented
							label={t('script-builder.source')}
							hideLabel
							value={source}
							options={[
								{ value: 'official', label: t('script-builder.source.official') },
								{ value: 'homebrew', label: t('script-builder.source.homebrew') }
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
					<CharacterSearchBox bind:query shortcut />
				</div>

				<section class="check" aria-label={t('script-builder.check')} data-testid="builder-check">
					<Collapsible
						title={t('script-builder.jinxes')}
						level={3}
						storageKey="script-builder:jinxes"
					>
						{#snippet aside()}<span class="count" data-testid="jinx-count"
								>{facts?.jinxes.length ?? 0}</span
							>{/snippet}
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
					>
						{#snippet aside()}<span class="count">{facts?.modifiers.length ?? 0}</span>{/snippet}
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
					>
						{#snippet aside()}<span class="count" data-warn={missingNeeds.length ? '' : undefined}
								>{missingNeeds.length}</span
							>{/snippet}
						{#if missingNeeds.length}
							<ul>
								{#each missingNeeds as need (need.id)}
									<li>
										<CharacterBadge
											characterId={need.id}
											character={onScript.get(need.id)}
											inline
										/>
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
					>
						{#snippet aside()}<span class="count" data-testid="homebrew-count"
								>{chosenHomebrewCharacters.length}</span
							>{/snippet}
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
				marker={source === 'homebrew' ? creatorOf : undefined}
				onSelect={choose}
			/>
		</div>
	</ErrorBoundary>
</main>

<Dialog bind:open={openOpen} title={t('script-builder.openTitle')}>
	<ul class="saved" data-testid="builder-saved-list">
		{#each recentScripts.list as saved (saved.scriptId)}
			<li>
				<button type="button" onclick={() => chooseSaved(saved)}
					>{saved.name || t('common.none')}</button
				>
			</li>
		{:else}
			<li>{t('common.none')}</li>
		{/each}
	</ul>
	{#snippet actions()}
		<Button variant="quiet" onclick={() => (openOpen = false)}>{t('common.cancel')}</Button>
	{/snippet}
</Dialog>

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
	main {
		max-width: var(--page-max);
		margin: 0 auto;
		padding: var(--space-5) var(--page-gutter) var(--space-5);
	}
	.title {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	h1 {
		margin: 0;
		font-size: 2rem;
	}
	.tools {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
	.tools :global(.icon-button) {
		background: var(--surface-raised);
		box-shadow: inset 0 0 0 1px var(--border);
	}
	.tools :global(.icon-button.danger) {
		color: var(--evil);
	}
	@media (hover: hover) {
		.tools :global(.icon-button:hover:not(:disabled)) {
			background: var(--surface-selected);
		}
	}
	.details {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-2);
		padding-top: var(--space-3);
	}
	label {
		display: grid;
		gap: var(--space-1);
	}
	label span {
		color: var(--on-surface-muted);
	}
	input {
		box-sizing: border-box;
		width: 100%;
		min-width: 0;
		min-height: var(--tap-target);
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
		color: var(--on-surface);
		font: var(--font-control);
	}
	/* The counts and search stay in view while the list scrolls. */
	.counts {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-2);
		position: sticky;
		top: 0;
		z-index: var(--z-raised);
		padding: var(--space-2) 0;
		background: var(--page-background, var(--surface));
	}
	.types {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(calc(7 * var(--u)), 1fr));
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 0.85rem;
	}
	.types li {
		display: grid;
		justify-items: center;
		padding: var(--space-1);
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
	}
	.types .label {
		color: var(--on-surface-muted);
	}
	.types .n {
		font-size: 1.2rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.source {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
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
		margin-bottom: var(--space-3);
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
	.count {
		display: inline-grid;
		place-items: center;
		min-width: 1.6em;
		height: 1.6em;
		padding: 0 0.3em;
		border-radius: var(--radius-full);
		background: var(--surface);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.count[data-warn] {
		background: var(--accent);
		color: var(--on-accent, var(--on-surface));
	}
	.saved {
		display: grid;
		gap: var(--space-1);
		margin: var(--space-3) 0;
		padding: 0;
		list-style: none;
	}
	.saved button {
		width: 100%;
		min-height: var(--tap-target);
		padding: 0 var(--space-3);
		border: 0;
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
		color: inherit;
		font: inherit;
		text-align: start;
		cursor: pointer;
	}
	@media (hover: hover) {
		.saved button:hover {
			background: var(--surface-selected);
		}
	}
	/* Phones and tablets: one column. */
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
	}
	.side {
		display: contents;
	}
	/* A computer window: details, counts and the check beside the list. */
	@media (min-width: 75rem) {
		.layout {
			grid-template-columns: calc(28 * var(--u)) minmax(0, 1fr);
			align-items: start;
			gap: var(--space-5);
			padding-top: var(--space-2);
		}
		.side {
			display: grid;
			grid-template-columns: minmax(0, 1fr);
			gap: var(--space-2);
			position: sticky;
			top: 0;
			max-height: calc(100dvh - 6 * var(--u));
			overflow-y: auto;
			padding-bottom: var(--space-4);
		}
		.counts {
			position: static;
		}
		.check {
			margin-bottom: 0;
		}
	}
</style>
