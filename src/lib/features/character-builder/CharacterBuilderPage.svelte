<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { GameData } from '#lib/core/data/index.ts';
	import { timestampName } from '#lib/core/timestamp-name.ts';
	import {
		blocksSaving,
		characterEntry,
		characterProblems,
		fieldsFromEntry,
		fieldsId,
		previewCharacter,
		type CharacterFields
	} from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { scriptBuilderDraft } from '#lib/features/script-builder/draft.svelte.ts';
	import BuilderTools from '#lib/ui/builder/BuilderTools.svelte';
	import OpenSavedDialog from '#lib/ui/builder/OpenSavedDialog.svelte';
	import { fileNameFor } from '#lib/ui/download.ts';
	import Page from '#lib/ui/layout/Page.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import CharacterForm from './CharacterForm.svelte';
	import CharacterPreview from './CharacterPreview.svelte';
	import CollectionField from './CollectionField.svelte';
	import type { SavedCharacter } from './saved-characters.ts';
	import { isEmptyCharacterDraft } from './draft.ts';
	import { characterBuilderDraft as draft, savedCharacters } from './stores.svelte.ts';

	/**
	 * Make a homebrew character (Trevor, 2026-10-17: "We have a script creator area. Lets build
	 * a character creator area as well"). It is written as TPI's script character object, so the
	 * Script builder puts it on a script like any homebrew character, and every part of the app
	 * reads it from there. The text is the user's own; the app adds none.
	 */

	let data = $state.raw<GameData>();
	let clearOpen = $state(false);
	let openOpen = $state(false);
	let deleteOpen = $state(false);
	let replacing = $state.raw<SavedCharacter>();
	let replaceOpen = $state(false);

	onMount(() => {
		loadOfficialData()
			.then((d) => {
				data = d;
				openFromHash();
			})
			.catch((e) => reportError(e, { area: 'character-builder' }));
	});

	const d = $derived(draft.current);
	const f = $derived(d.fields);
	const id = $derived(fieldsId(f));
	const problems = $derived(characterProblems(f, data));
	const canSave = $derived(!blocksSaving(problems));
	// Saving to the Library is never stopped by a missing name: it gets a timestamp name
	// (Trevor, 2026-10-18).
	const canStore = $derived(!blocksSaving(problems.filter((p) => p.kind !== 'name-missing')));
	const savedRecord = $derived(d.editing ? savedCharacters.get(d.editing) : undefined);
	const entryJson = $derived(JSON.stringify(characterEntry(f)));
	const isSaved = $derived(!!savedRecord && JSON.stringify(savedRecord.entry) === entryJson);
	const onScriptBuilder = $derived(scriptBuilderDraft.current.ids.includes(id));

	/** `/build-character#edit=<savedId>` opens that saved character (the hash stays on the device). */
	function openFromHash() {
		const savedId = new URLSearchParams(location.hash.slice(1)).get('edit');
		if (!savedId) return;
		history.replaceState(history.state, '', location.pathname);
		if (savedId === draft.current.editing) return;
		const saved = savedCharacters.get(savedId);
		if (saved) chooseSaved(saved);
	}

	function save(asNew = false) {
		if (!canStore) return;
		if (!f.name.trim()) f.name = timestampName();
		const savedId = savedCharacters.save(f, asNew ? undefined : d.editing);
		draft.setEditing(savedId);
	}

	function chooseSaved(saved: SavedCharacter) {
		openOpen = false;
		if (isEmptyCharacterDraft(d)) openSaved(saved);
		else {
			replacing = saved;
			replaceOpen = true;
		}
	}

	function openSaved(saved: SavedCharacter) {
		draft.replace({ version: 1, fields: fieldsFromEntry(saved.entry), editing: saved.savedId });
	}

	function deleteSaved() {
		if (!d.editing) return;
		savedCharacters.remove(d.editing);
		draft.setEditing(undefined);
	}

	/** Puts the character on the Script builder's script, as it is now. */
	function addToScript() {
		if (!canSave || onScriptBuilder) return;
		scriptBuilderDraft.toggle(id, { entry: characterEntry($state.snapshot(f) as CharacterFields) });
	}

	const savedPreview = (saved: SavedCharacter) => previewCharacter(fieldsFromEntry(saved.entry));
</script>

<svelte:window onhashchange={openFromHash} />

<Page title={t('character-builder.heading')}>
	{#snippet actions()}
		<BuilderTools
			save={{
				ready: canStore,
				saved: isSaved,
				editing: !!savedRecord,
				onSave: () => save(),
				onSaveNew: () => save(true)
			}}
			openLabel={t('character-builder.open')}
			openDisabled={savedCharacters.list.length === 0}
			onOpen={() => (openOpen = true)}
			downloadLabel={t('character-builder.download')}
			downloadDisabled={!canSave}
			json={characterEntry(f)}
			fileName={fileNameFor(f.name, 'character')}
			jsonTitle={f.name || t('common.none')}
			clearLabel={savedRecord ? t('character-builder.delete') : t('character-builder.clear')}
			clearDisabled={!savedRecord && isEmptyCharacterDraft(d)}
			onClear={() => (savedRecord ? (deleteOpen = true) : (clearOpen = true))}
		/>
	{/snippet}

	{#snippet side()}
		<ErrorBoundary area="character-builder">
			<CharacterPreview fields={f} {problems}>
				<Button disabled={!canSave || onScriptBuilder} onclick={addToScript}
					>{onScriptBuilder
						? t('character-builder.onScript')
						: t('character-builder.addToScript')}</Button
				>
				<CollectionField savedId={savedRecord?.savedId} />
			</CharacterPreview>
		</ErrorBoundary>
	{/snippet}

	<ErrorBoundary area="character-builder">
		<CharacterForm {draft} {data} />
	</ErrorBoundary>
</Page>

<OpenSavedDialog
	bind:open={openOpen}
	title={t('character-builder.openTitle')}
	items={savedCharacters.list}
	key={(saved) => saved.savedId}
	onChoose={chooseSaved}
	testid="saved-characters"
>
	{#snippet row(saved)}
		{@const character = savedPreview(saved)}
		<CharacterBadge characterId={character.id} {character} interactive={false} />
	{/snippet}
</OpenSavedDialog>

<ConfirmDialog
	bind:open={replaceOpen}
	title={t('character-builder.openReplace', {
		name: (replacing?.entry.name as string | undefined) || t('common.none')
	})}
	danger
	onConfirm={() => replacing && openSaved(replacing)}
>
	<p>{t('character-builder.openReplaceBody')}</p>
</ConfirmDialog>

<ConfirmDialog
	bind:open={clearOpen}
	title={t('character-builder.clearTitle')}
	danger
	onConfirm={() => draft.clear()}
>
	<p>{t('character-builder.clearBody')}</p>
</ConfirmDialog>

<ConfirmDialog
	bind:open={deleteOpen}
	title={t('character-builder.deleteTitle', {
		name: (savedRecord?.entry.name as string | undefined) || t('common.none')
	})}
	danger
	onConfirm={deleteSaved}
>
	<p>{t('character-builder.deleteBody')}</p>
</ConfirmDialog>
