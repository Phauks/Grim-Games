<!--
	The custom info card editor (InfoTokenList): the card's words with a live preview, what it
	asks for, each set on its own (Trevor, 2026-10-18), and the characters it belongs to.
-->
<script lang="ts">
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import { MAX_ASKED_CHARACTERS } from '#lib/core/data/info-tokens.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import SharedPicker from '#lib/features/characters/CharacterPicker.svelte';
	import ShownCard from '#lib/features/show/ShownCard.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import Stepper from '#lib/ui/primitives/Stepper.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import TextListField from '#lib/ui/primitives/TextListField.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import { plainText } from './bold.ts';
	import {
		editorAsks,
		editorDetail as detailOf,
		editorFor,
		wholeNumber,
		type CharacterCount,
		type EditorFields
	} from './custom-token-editor.ts';
	import {
		MAX_CHOICE_TEXT,
		MAX_CHOICES,
		MAX_CUSTOM_TEXT,
		type CustomInfoToken
	} from './custom-tokens.ts';
	import { customInfoTokens } from './custom-tokens.svelte.ts';
	import RichTextField from './RichTextField.svelte';

	interface Props {
		/** Characters a card can belong to (the script's, or every one off a game). */
		characters: readonly Character[];
	}

	let { characters }: Props = $props();

	let open = $state(false);
	/** The edit dialog shows the card's text, or the characters it belongs to. */
	let editView = $state<'text' | 'characters'>('text');
	let editing = $state<EditorFields>(editorFor());
	const byId = $derived(new Map(characters.map((c) => [c.id, c])));
	const editOwners = $derived(
		editing.characterIds.flatMap((id) => {
			const character = byId.get(id);
			return character ? [character] : [];
		})
	);
	/** The editor's preview shows where the filled-in part goes. */
	const editorDetail = $derived(detailOf(editing));

	/** Opens a card to edit, or a new one. */
	export function edit(token?: CustomInfoToken) {
		editing = editorFor(token);
		editView = 'text';
		open = true;
	}

	function toggleOwner(id: CharacterId) {
		editing.characterIds = editing.characterIds.includes(id)
			? editing.characterIds.filter((other) => other !== id)
			: [...editing.characterIds, id];
	}

	function save() {
		if (!plainText(editing.text).trim()) return;
		customInfoTokens.save(editing.text, editing.id, {
			characterIds: editing.characterIds,
			asks: editorAsks(editing),
			answerOnly: editing.answerOnly
		});
		open = false;
	}

	/** A range needs room for two numbers; switching keeps what was set where it can. */
	function setCount(count: CharacterCount) {
		editing.count = count;
		if (count === 'range') {
			editing.characters = Math.max(editing.characters, 2);
			editing.fewest = Math.min(editing.fewest, editing.characters - 1);
		}
	}
</script>

<Dialog
	bind:open
	size="full"
	title={editView === 'characters'
		? t('info-tokens.belongsTo')
		: t(editing.id ? 'info-tokens.edit' : 'info-tokens.newLabel')}
