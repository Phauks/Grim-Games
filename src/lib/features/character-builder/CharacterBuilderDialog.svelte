<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { GameData } from '#lib/core/data/index.ts';
	import { timestampName } from '#lib/core/timestamp-name.ts';
	import {
		blocksSaving,
		characterEntry,
		characterProblems,
		fieldsFromEntry
	} from '#lib/core/rules/index.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import CharacterForm from './CharacterForm.svelte';
	import CharacterPreview from './CharacterPreview.svelte';
	import CollectionField from './CollectionField.svelte';
	import { CHARACTER_DRAFT_VERSION, emptyCharacterDraft, type CharacterDraft } from './draft.ts';
	import type { SavedCharacter } from './saved-characters.ts';
	import { CharacterBuilderDraft, savedCharacters } from './stores.svelte.ts';

	/**
	 * The Character builder over the page you are on (Trevor, 2026-10-18: "open that page as a
	 * modal so we don't move away"). It builds a new character, or edits a saved one, with the
	 * page's own form; Confirm saves it and hands it back, Cancel leaves everything as it was
	 * (asking first when something was changed). The page's own draft is not touched.
	 */
	interface Props {
		open?: boolean;
		/** The saved character to edit; none builds a new one. */
		savedId?: string;
		/** After Confirm, with the character as saved. */
		onsaved?: (saved: SavedCharacter) => void;
	}

	let { open = $bindable(false), savedId, onsaved }: Props = $props();

	let data = $state.raw<GameData>();
	let draft = $state.raw(new CharacterBuilderDraft(undefined, emptyCharacterDraft()));
	let startJson = $state('');
	let discardOpen = $state(false);
	let wasOpen = false;

	function start(): CharacterDraft {
		const saved = savedId ? savedCharacters.get(savedId) : undefined;
		if (!saved) return emptyCharacterDraft();
		return {
			version: CHARACTER_DRAFT_VERSION,
			fields: fieldsFromEntry(saved.entry),
			editing: saved.savedId
		};
	}

	const f = $derived(draft.current.fields);
	const problems = $derived(characterProblems(f, data));
	// As on the page, a missing name never stops saving: it gets a timestamp name.
	const canSave = $derived(!blocksSaving(problems.filter((p) => p.kind !== 'name-missing')));
	const changed = $derived(JSON.stringify(characterEntry(f)) !== startJson);

	$effect(() => {
		if (open && !wasOpen) {
			const next = start();
			draft = new CharacterBuilderDraft(undefined, next);
			startJson = JSON.stringify(characterEntry(next.fields));
			if (!data) {
				loadOfficialData()
					.then((d) => (data = d))
					.catch((e) => reportError(e, { area: 'character-builder' }));
			}
		}
		wasOpen = open;
	});

	/** ✕, Escape or a tap outside with something changed asks first. */
	function beforeClose(): boolean {
		if (!changed) return true;
		discardOpen = true;
		return false;
	}

	function cancel() {
		if (changed) discardOpen = true;
		else close();
	}

	function close() {
		open = false;
	}

	function save() {
		if (!canSave) return;
		if (!f.name.trim()) f.name = timestampName();
		const id = savedCharacters.save(f, draft.current.editing);
		const saved = savedCharacters.get(id);
		close();
		if (saved) onsaved?.(saved);
	}
</script>

<Dialog
	bind:open
	title={savedId ? t('character-builder.editTitle') : t('character-builder.newTitle')}
	size="max"
	pinAside={false}
	{beforeClose}
>
	<!-- The preview beside the form once there is room, as on the page; above it on a phone,
	     scrolling with it, as it is tall. -->
	{#snippet aside()}
		<ErrorBoundary area="character-builder">
			<aside class="side">
				<CharacterPreview fields={f} {problems}>
					<CollectionField savedId={draft.current.editing} />
				</CharacterPreview>
			</aside>
		</ErrorBoundary>
	{/snippet}
	<ErrorBoundary area="character-builder">
		<div class="builder" data-testid="character-builder-dialog">
			<CharacterForm {draft} {data} />
		</div>
	</ErrorBoundary>
	{#snippet actions()}
		<ModalActions onCancel={cancel} onConfirm={save} disabled={!canSave} />
	{/snippet}
</Dialog>

<ConfirmDialog
	bind:open={discardOpen}
	title={t('character-builder.discardTitle')}
	danger
	onConfirm={close}
>
	<p>{t('character-builder.discardBody')}</p>
</ConfirmDialog>

<style>
	.side {
		display: grid;
		gap: var(--space-3);
	}
</style>
