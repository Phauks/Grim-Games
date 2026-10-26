<script lang="ts">
	import SetupNav from '#lib/features/setup/SetupNav.svelte';
	import { backToNewGame } from './new-game-draft.ts';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { fromScript, type Character, type CharacterId } from '#lib/core/data/index.ts';
	import {
		answerAsk,
		canRefuse,
		chooseOptions,
		dealTypes,
		pickableCharacters,
		refuseOffer,
		seatsLeft,
		STANDARD,
		startDraft,
		takeOffer
	} from '#lib/core/modes/index.ts';
	import type { SeatId } from '#lib/core/model/index.ts';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import { scriptJinxes, type BagSlot } from '#lib/core/rules/index.ts';
	import { splitPlayers, type SeatedType } from '#lib/core/rules/distribution.ts';
	import SharedPicker from '#lib/features/characters/CharacterPicker.svelte';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { TYPE_LABELS, TYPE_PLURALS } from '#lib/features/reference/labels.ts';
	import BagTiles from '#lib/features/setup/BagTiles.svelte';
	import type { SetupGamePort } from '#lib/features/setup/game-port.ts';
	import RevealDialog from '#lib/features/setup/RevealDialog.svelte';
	import { seatLabel } from '#lib/features/setup/seat-label.ts';
	import { remindersHref } from '#lib/features/setup/setup-steps.ts';
	import { tileMarks } from '#lib/features/setup/tile-face.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import Page from '#lib/ui/layout/Page.svelte';
	import { dealTitle } from './deal-title.ts';
	import { readDeal, writeDeal, type DealProgress } from './deal-progress.ts';
	import { readGameMode } from './game-mode-store.ts';
	import { gameModeOf } from './game-mode.ts';
	import OfferReels from './OfferReels.svelte';

	/**
	 * Characters for a mode that doesn't put characters in the bag, on the Storyteller's
	 * device passed round the table (Trevor, 2026-10-17): a draft (Sushi Buffet) or each player
	 * choosing a character of a dealt type (Whale Buffet). Players draw from the same bag of
	 * tiles as setup's draw (Trevor, 2026-10-18); a tile opens that seat's offer or dealt type,
	 * and the choice is revealed as an ordinary draw. Nothing on the screen counts the seats
	 * left (Trevor, 2026-10-18). Finishing puts the characters in the bag in seat order and
	 * deals them, so the board and its setup reminders follow as after an ordinary draw.
	 */
	interface Props {
		port: SetupGamePort;
	}

	let { port }: Props = $props();

	const game = $derived(port.game!);
	const gameId = $derived(game.gameId);
	const record = $derived(readGameMode(gameId));
	const mode = $derived(gameModeOf(gameId) ?? STANDARD);
	const assignment = $derived(mode.parts.assignment);
	const split = $derived(splitPlayers(game.seating.length));
	const seats = $derived(game.seating.slice(0, split.dealt));
	// The game's script is already the mode's (start.ts): its pool, less restricted characters.
	const characters = $derived(
		game.script.entries.flatMap((e): Character[] => {
			const c = e.kind === 'custom' ? e.character : port.lookup?.get(e.id);
			return c ? [c] : [];
		})
	);
	const byId = $derived(new Map(characters.map((c) => [c.id, c])));
	// TPI's jinxes and the script's own, among the draft's characters (Jinxed pairs on New game).
	const jinxes = $derived.by(() => {
		const data = officialData.current;
		if (!data) return [];
		const script = fromScript(game.script, data).script;
		return scriptJinxes(data.jinxes, byId.keys(), script.homebrewJinxes);
	});
	/**
	 * With the slot machine on (a Bag draw setting), reels run through every character a player
	 * can get: Sushi Buffet's offers spin in 3, 2, 1, and Whale Buffet's choice is revealed as
	 * any draw is (Trevor, 2026-10-23).
	 */
	const slotMachine = $derived(preferences.current.slotMachine);
	const reel = $derived(
		characters.filter((c) =>
			(['townsfolk', 'outsider', 'minion', 'demon'] as const).some((type) => type === c.type)
		)
	);
	let offerSpinning = $state(false);

	function fresh(): DealProgress | undefined {
		if (assignment?.kind === 'draft')
			return {
				kind: 'draft',
				state: startDraft(
					{
						...assignment,
						recycleUnchosen: record?.roleRecycling ?? assignment.recycleUnchosen,
						modifiers: mode.parts.setupModifiers?.kind === 'as-chosen',
						jinxes: record?.jinxedPairs ?? 'block'
					},
					split.counts,
					pickableCharacters(mode, characters),
					Math.random,
					jinxes
				)
			};
		if (assignment?.kind === 'choose-own')
			return { kind: 'choose', types: dealTypes(split.counts, Math.random), picks: [] };
		return undefined;
	}

	let progress = $state<DealProgress | undefined>();
	let restarting = $state(false);
	let choosing = $state(false);
	let revealing = $state<{ seatId: SeatId; character: Character; tile: number } | undefined>();
	let revealOpen = $state(false);
	$effect.pre(() => {
		if (progress) return;
		progress = readDeal(gameId) ?? fresh();
		if (!progress)
			void goto(resolve('/grimoire/[gameId]/setup', { gameId }), { replaceState: true });
	});

	/** Saves a change to the picks, keeping the bag's tiles unless given. */
	function save(next: DealProgress) {
		progress = {
			...next,
			drawn: next.drawn ?? progress?.drawn,
			held: 'held' in next ? next.held : progress?.held
		};
		writeDeal(gameId, progress);
	}

	const picks = $derived(
		progress?.kind === 'draft' ? progress.state.picks : (progress?.picks ?? [])
	);
	const done = $derived(
		progress?.kind === 'draft' ? seatsLeft(progress.state) === 0 : picks.length >= seats.length
	);
	const seatId = $derived(seats[picks.length]);
	const label = (id: SeatId | undefined) => (id ? seatLabel(game, id) : t('common.none'));

	// The bag: one tile per dealt seat. Saves from before the bag read as tiles drawn in order.
	const drawn = $derived(progress?.drawn ?? picks.map((_, i) => i + 1));
	const held = $derived(progress?.held);
	const slots = $derived(
		seats.map((_, i): BagSlot => {
			const number = i + 1;
			const taken = drawn.indexOf(number);
			return {
				tileId: `deal-${number}`,
				number,
				state: taken !== -1 ? 'drawn' : held === number ? 'held' : 'in-bag',
				...(taken !== -1 ? { seatId: seats[taken] } : held === number && seatId ? { seatId } : {})
			};
		})
	);
	const marks = $derived(
		tileMarks(
			slots.length,
			preferences.current.tileFace,
			`deal:${gameId}`,
			preferences.current.tileOrderRandom
		)
	);
	const markName = (number: number) => marks[number - 1]?.name ?? String(number);

	function draw(slot: BagSlot) {
		if (!progress || done || slot.state === 'drawn' || ask) return;
		if (slot.state === 'in-bag') {
			if (held !== undefined) return void (choosing = true);
			save({ ...progress, held: slot.number });
		}
		choosing = true;
	}

	const dealtType = $derived<SeatedType | undefined>(
		progress?.kind === 'choose' ? progress.types[picks.length] : undefined
	);
	const options = $derived.by((): Character[] => {
		if (!progress) return [];
		if (progress.kind === 'draft') return progress.state.offer.flatMap((id) => byId.get(id) ?? []);
		return dealtType ? chooseOptions(mode, characters, dealtType, picks) : [];
	});

	function pick(id: CharacterId) {
		if (!progress || held === undefined || !seatId) return;
		const tile = held;
		const seat = seatId;
		const bag = { drawn: [...drawn, tile], held: undefined };
		if (progress.kind === 'draft')
			save({ kind: 'draft', state: takeOffer(progress.state, id, Math.random), ...bag });
		else save({ ...progress, picks: [...progress.picks, id], ...bag });
		choosing = false;
		const character = byId.get(id);
		if (character) {
			revealing = { seatId: seat, character, tile };
			revealOpen = true;
		}
	}

	function confirmReveal(details: { playerName: string }) {
		const name = details.playerName.trim();
		if (revealing && name !== (game.seats[revealing.seatId]?.playerName ?? ''))
			port.dispatch({ type: 'RenameSeat', seatId: revealing.seatId, playerName: name });
		revealOpen = false;
	}

	/**
	 * A drafted character's setup change that is a choice (Trevor, 2026-10-26: "modifiers are
	 * made dynamically for outsider count"): the Storyteller chooses before the next tile.
	 */
	const ask = $derived(progress?.kind === 'draft' ? progress.state.ask : undefined);
	/** The character in play that sets this seat's only offer (the Choirboy's King). */
	const forcedBy = $derived(progress?.kind === 'draft' ? progress.state.forcedBy : undefined);
	let askOpen = $derived(ask !== undefined && !revealOpen && !choosing);
	function answer(total: number) {
		if (progress?.kind !== 'draft') return;
		save({ kind: 'draft', state: answerAsk(progress.state, total, Math.random) });
	}

	function refuse() {
		if (progress?.kind !== 'draft') return;
		save({ kind: 'draft', state: refuseOffer(progress.state, Math.random) });
	}

	/** The Storyteller asks the last player to choose again (Whale Buffet's reconsider). */
	function chooseAgain() {
		if (progress?.kind !== 'choose' || progress.picks.length === 0) return;
		const last = drawn.at(-1);
		save({
			...progress,
			picks: progress.picks.slice(0, -1),
			drawn: drawn.slice(0, -1),
			held: last
		});
	}

	async function finish() {
		const built = port.dispatch({
			type: 'BuildBag',
			tiles: picks.map((id) => ({ shows: id, grimoire: id })),
			includeTravellers: false,
			shuffle: false
		});
		if (!built.ok) return;
		const order = port.game?.bag?.order ?? [];
		seats.forEach((seat, i) => {
			const tileId = order[i];
			if (!tileId) return;
			port.dispatch({ type: 'DrawTile', seatId: seat, tileId });
			port.dispatch({ type: 'ConfirmDraw', tileId });
		});
		writeDeal(gameId, undefined);
		await port.flush();
		await goto(remindersHref(gameId));
	}
