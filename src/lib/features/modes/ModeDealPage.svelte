<script lang="ts">
	import SetupNav from '#lib/features/setup/SetupNav.svelte';
	import { backToNewGame } from './new-game-draft.ts';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { fromScript, type Character, type CharacterId } from '#lib/core/data/index.ts';
	import {
		answerAbility,
		answerAsk,
		answerHidden,
		canRedraft,
		canRefuse,
		chooseOptions,
		conversions,
		turnableSeats,
		turnOptions,
		draftedTurned,
		dealTypes,
		hiddenAsTownsfolk,
		pickableCharacters,
		redraft,
		refuseOffer,
		reservedHidden,
		reservedSeats,
		seatsLeft,
		STANDARD,
		startDraft,
		takeOffer
	} from '#lib/core/modes/index.ts';
	import type { SeatId } from '#lib/core/model/index.ts';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import {
		isReplacedAfterDraw,
		replacementReminder,
		scriptJinxes,
		type BagSlot
	} from '#lib/core/rules/index.ts';
	import { SEATED_TYPES, splitPlayers, type SeatedType } from '#lib/core/rules/distribution.ts';
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
	import DraftConversion from './DraftConversion.svelte';
	import DraftSeatList from './DraftSeatList.svelte';

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
						oneTypePerOffer: record?.oneTypePerOffer ?? assignment.oneTypePerOffer,
						dealsRequired: record?.dealsRequired ?? true,
						modifiers: mode.parts.setupModifiers?.kind === 'as-chosen',
						jinxes: record?.jinxedPairs ?? 'allow',
						ivory: record?.ivoryDraft ?? false,
						hidden: characters.filter(isReplacedAfterDraw).map((c) => c.id),
						...(record?.marionette ? { reserve: reservedHidden(characters)[0] } : {})
					},
					split.counts,
					// Lil' Monsta is never dealt, but drafted it turns its player into a Minion.
					mode.parts.setupModifiers?.kind === 'as-chosen'
						? [...pickableCharacters(mode, characters), ...draftedTurned(characters)]
						: pickableCharacters(mode, characters),
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
		progress?.kind === 'draft'
			? seatsLeft(progress.state) === 0 &&
					!progress.state.ask &&
					!progress.state.choice &&
					!progress.state.ability
			: picks.length >= seats.length
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
		if (!progress || done || slot.state === 'drawn' || ask || choice || ability) return;
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
		if (progress.kind === 'draft') {
			const next = takeOffer(progress.state, id, Math.random);
			// Turned into another type (Lil' Monsta's Minion): the same player drafts again.
			save({ kind: 'draft', state: next, ...(next.turnedBy ? {} : bag) });
		} else save({ ...progress, picks: [...progress.picks, id], ...bag });
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
		if (turnedBy && held !== undefined) choosing = true;
	}

	/**
	 * A drafted character's setup change that is a choice (Trevor, 2026-10-26: "modifiers are
	 * made dynamically for outsider count"): the Storyteller chooses before the next tile.
	 */
	const ask = $derived(progress?.kind === 'draft' ? progress.state.ask : undefined);
	/** The character in play that sets this seat's only offer (the Choirboy's King). */
	const forcedBy = $derived(progress?.kind === 'draft' ? progress.state.forcedBy : undefined);
	/** The character in play that turned this seat's player into the type offered (Lil' Monsta). */
	const turnedBy = $derived(progress?.kind === 'draft' ? progress.state.turnedBy : undefined);
	let askOpen = $derived(ask !== undefined && !revealOpen && !choosing);
	function answer(total: number) {
		if (progress?.kind !== 'draft') return;
		save({ kind: 'draft', state: answerAsk(progress.state, total, Math.random) });
	}

	/**
	 * A drafted character that may really be a hidden one (Grimbits' draft: the Atheist may be
	 * the Drunk): the Storyteller chooses before the next tile.
	 */
	const choice = $derived(progress?.kind === 'draft' ? progress.state.choice : undefined);
	let choiceOpen = $derived(choice !== undefined && !revealOpen && !choosing);
	function answerChoice(isHidden: boolean) {
		if (progress?.kind !== 'draft') return;
		save({ kind: 'draft', state: answerHidden(progress.state, isHidden, Math.random) });
	}

	/**
	 * A drafted character that gains a not-in-play character's ability (Grimbits' draft: the
	 * Alchemist's Minion ability): the Storyteller chooses one that changes setup, or Later.
	 */
	const ability = $derived(progress?.kind === 'draft' ? progress.state.ability : undefined);
	let abilityOpen = $derived(ability !== undefined && !revealOpen && !choosing);
	function answerGained(chosen: CharacterId | undefined) {
		if (progress?.kind !== 'draft') return;
		save({ kind: 'draft', state: answerAbility(progress.state, chosen, Math.random) });
	}

	function refuse() {
		if (progress?.kind !== 'draft') return;
		save({ kind: 'draft', state: refuseOffer(progress.state, Math.random) });
	}

	/**
	 * Redraft (Grimbits' draft): the Storyteller lets the last player draft again, of any type
	 * or one they name. Their tile goes back to them, so it opens the new offer.
	 */
	let redrafting = $state(false);
	const previousSlots = $derived(
		progress?.kind === 'draft' ? progress.state.previous?.slots : undefined
	);
	const redraftTypes = $derived(
		previousSlots ? SEATED_TYPES.filter((type) => previousSlots[type] > 0) : []
	);
	function draftAgain(type: SeatedType | undefined) {
		redrafting = false;
		if (progress?.kind !== 'draft' || !canRedraft(progress.state)) return;
		const last = drawn.at(-1);
		save({
			kind: 'draft',
			state: redraft(progress.state, type, Math.random),
			drawn: drawn.slice(0, -1),
			held: last
		});
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

	/**
	 * The Drunk, when the draft's characters hold it: once every seat has drafted, the
	 * Storyteller picks which drafted Townsfolk is really the Drunk, or none (Trevor,
	 * 2026-10-26, "force a drunk"). That seat's tile carries its "Is The Drunk" token, which
	 * the setup reminders then suggest on the seat, as after an ordinary draw.
	 */
	const hiddenSeats = $derived(
		progress?.kind === 'draft' ? (progress.state.hiddenSeats ?? {}) : {}
	);
	// Not asked again when a drafted character's hidden choice already made a seat it.
	const hidden = $derived(
		progress?.kind === 'draft'
			? hiddenAsTownsfolk(characters).find((c) => !Object.values(hiddenSeats).includes(c.id))
			: undefined
	);
	const townsfolkSeats = $derived(
		picks.flatMap((id, i) => (byId.get(id)?.type === 'townsfolk' ? [i] : []))
	);
	let hiding = $state(false);
	// A seat (by pick index) as the Storyteller's lists of seats show it, with what it drafted.
	const seatName = (i: number) => label(seats[i]);
	const kept = (i: number) => byId.get(picks[i]);
	let drunkAt = $state<number | undefined>();

	/**
	 * The Marionette, with its New game switch on (Grimbits' draft): a Minion seat was kept out
	 * of the draft, so the Storyteller picks which good neighbour of the Demon is really it.
	 */
	const reserve = $derived(
		progress?.kind === 'draft' && progress.state.reserved
			? progress.state.config.reserve
			: undefined
	);
	const reservedCharacter = $derived(reserve ? byId.get(reserve.id) : undefined);
	const reserveSeats = $derived(
		progress?.kind === 'draft' && reserve
			? reservedSeats(progress.state, reserve, [
					...Object.keys(hiddenSeats).map(Number),
					...(drunkAt !== undefined ? [drunkAt] : [])
				])
			: []
	);
	let placing = $state(false);
	let reservedAt = $state<number | undefined>();

	/**
	 * A drafted character that turns players into another type (Grimbits' draft: the Kazali's
	 * Minions, the Lord of Typhon's neighbours, who pick their own): the players turn last. A game
	 * has one Demon, so one such character at most.
	 */
	const conversion = $derived(
		progress?.kind === 'draft' ? conversions(progress.state)[0] : undefined
	);
	const convertSeats = $derived(
		progress?.kind === 'draft' && conversion
			? turnableSeats(progress.state, conversion, [drunkAt, reservedAt])
			: []
	);
	const convertOptions = $derived(
		progress?.kind === 'draft' && conversion
			? turnOptions(progress.state, conversion, pickableCharacters(mode, characters))
			: []
	);
	let converting = $state(false);

	function finishTapped() {
		drunkAt = undefined;
		reservedAt = undefined;
		if (hidden && townsfolkSeats.length > 0) hiding = true;
		else afterHidden();
	}

	function chooseHidden(at: number | undefined) {
		hiding = false;
		drunkAt = at;
		afterHidden();
	}

	function afterHidden() {
		if (reservedCharacter && reserveSeats.length > 0) placing = true;
		else afterReserved(undefined);
	}

	function afterReserved(at: number | undefined) {
		placing = false;
		reservedAt = at;
		if (conversion && convertSeats.length > 0) converting = true;
		else void finish();
	}

	async function finish(turned: Record<number, CharacterId> = {}) {
		hiding = false;
		converting = false;
		const placed: Record<number, Character> = {};
		if (hidden && drunkAt !== undefined) placed[drunkAt] = hidden;
		if (reservedCharacter && reservedAt !== undefined) placed[reservedAt] = reservedCharacter;
		const tokenAt = (i: number) => {
			const as = byId.get(hiddenSeats[i]) ?? placed[i];
			return as ? replacementReminder(as) : undefined;
		};
		const built = port.dispatch({
			type: 'BuildBag',
			tiles: picks.map((id, i) => {
				const into = turned[i];
				if (into) return { shows: into, grimoire: into };
				const reminder = tokenAt(i);
				return { shows: id, grimoire: id, ...(reminder ? { reminders: [reminder] } : {}) };
			}),
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
				{#if progress?.kind === 'draft'}
					<Button
						icon="undo"
						disabled={!canRedraft(progress.state) || held !== undefined}
						onclick={() => (redrafting = true)}
					>
						{t('modes.deal.redraft')}
					</Button>
				{/if}
				{#if progress?.kind === 'choose' && assignment?.kind === 'choose-own' && assignment.reconsider}
					<Button
						icon="undo"
						disabled={picks.length === 0 || held !== undefined}
						onclick={chooseAgain}
					>
						{t('modes.deal.chooseAgain')}
					</Button>
				{/if}
				<Button variant="accent" icon="check" disabled={!done} onclick={finishTapped}>
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
		{#if turnedBy && progress?.kind === 'draft' && progress.state.onlyType}
			{@const by = byId.get(turnedBy)}
			<p class="prompt" data-testid="turned-by">
				{t('modes.deal.turned', {
					type: TYPE_LABELS[progress.state.onlyType]
				})}{#if by}<CharacterBadge characterId={by.id} character={by} />{/if}
			</p>
		{:else if forcedBy}
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
				size={progress.state.config.offers[0] ?? options.length}
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
				<!-- Or the player drafts again, as Grimbits does for a rejected Legion. -->
				{#if progress?.kind === 'draft' && canRedraft(progress.state)}
					<Button icon="undo" onclick={() => draftAgain(undefined)}>
						{t('modes.deal.redraft')}
					</Button>
				{/if}
			</div>
		</div>
	</Dialog>
{/if}

<!-- Answered before the next tile, as a setup change is. -->
{#if choice}
	{@const drafted = byId.get(choice.characterId)}
	{@const really = byId.get(choice.hidden)}
	<Dialog
		bind:open={choiceOpen}
		title={t('modes.deal.askTitle')}
		closeButton={false}
		beforeClose={() => false}
	>
		{#snippet subtitle()}{#if drafted}<CharacterBadge
					characterId={drafted.id}
					character={drafted}
				/>{/if}{/snippet}
		<div class="ask" data-testid="draft-hidden-choice">
			<p class="prompt">
				{t('modes.deal.hiddenChoice')}{#if really}<CharacterBadge
						characterId={really.id}
						character={really}
					/>{/if}
			</p>
			<div class="options">
				<Button onclick={() => answerChoice(false)}>{t('modes.deal.asDrafted')}</Button>
				<Button onclick={() => answerChoice(true)}>{t('modes.deal.reallyHidden')}</Button>
				{#if progress?.kind === 'draft' && canRedraft(progress.state)}
					<Button icon="undo" onclick={() => draftAgain(undefined)}>
						{t('modes.deal.redraft')}
					</Button>
				{/if}
			</div>
		</div>
	</Dialog>
{/if}

<!-- Answered before the next tile, as a setup change is. -->
{#if ability}
	{@const drafted = byId.get(ability.characterId)}
	<Dialog
		bind:open={abilityOpen}
		title={t('modes.deal.askTitle')}
		closeButton={false}
		beforeClose={() => false}
	>
		{#snippet subtitle()}{#if drafted}<CharacterBadge
					characterId={drafted.id}
					character={drafted}
				/>{/if}{/snippet}
		<div class="ask" data-testid="draft-ability">
			<p class="prompt">{t('modes.deal.abilityPrompt')}</p>
			<!-- Each ability that changes setup now, then Later. -->
			<ul class="seats" data-testid="ability-options">
				{#each ability.options as id (id)}
					{@const option = byId.get(id)}
					{#if option}
						<li>
							<Button onclick={() => answerGained(id)}>{t('modes.deal.abilityTake')}</Button>
							<CharacterBadge characterId={option.id} character={option} />
						</li>
					{/if}
				{/each}
				<li>
					<Button onclick={() => answerGained(undefined)}>{t('modes.deal.abilityLater')}</Button>
				</li>
			</ul>
			{#if progress?.kind === 'draft' && canRedraft(progress.state)}
				<div class="options">
					<Button icon="undo" onclick={() => draftAgain(undefined)}>
						{t('modes.deal.redraft')}
					</Button>
				</div>
			{/if}
		</div>
	</Dialog>
{/if}

<Dialog bind:open={redrafting} title={t('modes.deal.redraft')}>
	<div class="ask" data-testid="redraft">
		<p class="prompt">{t('modes.deal.redraftType')}</p>
		<div class="options">
			<Button onclick={() => draftAgain(undefined)}>{t('modes.deal.redraftAny')}</Button>
			{#each redraftTypes as type (type)}
				<Button onclick={() => draftAgain(type)}>{TYPE_LABELS[type]}</Button>
			{/each}
		</div>
	</div>
</Dialog>

{#if hidden}
	<Dialog bind:open={hiding} title={t('modes.deal.hiddenTitle')}>
		<div class="ask" data-testid="draft-hidden">
			<p class="prompt">
				{t('modes.deal.hiddenPrompt')}<CharacterBadge characterId={hidden.id} character={hidden} />
			</p>
			<DraftSeatList
				seats={townsfolkSeats}
				seatLabel={seatName}
				{kept}
				onPick={chooseHidden}
				last={t('common.none')}
				onLast={() => chooseHidden(undefined)}
				testid="hidden-seats"
			/>
		</div>
	</Dialog>
{/if}

{#if reservedCharacter && reserve}
	<Dialog bind:open={placing} title={t('modes.deal.hiddenTitle')}>
		<div class="ask" data-testid="draft-reserved">
			<p class="prompt">
				{t('modes.deal.reservedPrompt', {
					type: TYPE_LABELS[reserve.nextTo]
				})}<CharacterBadge characterId={reservedCharacter.id} character={reservedCharacter} />
			</p>
			<DraftSeatList
				seats={reserveSeats}
				seatLabel={seatName}
				{kept}
				onPick={afterReserved}
				last={t('common.none')}
				onLast={() => afterReserved(undefined)}
				testid="reserved-seats"
			/>
		</div>
	</Dialog>
{/if}

{#if conversion && converting}
	<DraftConversion
		bind:open={converting}
		{conversion}
		by={byId.get(conversion.characterId)}
		seats={convertSeats}
		seatLabel={seatName}
		{kept}
		characters={convertOptions}
		offers={progress?.kind === 'draft' ? progress.state.config.offers : [1]}
		onDone={(turned) => void finish(turned)}
	/>
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
	.seats {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.seats li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding-block: var(--space-1);
		border-bottom: var(--card-border);
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
