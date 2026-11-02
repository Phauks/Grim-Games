<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { DeathCause, SeatId } from '#lib/core/model/index.ts';
	import { isExecution, validDeathCauses, type ValidDeathCause } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import { causeFlagText, causeLabel } from './board.ts';
	import CauseName from './CauseName.svelte';
	import { seatName } from '#lib/features/game/seat-label.ts';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * A seat's status: Alive, Not in play for a Traveller, or dead with its cause, in one
	 * drop-down on the seat sheet's Status row (Trevor, 2026-11-02, option B: no Status screen),
	 * with the confirm to bring a player back and why a cause is offered with a caution.
	 */
	interface Props {
		grimoire: Grimoire;
		seatId: SeatId | undefined;
		/** What the Status row says, also its accessible name ("Status: Dead: Imp"). */
		statusText: string;
		/** Whether the seat sheet is open: the causes are worked out only then. */
		sheetOpen: boolean;
		/** Executed during the day asks as the day's Execution does (the seat sheet's onExecute). */
		onExecute?: (seatId: SeatId) => boolean;
	}

	let { grimoire, seatId, statusText, sheetOpen, onExecute }: Props = $props();

	const ALIVE = 'alive';
	const NOT_IN_PLAY = 'not-in-play';
	const labelId = $props.id();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const seat = $derived(seatId === undefined ? undefined : game.seats[seatId]);
	const character = $derived(seat?.characterId ? characters.get(seat.characterId) : undefined);
	const traveller = $derived(character?.type === 'traveller');
	const title = $derived(seat && seatId ? seatName(game, seatId) : '');

	let reviveOpen = $state(false);
	// Only the causes that fit this player (core, which no longer offers "Something else").
	// By day (Night 1 is over and no night is under way), so "can't die by day" is flagged.
	const day = $derived(
		game.pastDays.length > 0 && !grimoire.nightRunning && !grimoire.nightUnderway
	);
	// Worked out as if still alive, so a dead player's cause keeps the caution it was offered
	// with (a dead Vizier's ability no longer protects them, yet The Demon by day was flagged).
	const living = $derived(
		seat?.dead && seatId
			? { ...game, seats: { ...game.seats, [seatId]: { ...seat, dead: false } } }
			: game
	);
	const causes = $derived(
		seatId && sheetOpen ? validDeathCauses(living, seatId, characters, { day }) : []
	);
	let flagged = $state<ValidDeathCause | undefined>();
	let flagOpen = $state(false);

	// Only a Traveller sits out (Trevor, 2026-11-02); a seat already out still shows it.
	const options = $derived([
		{ value: ALIVE, label: 'Alive' },
		...(traveller || seat?.notInPlay ? [{ value: NOT_IN_PLAY, label: t('common.notInPlay') }] : []),
		// A cause recorded before that no longer fits stays listed, so the row still shows it.
		...(seat?.dead && seat.deathCause && !causes.some((c) => c.cause === seat.deathCause)
			? [
					{
						value: seat.deathCause,
						label: causeLabel(seat.deathCause, characters, traveller),
						group: 'Dead'
					}
				]
			: []),
		...causes.map(({ cause }) => ({
			value: cause,
			label: causeLabel(cause, characters, traveller),
			group: 'Dead'
		}))
	]);
	const current = $derived(
		seat?.dead ? (seat.deathCause ?? undefined) : seat?.notInPlay ? NOT_IN_PLAY : ALIVE
	);
	const currentFlagged = $derived(
		seat?.dead ? causes.find((c) => c.cause === seat.deathCause && c.flags.length > 0) : undefined
	);

	function pick(value: string) {
		if (value === ALIVE) pickAlive();
		else if (value === NOT_IN_PLAY) pickNotInPlay();
		else setCause(value as DeathCause);
	}

	// A death always has a cause (Trevor, 2026-10-16: "dead, no cause" does not exist). Alive
	// brings a dead player back, after a confirm that states both sides.
	function pickAlive() {
		if (seat?.notInPlay && seatId)
			grimoire.run({ type: 'SetInPlay', seatIds: [seatId], inPlay: true });
		if (seat?.dead) reviveOpen = true;
	}
	/**
	 * At the table but not in play yet (Trevor, 2026-10-31): a Traveller who arrives mid-game
	 * sits down before the night they join at. The night's "Travellers not in play" step
	 * offers to bring them in (Trevor, 2026-11-02).
	 */
	function pickNotInPlay() {
		if (seatId && !seat?.notInPlay)
			grimoire.run({ type: 'SetInPlay', seatIds: [seatId], inPlay: false });
	}
	function revive() {
		reviveOpen = false;
		if (seatId) grimoire.run({ type: 'SetDead', seatId, dead: false });
	}

	function setCause(cause: DeathCause) {
		if (!seat || !seatId) return;
		if (seat.dead) grimoire.run({ type: 'SetDeathCause', seatId, cause });
		// An execution or exile is also today's day log entry (the Undertaker, game end, stats),
		// as the day's Players section logged it before it went (Trevor, 2026-10-20).
		else if (cause === 'execution') {
			if (!onExecute?.(seatId)) grimoire.run({ type: 'Execute', seatId });
		} else if (cause === 'exile') grimoire.run({ type: 'Exile', seatId });
		// A character's execution (the Virgin's nominator) is one too, with it as the cause.
		else if (isExecution(cause, characters)) grimoire.run({ type: 'Execute', seatId, cause });
		else grimoire.run({ type: 'SetDead', seatId, dead: true, cause });
	}
</script>

