<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import type { InfoToken } from '#lib/core/data/info-tokens.ts';
	import type { ShowableBluffSet } from '#lib/features/bluffs/bluffs.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import CharacterPicker from '#lib/features/show/CharacterPicker.svelte';
	import ShowToPlayer from '#lib/features/show/ShowToPlayer.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Segmented from '#lib/ui/primitives/Segmented.svelte';
	import { plainText } from './bold.ts';
	import { pickMax } from './pick.ts';
	import { characterCardsFor } from './character-cards.ts';
	import InfoTokenList from './InfoTokenList.svelte';

	interface Props {
		open?: boolean;
		/** Characters the Storyteller can show with a card, in script order. */
		characters: readonly Character[];
		/**
		 * The game's bluff sets that have characters (`showableBluffSets`). Given, "These
		 * characters are not in play" shows them instead of asking for characters.
		 */
		bluffSets?: readonly ShowableBluffSet[];
		/**
		 * Characters on a seat. Character Specific cards load only for these (Trevor,
		 * 2026-10-16); without it, for every character given.
		 */
		inPlay?: readonly CharacterId[];
		/** No bluffs chosen yet: called (with this sheet closed) to open the bluff picker. */
		onChooseBluffs?: () => void;
		/**
		 * The Storyteller closed the sheet; not called while it steps aside for the player view
		 * or the bluff picker. Lets whatever opened it come back (Trevor, 2026-10-16).
		 */
		onclose?: () => void;
	}

	let {
		open = $bindable(false),
		characters,
		inPlay,
		bluffSets,
		onChooseBluffs,
		onclose
	}: Props = $props();

	type View =
		| { kind: 'list' }
		| { kind: 'characters'; token: InfoToken }
		| { kind: 'sets'; token: InfoToken };

	let view = $state<View>({ kind: 'list' });
	let query = $state('');
	let picked = $state<CharacterId[]>([]);

	interface Card {
		text: string;
		characterIds: CharacterId[];
		/** What the Storyteller filled in, e.g. the Mezepheles's secret word. */
		detail?: string;
	}

	/**
	 * "Show now" shows a card at once. "Chain" collects cards in order and shows them
	 * together, swiped left and right, e.g. the Cerenovus's card then the madness card
	 * (Trevor, 2026-10-16).
	 */
	let mode = $state<'now' | 'chain'>('now');
	let chainCards = $state<Card[]>([]);

	let showOpen = $state(false);
	let shown = $state<Card[]>([]);

	const byId = $derived(new Map(characters.map((c) => [c.id, c])));
	const names = (ids: readonly CharacterId[]) =>
		ids.map((id) => byId.get(id)?.name ?? id).join(', ');
	// Cards of characters in play (Trevor, 2026-10-16).
	const characterCards = $derived(
		characterCardsFor(inPlay ?? characters.map((c) => c.id)).flatMap((card) => {
			const character = byId.get(card.characterId);
			return character ? [{ card, character }] : [];
		})
	);
	const shownCards = $derived(
		shown.map((card) => ({
			title: card.text,
			detail: card.detail,
			characters: card.characterIds.flatMap((id) => {
				const character = byId.get(id);
				return character ? [{ character }] : [];
			})
		}))
	);
	const chainLabel = (card: Card) =>
		card.detail
			? `${plainText(card.text)}: ${card.detail}`
			: card.characterIds.length
				? `${plainText(card.text)} (${names(card.characterIds)})`
				: plainText(card.text);

	/** Moves a chain card one place up (-1) or down (1). */
	function move(index: number, by: -1 | 1) {
		const to = index + by;
		if (to < 0 || to >= chainCards.length) return;
		const next = [...chainCards];
		[next[index], next[to]] = [next[to], next[index]];
		chainCards = next;
	}
	const title = $derived(
		view.kind === 'list' ? t('info-tokens.title') : plainText(view.token.text)
	);

	// Each time the sheet opens it starts at the list.
	$effect(() => {
		if (!open && !showOpen) view = { kind: 'list' };
	});

	let wasOpen = false;
	let handedOff = false;
	$effect(() => {
		if (open) wasOpen = true;
		else if (wasOpen && !showOpen) {
			wasOpen = false;
			if (!handedOff) onclose?.();
			handedOff = false;
		}
	});

	function choose(token: InfoToken) {
		if (token.id === 'not-in-play' && bluffSets) {
			if (bluffSets.length === 1) return use(token.text, bluffSets[0].characterIds);
			if (bluffSets.length > 1) {
				view = { kind: 'sets', token };
				return;
			}
			if (onChooseBluffs) {
				handedOff = true;
				open = false;
				onChooseBluffs();
				return;
			}
		}
		if (token.shows === 'characters') {
			picked = [];
			view = { kind: 'characters', token };
			return;
		}
		// "This is the Demon", "These are your Minions" and the rest: the Storyteller points.
		use(token.text);
	}

	/** Shows the card now, or adds it to the chain. */
	function use(text: string, characterIds: readonly CharacterId[] = [], detail?: string) {
		const card = { text, characterIds: [...characterIds], detail };
		view = { kind: 'list' };
		if (mode === 'chain') chainCards = [...chainCards, card];
		else show([card]);
	}

	/**
	 * The player view opens on its own: the sheet closes first and comes back when the player
	 * view is closed, because the sheet hides everything outside it while open.
	 */
	function show(cards: Card[]) {
		if (cards.length === 0) return;
		shown = cards;
		view = { kind: 'list' };
		open = false;
		showOpen = true;
	}
