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
	import Popover from '#lib/ui/primitives/Popover.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import RichTextField from './RichTextField.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import { plainText } from './bold.ts';
	import type { CharacterCard } from './character-cards.ts';
	import { MAX_CUSTOM_TEXT } from './custom-tokens.ts';
	import { customInfoTokens } from './custom-tokens.svelte.ts';
	import InfoTokenText from './InfoTokenText.svelte';

	interface Props {
		/** A card was tapped. */
		onchoose: (token: InfoToken) => void;
		/** Heading level of the Standard and Custom sections. */
		level?: 2 | 3;
		/**
		 * Cards that belong to characters (the Mezepheles's secret word), each with its
		 * character. Given, a Characters section lists them (Trevor, 2026-10-16).
		 */
		characterCards?: readonly { card: CharacterCard; character: Character }[];
		/**
		 * A character card was filled in: its text, character, what the Storyteller typed, and
		 * whether it came from the card's + (add to the cards to show) rather than a tap.
		 */
		onchooseCharacter?: (chosen: {
			title: string;
			character: Character;
			detail: string;
			add: boolean;
		}) => void;
		/** Given, each card has a + that adds it to the cards shown together (Trevor, 2026-10-16). */
		onadd?: (token: InfoToken) => void;
	}

	let { onchoose, level = 2, characterCards, onchooseCharacter, onadd }: Props = $props();

	// No search: there are too few cards for it to help (Trevor, 2026-10-16).
	const standard = STANDARD_INFO_TOKENS;

	// Alphabetical by their words, formatting ignored (Trevor, 2026-10-16).
	const custom = $derived(
		[...customInfoTokens.list].sort((a, b) =>
			plainText(a.text).localeCompare(plainText(b.text), undefined, {
				sensitivity: 'base',
				numeric: true
			})
		)
	);
	const characterRows = $derived(characterCards ?? []);

	let aboutOpen = $state(false);
	let aboutAnchor = $state<HTMLElement>();

	/** The character card being filled in, and the last text typed for each card. */
	let filling = $state<{ card: CharacterCard; character: Character }>();
	let fillOpen = $state(false);
	let filled = $state<Record<string, string>>({});
	let fillAdds = $state(false);
	const fillText = $derived(filling ? (filled[filling.card.id] ?? '') : '');

	function fill(row: { card: CharacterCard; character: Character }, add = false) {
		filling = row;
		fillAdds = add;
		fillOpen = true;
	}

	function useFilled() {
		if (!filling || !fillText.trim()) return;
		fillOpen = false;
		onchooseCharacter?.({
			title: t(filling.card.titleKey),
			character: filling.character,
			detail: fillText.trim(),
			add: fillAdds
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

	function save() {
		if (!plainText(editing.text).trim()) return;
		customInfoTokens.save(editing.text, editing.id, editing.withCharacters);
		editOpen = false;
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
					{#if onadd}
						<span class="add">
							<IconButton
								icon="add"
								label={t('info-tokens.addNamed', { name: token.text })}
								onclick={() => onadd(token)}
							/>
						</span>
					{/if}
				</li>
			{:else}
				<li class="none">{t('common.none')}</li>
			{/each}
		</ul>
	</Collapsible>

	<Collapsible title={t('info-tokens.custom')} storageKey="info-tokens-custom" {level}>
		<ul class="cards">
			{#each custom as token (token.id)}
				{@const name = plainText(token.text)}
				<li class="tile">
					<button type="button" class="card" onclick={() => onchoose(token)}>
						<!-- One inline box, so the card's flex layout keeps the spaces between runs. -->
						<span class="text"><InfoTokenText text={token.text} /></span>
					</button>
					{#if onadd}
						<span class="add">
							<IconButton
								icon="add"
								label={t('info-tokens.addNamed', { name })}
								onclick={() => onadd(token)}
							/>
						</span>
					{/if}
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
			{/each}
			<!-- A new card starts from an empty tile, always last (Trevor, 2026-10-16). -->
			<li class="tile new">
				<button
					type="button"
					class="card"
					aria-label={t('info-tokens.newLabel')}
					onclick={() => edit()}
				>
					<Icon name="add" />
					<span class="text">{t('info-tokens.new')}</span>
				</button>
			</li>
		</ul>
	</Collapsible>

	{#if characterCards}
		<Collapsible
			title={t('info-tokens.characterCards')}
			storageKey="info-tokens-characters"
			{level}
		>
			{#snippet aside()}
				<span class="about" bind:this={aboutAnchor}>
					<IconButton
						icon="info"
						label={t('info-tokens.characterCardsAbout')}
						onclick={() => (aboutOpen = !aboutOpen)}
					/>
				</span>
			{/snippet}
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
						{#if onadd}
							<span class="add">
								<IconButton
									icon="add"
									label={t('info-tokens.addNamed', {
										name: t('info-tokens.cardFor', { card: title, name: row.character.name })
									})}
									onclick={() => fill(row, true)}
								/>
							</span>
						{/if}
					</li>
				{:else}
					<li class="none">{t('common.none')}</li>
				{/each}
			</ul>
		</Collapsible>
	{/if}
</div>

<Popover bind:open={aboutOpen} title={t('info-tokens.characterCards')} anchor={aboutAnchor}>
	<p class="about-note">{t('info-tokens.characterCardsNote')}</p>
</Popover>

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
						interactive={false}
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
		<Button
			variant="accent"
			icon={fillAdds ? 'add' : 'forward'}
			disabled={!fillText.trim()}
			onclick={useFilled}>{t(fillAdds ? 'info-tokens.addToChain' : 'info-tokens.show')}</Button
		>
	{/snippet}
</Dialog>

<Dialog bind:open={editOpen} title={t(editing.id ? 'info-tokens.edit' : 'info-tokens.newLabel')}>
	<RichTextField
		bind:value={editing.text}
		label={t('info-tokens.text')}
		maxlength={MAX_CUSTOM_TEXT}
		onsubmit={save}
	/>
	<Toggle
		label={t('info-tokens.withCharacters')}
		checked={editing.withCharacters}
		onChange={(checked) => (editing.withCharacters = checked)}
	/>
	{#snippet actions()}
		<Button variant="quiet" onclick={() => (editOpen = false)}>{t('common.cancel')}</Button>
		<Button variant="accent" disabled={!plainText(editing.text).trim()} onclick={save}
			>{t('info-tokens.save')}</Button
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
	/* The + that adds a card to the ones shown together: a strip at the tile's edge. */
	.add {
		display: grid;
		flex: none;
		border-inline-start: 1px solid color-mix(in srgb, currentColor 20%, transparent);
	}
	.add :global(.icon-button) {
		height: 100%;
		color: inherit;
		border-radius: 0;
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
	/* The empty tile that starts a new card: dashed, like a space to fill. */
	.tile.new {
		border-style: dashed;
	}
	.tile.new .card {
		gap: var(--space-2);
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
	.about :global(.icon-button) {
		color: inherit;
	}
	.about-note {
		margin: 0;
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
	input {
		width: 100%;
		padding: var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
		color: inherit;
		font: inherit;
		resize: vertical;
	}
	.confirm-text {
		margin: 0;
		font-family: var(--font-heading);
	}
</style>