{#snippet slot(value: string)}
	{@const killer = characters.get(value)}
	<!-- Decoration: the option's name is its words. -->
	<span
		class="slot"
		aria-hidden="true"
		class:status-icon={!killer}
		data-dead={value !== ALIVE && value !== NOT_IN_PLAY ? '' : undefined}
		>{#if killer}<CharacterToken character={killer} size={28} />{:else}<Icon
				name={value === ALIVE ? 'alive' : value === NOT_IN_PLAY ? 'night' : 'dead'}
			/>{/if}</span
	>
{/snippet}

<!-- The row's name, with a warning after it while the cause set was offered with a caution
     (as a setting's warning mark), and the drop-down at the row's end. -->
<span class="label">
	<span id={labelId}
		><span aria-hidden="true">Status</span><span class="visually-hidden">Status: {statusText}</span
		></span
	>
	{#if currentFlagged}
		<IconButton
			icon="warning"
			label={`Why ${causeLabel(currentFlagged.cause, characters, traveller)} is marked`}
			onclick={() => {
				flagged = currentFlagged;
				flagOpen = true;
			}}
		/>
	{/if}
</span>
<span class="control">
	<Select
		label="Status"
		labelledBy={labelId}
		value={current}
		{options}
		onChange={pick}
		testid="seat-status"
	>
		{#snippet item(option)}
			{@const found = causes.find((c) => c.cause === option.value)}
			<span class="option">
				{@render slot(option.value)}
				<span>{option.label}</span>
				<!-- The gained ability that kills, as on the day sheet: "Cannibal (Slayer)". -->
				{#if found?.gained}<span class="gained"
						>(<CharacterBadge
							characterId={found.gained}
							character={characters.get(found.gained)}
							interactive={false}
						/>)</span
					>{/if}
				{#if found && found.flags.length > 0}<span
						class="flag"
						data-testid="cause-flag"
						aria-hidden="true"><Icon name="warning" /></span
					>{/if}
			</span>
		{/snippet}
		{#snippet selected(option)}
			<span class="option">
				{@render slot(option.value)}
				<span class="text"
					>{#if option.group}Dead: <CauseName
							cause={seat?.deathCause}
							{characters}
							{traveller}
							interactive={false}
						/>{:else}{option.label}{/if}</span
				>
			</span>
		{/snippet}
	</Select>
</span>

<!-- eslint-disable-next-line grim/names-as-badges -- the dialog's accessible name; its heading shows the badge -->
<ConfirmDialog bind:open={reviveOpen} title={`Bring ${title} back to life?`} onConfirm={revive}>
	{#snippet heading()}Bring <PlayerBadge name={title} /> back to life?{/snippet}
	<dl class="change">
		<dt>Now</dt>
		<dd>
			<span class="state-pill" data-dead
				><Icon name="dead" />Dead: <CauseName
					cause={seat?.deathCause}
					{characters}
					{traveller}
				/></span
			>
		</dd>
		<dt>Becomes</dt>
		<dd><span class="state-pill"><Icon name="alive" />Alive</span></dd>
	</dl>
</ConfirmDialog>

<Dialog
	bind:open={flagOpen}
	title={flagged ? causeLabel(flagged.cause, characters, traveller) : ''}
	description="Offered with a caution"
>
	{#if flagged}
		<ul class="flags">
			{#each flagged.flags as flag, i (i)}
				{@const why = causeFlagText(flag, game, characters, title)}
				<li>
					{why.text}{#if why.by}
						(<CharacterBadge characterId={why.by} character={characters.get(why.by)} />).{/if}
				</li>
			{/each}
		</ul>
	{/if}
	{#snippet actions()}
		{@const registers = flagged?.flags.find((f) => f.code === 'registers')}
		{#if registers?.code === 'registers'}
			<!-- External wiki page (the rules authority), not an app route. -->
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a class="wiki" href={registers.wiki} target="_blank" rel="noopener">
				<Icon name="wiki" /><span>Open wiki entry</span>
			</a>
		{/if}
		<Button variant="quiet" onclick={() => (flagOpen = false)}>Close</Button>
	{/snippet}
</Dialog>

<style>
	.label {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		font-family: var(--font-control);
		font-size: 0.8rem;
		letter-spacing: 0.04em;
		color: var(--on-surface-muted);
	}
	.label :global(.icon-button) {
		color: var(--accent);
	}
	/* One width whatever it says (Trevor, 2026-10-16), as wide as the ghost vote toggle. */
	.control {
		width: min(70%, 16rem);
		min-width: 0;
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.option {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
	}
	.option .text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.flag {
		display: inline-grid;
		color: var(--accent);
	}
	.change {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-1) var(--space-3);
		align-items: center;
		margin: 0 0 var(--space-2);
	}
	.gained {
		color: var(--on-surface-muted);
	}
	.slot {
		display: grid;
		flex: none;
		place-items: center;
		width: calc(1.75 * var(--u));
		height: calc(1.75 * var(--u));
	}
	.state-pill {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: 0 var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-full);
	}
	.status-icon {
		border-radius: 50%;
		--icon-size: calc(1.1 * var(--u));
	}
	.wiki {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
		padding: 0 var(--space-4);
		border-radius: var(--radius-md);
		background: var(--accent);
		color: var(--on-accent, var(--on-surface));
		text-decoration: none;
		font-weight: 600;
	}
	.flags {
		margin: var(--space-2) 0 0;
		padding-left: var(--space-3);
	}
	.flags li + li {
		margin-top: var(--space-1);
	}
	.state-pill[data-dead],
	.status-icon[data-dead] {
		background: var(--backdrop);
		color: var(--on-surface);
	}
</style>
