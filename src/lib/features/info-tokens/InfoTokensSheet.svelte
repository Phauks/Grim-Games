<script lang="ts">
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
		/** No bluffs chosen yet: called (with this sheet closed) to open the bluff picker. */
		onChooseBluffs?: () => void;
	}

	let { open = $bindable(false), characters, bluffSets, onChooseBluffs }: Props = $props();

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
	const shownCards = $derived(
		shown.map((card) => ({
			title: card.text,
			characters: card.characterIds.flatMap((id) => {
				const character = byId.get(id);
				return character ? [{ character }] : [];
			})
		}))
	);
	const chainSummary = $derived(
		chainCards
			.map((card, i) => {
				const who = card.characterIds.length ? ` (${names(card.characterIds)})` : '';
				return `${i + 1}. ${plainText(card.text)}${who}`;
			})
			.join('  ')
	);
	const title = $derived(view.kind === 'list' ? 'Info tokens' : plainText(view.token.text));

	// Each time the sheet opens it starts at the list.
	$effect(() => {
		if (!open && !showOpen) view = { kind: 'list' };
	});

	function choose(token: InfoToken) {
		if (token.id === 'not-in-play' && bluffSets) {
			if (bluffSets.length === 1) return use(token.text, bluffSets[0].characterIds);
			if (bluffSets.length > 1) {
				view = { kind: 'sets', token };
				return;
			}
			if (onChooseBluffs) {
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
	function use(text: string, characterIds: readonly CharacterId[] = []) {
		const card = { text, characterIds: [...characterIds] };
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
					label="How cards are shown"
					hideLabel
					value={mode}
					options={[
						{ value: 'now', label: 'Show now' },
						{ value: 'chain', label: 'Chain' }
					]}
					onChange={(value) => (mode = value)}
				/>
			</div>
			<div class="search">
				<Icon name="search" />
				<input
					bind:value={query}
					type="search"
					aria-label="Search info tokens"
					placeholder="Search"
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
					aria-label="Clear search"
					disabled={query === ''}
					onclick={() => (query = '')}><Icon name="close" /></button
				>
			</div>
			<InfoTokenList onchoose={choose} {query} level={3} />
			{#if mode === 'chain'}
				<div class="chain" role="group" aria-label="Chain">
					<p class="chain-summary" data-testid="chain-summary">
						{chainCards.length === 0 ? 'Tap cards to add them in order.' : chainSummary}
					</p>
					<div class="chain-actions">
						<IconButton
							icon="undo"
							label="Remove last card"
							disabled={chainCards.length === 0}
							onclick={() => (chainCards = chainCards.slice(0, -1))}
						/>
						<Button
							variant="quiet"
							disabled={chainCards.length === 0}
							onclick={() => (chainCards = [])}>Clear</Button
						>
						<Button
							variant="accent"
							icon="forward"
							disabled={chainCards.length === 0}
							onclick={() => show(chainCards)}
							>Show {chainCards.length} {chainCards.length === 1 ? 'card' : 'cards'}</Button
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
				label="Characters"
			/>
			<div class="sheet-actions">
				<Button variant="quiet" onclick={() => (view = { kind: 'list' })}>Cancel</Button>
				<Button
					variant="accent"
					icon={mode === 'chain' ? 'add' : 'forward'}
					onclick={() => use(token.text, picked)}>{mode === 'chain' ? 'Add' : 'Show'}</Button
				>
			</div>
		{:else}
			{@const token = view.token}
			<ul class="sets" aria-label="Bluff sets">
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
				<Button variant="quiet" onclick={() => (view = { kind: 'list' })}>Cancel</Button>
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
	.chain-summary {
		margin: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		opacity: 0.85;
	}
	.chain-actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-2);
	}
	.chain-actions :global(.icon-button) {
		color: inherit;
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
