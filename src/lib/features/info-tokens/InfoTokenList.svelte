<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Character } from '#lib/core/data/index.ts';
	import { STANDARD_INFO_TOKENS, type InfoToken } from '#lib/core/data/info-tokens.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Sentence from '#lib/features/characters/Sentence.svelte';
	import { slot } from '#lib/features/characters/slots.ts';
	import CharacterLabel from '#lib/features/show/CharacterLabel.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import { plainText } from './bold.ts';
	import type { CharacterCard } from './character-cards.ts';
	import { MAX_CUSTOM_TEXT } from './custom-tokens.ts';
	import { customInfoTokens } from './custom-tokens.svelte.ts';
	import InfoTokenText from './InfoTokenText.svelte';

	interface Props {
		/** A card was tapped. */
		onchoose: (token: InfoToken) => void;
		/** Only cards whose text contains this (any case). */
		query?: string;
		/** Heading level of the Standard and Custom sections. */
		level?: 2 | 3;
		/**
		 * Cards that belong to characters (the Mezepheles's secret word), each with its
		 * character. Given, a Characters section lists them (Trevor, 2026-10-16).
		 */
		characterCards?: readonly { card: CharacterCard; character: Character }[];
		/** A character card was filled in: its text, character and what the Storyteller typed. */
		onchooseCharacter?: (chosen: { title: string; character: Character; detail: string }) => void;
		/** The fill-in dialog's main button, e.g. "Show" or "Add". */
		fillAction?: string;
	}

	let {
		onchoose,
		query = '',
		level = 2,
		characterCards,
		onchooseCharacter,
		fillAction
	}: Props = $props();

	const needle = $derived(query.trim().toLowerCase());
	const matches = (token: InfoToken) =>
		needle === '' || plainText(token.text).toLowerCase().includes(needle);
	const standard = $derived(STANDARD_INFO_TOKENS.filter(matches));

	const custom = $derived(customInfoTokens.list.filter(matches));
	const characterRows = $derived(
		(characterCards ?? []).filter(
			({ card, character }) =>
				needle === '' ||
				t(card.titleKey).toLowerCase().includes(needle) ||
				character.name.toLowerCase().includes(needle)
		)
	);

	/** The character card being filled in, and the last text typed for each card. */
	let filling = $state<{ card: CharacterCard; character: Character }>();
	let fillOpen = $state(false);
	let filled = $state<Record<string, string>>({});
	const fillText = $derived(filling ? (filled[filling.card.id] ?? '') : '');

	function fill(row: { card: CharacterCard; character: Character }) {
		filling = row;
		fillOpen = true;
	}

	function useFilled() {
		if (!filling || !fillText.trim()) return;
		fillOpen = false;
		onchooseCharacter?.({
			title: t(filling.card.titleKey),
			character: filling.character,
			detail: fillText.trim()
		});
	}

	let editOpen = $state(false);
	let editing = $state<{ id?: string; text: string; withCharacters: boolean }>({
		text: '',
		withCharacters: false
	});
	let confirmOpen = $state(false);
	let confirming = $state<InfoToken>();

	function edit(token?: InfoToken) {
		editing = {
			id: token?.id,
			text: token?.text ?? '',
			withCharacters: token?.shows === 'characters'
		};
		editOpen = true;
	}

	function askDelete(token: InfoToken) {
		confirming = token;
		confirmOpen = true;
	}

	function remove(token: InfoToken) {
		customInfoTokens.remove(token.id);
	}
</script>

