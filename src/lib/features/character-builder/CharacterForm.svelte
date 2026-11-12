<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { CHARACTER_TYPES, type CharacterType, type GameData } from '#lib/core/data/index.ts';
	import type { NightPlace } from '#lib/core/data/parts/night-order.ts';
	import {
		changesSetup,
		fieldsFromEntry,
		fieldsId,
		nightPlaceOf,
		previewCharacter,
		withNightPlace
	} from '#lib/core/rules/character-builder.ts';
	import { SEATED_TYPES } from '#lib/core/data/types.ts';
	import { TYPE_LABELS } from '#lib/features/reference/labels.ts';
	import { ruleRows } from '#lib/core/rules/character-builder-rules.ts';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import Tabs from '#lib/ui/primitives/Tabs.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import TextListField from '#lib/ui/primitives/TextListField.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import AbilityField from './AbilityField.svelte';
	import NightPlaceField from './NightPlaceField.svelte';
	import RulesField from './RulesField.svelte';
	import type { SavedCharacter } from './saved-characters.ts';
	import { savedCharacters, type CharacterBuilderDraft } from './stores.svelte.ts';

	/**
	 * The Character builder's fields, the same on its page and in the builder opened over
	 * another page (Trevor, 2026-10-18: build or edit a character without leaving the script).
	 * Tabs for the character, its night and its rules (M82, Trevor 2026-11-12: "do it all"), so
	 * the rules are one tap away rather than below both night order lists; the Rules tab counts
	 * them.
	 */
	interface Props {
		draft: CharacterBuilderDraft;
		data: GameData | undefined;
	}

	let { draft, data }: Props = $props();

	const f = $derived(draft.current.fields);
	const id = $derived(fieldsId(f));

	const preview = $derived(previewCharacter(f));

	/** Where it wakes, saved in its rules as a stage and the step it follows (M59). */
	function setPlace(night: 'first' | 'other', place: NightPlace) {
		const rules = withNightPlace(f, night, place);
		if (rules) draft.update({ rules });
		else draft.unset('rules');
	}

	const savedPreview = (saved: SavedCharacter) => previewCharacter(fieldsFromEntry(saved.entry));

	/** Characters a setup change can name ("+the King"): official and saved, seated types. */
	const linkable = $derived(
		[...(data?.characters ?? []), ...savedCharacters.list.map(savedPreview)].filter(
			(c) => (SEATED_TYPES as readonly string[]).includes(c.type) && c.id !== id
		)
	);

	/** Characters a rule can name, such as a jinx's partner: official and saved, every type. */
	const namable = $derived(
		[...(data?.characters ?? []), ...savedCharacters.list.map(savedPreview)].filter(
			(c) => c.id !== id
		)
	);

	type Part = 'character' | 'night' | 'rules';
	let tab = $state<Part>('character');
	const tabs = $derived<{ value: Part; label: string }[]>([
		{ value: 'character', label: t('character-builder.character') },
		{ value: 'night', label: t('character-builder.night') },
		{
			value: 'rules',
			label: t('character-builder.rulesTab', { count: String(ruleRows(f).length) })
		}
	]);

	const typeOptions = CHARACTER_TYPES.map((value) => ({ value, label: TYPE_LABELS[value] }));
</script>

<Tabs bind:value={tab} {tabs} label={t('character-builder.formTabs')}>
	{#snippet panel(part)}
		<div class="form" data-testid="character-{part}">
			{#if part === 'character'}
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
			{:else if part === 'night'}
				<PageSection title={t('character-builder.night')}>
					<div class="fields">
						<TextField
							label={t('character-builder.firstNightReminder')}
							multiline
							rows={2}
							value={f.firstNightReminder}
							oninput={(firstNightReminder) => draft.update({ firstNightReminder })}
						/>
						<NightPlaceField
							night="first"
							label={t('character-builder.firstNightPlace')}
							character={preview}
							{data}
							value={nightPlaceOf(f, 'first')}
							disabled={!f.firstNightReminder.trim()}
							onChange={(place) => setPlace('first', place)}
						/>
						<TextField
							label={t('character-builder.otherNightReminder')}
							multiline
							rows={2}
							value={f.otherNightReminder}
							oninput={(otherNightReminder) => draft.update({ otherNightReminder })}
						/>
						<NightPlaceField
							night="other"
							label={t('character-builder.otherNightPlace')}
							character={preview}
							{data}
							value={nightPlaceOf(f, 'other')}
							disabled={!f.otherNightReminder.trim()}
							onChange={(place) => setPlace('other', place)}
						/>
					</div>
				</PageSection>
			{:else}
				<RulesField
					fields={f}
					characters={namable}
					onchange={(rules) => (rules ? draft.update({ rules }) : draft.unset('rules'))}
				/>
			{/if}
		</div>
	{/snippet}
</Tabs>

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
</style>
