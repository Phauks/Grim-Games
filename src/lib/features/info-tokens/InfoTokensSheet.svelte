<script lang="ts">
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import type { InfoToken } from '#lib/core/data/info-tokens.ts';
	import { shownOrder, type FilledInfoToken } from '#lib/core/rules/info-token-characters.ts';
	import type { ShowableBluffSet } from '#lib/features/bluffs/bluffs.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import CharacterPicker from '#lib/features/show/CharacterPicker.svelte';
	import ShowToPlayer from '#lib/features/show/ShowToPlayer.svelte';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { tokenTitle } from './token-title.ts';
	import { characterCardsFor } from './character-cards.ts';
	import InfoTokenList, { QUICK_CARD_ID } from './InfoTokenList.svelte';
	import ChainBar from './ChainBar.svelte';
	import type { ChainCard } from './chain.ts';

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
		| { kind: 'characters'; token: InfoToken; max: number; filled?: FilledInfoToken }
		| { kind: 'sets'; token: InfoToken };

	let view = $state<View>({ kind: 'list' });
	let list = $state<ReturnType<typeof InfoTokenList>>();
	let picked = $state<CharacterId[]>([]);

	type Card = ChainCard;

	/**
	 * Tapping a card shows it at once; its + adds it to the cards shown together (Trevor,
	 * 2026-10-16: no mode switch). `adding` is true while the + of a card that asks for
	 * characters or a bluff set is being completed.
	 */
	let adding = $state(false);
	let chainCards = $state<Card[]>([]);

	let showOpen = $state(false);
	/** The quick card is showing on its own: closing goes back to its editor. */
	let quickShown = false;
	let shown = $state<Card[]>([]);
	/**
	 * Opened at one card (`openWith`): closing the player view closes the sheet too, straight
	 * back to what opened it, such as a night step (Trevor, 2026-10-26). Going back to the list
	 * keeps the sheet.
	 */
	let direct = false;

	const byId = $derived(new Map(characters.map((c) => [c.id, c])));
	const known = (ids: readonly CharacterId[]) =>
		ids.flatMap((id) => {
			const character = byId.get(id);
			return character ? [character] : [];
		});
	// Cards of characters in play (Trevor, 2026-10-16).
	const characterCards = $derived(
		characterCardsFor(inPlay ?? characters.map((c) => c.id), byId).flatMap((card) => {
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
	const title = $derived(view.kind === 'list' ? t('info-tokens.title') : tokenTitle(view.token));

	// Each time the sheet opens it starts at the list.
	$effect(() => {
		if (!open && !showOpen) {
			view = { kind: 'list' };
			direct = false;
		}
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

	function choose(token: InfoToken, add = false, detail?: string, filled?: FilledInfoToken) {
		adding = add;
		quickShown = token.id === QUICK_CARD_ID && !add;
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
		if (filled) {
			// Every place filled shows at once; with room left the picker opens with them
			// picked, to add to or change (Trevor, 2026-10-24).
			if (filled.characterIds.length >= filled.upTo) return use(token.text, order(filled));
			picked = [...filled.characterIds];
			view = { kind: 'characters', token, max: filled.upTo, filled };
			return;
		}
		if (token.asks?.characters) {
			picked = [];
			view = { kind: 'characters', token, max: token.asks.characters };
			return;
		}
		// "This is the Demon", "These are your Minions" and the rest: the Storyteller points.
		use(token.text, [], detail);
	}

	/** The characters in the order shown: good above evil on the Dreamer's card. */
	const order = (filled: FilledInfoToken | undefined, ids = filled?.characterIds ?? []) =>
		shownOrder(filled, ids, (id) => byId.get(id)?.type);

	/**
	 * Opens the sheet straight at one card, as tapped in the list: a night step's own cards
	 * (Trevor, 2026-10-19), with the characters the step fills in (Trevor, 2026-10-24).
	 * Closing goes back to the list.
	 */
	export function openWith(token: InfoToken, filled?: FilledInfoToken) {
		open = true;
		direct = true;
		choose(token, false, undefined, filled);
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

	function toList() {
		direct = false;
		view = { kind: 'list' };
	}

	/** The player view opens over the sheet, which stays open under it (Trevor, 2026-10-17). */
	function show(cards: Card[]) {
		if (cards.length === 0) return;
		shown = cards;
		view = { kind: 'list' };
		showOpen = true;
	}
</script>

<BottomSheet bind:open {title} height="85dvh">
	<!-- The quick card, in the header next to the X (Trevor, 2026-10-18); kept in place on
	     every view, usable on the list. -->
	{#snippet actions()}
		<IconButton
			icon="quickCard"
			label={t('info-tokens.quick')}
			outlined
			disabled={view.kind !== 'list'}
			onclick={() => list?.openQuick()}
		/>
	{/snippet}
	<ErrorBoundary area="info-tokens">
		{#if view.kind === 'list'}
			<InfoTokenList
				bind:this={list}
				quickInHeader
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
			<ChainBar bind:cards={chainCards} {characters} onshow={() => show(chainCards)} />
		{:else if view.kind === 'characters'}
			{@const token = view.token}
			{@const filled = view.filled}
			<CharacterPicker
				{characters}
				bind:selected={picked}
				max={view.max}
				label={t('info-tokens.characters')}
				inPlay={inPlay && new Set(inPlay)}
				notInPlay={token.asks?.notInPlay === true}
				onlyAlignment={view.filled?.othersAlignment}
			/>
			<ModalActions
				onCancel={toList}
				onConfirm={() => use(token.text, order(filled, picked))}
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
			<ModalActions onCancel={toList} />
		{/if}
	</ErrorBoundary>
	<!--
		Inside the sheet, so the sheet stays open under the player view (Trevor, 2026-10-17);
		outside the boundary, so a crash in the sheet never closes it.
	-->
	<ShowToPlayer
		bind:open={showOpen}
		cards={shownCards}
		onclose={() => {
			if (direct) open = false;
			else if (quickShown) list?.reopenQuick();
			quickShown = false;
		}}
	/>
</BottomSheet>

<style>
	/* A bluff set's characters wrap onto new lines rather than widening the row. */
	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		min-width: 0;
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
