<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { CHARACTER_TYPES, type CharacterType, type GameData } from '#lib/core/data/index.ts';
	import {
		changesSetup,
		fieldsFromEntry,
		fieldsId,
		previewCharacter,
		SEATED_TYPES
	} from '#lib/core/rules/index.ts';
	import { TYPE_LABELS } from '#lib/features/reference/labels.ts';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import TextListField from '#lib/ui/primitives/TextListField.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import AbilityField from './AbilityField.svelte';
	import type { SavedCharacter } from './saved-characters.ts';
	import { savedCharacters, type CharacterBuilderDraft } from './stores.svelte.ts';

	/**
	 * The Character builder's fields, the same on its page and in the builder opened over
	 * another page (Trevor, 2026-10-18: build or edit a character without leaving the script).
	 */
	interface Props {
		draft: CharacterBuilderDraft;
		data: GameData | undefined;
	}

	let { draft, data }: Props = $props();

	const f = $derived(draft.current.fields);
	const id = $derived(fieldsId(f));

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
</style>