>
	{#if editView === 'characters'}
		<SharedPicker
			{characters}
			mode="multi"
			selected={editing.characterIds}
			onSelect={toggleOwner}
		/>
	{:else}
		<div class="editor">
			<!-- The card as players will see it, updated while typing (Trevor, 2026-10-16). -->
			<figure class="preview" aria-label={t('info-tokens.preview')}>
				<div class="preview-card">
					<ShownCard
						title={editing.answerOnly && editorDetail
							? undefined
							: plainText(editing.text).trim()
								? editing.text
								: t('info-tokens.text')}
						detail={editorDetail}
						compact
					/>
				</div>
			</figure>
			<div class="fields">
				<RichTextField
					bind:value={editing.text}
					label={t('info-tokens.text')}
					maxlength={MAX_CUSTOM_TEXT}
					onsubmit={save}
				/>
				<!-- Each thing it asks for, set on its own (Trevor, 2026-10-18). -->
				<Select
					label={t('info-tokens.input')}
					value={editing.input}
					options={(['none', 'text', 'number', 'choices'] as const).map((value) => ({
						value,
						label: t(`info-tokens.inputs.${value}`)
					}))}
					onChange={(value) => (editing.input = value)}
				/>
				{#if editing.input === 'number'}
					<div class="range">
						<TextField
							label={t('info-tokens.min')}
							inputmode="numeric"
							filter={wholeNumber}
							bind:value={editing.min}
						/>
						<TextField
							label={t('info-tokens.max')}
							inputmode="numeric"
							filter={wholeNumber}
							bind:value={editing.max}
						/>
					</div>
				{:else if editing.input === 'choices'}
					<TextListField
						label={t('info-tokens.choices')}
						values={editing.choices}
						onChange={(values) => (editing.choices = values.slice(0, MAX_CHOICES))}
						rowLabel={(number) => t('info-tokens.choiceNumber', { number })}
						removeLabel={(number) => t('info-tokens.choiceRemove', { number })}
						addLabel={t('info-tokens.choiceAdd')}
						maxlength={MAX_CHOICE_TEXT}
					/>
				{/if}
				<!-- Shown only while there is something to fill in, but always in place (no reflow). -->
				<Toggle
					label={t('info-tokens.answerOnly')}
					checked={editing.answerOnly && editing.input !== 'none'}
					disabled={editing.input === 'none'}
					onChange={(checked) => (editing.answerOnly = checked)}
				/>
				<!-- None, exact or a range, then its numbers, always in place (no reflow). -->
				<Select
					label={t('info-tokens.askCharacters')}
					value={editing.count}
					options={(['none', 'exact', 'range'] as const).map((value) => ({
						value,
						label: t(`info-tokens.characterCount.${value}`)
					}))}
					onChange={setCount}
				/>
				<div class="count-field">
					{#if editing.count === 'range'}
						<span class="count-label">{t('info-tokens.from')}</span>
						<Stepper
							bind:value={editing.fewest}
							label={t('info-tokens.from')}
							lessLabel={t('info-tokens.fewerFrom')}
							moreLabel={t('info-tokens.moreFrom')}
							min={1}
							max={editing.characters - 1}
						/>
						<span class="count-label">{t('info-tokens.to')}</span>
						<Stepper
							bind:value={editing.characters}
							label={t('info-tokens.to')}
							lessLabel={t('info-tokens.fewer')}
							moreLabel={t('info-tokens.more')}
							min={editing.fewest + 1}
							max={MAX_ASKED_CHARACTERS}
						/>
					{:else}
						<span class="count-label">{t('info-tokens.howMany')}</span>
						<Stepper
							bind:value={editing.characters}
							label={t('info-tokens.howMany')}
							lessLabel={t('info-tokens.fewer')}
							moreLabel={t('info-tokens.more')}
							min={1}
							max={MAX_ASKED_CHARACTERS}
							disabled={editing.count === 'none'}
						/>
					{/if}
				</div>
				<!-- As "These characters are not in play": chosen from those not in play. -->
				<Toggle
					label={t('info-tokens.notInPlay')}
					checked={editing.notInPlay && editing.count !== 'none'}
					disabled={editing.count === 'none'}
					onChange={(checked) => (editing.notInPlay = checked)}
				/>
				{#if characters.length > 0}
					<div class="belongs">
						<span class="belongs-label">{t('info-tokens.belongsTo')}</span>
						<span class="belongs-owners">
							{#each editOwners as owner (owner.id)}<CharacterBadge
									characterId={owner.id}
									character={owner}
									interactive={false}
								/>{:else}{t('common.none')}{/each}
						</span>
						<Button icon="edit" onclick={() => (editView = 'characters')}
							>{t('info-tokens.chooseCharacters')}</Button
						>
					</div>
				{/if}
			</div>
		</div>
	{/if}
	{#snippet actions()}
		{#if editView === 'characters'}
			<Button variant="accent" onclick={() => (editView = 'text')}>{t('info-tokens.done')}</Button>
		{:else}
			<ModalActions
				onCancel={() => (open = false)}
				onConfirm={save}
				disabled={!plainText(editing.text).trim()}
			/>
		{/if}
	{/snippet}
</Dialog>

<style>
	.editor {
		display: grid;
		gap: var(--space-3);
	}
	@media (min-width: 48rem) {
		.editor {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			align-items: start;
		}
		.preview {
			order: 2;
		}
	}
	.fields {
		display: grid;
		gap: var(--space-3);
		align-content: start;
	}
	/* A fixed box, so typing never moves the editor (no reflow, Trevor). */
	.preview {
		margin: 0;
		height: calc(9 * var(--u));
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: var(--card-radius);
		background: var(--surface, Canvas);
		color: var(--on-surface);
	}
	/* The card fills the box, so if it must scroll its scrollbar is at the box's edge, not
	   beside the centred text (Trevor, 2026-10-18). */
	.preview-card {
		height: 100%;
		display: grid;
	}
	.range {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-2);
	}
	.count-field {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
	}
	.count-label {
		font-weight: 600;
	}
	.belongs {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.belongs-label {
		font-weight: 600;
	}
	.belongs-owners {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		flex: 1;
	}
</style>
