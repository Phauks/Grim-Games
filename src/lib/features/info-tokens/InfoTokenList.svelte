<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import { STANDARD_INFO_TOKENS, type InfoToken } from '#lib/core/data/info-tokens.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Sentence from '#lib/features/characters/Sentence.svelte';
	import { slot } from '#lib/features/characters/slots.ts';
	import SharedPicker from '#lib/features/characters/CharacterPicker.svelte';
	import CharacterLabel from '#lib/features/show/CharacterLabel.svelte';
	import ShownCard from '#lib/features/show/ShownCard.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Popover from '#lib/ui/primitives/Popover.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import RichTextField from './RichTextField.svelte';
	import InfoTokenTile from './InfoTokenTile.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import { plainText } from './bold.ts';
	import type { CharacterCard } from './character-cards.ts';
	import { MAX_CUSTOM_TEXT, type CustomInfoToken } from './custom-tokens.ts';
	import { customInfoTokens } from './custom-tokens.svelte.ts';
	import InfoTokenText from './InfoTokenText.svelte';

	interface Props {
		/** A card was tapped; `detail` is what was filled into a fill-in card. */
		onchoose: (token: InfoToken, detail?: string) => void;
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
		onadd?: (token: InfoToken, detail?: string) => void;
		/** Characters a custom card can belong to (the script's, or every one off a game). */
		characters?: readonly Character[];
		/**
		 * Characters in play. Given, a custom card that belongs to characters is listed only
		 * while one of them is in play (Trevor, 2026-10-16); without it, every one is.
		 */
		activeCharacters?: ReadonlySet<CharacterId>;
	}

	let {
		onchoose,
		level = 2,
		characterCards,
		onchooseCharacter,
		onadd,
		characters = [],
		activeCharacters
	}: Props = $props();

	// No search: there are too few cards for it to help (Trevor, 2026-10-16).
	const standard = STANDARD_INFO_TOKENS;

	const byId = $derived(new Map(characters.map((c) => [c.id, c])));
	const ownersOf = (token: CustomInfoToken) =>
		(token.characterIds ?? []).flatMap((id) => {
			const character = byId.get(id);
			return character ? [character] : [];
		});

	// Alphabetical by their words, formatting ignored (Trevor, 2026-10-16).
	const sorted = $derived(
		[...customInfoTokens.list].sort((a, b) =>
			plainText(a.text).localeCompare(plainText(b.text), undefined, {
				sensitivity: 'base',
				numeric: true
			})
		)
	);
	// A card that belongs to characters sits under Character Specific instead of Custom.
	const custom = $derived(sorted.filter((token) => !token.characterIds?.length));
	const tied = $derived(
		sorted.filter(
			(token) =>
				token.characterIds?.length &&
				(!activeCharacters || token.characterIds.some((id) => activeCharacters.has(id)))
		)
	);
	const characterRows = $derived(characterCards ?? []);

	let aboutOpen = $state(false);
	let aboutAnchor = $state<HTMLElement>();

	/**
	 * The card being filled in: a character card (the Mezepheles's secret word) or a custom
	 * card marked "Fill in when shown"; and the last text typed for each card.
	 */
	type Filling =
		| { kind: 'card'; card: CharacterCard; character: Character }
		| { kind: 'custom'; token: CustomInfoToken };
	let filling = $state<Filling>();
	let fillOpen = $state(false);
	let filled = $state<Record<string, string>>({});
	let fillAdds = $state(false);
	const fillKey = (f: Filling) => (f.kind === 'card' ? f.card.id : f.token.id);
	const fillText = $derived(filling ? (filled[fillKey(filling)] ?? '') : '');
	const fillTitle = $derived(
		!filling
			? ''
			: filling.kind === 'card'
				? t('info-tokens.cardFor', { card: t(filling.card.titleKey), name: slot('character') })
				: plainText(filling.token.text)
	);

	function fill(row: { card: CharacterCard; character: Character }, add = false) {
		filling = { kind: 'card', ...row };
		fillAdds = add;
		fillOpen = true;
	}

	/** A custom card: a fill-in one asks for its word first. */
	function pick(token: CustomInfoToken, add = false) {
		if (!token.blank) return add ? onadd?.(token) : onchoose(token);
		filling = { kind: 'custom', token };
		fillAdds = add;
		fillOpen = true;
	}

	function useFilled() {
		if (!filling || !fillText.trim()) return;
		fillOpen = false;
		const detail = fillText.trim();
		if (filling.kind === 'custom') {
			if (fillAdds) onadd?.(filling.token, detail);
			else onchoose(filling.token, detail);
			return;
		}
		onchooseCharacter?.({
			title: t(filling.card.titleKey),
			character: filling.character,
			detail,
			add: fillAdds
		});
	}

	let editOpen = $state(false);
	/** The edit dialog shows the card's text, or the characters it belongs to. */
	let editView = $state<'text' | 'characters'>('text');
	let editing = $state<{
		id?: string;
		text: string;
		withCharacters: boolean;
		characterIds: CharacterId[];
		blank: boolean;
	}>({ text: '', withCharacters: false, characterIds: [], blank: false });
	const editOwners = $derived(
		editing.characterIds.flatMap((id) => {
			const character = byId.get(id);
			return character ? [character] : [];
		})
	);
	let confirmOpen = $state(false);
	let confirming = $state<InfoToken>();

	function edit(token?: CustomInfoToken) {
		editing = {
			id: token?.id,
			text: token?.text ?? '',
			withCharacters: token?.shows === 'characters',
			characterIds: [...(token?.characterIds ?? [])],
			blank: token?.blank === true
		};
		editView = 'text';
		editOpen = true;
	}

	function toggleOwner(id: CharacterId) {
		editing.characterIds = editing.characterIds.includes(id)
			? editing.characterIds.filter((other) => other !== id)
			: [...editing.characterIds, id];
	}

	function save() {
		if (!plainText(editing.text).trim()) return;
		customInfoTokens.save(editing.text, editing.id, {
			withCharacters: editing.withCharacters,
			characterIds: editing.characterIds,
			blank: editing.blank
		});
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

{#snippet customTile(token: CustomInfoToken)}
	{@const name = plainText(token.text)}
	<InfoTokenTile
		text={token.text}
		owners={ownersOf(token)}
		onchoose={() => pick(token)}
		onadd={onadd && (() => pick(token, true))}
	>
		{#snippet actions()}
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
		{/snippet}
	</InfoTokenTile>
{/snippet}

<div class="sections">
	<Collapsible title={t('info-tokens.standard')} storageKey="info-tokens-standard" {level}>
		<ul class="cards">
			{#each standard as token (token.id)}
				<InfoTokenTile
					text={token.text}
					onchoose={() => onchoose(token)}
					onadd={onadd && (() => onadd(token))}
				/>
			{:else}
				<li class="none">{t('common.none')}</li>
			{/each}
		</ul>
	</Collapsible>

	<Collapsible title={t('info-tokens.custom')} storageKey="info-tokens-custom" {level}>
		<ul class="cards">
			{#each custom as token (token.id)}
				{@render customTile(token)}
			{/each}
			<!-- A new card starts from an empty tile, always last (Trevor, 2026-10-16). -->
			<li class="new">
				<button
					type="button"
					class="new-card"
					aria-label={t('info-tokens.newLabel')}
					onclick={() => edit()}
				>
					<Icon name="add" />
					<span>{t('info-tokens.new')}</span>
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
					<InfoTokenTile
						text={title}
						aria-label={t('info-tokens.cardFor', { card: title, name: row.character.name })}
						owners={[row.character]}
						onchoose={() => fill(row)}
						onadd={onadd && (() => fill(row, true))}
					/>
				{/each}
				{#each tied as token (token.id)}
					{@render customTile(token)}
				{/each}
				{#if characterRows.length === 0 && tied.length === 0}
					<li class="none">{t('common.none')}</li>
				{/if}
			</ul>
		</Collapsible>
	{/if}
</div>

<Popover bind:open={aboutOpen} title={t('info-tokens.characterCards')} anchor={aboutAnchor}>
	<p class="about-note">{t('info-tokens.characterCardsNote')}</p>
</Popover>

<Dialog bind:open={fillOpen} title={fillTitle}>
	{#snippet heading()}{#if filling?.kind === 'custom'}<InfoTokenText
				text={filling.token.text}
			/>{:else if filling}<Sentence
				text={t('info-tokens.cardFor', {
					card: t(filling.card.titleKey),
					name: slot('character')
				})}
				>{#snippet fill()}<CharacterBadge
						characterId={filling?.kind === 'card' ? filling.character.id : ''}
						character={filling?.kind === 'card' ? filling.character : undefined}
						inline
						interactive={false}
					/>{/snippet}</Sentence
			>{/if}{/snippet}
	{#if filling}
		<label class="field">
			<span
				>{t(
					filling.kind === 'custom'
						? 'info-tokens.fill.answer'
						: filling.card.fills === 'word'
							? 'info-tokens.fill.word'
							: 'info-tokens.fill.phrase'
				)}</span
			>
			<input
				type="text"
				value={fillText}
				oninput={(e) => {
					if (filling) filled[fillKey(filling)] = e.currentTarget.value;
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

<Dialog
	bind:open={editOpen}
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
						title={plainText(editing.text).trim() ? editing.text : t('info-tokens.text')}
						detail={editing.blank ? '…' : undefined}
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
				<Toggle
					label={t('info-tokens.blank')}
					checked={editing.blank}
					onChange={(checked) => (editing.blank = checked)}
				/>
				<Toggle
					label={t('info-tokens.withCharacters')}
					checked={editing.withCharacters}
					onChange={(checked) => (editing.withCharacters = checked)}
				/>
				{#if characters.length > 0}
					<div class="belongs">
						<span class="belongs-label">{t('info-tokens.belongsTo')}</span>
						<span class="belongs-owners">
							{#each editOwners as owner (owner.id)}<CharacterLabel character={owner} />{:else}{t(
									'common.none'
								)}{/each}
						</span>
						<Button icon="rename" onclick={() => (editView = 'characters')}
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
			<Button variant="quiet" onclick={() => (editOpen = false)}>{t('common.cancel')}</Button>
			<Button variant="accent" disabled={!plainText(editing.text).trim()} onclick={save}
				>{t('info-tokens.save')}</Button
			>
		{/if}
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
	/* The empty tile that starts a new card: dashed, like a space to fill, tile-sized. */
	.new {
		display: flex;
		height: calc(2 * var(--tap-target));
		border: 1px dashed color-mix(in srgb, currentColor 30%, transparent);
		border-radius: var(--card-radius);
		overflow: hidden;
	}
	.new-card {
		flex: 1;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-3);
		border: 0;
		background: none;
		color: inherit;
		font-family: var(--font-heading);
		font-size: 1.05rem;
		cursor: pointer;
	}
	.new-card:hover {
		background: color-mix(in srgb, currentColor 8%, transparent);
	}
	/* Editor and preview: side by side when there is room, preview first on a phone. */
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
	.preview-card {
		height: 100%;
		display: grid;
		place-items: center;
		padding: var(--space-2);
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
