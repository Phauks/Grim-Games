<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import {
		canRefuse,
		chooseOptions,
		dealTypes,
		pickableCharacters,
		refuseOffer,
		seatsLeft,
		setSlots,
		STANDARD,
		startDraft,
		takeOffer,
		type DraftState
	} from '#lib/core/modes/index.ts';
	import type { SeatId } from '#lib/core/model/index.ts';
	import type { BagSlot } from '#lib/core/rules/index.ts';
	import { SEATED_TYPES, splitPlayers, type SeatedType } from '#lib/core/rules/distribution.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import SharedPicker from '#lib/features/characters/CharacterPicker.svelte';
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
	import Stepper from '#lib/ui/primitives/Stepper.svelte';
	import Page from '#lib/ui/layout/Page.svelte';
	import { dealTitle } from './deal-title.ts';
	import { findMode } from './custom-modes.svelte.ts';
	import { readDeal, writeDeal, type DealProgress } from './deal-progress.ts';
	import { readGameMode } from './game-mode-store.ts';

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
	const mode = $derived(findMode(record?.modeId ?? '') ?? STANDARD);
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

	function fresh(): DealProgress | undefined {
		if (assignment?.kind === 'draft')
			return {
				kind: 'draft',
				state: startDraft(
					{ ...assignment, recycleUnchosen: record?.roleRecycling ?? assignment.recycleUnchosen },
					split.counts,
					pickableCharacters(mode, characters),
					Math.random
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
	const marks = $derived(tileMarks(slots.length, preferences.current.tileFace, `deal:${gameId}`));
	const markName = (number: number) => marks[number - 1]?.name ?? String(number);

	function draw(slot: BagSlot) {
		if (!progress || done || slot.state === 'drawn') return;
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
			save({ kind: 'draft', state: takeOffer(progress.state, id, byId, Math.random), ...bag });
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

	function changeSlot(state: DraftState, type: SeatedType, by: number) {
		const slots = { ...state.slots, [type]: Math.max(0, state.slots[type] + by) };
		save({ kind: 'draft', state: setSlots(state, slots, Math.random) });
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
		<Button variant="danger-quiet" icon="reset" onclick={() => (restarting = true)}>
			{t('modes.deal.restart')}
		</Button>
	{/snippet}

	<!-- The Storyteller's controls between seats: the open slots and drafted setup changes. -->
	{#if progress?.kind === 'draft'}
		{@const state = progress.state}
		<div class="slots" role="group" aria-label={t('modes.deal.openSlots')}>
			{#each SEATED_TYPES as type (type)}
				<span class="slot">
					<Stepper
						value={state.slots[type]}
						label={TYPE_PLURALS[type]}
						lessLabel={t('modes.deal.fewer', { type: TYPE_PLURALS[type] })}
						moreLabel={t('modes.deal.more', { type: TYPE_PLURALS[type] })}
						onchange={(n) => changeSlot(state, type, n - state.slots[type])}
					>
						{#snippet display()}<span class="count" data-type={type}
								>{TYPE_PLURALS[type]} {state.slots[type]}</span
							>{/snippet}
					</Stepper>
				</span>
			{/each}
		</div>
		<div class="decisions" aria-live="polite">
			<span class="muted">{t('modes.deal.decisions')}</span>
			{#if state.decisions.length === 0}
				{t('common.none')}
			{:else}
				{#each state.decisions as id (id)}<CharacterBadge characterId={id} inline />{/each}
			{/if}
		</div>
	{/if}

	<p class="next">
		<span class="muted">{t('setup.draw.next')}</span>
		<span data-testid="next-seat">{done ? t('common.none') : label(seatId)}</span>
	</p>
	<BagTiles {slots} {marks} seatLabel={label} onpick={draw} />

	<div class="footer">
		{#if progress?.kind === 'choose' && assignment?.kind === 'choose-own' && assignment.reconsider}
			<Button icon="undo" disabled={picks.length === 0 || held !== undefined} onclick={chooseAgain}>
				{t('modes.deal.chooseAgain')}
			</Button>
		{/if}
		<Button variant="accent" icon="check" disabled={!done} onclick={finish}>
			{t('modes.deal.finish')}
		</Button>
	</div>
</Page>

<!-- The seat's offer or dealt type, for the player who drew the tile only. -->
<Dialog
	bind:open={choosing}
	title={held !== undefined ? t('setup.draw.tile', { number: markName(held) }) : ''}
	size="full"
>
	<div class="choose">
		<p class="seat">{label(seatId)}</p>
		<p class="prompt">
			{dealtType
				? t('modes.deal.dealtType', { type: TYPE_LABELS[dealtType] })
				: t('modes.deal.offer')}
		</p>
		{#if options.length === 0}
			<p>{t('modes.deal.noOptions')}</p>
		{:else}
			<div class="list">
				<SharedPicker
					characters={options}
					collapsibleKey="deal"
					showSearch={progress?.kind !== 'draft'}
					onSelect={pick}
				/>
			</div>
		{/if}
		{#if progress?.kind === 'draft'}
			<Button icon="random" disabled={!canRefuse(progress.state)} onclick={refuse}>
				{t('modes.deal.refuse')}
			</Button>
		{/if}
	</div>
</Dialog>

{#if revealing}
	<RevealDialog
		bind:open={revealOpen}
		number={markName(revealing.tile)}
		shows={revealing.character}
		needsAlignment={false}
		seatLabel={label(revealing.seatId)}
		playerName={game.seats[revealing.seatId]?.playerName ?? ''}
		onConfirm={confirmReveal}
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
	.muted {
		color: var(--on-surface-muted);
	}
	.slots {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(calc(10 * var(--u)), 1fr));
		gap: var(--space-2);
	}
	.slot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-1);
	}
	.count {
		font-variant-numeric: tabular-nums;
		text-align: center;
	}
	.decisions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
	}
	.next {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
		margin: var(--space-2) 0;
	}
	.footer {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
		margin-top: var(--space-3);
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
	.list {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}
</style>