</script>

<BottomSheet bind:open {title} height="85dvh" focusFirstField={false}>
	<ErrorBoundary area="info-tokens">
		{#if view.kind === 'list'}
			<div class="mode">
				<Segmented
					label={t('info-tokens.mode')}
					hideLabel
					value={mode}
					options={[
						{ value: 'now', label: t('info-tokens.showNow') },
						{ value: 'chain', label: t('info-tokens.chain') }
					]}
					onChange={(value) => (mode = value)}
				/>
			</div>
			<div class="search">
				<Icon name="search" />
				<input
					bind:value={query}
					type="search"
					aria-label={t('info-tokens.search')}
					placeholder={t('info-tokens.searchPlaceholder')}
					autocomplete="off"
					enterkeyhint="search"
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							e.currentTarget.blur();
						}
					}}
				/>
				<button
					type="button"
					class="clear"
					aria-label={t('info-tokens.clearSearch')}
					disabled={query === ''}
					onclick={() => (query = '')}><Icon name="close" /></button
				>
			</div>
			<InfoTokenList
				onchoose={choose}
				{query}
				level={3}
				{characterCards}
				onchooseCharacter={({ title, detail }) => use(title, [], detail)}
				fillAction={t(mode === 'chain' ? 'info-tokens.addToChain' : 'info-tokens.show')}
			/>
			{#if mode === 'chain'}
				<div class="chain" role="group" aria-label={t('info-tokens.chain')}>
					{#if chainCards.length === 0}
						<p class="chain-empty">{t('info-tokens.chainEmpty')}</p>
					{:else}
						<ol class="chain-list" data-testid="chain-list">
							{#each chainCards as card, i (card)}
								{@const name = chainLabel(card)}
								<li>
									<span class="chain-text">{i + 1}. {name}</span>
									<span class="chain-buttons">
										<span class="up">
											<IconButton
												icon="expand"
												label={t('info-tokens.moveUp', { name })}
												disabled={i === 0}
												onclick={() => move(i, -1)}
											/>
										</span>
										<IconButton
											icon="expand"
											label={t('info-tokens.moveDown', { name })}
											disabled={i === chainCards.length - 1}
											onclick={() => move(i, 1)}
										/>
										<span class="danger">
											<IconButton
												icon="remove"
												label={t('info-tokens.removeFromChain', { name })}
												onclick={() => (chainCards = chainCards.filter((_, j) => j !== i))}
											/>
										</span>
									</span>
								</li>
							{/each}
						</ol>
					{/if}
					<div class="chain-actions">
						<span class="danger">
							<IconButton
								icon="remove"
								label={t('info-tokens.clearChain')}
								disabled={chainCards.length === 0}
								onclick={() => (chainCards = [])}
							/>
						</span>
						<Button
							variant="accent"
							icon="forward"
							disabled={chainCards.length === 0}
							onclick={() => show(chainCards)}
							>{t('info-tokens.showCards', { count: chainCards.length })}</Button
						>
					</div>
				</div>
			{/if}
		{:else if view.kind === 'characters'}
			{@const token = view.token}
			<CharacterPicker
				{characters}
				bind:selected={picked}
				max={pickMax(token.id)}
				label={t('info-tokens.characters')}
			/>
			<div class="sheet-actions">
				<Button variant="quiet" onclick={() => (view = { kind: 'list' })}
					>{t('common.cancel')}</Button
				>
				<Button
					variant="accent"
					icon={mode === 'chain' ? 'add' : 'forward'}
					onclick={() => use(token.text, picked)}
					>{t(mode === 'chain' ? 'info-tokens.addToChain' : 'info-tokens.show')}</Button
				>
			</div>
		{:else}
			{@const token = view.token}
			<ul class="sets" aria-label={t('info-tokens.bluffSets')}>
				{#each bluffSets ?? [] as set (set.set)}
					<li>
						<button type="button" class="set" onclick={() => use(token.text, set.characterIds)}>
							<span class="set-label">{set.label}</span>
							<span class="set-names">{names(set.characterIds)}</span>
						</button>
					</li>
				{/each}
			</ul>
			<div class="sheet-actions">
				<Button variant="quiet" onclick={() => (view = { kind: 'list' })}
					>{t('common.cancel')}</Button
				>
			</div>
		{/if}
	</ErrorBoundary>
</BottomSheet>

<ShowToPlayer bind:open={showOpen} cards={shownCards} onclose={() => (open = true)} />

<style>
	/* Lives in a sheet, so it follows the sheet's colours rather than the page's. */
	.mode {
		margin-bottom: var(--space-2);
	}
	/* Sits over the bottom of the list, so adding cards never moves the cards above. */
	.chain {
		position: sticky;
		bottom: 0;
		display: grid;
		gap: var(--space-1);
		margin-top: var(--space-3);
		padding: var(--space-2) 0;
		border-top: 1px solid color-mix(in srgb, currentColor 30%, transparent);
		background: var(--sheet-background);
	}
	.chain-empty {
		margin: 0;
		opacity: 0.85;
	}
	.chain-list {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.chain-list li {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
	.chain-text {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	/* The bin and Show on one line, the bin set apart at the start. */
	.chain-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
	.chain-buttons {
		display: flex;
		flex: none;
	}
	/* The same caret as the sections, turned to point up. */
	.up :global(.icon) {
		rotate: 180deg;
	}
	.chain-buttons :global(.icon-button) {
		color: inherit;
	}
	.danger :global(.icon-button) {
		color: var(--accent);
	}
	.search {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		height: var(--tap-target);
		margin-bottom: var(--space-3);
		padding-inline-start: var(--space-2);
		border-radius: var(--radius-md);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 30%, transparent);
	}
	.search:focus-within {
		box-shadow: inset 0 0 0 2px var(--focus);
	}
	.search input {
		flex: 1;
		min-width: 0;
		height: 100%;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		outline: none;
	}
	/* The field's border shows focus; the global input ring would draw a second one. */
	.search input:focus-visible {
		outline: none;
	}
	.search input::-webkit-search-cancel-button {
		appearance: none;
	}
	.clear {
		display: grid;
		place-items: center;
		width: var(--tap-target);
		height: var(--tap-target);
		border: 0;
		background: none;
		color: inherit;
		cursor: pointer;
	}
	.clear:disabled {
		visibility: hidden;
	}
	.sets {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.set {
		display: grid;
		gap: var(--space-1);
		width: 100%;
		min-height: var(--tap-target);
		padding: var(--space-2) var(--space-3);
		border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
		border-radius: var(--radius-md);
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.set:hover {
		background: color-mix(in srgb, currentColor 8%, transparent);
	}
	.set-label {
		font-family: var(--font-heading);
		font-size: 1.05rem;
	}
	.set-names {
		opacity: 0.85;
	}
	.sheet-actions {
		position: sticky;
		bottom: 0;
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
		padding-top: var(--space-3);
		background: var(--sheet-background);
	}
</style>
