<script lang="ts">
	import { untrack } from 'svelte';
	import type { Alignment, CharacterId } from '#lib/core/data/index.ts';
	import { trueCharacter, type SeatId } from '#lib/core/model/index.ts';
	import {
		gameEnds,
		promptable,
		suggestedWinner,
		type EndReason,
		type GameEnd,
		type GameHold
	} from '#lib/core/rules/index.ts';
	import { impairmentOfLabel } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { dismissedGameEnds } from './device-notes.ts';
	import EndGameFields from './EndGameFields.svelte';
	import { tonight } from './night-steps.ts';
	import { tokenLabel } from './reminders.ts';

	/**
	 * When a game end condition is met (Trevor, 2026-10-18), list every one met, with what may
	 * keep the game going, and offer End game. A recommendation, never a requirement: Cancel
	 * (or closing it) dismisses those conditions until they change, and the winner is only
	 * preselected when every condition agrees. A condition something may hold off (a living
	 * Mastermind, both twins alive) doesn't open it (Trevor, 2026-10-18). Rules:
	 * `#lib/core/rules/game-end.ts`.
	 */
	interface Props {
		grimoire: Grimoire;
		/** False once the game has ended. */
		active: boolean;
		onEnd: (winner: Alignment | undefined, reason: EndReason | undefined) => void;
	}

	let { grimoire, active, onEnd }: Props = $props();

	/**
	 * Our own sentences ("Saint executed."), off until Trevor approves them: no new authored
	 * content (Trevor, 2026-10-15). Off, each line is the players' badges and the character's
	 * TPI ability text; a badge opens the character's page (Trevor: no separate wiki links).
	 */
	const OWN_WORDING = false;

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	// Dusk ticked for tonight: today is over, for the rules checked at dusk (Vortox, Mayor).
	const dayEnded = $derived(
		grimoire.nightDay === game.pastDays.length &&
			grimoire.isNightStepDone(tonight(game), { id: 'dusk' })
	);
	const on = $derived(active && preferences.current.assistance.gameEndPrompts);
	const ends = $derived(on ? gameEnds(game, characters, { dayEnded }) : []);

	// Dismissed per condition and what holds it off, so a hold ending asks again.
	const dismissKey = (e: GameEnd) => `${e.key}|${e.holds.map((h) => h.rule).join(',')}`;

	// Kept on this device, so reopening the game doesn't ask again.
	let dismissed = $state<readonly string[]>(
		dismissedGameEnds.read(untrack(() => grimoire.game.gameId))
	);
	$effect(() => dismissedGameEnds.write(game.gameId, dismissed));
	let shown = $state<GameEnd[]>([]);
	let open = $state(false);
	let winner = $state<Alignment | undefined>();
	let reason = $state<EndReason | undefined>();

	// A condition that stops holding can prompt again if it comes back.
	$effect(() => {
		if (!on) return;
		const keys = new Set(ends.map(dismissKey));
		if (dismissed.some((k) => !keys.has(k))) dismissed = dismissed.filter((k) => keys.has(k));
	});
	// Closed any way but Confirm: dismissed until something changes. Then a condition not
	// dismissed opens the prompt.
	let ending = false;
	$effect(() => {
		if (open) return;
		if (shown.length > 0) {
			if (!ending) dismissed = [...new Set([...dismissed, ...shown.map(dismissKey)])];
			ending = false;
			shown = [];
			return;
		}
		if (!promptable(ends).some((e) => !dismissed.includes(dismissKey(e)))) return;
		shown = ends;
		winner = suggestedWinner(ends);
		open = true;
	});

	function confirm() {
		ending = true;
		onEnd(winner, winner ? reason : undefined);
	}

	const teamText = (team: Alignment) => (team === 'good' ? 'Good wins' : 'Evil wins');
</script>

