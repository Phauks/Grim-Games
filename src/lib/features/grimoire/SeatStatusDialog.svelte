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
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import { causeFlagText, causeLabel } from './board.ts';
	import CauseName from './CauseName.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * A seat's status: Alive, or dead with its cause, in one list (Trevor, 2026-10-16), with
	 * the confirm to bring a player back and why a cause is offered with a caution.
	 */
	interface Props {
		open: boolean;
		grimoire: Grimoire;
		seatId: SeatId | undefined;
		/** Whether the seat sheet is open: the causes are worked out only then. */
		sheetOpen: boolean;
		/** Executed during the day asks as the day's Execution does (the seat sheet's onExecute). */
		onExecute?: (seatId: SeatId) => boolean;
	}

	let { open = $bindable(), grimoire, seatId, sheetOpen, onExecute }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const seat = $derived(seatId === undefined ? undefined : game.seats[seatId]);
	const character = $derived(seat?.characterId ? characters.get(seat.characterId) : undefined);
	const traveller = $derived(character?.type === 'traveller');
	const title = $derived(
		seat && seatId ? (seat.playerName ?? `Seat ${game.seating.indexOf(seatId) + 1}`) : ''
	);

	let reviveOpen = $state(false);
	// Only the causes that fit this player (core, which no longer offers "Something else").
	// By day (Night 1 is over and no night is under way), so "can't die by day" is flagged.
	const day = $derived(
		game.pastDays.length > 0 && !grimoire.nightRunning && !grimoire.nightUnderway
	);
	const causes = $derived(
		seatId && sheetOpen ? validDeathCauses(game, seatId, characters, { day }) : []
	);
	let flagged = $state<ValidDeathCause | undefined>();
	let flagOpen = $state(false);

	// A death always has a cause (Trevor, 2026-10-16: "dead, no cause" does not exist). Alive
	// brings a dead player back, after a confirm that states both sides.
	function pickAlive() {
		open = false;
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
		open = false;
		if (seatId && !seat?.notInPlay)
			grimoire.run({ type: 'SetInPlay', seatIds: [seatId], inPlay: false });
	}
	function revive() {
		reviveOpen = false;
		if (seatId) grimoire.run({ type: 'SetDead', seatId, dead: false });
	}

	function setCause(cause: DeathCause) {
		open = false;
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

<Dialog bind:open title={`Status of ${title}`}>
	<div class="causes">
		<div class="cause-row">
			<button
				type="button"
				class="cause"
				aria-pressed={!seat?.dead && !seat?.notInPlay}
				onclick={pickAlive}
			>
				<span class="slot status-icon"><Icon name="alive" /></span>
				Alive
			</button>
		</div>
		<!-- Only a Traveller sits out (Trevor, 2026-11-02); a seat already out still shows it. -->
		{#if traveller || seat?.notInPlay}
			<div class="cause-row">
				<button
					type="button"
					class="cause"
					aria-pressed={!!seat?.notInPlay}
					onclick={pickNotInPlay}
				>
					<span class="slot status-icon"><Icon name="night" /></span>
					{t('common.notInPlay')}
				</button>
			</div>
		{/if}
		{#each causes as { cause, flags, gained }, i (cause)}
			{@const killer = characters.get(cause)}
			<div class="cause-row">
				<button
					type="button"
					class="cause"
					aria-pressed={seat?.deathCause === cause}
					onclick={() => setCause(cause)}
				>
					<span class="slot" class:status-icon={!killer} data-dead
						>{#if killer}<CharacterToken character={killer} size={32} />{:else}<Icon
								name="dead"
							/>{/if}</span
					>
					{causeLabel(cause, characters, traveller)}
					<!-- The gained ability that kills, as on the day sheet: "Cannibal (Slayer)". -->
					{#if gained}<span class="gained"
							>(<CharacterBadge
								characterId={gained}
								character={characters.get(gained)}
								interactive={false}
							/>)</span
						>{/if}
				</button>
				{#if flags.length > 0}
					<IconButton
						icon="warning"
						label={`Why ${causeLabel(cause, characters, traveller)} is marked`}
						onclick={() => {
							flagged = causes[i];
							flagOpen = true;
						}}
					/>
				{/if}
			</div>
		{/each}
	</div>
	{#snippet actions()}
		<ModalActions onCancel={() => (open = false)} />
	{/snippet}
</Dialog>

<ConfirmDialog bind:open={reviveOpen} title={`Bring ${title} back to life?`} onConfirm={revive}>
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
		place-items: center;
		width: calc(3 * var(--u));
		height: calc(3 * var(--u));
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
		--icon-size: calc(1.25 * var(--u));
	}
	.causes {
		display: grid;
		gap: calc(0.125 * var(--u));
		margin-top: var(--space-2);
	}
	.cause {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
		padding: 0 var(--space-2);
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.cause:hover {
		background: var(--surface-selected);
	}
	.cause[aria-pressed='true'] {
		border-color: var(--focus);
	}
	.cause-row {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
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
	.cause .slot {
		width: calc(2 * var(--u));
		height: calc(2 * var(--u));
	}
	.state-pill[data-dead],
	.status-icon[data-dead] {
		background: var(--backdrop);
		color: var(--on-surface);
	}
</style>
