<script lang="ts">
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import type { InfoToken } from '#lib/core/data/info-tokens.ts';
	import type { ShowableBluffSet } from '#lib/features/bluffs/bluffs.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import CharacterPicker from '#lib/features/show/CharacterPicker.svelte';
	import ShowToPlayer from '#lib/features/show/ShowToPlayer.svelte';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { plainText } from './bold.ts';
	import { tokenTitle } from './token-title.ts';
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
		 * Characters on a seat. Character-Specific cards load only for these (Trevor,
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
	let picked = $state<CharacterId[]>([]);

	interface Card {
		text: string;
		characterIds: CharacterId[];
		/** What the Storyteller filled in, e.g. the Mezepheles's secret word. */
		detail?: string;
	}

	/**
	 * Tapping a card shows it at once; its + adds it to the cards shown together (Trevor,
	 * 2026-10-16: no mode switch). `adding` is true while the + of a card that asks for
	 * characters or a bluff set is being completed.
	 */
	let adding = $state(false);
	let chainCards = $state<Card[]>([]);

	let showOpen = $state(false);
	let shown = $state<Card[]>([]);

	const byId = $derived(new Map(characters.map((c) => [c.id, c])));
	const names = (ids: readonly CharacterId[]) =>
		ids.map((id) => byId.get(id)?.name ?? id).join(', ');
	const known = (ids: readonly CharacterId[]) =>
		ids.flatMap((id) => {
			const character = byId.get(id);
			return character ? [character] : [];
		});
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
	/** A filled-in card's words and answer; the Number card is only its number. */
	const detailLabel = (card: Card) =>
		plainText(card.text) ? `${plainText(card.text)}: ${card.detail}` : (card.detail ?? '');
	const chainLabel = (card: Card) =>
		card.detail
			? detailLabel(card)
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
	const title = $derived(view.kind === 'list' ? t('info-tokens.title') : tokenTitle(view.token));

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

	/** What was filled into a fill-in custom card, kept while its characters are chosen. */
	let pendingDetail: string | undefined;

	function choose(token: InfoToken, add = false, detail?: string) {
		adding = add;
		pendingDetail = detail;
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
		if (token.asks?.characters) {
			picked = [];
			view = { kind: 'characters', token };
			return;
		}
		// "This is the Demon", "These are your Minions" and the rest: the Storyteller points.
		use(token.text, [], detail);
	}

	/** Shows the card now, or adds it to the cards to show together. */
	function use(
		text: string,
		characterIds: readonly CharacterId[] = [],
		detail: string | undefined = pendingDetail
	) {
		pendingDetail = undefined;
		const card = { text, characterIds: [...characterIds], detail };
		view = { kind: 'list' };
		if (adding) chainCards = [...chainCards, card];
		else show([card]);
		adding = false;
	}

	/** The player view opens over the sheet, which stays open under it (Trevor, 2026-10-17). */
	function show(cards: Card[]) {
		if (cards.length === 0) return;
		shown = cards;
		view = { kind: 'list' };
		showOpen = true;
	}
</script>

<BottomSheet bind:open {title} height="85dvh" focusFirstField={false}>
	<ErrorBoundary area="info-tokens">
		{#if view.kind === 'list'}
			<InfoTokenList
				onchoose={(token, detail) => choose(token, false, detail)}
				level={3}
				{characterCards}
				{characters}
				activeCharacters={inPlay && new Set(inPlay)}
				onadd={(token, detail) => choose(token, true, detail)}
				onchooseCharacter={({ title, detail, add }) => {
					adding = add;
					use(title, [], detail);
				}}
			/>
			{#if chainCards.length > 0}
				<div class="chain" role="group" aria-label={t('info-tokens.toShow')}>
					{#if chainCards.length > 0}
						<ol class="chain-list" data-testid="chain-list">
							{#each chainCards as card, i (card)}
								{@const name = chainLabel(card)}
								<li>
									<!-- The chosen characters wrap under the card's words, so the row keeps its width (Trevor, 2026-10-17). -->
									<span class="chain-card">
										<span class="chain-text"
											>{i + 1}. {card.detail ? detailLabel(card) : plainText(card.text)}</span
										>
										{#if card.characterIds.length > 0}
											<span class="badges">
												{#each known(card.characterIds) as character (character.id)}
													<CharacterBadge
														characterId={character.id}
														{character}
														interactive={false}
													/>
												{/each}
											</span>
										{/if}
									</span>
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
										<span>
											<DeleteButton
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
						<span>
							<DeleteButton
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
				max={token.asks?.characters ?? 1}
				label={t('info-tokens.characters')}
				inPlay={inPlay && new Set(inPlay)}
				notInPlay={token.id === 'not-in-play'}
			/>
			<ModalActions
				onCancel={() => (view = { kind: 'list' })}
				onConfirm={() => use(token.text, picked)}
				disabled={picked.length === 0}
			/>
		{:else}
			{@const token = view.token}
			<ul class="sets" aria-label={t('info-tokens.bluffSets')}>
				{#each bluffSets ?? [] as set (set.set)}
					<li>
						<button type="button" class="set" onclick={() => use(token.text, set.characterIds)}>
							<span class="set-label">{set.label}</span>
							<span class="badges">
								{#each known(set.characterIds) as character (character.id)}
									<CharacterBadge characterId={character.id} {character} interactive={false} />
								{/each}
							</span>
						</button>
					</li>
				{/each}
			</ul>
			<ModalActions onCancel={() => (view = { kind: 'list' })} />
		{/if}
	</ErrorBoundary>
	<!--
		Inside the sheet, so the sheet stays open under the player view (Trevor, 2026-10-17);
		outside the boundary, so a crash in the sheet never closes it.
	-->
	<ShowToPlayer bind:open={showOpen} cards={shownCards} />
</BottomSheet>

<style>
	/* Lives in a sheet, so it follows the sheet's colours rather than the page's. */
	/* Sits over the bottom of the list, so adding cards never moves the cards above. */
	.chain {
		position: sticky;
		bottom: 0;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-1);
		margin-top: var(--space-3);
		padding: var(--space-2) 0;
		border-top: 1px solid var(--border);
		background: var(--sheet-background);
	}
	.chain-list {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
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
	.chain-card {
		display: grid;
		flex: 1;
		min-width: 0;
		gap: var(--space-1);
	}
	.chain-text {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	/* Chosen characters wrap onto new lines rather than widening the row. */
	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		min-width: 0;
	}
	.badges > :global(*) {
		max-width: 100%;
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
	.sets {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
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
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.set:hover {
		background: var(--surface-hover);
	}
	.set-label {
		font-family: var(--font-heading);
		font-size: 1.05rem;
	}
</style>