{#snippet seat(id: SeatId, characterId?: CharacterId)}
	{@const s = game.seats[id]}
	{@const shownAs = characterId ?? trueCharacter(game, id, characters) ?? s?.characterId}
	{#if s && shownAs}
		<CharacterBadge
			characterId={shownAs}
			character={characters.get(shownAs)}
			alignment={s.alignment}
			playerName={s.playerName ?? `Seat ${game.seating.indexOf(id) + 1}`}
		/>
	{/if}
{/snippet}

{#snippet character(id: CharacterId)}
	<CharacterBadge characterId={id} character={characters.get(id)} />
{/snippet}

{#snippet ability(id: CharacterId)}
	{@const c = characters.get(id)}
	{#if c}<span class="ability"><GlossaryText text={c.ability} names={[c.name]} /></span>{/if}
{/snippet}

{#snippet hold(h: GameHold)}
	<li class="hold" data-rule={h.rule}>
		<span class="text">
			{#if !OWN_WORDING}
				{#each h.seats as id (id)}{@render seat(id)}{/each}
				{#if h.rule === 'impaired'}
					{@const s = game.seats[h.seats[0]]}
					{#each s?.reminders.filter((r) => impairmentOfLabel(r.label) || r.label === 'No Ability') ?? [] as r (r.reminderId)}
						<ReminderToken label={tokenLabel(r)} character={characters.get(r.characterId)} />
					{/each}
				{:else}
					{@render ability(h.characterId)}
				{/if}
			{:else if h.rule === 'evil-twin'}
				Good can't win while {@render seat(h.seats[0])} and {@render seat(h.seats[1])} live.
			{:else if h.rule === 'scarlet-woman'}
				{@render seat(h.seats[0])} may become the Demon.
			{:else if h.rule === 'mastermind'}
				{@render seat(h.seats[0])}: play for 1 more day.
			{:else if h.rule === 'imp'}
				{@render character('imp')}: a Minion may become the Imp.
			{:else if h.rule === 'fang-gu'}
				{@render character('fanggu')}: an Outsider may become the Fang Gu.
			{:else}
				{@render seat(h.seats[0])} is drunk, poisoned or has no ability.
			{/if}
		</span>
	</li>
{/snippet}

<ConfirmDialog bind:open title="End game?" danger onConfirm={confirm}>
	<ul class="ends" data-testid="game-end-prompt">
		{#each shown as end (end.key)}
			<li data-rule={end.rule}>
				<span class="text">
					{#if !OWN_WORDING}
						{#each end.seats as id (id)}{@render seat(id)}{/each}
						{#if end.characterId}{@render ability(end.characterId)}{/if}
					{:else if end.rule === 'demon-dead'}
						{#each end.seats as id (id)}{@render seat(id)}{/each} dead.
					{:else if end.rule === 'two-alive'}
						Just 2 players alive.
					{:else if end.rule === 'saint'}
						{@render seat(end.seats[0])} executed.
					{:else if end.rule === 'evil-twin'}
						{@render seat(end.seats[0])} executed, twin of {@render seat(end.seats[1])}.
					{:else if end.rule === 'vortox'}
						{@render character('vortox')}: no execution on day {end.day}.
					{:else if end.rule === 'mayor'}
						{@render seat(end.seats[0])}: 3 alive and no execution today.
					{:else if end.rule === 'leviathan-executions'}
						{@render character('leviathan')}:
						{#each end.seats as id (id)}{@render seat(id)}{/each} executed.
					{:else if end.rule === 'leviathan-day-5'}
						{@render seat(end.seats[0])} alive after day 5.
					{:else if end.rule === 'fearmonger'}
						{@render seat(end.seats[1])} nominated and executed {@render seat(end.seats[0])}.
					{:else if end.rule === 'summoner'}
						{#each end.seats as id (id)}{@render seat(id)}{/each} dead with no Demon.
					{:else if end.seats.length > 0}
						{@render character('mastermind')}: {@render seat(end.seats[0])} executed on day {end.day}.
					{:else}
						{@render character('mastermind')}: no execution on day {end.day}.
					{/if}
					<strong class="team" data-team={end.winner}>{teamText(end.winner)}</strong>
					{#if end.flippedBy?.seatId && OWN_WORDING}
						({@render seat(end.flippedBy.seatId)} flips it)
					{/if}
				</span>
			</li>
			{#if end.flippedBy?.seatId && !OWN_WORDING}
				<li class="hold" data-rule="heretic">
					<span class="text">
						{@render seat(end.flippedBy.seatId)}
						{@render ability('heretic')}
					</span>
				</li>
			{/if}
			{#each end.holds as h, i (i)}{@render hold(h)}{/each}
		{/each}
	</ul>
	<div class="winner">
		<EndGameFields {grimoire} bind:winner bind:reason {dayEnded} />
	</div>
</ConfirmDialog>

<style>
	.ends {
		list-style: none;
		margin: 0 0 var(--space-2);
		padding: 0;
		display: grid;
		gap: var(--space-1);
	}
	.ends li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.ends .hold {
		padding-left: var(--space-4);
		color: var(--on-surface-muted);
	}
	.text {
		flex: 1;
		min-width: 0;
	}
	.ability {
		font-family: var(--font-ability);
	}
	.team {
		display: inline-block;
		padding: 0 var(--space-2);
		border-radius: var(--radius-full);
		background: var(--surface-raised);
		color: var(--on-surface);
	}
	.team[data-team='good'] {
		background: var(--good);
		color: var(--on-good);
	}
	.team[data-team='evil'] {
		background: var(--evil);
		color: var(--on-evil);
	}
	.winner {
		margin-top: var(--space-2);
	}
</style>