</script>

<Page title={dealTitle(gameId)}>
	{#snippet actions()}
		<Button variant="danger" icon="reset" onclick={() => (restarting = true)}>
			{t('modes.deal.restart')}
		</Button>
	{/snippet}

	<BagTiles {slots} {marks} seatLabel={label} onpick={draw} />

	<!-- The start flow's bar (Trevor, 2026-10-23): Back to New game as it was, until a tile is
	     drawn; Restart starts the deal over after that. -->
	<SetupNav
		onBack={() => void backToNewGame(gameId)}
		backDisabled={picks.length > 0 || held !== undefined}
		backLabel={t('setup.newGame')}
	>
		{#snippet next()}
			<span class="footer">
				{#if progress?.kind === 'choose' && assignment?.kind === 'choose-own' && assignment.reconsider}
					<Button
						icon="undo"
						disabled={picks.length === 0 || held !== undefined}
						onclick={chooseAgain}
					>
						{t('modes.deal.chooseAgain')}
					</Button>
				{/if}
				<Button variant="accent" icon="check" disabled={!done} onclick={finish}>
					{t('modes.deal.finish')}
				</Button>
			</span>
		{/snippet}
	</SetupNav>
</Page>

<!-- The seat's offer or dealt type, for the player who drew the tile only. -->
<Dialog
	bind:open={choosing}
	title={held !== undefined ? t('setup.draw.tile', { number: markName(held) }) : ''}
	size="full"
>
	<div class="choose">
		<p class="seat">{label(seatId)}</p>
		<!-- A character another needs in play (Grimbits' draft): the player is told which. -->
		{#if forcedBy}
			{@const by = byId.get(forcedBy)}
			<p class="prompt" data-testid="forced-by">
				{t('modes.deal.forced')}{#if by}<CharacterBadge characterId={by.id} character={by} />{/if}
			</p>
		{:else}
			<p class="prompt">
				{dealtType
					? t('modes.deal.dealtType', { type: TYPE_LABELS[dealtType] })
					: t('modes.deal.offer')}
			</p>
		{/if}
		{#if slotMachine && progress?.kind === 'draft' && assignment?.kind === 'draft'}
			<OfferReels
				offer={options}
				size={assignment.offers[0] ?? options.length}
				{reel}
				bind:spinning={offerSpinning}
			/>
		{/if}
		{#if options.length === 0}
			<p>{t('modes.deal.noOptions')}</p>
		{:else}
			<!-- Kept back while the reels spin: they show the offer first. -->
			<div class="list" class:spinning={offerSpinning} inert={offerSpinning}>
				<SharedPicker
					characters={options}
					collapsibleKey="deal"
					showSearch={progress?.kind !== 'draft'}
					onSelect={pick}
				/>
			</div>
		{/if}
		{#if progress?.kind === 'draft'}
			<Button icon="random" disabled={!canRefuse(progress.state) || offerSpinning} onclick={refuse}>
				{t('modes.deal.refuse')}
			</Button>
		{/if}
	</div>
</Dialog>

<!-- Answered before the next tile, so it can't be closed without a choice. -->
{#if ask}
	{@const asked = byId.get(ask.characterId)}
	<Dialog
		bind:open={askOpen}
		title={t('modes.deal.askTitle')}
		closeButton={false}
		beforeClose={() => false}
	>
		{#snippet subtitle()}{#if asked}<CharacterBadge
					characterId={asked.id}
					character={asked}
				/>{/if}{/snippet}
		<div class="ask" data-testid="draft-ask">
			<p class="prompt">{t('modes.deal.askCount', { type: TYPE_PLURALS[ask.type] })}</p>
			<div class="options">
				{#each ask.options as total (total)}
					<Button onclick={() => answer(total)}>{String(total)}</Button>
				{/each}
				{#if !ask.options.includes(ask.current)}
					<Button onclick={() => answer(ask.current)}>
						{t('modes.deal.askKeep', { count: ask.current })}
					</Button>
				{/if}
			</div>
		</div>
	</Dialog>
{/if}

{#if revealing}
	<RevealDialog
		bind:open={revealOpen}
		number={markName(revealing.tile)}
		shows={revealing.character}
		needsAlignment={false}
		seatLabel={label(revealing.seatId)}
		playerName={game.seats[revealing.seatId]?.playerName ?? ''}
		onConfirm={confirmReveal}
		reel={slotMachine && progress?.kind === 'choose' ? reel : []}
	/>
{/if}

<ConfirmDialog
	bind:open={restarting}
	title={t('modes.deal.restartConfirm')}
	danger
	onConfirm={() => {
		const next = fresh();
		if (next) save({ ...next, drawn: [], held: undefined });
	}}
/>

<style>
	.footer {
		display: flex;
		gap: var(--space-2);
	}
	/* A full dialog doesn't scroll itself: its content does. */
	.choose {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		gap: var(--space-3);
	}
	.seat,
	.prompt {
		margin: 0;
	}
	.prompt {
		font-weight: 600;
	}
	.ask,
	.options {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.ask {
		flex-direction: column;
	}
	.list.spinning {
		visibility: hidden;
	}
	.list {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}
</style>
