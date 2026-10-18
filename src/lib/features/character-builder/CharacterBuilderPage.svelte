<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { CHARACTER_TYPES, type CharacterType, type GameData } from '#lib/core/data/index.ts';
	import { timestampName } from '#lib/core/timestamp-name.ts';
	import {
		blocksSaving,
		changesSetup,
		characterEntry,
		characterProblems,
		fieldsFromEntry,
		fieldsId,
		previewCharacter,
		SEATED_TYPES,
		type CharacterFields
	} from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { TYPE_LABELS } from '#lib/features/reference/labels.ts';
	import { scriptBuilderDraft } from '#lib/features/script-builder/draft.svelte.ts';
	import BuilderSave from '#lib/ui/builder/BuilderSave.svelte';
	import BuilderTools from '#lib/ui/builder/BuilderTools.svelte';
	import OpenSavedDialog from '#lib/ui/builder/OpenSavedDialog.svelte';
	import { downloadJson, fileNameFor } from '#lib/ui/download.ts';
	import Page from '#lib/ui/layout/Page.svelte';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import TextListField from '#lib/ui/primitives/TextListField.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import AbilityField from './AbilityField.svelte';
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
	const preview = $derived(previewCharacter(f));
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

	const position = (value: string) => {
		const n = Number(value.trim());
		return Number.isFinite(n) && n > 0 ? n : undefined;
	};
	function setPosition(key: 'firstNight' | 'otherNight', value: string) {
		const n = position(value);
		if (n === undefined) draft.unset(key);
		else draft.update({ [key]: n });
	}

	const savedPreview = (saved: SavedCharacter) => previewCharacter(fieldsFromEntry(saved.entry));

	/** Characters a setup change can name ("+the King"): official and saved, seated types. */
	const linkable = $derived(
		[...(data?.characters ?? []), ...savedCharacters.list.map(savedPreview)].filter(
			(c) => (SEATED_TYPES as readonly string[]).includes(c.type) && c.id !== id
		)
	);

	const typeOptions = CHARACTER_TYPES.map((value) => ({ value, label: TYPE_LABELS[value] }));
</script>

<svelte:window onhashchange={openFromHash} />