<div class="sections">
	<Collapsible title={t('info-tokens.standard')} storageKey="info-tokens-standard" {level}>
		<ul class="cards">
			{#each standard as token (token.id)}
				<li class="tile">
					<button type="button" class="card" onclick={() => onchoose(token)}>
						<span class="text">{token.text}</span>
					</button>
				</li>
			{:else}
				<li class="none">{t('common.none')}</li>
			{/each}
		</ul>
	</Collapsible>

	<Collapsible title={t('info-tokens.custom')} storageKey="info-tokens-custom" {level}>
		{#snippet aside()}
			<Button icon="add" variant="quiet" onclick={() => edit()}>{t('info-tokens.add')}</Button>
		{/snippet}
		<ul class="cards">
			{#each custom as token (token.id)}
				{@const name = plainText(token.text)}
				<li class="tile">
					<button type="button" class="card" onclick={() => onchoose(token)}>
						<!-- One inline box, so the card's flex layout keeps the spaces between runs. -->
						<span class="text"><InfoTokenText text={token.text} /></span>
					</button>
					<span class="actions">
						<IconButton
							icon="rename"
							label={t('info-tokens.editNamed', { name })}
							onclick={() => edit(token)}
						/>
						<IconButton
							icon="remove"
							label={t('info-tokens.deleteNamed', { name })}
							onclick={() => askDelete(token)}
						/>
					</span>
				</li>
			{:else}
				<li class="none">{t('common.none')}</li>
			{/each}
		</ul>
	</Collapsible>

	{#if characterCards}
		<Collapsible
			title={t('info-tokens.characterCards')}
			storageKey="info-tokens-characters"
			{level}
		>
			<ul class="cards">
				{#each characterRows as row (row.card.id)}
					{@const title = t(row.card.titleKey)}
					<li class="tile">
						<button
							type="button"
							class="card character"
							aria-label={t('info-tokens.cardFor', { card: title, name: row.character.name })}
							onclick={() => fill(row)}
						>
							<span class="text">{title}</span>
							<CharacterLabel character={row.character} />
						</button>
					</li>
				{:else}
					<li class="none">{t('common.none')}</li>
				{/each}
			</ul>
		</Collapsible>
	{/if}
</div>

<Dialog
	bind:open={fillOpen}
	title={filling
		? t('info-tokens.cardFor', { card: t(filling.card.titleKey), name: slot('character') })
		: ''}
>
	{#snippet heading()}{#if filling}<Sentence
				text={t('info-tokens.cardFor', {
					card: t(filling.card.titleKey),
					name: slot('character')
				})}
				>{#snippet fill()}<CharacterBadge
						characterId={filling!.character.id}
						character={filling!.character}
						inline
					/>{/snippet}</Sentence
			>{/if}{/snippet}
	{#if filling}
		<label class="field">
			<span
				>{t(
					filling.card.fills === 'word' ? 'info-tokens.fill.word' : 'info-tokens.fill.phrase'
				)}</span
			>
			<input
				type="text"
				value={fillText}
				oninput={(e) => {
					if (filling) filled[filling.card.id] = e.currentTarget.value;
				}}
				onkeydown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						useFilled();
					}
				}}
				autocomplete="off"
				enterkeyhint="done"
			/>
		</label>
	{/if}
	{#snippet actions()}
		<Button variant="quiet" onclick={() => (fillOpen = false)}>{t('common.cancel')}</Button>
		<Button variant="accent" icon="forward" disabled={!fillText.trim()} onclick={useFilled}
			>{fillAction ?? t('info-tokens.show')}</Button
		>
	{/snippet}
</Dialog>

<Dialog bind:open={editOpen} title={t(editing.id ? 'info-tokens.edit' : 'info-tokens.add')}>
	<label class="field">
		<span>{t('info-tokens.text')}</span>
		<textarea
			bind:value={editing.text}
			maxlength={MAX_CUSTOM_TEXT}
			rows="3"
			aria-describedby="bold-hint"></textarea>
	</label>
	<p id="bold-hint" class="hint">{t('info-tokens.boldHint')}</p>
	<Toggle
		label={t('info-tokens.withCharacters')}
		checked={editing.withCharacters}
		onChange={(checked) => (editing.withCharacters = checked)}
	/>
	{#snippet actions()}
		<Button variant="quiet" onclick={() => (editOpen = false)}>{t('common.cancel')}</Button>
		<Button
			variant="accent"
			disabled={!editing.text.trim()}
			onclick={() => {
				customInfoTokens.save(editing.text, editing.id, editing.withCharacters);
				editOpen = false;
			}}>{t('info-tokens.save')}</Button
		>
	{/snippet}
</Dialog>

<ConfirmDialog
	bind:open={confirmOpen}
	title={t('info-tokens.deleteConfirm')}
	danger
	onConfirm={() => confirming && remove(confirming)}
>
	<p class="confirm-text">
		{#if confirming}<InfoTokenText text={confirming.text} />{/if}
	</p>
</ConfirmDialog>

<style>
	/* Follows the colours of whatever holds it: the page or a parchment sheet. */
	.sections {
		display: grid;
		gap: var(--space-3);
		--collapsible-heading: currentColor;
	}
	/* The global heading colour (gold) is too faint on a parchment sheet. */
	.sections :global(.collapsible .title) {
		color: inherit;
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, calc(12 * var(--u))), 1fr));
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* Every tile is the same size (Trevor, 2026-10-16); long text is cut to fit and shown
	   in full on the player's screen. */
	.tile {
		display: flex;
		align-items: stretch;
		height: calc(2 * var(--tap-target));
		border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
		border-radius: var(--card-radius);
		overflow: hidden;
	}
	.actions {
		display: flex;
		flex-direction: column;
		flex: none;
	}
	.actions :global(.icon-button) {
		color: inherit;
		border-radius: 0;
	}
	.card {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		padding: var(--space-1) var(--space-3);
		border: 0;
		background: none;
		color: inherit;
		font-family: var(--font-heading);
		font-size: 1.05rem;
		line-height: 1.25;
		text-align: left;
		overflow-wrap: anywhere;
		cursor: pointer;
	}
	/* A character card: its text, then the character it belongs to. */
	.card.character {
		flex-direction: column;
		align-items: flex-start;
		justify-content: center;
		gap: var(--space-1);
	}
	.card:hover {
		background: color-mix(in srgb, currentColor 8%, transparent);
	}
	.text {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		overflow: hidden;
	}
	.none {
		opacity: 0.7;
	}
	.field {
		display: grid;
		gap: var(--space-1);
	}
	input {
		min-height: var(--tap-target);
	}
	input,
	textarea {
		width: 100%;
		padding: var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
		color: inherit;
		font: inherit;
		resize: vertical;
	}
	.hint {
		margin: var(--space-1) 0 0;
		font-size: 0.85rem;
		opacity: 0.8;
	}
	.confirm-text {
		margin: 0;
		font-family: var(--font-heading);
	}
</style>
