<script lang="ts">
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import {
		MAX_ASKED_CHARACTERS,
		STANDARD_INFO_TOKENS,
		type InfoToken,
		type InfoTokenAsks,
		type InfoTokenValue
	} from '#lib/core/data/info-tokens.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import SharedPicker from '#lib/features/characters/CharacterPicker.svelte';
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
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import Stepper from '#lib/ui/primitives/Stepper.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import { plainText } from './bold.ts';
	import { tokenTitle } from './token-title.ts';
	import type { CharacterCard } from './character-cards.ts';
	import {
		MAX_CHOICE_TEXT,
		MAX_CHOICES,
		MAX_CUSTOM_TEXT,
		cleanChoices,
		type CustomInfoToken
	} from './custom-tokens.ts';
	import TextListField from '#lib/ui/primitives/TextListField.svelte';
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
		/** `custom`: only the user's own cards, e.g. in the Library (Trevor, 2026-10-16). */
		only?: 'custom';
	}

	type InputKind = 'none' | InfoTokenValue['kind'];

	let {
		onchoose,
		level = 2,
		characterCards,
		onchooseCharacter,
		onadd,
		characters = [],
		activeCharacters,
		only
	}: Props = $props();

	// No search: there are too few cards for it to help (Trevor, 2026-10-16).
	const standard = STANDARD_INFO_TOKENS.filter((token) => !token.extra);
	// Trevor's own additions, listed apart so they read as not the base game's (2026-10-18).
	const extras = STANDARD_INFO_TOKENS.filter((token) => token.extra);

	/**
	 * A card that asks for something to fill in (words, a number or one of its answers) asks
	 * for it first; the rest are chosen at once. Characters, if it asks for them too, are
	 * chosen next, by the page or sheet this list sits in.
	 */
	function ask(token: InfoToken, add = false) {
		const value = token.asks?.value;
		if (!value) return add ? onadd?.(token) : onchoose(token);
		asking = token;
		askAdds = add;
		if (value.kind === 'number')
			number = Math.max(value.min ?? 0, Math.min(number, value.max ?? Infinity));
		if (value.kind === 'choices') answer = value.options[0];
		askOpen = true;
	}

	let askOpen = $state(false);
	let asking = $state<InfoToken>();
	let askAdds = $state(false);
	/** The last words typed for each card, offered again next time. */
	let typed = $state<Record<string, string>>({});
	let number = $state(0);
	let answer = $state('');
	const askValue = $derived(asking?.asks?.value);
	const askText = $derived(asking ? (typed[asking.id] ?? '') : '');
	const askReady = $derived(askValue?.kind !== 'text' || askText.trim() !== '');

	function useAsked() {
		if (!asking || !askValue || !askReady) return;
		askOpen = false;
		const detail =
			askValue.kind === 'text'
				? askText.trim()
				: askValue.kind === 'number'
					? String(number)
					: answer;
		// Yes/No shows only the answer, big, so the card's own words are left off.
		const card = asking.answerOnly ? { ...asking, text: '' } : asking;
		if (askAdds) onadd?.(card, detail);
		else onchoose(card, detail);
	}

	/** A card for once: shown, then gone, never saved (Trevor, 2026-10-18). */
	let quickOpen = $state(false);
	let quickAdds = $state(false);
	let quickText = $state('');
	function openQuick(add = false) {
		quickText = '';
		quickAdds = add;
		quickOpen = true;
	}
	function useQuick() {
		if (!plainText(quickText).trim()) return;
		quickOpen = false;
		const card: InfoToken = { id: 'quick', text: quickText, source: 'custom' };
		if (quickAdds) onadd?.(card);
		else onchoose(card);
	}

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
	// A card that belongs to characters sits under Character-Specific instead of Custom.
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

	/** The character card being filled in (the Mezepheles's secret word), and the last text typed for each. */
	type Filling = { card: CharacterCard; character: Character };
	let filling = $state<Filling>();
	let fillOpen = $state(false);
	let filled = $state<Record<string, string>>({});
	let fillAdds = $state(false);
	const fillText = $derived(filling ? (filled[filling.card.id] ?? '') : '');
	const fillTitle = $derived(filling ? t(filling.card.titleKey) : '');

	function fill(row: { card: CharacterCard; character: Character }, add = false) {
		filling = { ...row };
		fillAdds = add;
		fillOpen = true;
	}

	function useFilled() {
		if (!filling || !fillText.trim()) return;
		fillOpen = false;
		const detail = fillText.trim();
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
	/** The editor's fields: each thing the card asks for is set on its own (Trevor, 2026-10-18). */
	let editing = $state<{
		id?: string;
		text: string;
		characterIds: CharacterId[];
		input: InputKind;
		min: string;
		max: string;
		choices: string[];
		characters: number;
	}>(blankEditor());
	const editOwners = $derived(
		editing.characterIds.flatMap((id) => {
			const character = byId.get(id);
			return character ? [character] : [];
		})
	);
	let confirmOpen = $state(false);
	let confirming = $state<InfoToken>();

	function blankEditor() {
		return {
			text: '',
			characterIds: [],
			input: 'none' as InputKind,
			min: '',
			max: '',
			choices: ['', ''],
			characters: 0
		};
	}

	function edit(token?: CustomInfoToken) {
		const value = token?.asks?.value;
		editing = {
			...blankEditor(),
			id: token?.id,
			text: token?.text ?? '',
			characterIds: [...(token?.characterIds ?? [])],
			input: value?.kind ?? 'none',
			min: value?.kind === 'number' && value.min !== undefined ? String(value.min) : '',
			max: value?.kind === 'number' && value.max !== undefined ? String(value.max) : '',
			choices: value?.kind === 'choices' ? [...value.options] : ['', ''],
			characters: token?.asks?.characters ?? 0
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
			characterIds: editing.characterIds,
			asks: editorAsks(editing)
		});
		editOpen = false;
	}

	/** What the editor's fields ask for; the store drops what can't be asked (one answer). */
	function editorAsks(fields: typeof editing): InfoTokenAsks {
		const whole = (text: string) => (/^-?\d+$/.test(text.trim()) ? Number(text) : undefined);
		const value: InfoTokenValue | undefined =
			fields.input === 'text'
				? { kind: 'text' }
				: fields.input === 'number'
					? { kind: 'number', min: whole(fields.min), max: whole(fields.max) }
					: fields.input === 'choices'
						? { kind: 'choices', options: cleanChoices(fields.choices) }
						: undefined;
		return { characters: fields.characters || undefined, value };
	}
	/** The editor's preview shows where the filled-in part goes. */
	const editorDetail = $derived(
		editing.input === 'none'
			? undefined
			: editing.input === 'choices'
				? (cleanChoices(editing.choices)[0] ?? '…')
				: editing.input === 'number'
					? editing.min.trim() || '0'
					: '…'
	);

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
		asks={token.asks}
		onchoose={() => ask(token)}
		onadd={onadd && (() => ask(token, true))}
	>
		{#snippet actions()}
			<IconButton
				icon="rename"
				label={t('info-tokens.editNamed', { name })}
				onclick={() => edit(token)}
			/>
			<DeleteButton
				label={t('info-tokens.deleteNamed', { name })}
				onclick={() => askDelete(token)}
			/>
		{/snippet}
	</InfoTokenTile>
{/snippet}

<div class="sections">
	{#if !only}
		<Collapsible title={t('info-tokens.standard')} storageKey="info-tokens-standard" {level}>
			<ul class="cards">
				{#each standard as token (token.id)}
					<InfoTokenTile
						text={token.text}
						asks={token.asks}
						onchoose={() => ask(token)}
						onadd={onadd && (() => ask(token, true))}
					/>
				{:else}
					<li class="none">{t('common.none')}</li>
				{/each}
			</ul>
		</Collapsible>
		<!-- Trevor's own additions, apart from the base game's (2026-10-18). -->
		<Collapsible title={t('info-tokens.extras')} storageKey="info-tokens-enhanced" {level}>
			<ul class="cards">
				{#each extras as token (token.id)}
					<InfoTokenTile
						text={token.text}
						asks={token.asks}
						onchoose={() => ask(token)}
						onadd={onadd && (() => ask(token, true))}
					/>
				{/each}
			</ul>
		</Collapsible>
	{/if}

	<Collapsible title={t('info-tokens.custom')} storageKey="info-tokens-custom" {level}>
		<ul class="cards">
			<InfoTokenTile
				text={t('info-tokens.quick')}
				quick
				asks={{ value: { kind: 'text' } }}
				onchoose={() => openQuick()}
				onadd={onadd && (() => openQuick(true))}
			/>
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

	{#if characterCards && !only}
		<Collapsible
			title={t('info-tokens.characterCards')}
			storageKey="info-tokens-characters"
			{level}
			asideByTitle
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
						asks={{ value: { kind: 'text' } }}
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
	{#if filling}
		<!-- The card's character, apart from its words (Trevor, 2026-10-18: no brackets). -->
		<p class="fill-owner">
			<CharacterBadge
				characterId={filling.character.id}
				character={filling.character}
				interactive={false}
			/>
		</p>
		<TextField
			label={t(filling.card.fills === 'word' ? 'info-tokens.fill.word' : 'info-tokens.fill.phrase')}
			value={fillText}
			oninput={(value) => {
				if (filling) filled[filling.card.id] = value;
			}}
			oncommit={() => {
				useFilled();
				return false;
			}}
		/>
	{/if}
	{#snippet actions()}
		<ModalActions
			onCancel={() => (fillOpen = false)}
			onConfirm={useFilled}
			disabled={!fillText.trim()}
		/>
	{/snippet}
</Dialog>

<Dialog bind:open={askOpen} title={asking ? tokenTitle(asking) : ''}>
	{#if asking && askValue?.kind === 'text'}
		<TextField
			label={t('info-tokens.fill.answer')}
			value={askText}
			oninput={(value) => {
				if (asking) typed[asking.id] = value;
			}}
			oncommit={() => {
				useAsked();
				return false;
			}}
		/>
	{:else if asking && askValue?.kind === 'number'}
		<div class="number">
			<Stepper
				bind:value={number}
				label={tokenTitle(asking)}
				lessLabel={t('info-tokens.numberLess')}
				moreLabel={t('info-tokens.numberMore')}
				min={askValue.min}
				max={askValue.max}
				large
				typeable
				oncommit={useAsked}
			/>
		</div>
	{:else if askValue?.kind === 'choices'}
		<Select
			label={t('info-tokens.answer')}
			value={answer}
			options={askValue.options.map((option) => ({ value: option, label: option }))}
			onChange={(value) => (answer = value)}
		/>
	{/if}
	{#snippet actions()}
		<ModalActions onCancel={() => (askOpen = false)} onConfirm={useAsked} disabled={!askReady} />
	{/snippet}
</Dialog>

<Dialog bind:open={quickOpen} size="full" title={t('info-tokens.quick')}>
	<div class="editor">
		<figure class="preview" aria-label={t('info-tokens.preview')}>
			<div class="preview-card">
				<ShownCard
					title={plainText(quickText).trim() ? quickText : t('info-tokens.text')}
					compact
				/>
			</div>
		</figure>
		<div class="fields">
			<RichTextField
				bind:value={quickText}
				label={t('info-tokens.text')}
				maxlength={MAX_CUSTOM_TEXT}
				onsubmit={useQuick}
			/>
		</div>
	</div>
	{#snippet actions()}
		<ModalActions
			onCancel={() => (quickOpen = false)}
			onConfirm={useQuick}
			disabled={!plainText(quickText).trim()}
		/>
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
						<TextField label={t('info-tokens.min')} inputmode="numeric" bind:value={editing.min} />
						<TextField label={t('info-tokens.max')} inputmode="numeric" bind:value={editing.max} />
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
				<div class="count-field">
					<span class="count-label">{t('info-tokens.askCharacters')}</span>
					<Stepper
						bind:value={editing.characters}
						label={t('info-tokens.askCharacters')}
						lessLabel={t('info-tokens.fewer')}
						moreLabel={t('info-tokens.more')}
						min={0}
						max={MAX_ASKED_CHARACTERS}
					/>
				</div>
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
			<ModalActions
				onCancel={() => (editOpen = false)}
				onConfirm={save}
				disabled={!plainText(editing.text).trim()}
			/>
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
	.fill-owner {
		margin: 0 0 var(--space-2);
	}
	.number {
		display: grid;
		place-items: center;
		padding-block: var(--space-3);
	}
	/* The same on the page and in a sheet: the surface's own text and heading colours. */
	.sections {
		display: grid;
		gap: var(--space-3);
		color: var(--on-surface);
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
		border: 1px dashed var(--border);
		background: var(--card-background);
		color: var(--on-surface);
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
		background: var(--surface-hover);
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
	.range {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-2);
	}
	.count-field {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
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
	.about :global(.icon-button) {
		color: inherit;
	}
	.about-note {
		margin: 0;
	}
	.none {
		opacity: 0.7;
	}
	.confirm-text {
		margin: 0;
		font-family: var(--font-heading);
	}
</style>