<Page title={t('character-builder.heading')}>
	{#snippet actions()}
		<BuilderTools
			openLabel={t('character-builder.open')}
			openDisabled={savedCharacters.list.length === 0}
			onOpen={() => (openOpen = true)}
			downloadLabel={t('character-builder.download')}
			downloadDisabled={!canSave}
			onDownload={() => downloadJson(fileNameFor(f.name, 'character'), characterEntry(f))}
			clearLabel={t('character-builder.clear')}
			clearDisabled={isEmptyCharacterDraft(d)}
			onClear={() => (clearOpen = true)}
		>
			<DeleteButton
				class="icon-button"
				label={t('character-builder.delete')}
				disabled={!savedRecord}
				onclick={() => (deleteOpen = true)}
			/>
		</BuilderTools>
	{/snippet}

	{#snippet side()}
		<ErrorBoundary area="character-builder">
			<section class="preview" aria-label={t('character-builder.preview')} data-testid="preview">
				<div class="token"><CharacterToken character={preview} /></div>
				<CharacterBadge characterId={preview.id} character={preview} />
				<p class="ability">{preview.ability || t('common.none')}</p>
				<!-- Always there, so typing a reminder never moves the preview. -->
				<p class="reminders">
					{#each [...preview.reminders, ...preview.remindersGlobal] as label, i (i)}
						<ReminderToken {label} character={preview} />
					{:else}{t('common.none')}{/each}
				</p>
			</section>
			<BuilderSave
				ready={canStore}
				saved={isSaved}
				editing={!!savedRecord}
				onSave={() => save()}
				onSaveNew={() => save(true)}
			/>
			<Button disabled={!canSave || onScriptBuilder} onclick={addToScript}
				>{onScriptBuilder
					? t('character-builder.onScript')
					: t('character-builder.addToScript')}</Button
			>
			<!-- Reserved room: problems come and go as the form is filled, so nothing moves. -->
			<ul class="problems" role="status" aria-label={t('character-builder.problems')}>
				{#each problems as problem (problem.kind)}
					<li data-warn={problem.kind !== 'id-official' ? '' : undefined}>
						{t(`character-builder.problem.${problem.kind}`)}
					</li>
				{/each}
			</ul>
		</ErrorBoundary>
	{/snippet}

	<ErrorBoundary area="character-builder">
		<div class="form">
			<PageSection title={t('character-builder.character')}>
				<div class="fields">
					<TextField
						label={t('character-builder.name')}
						value={f.name}
						testid="character-name"
						oninput={(name) => draft.update({ name })}
					/>
					<Select
						label={t('character-builder.type')}
						value={f.team}
						options={typeOptions}
						onChange={(team: CharacterType) => draft.update({ team })}
					/>
					<AbilityField
						ability={f.ability}
						name={f.name}
						characters={linkable}
						onchange={(ability) => draft.update({ ability })}
					/>
					<Toggle
						label={t('character-builder.setup')}
						checked={changesSetup(f)}
						onChange={(setup) => draft.update({ setup })}
					/>
					<TextField
						label={t('character-builder.flavor')}
						multiline
						rows={2}
						value={f.flavor}
						oninput={(flavor) => draft.update({ flavor })}
					/>
					<TextField
						label={t('character-builder.image')}
						type="url"
						value={f.image}
						oninput={(image) => draft.update({ image })}
					/>
					<TextField
						label={t('character-builder.id')}
						value={f.id}
						placeholder={id}
						oninput={(value) => draft.update({ id: value })}
					/>
				</div>
			</PageSection>

			<PageSection title={t('character-builder.reminders')}>
				<div class="fields">
					<TextListField
						label={t('character-builder.reminders')}
						values={f.reminders}
						onChange={(reminders) => draft.update({ reminders })}
						rowLabel={(number) => t('character-builder.reminder', { number })}
						removeLabel={(number) => t('character-builder.removeReminder', { number })}
						addLabel={t('character-builder.addReminder')}
						testid="reminders"
					/>
					<TextListField
						label={t('character-builder.remindersGlobal')}
						values={f.remindersGlobal}
						onChange={(remindersGlobal) => draft.update({ remindersGlobal })}
						rowLabel={(number) => t('character-builder.reminder', { number })}
						removeLabel={(number) => t('character-builder.removeReminder', { number })}
						addLabel={t('character-builder.addReminder')}
					/>
				</div>
			</PageSection>

			<PageSection title={t('character-builder.night')}>
				<div class="fields night">
					<TextField
						label={t('character-builder.firstNightReminder')}
						multiline
						rows={2}
						value={f.firstNightReminder}
						oninput={(firstNightReminder) => draft.update({ firstNightReminder })}
					/>
					<TextField
						label={t('character-builder.firstNight')}
						inputmode="numeric"
						value={f.firstNight?.toString() ?? ''}
						oninput={(v) => setPosition('firstNight', v)}
					/>
					<TextField
						label={t('character-builder.otherNightReminder')}
						multiline
						rows={2}
						value={f.otherNightReminder}
						oninput={(otherNightReminder) => draft.update({ otherNightReminder })}
					/>
					<TextField
						label={t('character-builder.otherNight')}
						inputmode="numeric"
						value={f.otherNight?.toString() ?? ''}
						oninput={(v) => setPosition('otherNight', v)}
					/>
				</div>
			</PageSection>
		</div>
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

<style>
	.form {
		display: grid;
		gap: var(--space-4);
	}
	.fields {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-3);
	}
	/* Night text and its position side by side once there is room. */
	@media (min-width: 40rem) {
		.night {
			grid-template-columns: minmax(0, 3fr) minmax(0, 1fr);
			align-items: start;
		}
	}
	.preview {
		display: grid;
		justify-items: start;
		gap: var(--space-2);
		padding: var(--space-3);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
	}
	.token {
		justify-self: center;
	}
	.ability,
	.reminders {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.reminders {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		min-height: var(--tap-target);
	}
	.problems {
		display: grid;
		gap: var(--space-1);
		min-height: 3lh;
		margin: 0;
		padding-inline-start: 1.2em;
		font-size: 0.9rem;
	}
	.problems [data-warn] {
		color: var(--evil);
	}
</style>
