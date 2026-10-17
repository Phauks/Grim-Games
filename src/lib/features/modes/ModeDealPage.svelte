<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import {
		canRefuse,
		chooseOptions,
		dealTypes,
		gameModeById,
		pickableCharacters,
		refuseOffer,
		seatsLeft,
		setSlots,
		STANDARD,
		startDraft,
		takeOffer,
		type DraftState
	} from '#lib/core/modes/index.ts';
	import { seatNumber } from '#lib/core/model/index.ts';
	import { SEATED_TYPES, splitPlayers, type SeatedType } from '#lib/core/rules/distribution.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import SharedPicker from '#lib/features/characters/CharacterPicker.svelte';
	import { TYPE_LABELS, TYPE_PLURALS } from '#lib/features/reference/labels.ts';
	import type { SetupGamePort } from '#lib/features/setup/game-port.ts';
	import { remindersHref } from '#lib/features/setup/setup-steps.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Page from '#lib/ui/layout/Page.svelte';
	import { dealTitle } from './deal-title.ts';
	import { readDeal, writeDeal, type DealProgress } from './deal-progress.ts';
	import { readGameMode } from './game-mode-store.ts';

	/**
	 * Characters for a mode that doesn't use the bag, on the Storyteller's device passed round
	 * the table (Trevor, 2026-10-17): a draft (Sushi Buffet) or each player choosing a
	 * character of a dealt type (Whale Buffet). Each seat starts covered, so the next player
	 * doesn't see the last one's choice. Finishing puts the characters in the bag in seat order
	 * and deals them, so the board and its setup reminders follow as after an ordinary draw.
	 */
	interface Props {
		port: SetupGamePort;
	}

	let { port }: Props = $props();

	const game = $derived(port.game!);
	const gameId = $derived(game.gameId);
	const record = $derived(readGameMode(gameId));
	const mode = $derived(gameModeById(record?.modeId ?? '') ?? STANDARD);
	const assignment = $derived(mode.parts.assignment);
	const split = $derived(splitPlayers(game.seating.length));
	const seats = $derived(game.seating.slice(0, split.dealt));
	const scriptCharacters = $derived(
		game.script.entries.flatMap((e): Character[] => {
			const c = e.kind === 'custom' ? e.character : port.lookup?.get(e.id);
			return c ? [c] : [];
		})
	);
	// The game's script is already the mode's (start.ts): its pool, less restricted characters.
	const characters = $derived(scriptCharacters);

	function fresh(): DealProgress | undefined {
		if (assignment?.kind === 'draft')
			return {
				kind: 'draft',
				state: startDraft(
					assignment,
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
	let covered = $state(true);
	let restarting = $state(false);
	$effect.pre(() => {
		if (progress) return;
		progress = readDeal(gameId) ?? fresh();
		if (!progress)
			void goto(resolve('/grimoire/[gameId]/setup', { gameId }), { replaceState: true });
	});

	function save(next: DealProgress) {
		progress = next;
		writeDeal(gameId, next);
	}

	const picks = $derived(
		progress?.kind === 'draft' ? progress.state.picks : (progress?.picks ?? [])
	);
	const done = $derived(
		progress?.kind === 'draft' ? seatsLeft(progress.state) === 0 : picks.length >= seats.length
	);
	const seatId = $derived(seats[picks.length]);
	const seatName = $derived.by(() => {
		if (!seatId) return '';
		const number = t('common.seat', { number: seatNumber(game, seatId) ?? 0 });
		const name = game.seats[seatId]?.playerName;
		return name ? `${number} · ${name}` : number;
	});
	const dealtType = $derived<SeatedType | undefined>(
		progress?.kind === 'choose' ? progress.types[picks.length] : undefined
	);
	const options = $derived.by((): Character[] => {
		if (!progress) return [];
		if (progress.kind === 'draft') {
			const byId = new Map(characters.map((c) => [c.id, c]));
			return progress.state.offer.flatMap((id) => byId.get(id) ?? []);
		}
		return dealtType ? chooseOptions(mode, characters, dealtType, picks) : [];
	});

	function pick(id: CharacterId) {
		if (!progress) return;
		if (progress.kind === 'draft') {
			const byId = new Map(characters.map((c) => [c.id, c]));
			save({ kind: 'draft', state: takeOffer(progress.state, id, byId, Math.random) });
		} else {
			save({ ...progress, picks: [...progress.picks, id] });
		}
		covered = true;
	}

	function refuse() {
		if (progress?.kind !== 'draft') return;
		save({ kind: 'draft', state: refuseOffer(progress.state, Math.random) });
	}

	/** The Storyteller asks the last player to choose again (Whale Buffet's reconsider). */
	function chooseAgain() {
		if (progress?.kind !== 'choose' || progress.picks.length === 0) return;
		save({ ...progress, picks: progress.picks.slice(0, -1) });
		covered = true;
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

<Page title={dealTitle(gameId)} width="text">
	{#snippet actions()}
		<Button variant="danger-quiet" icon="reset" onclick={() => (restarting = true)}>
			{t('modes.deal.restart')}
		</Button>
	{/snippet}
	{#snippet subtitle()}
		<span data-testid="seats-left">
			{t('modes.deal.seatsLeft', { count: Math.max(0, seats.length - picks.length) })}
		</span>
	{/snippet}

	<div class="stage">
		{#if done}
			<div class="cover">
				<Button variant="accent" icon="check" onclick={finish}>{t('modes.deal.finish')}</Button>
			</div>
		{:else if covered}
			<!-- Between seats only: the slots and drafted setup changes are the Storyteller's. -->
			{#if progress?.kind === 'draft'}
				{@const state = progress.state}
				<div class="slots" role="group" aria-label={t('modes.deal.openSlots')}>
					{#each SEATED_TYPES as type (type)}
						<span class="slot">
							<IconButton
								icon="minus"
								label={t('modes.deal.fewer', { type: TYPE_PLURALS[type] })}
								disabled={state.slots[type] === 0}
								onclick={() => changeSlot(state, type, -1)}
							/>
							<span class="count" data-type={type}>{TYPE_PLURALS[type]} {state.slots[type]}</span>
							<IconButton
								icon="add"
								label={t('modes.deal.more', { type: TYPE_PLURALS[type] })}
								onclick={() => changeSlot(state, type, 1)}
							/>
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

			<div class="cover">
				<p class="pass">{t('modes.deal.passTo', { seat: seatName })}</p>
				<Button variant="accent" icon="showToPlayer" onclick={() => (covered = false)}>
					{t('modes.deal.show')}
				</Button>
			</div>
		{:else}
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
		{/if}
	</div>

	{#if covered && progress?.kind === 'choose' && assignment?.kind === 'choose-own' && assignment.reconsider}
		<Button icon="undo" disabled={picks.length === 0} onclick={chooseAgain}>
			{t('modes.deal.chooseAgain')}
		</Button>
	{/if}
</Page>

<ConfirmDialog
	bind:open={restarting}
	title={t('modes.deal.restartConfirm')}
	danger
	onConfirm={() => {
		const next = fresh();
		if (next) save(next);
		covered = true;
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
	.stage {
		display: grid;
		gap: var(--space-3);
		min-height: 60vh;
		align-content: start;
	}
	.cover {
		display: grid;
		place-items: center;
		gap: var(--space-3);
		min-height: 50vh;
		border: 1px solid var(--card-border);
		border-radius: var(--radius-sm);
	}
	.pass {
		margin: 0;
		font: 600 1.3rem / 1.2 var(--font-heading);
		text-align: center;
	}
	.prompt {
		margin: 0;
		font-weight: 600;
	}
	.list {
		display: flex;
		flex-direction: column;
		height: 55vh;
		min-height: 0;
	}
</style>
