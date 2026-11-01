<script lang="ts">
	import { seatName } from '#lib/features/game/seat-label.ts';
	import AlignmentPill from './AlignmentPill.svelte';
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
	import BoardReminder from './BoardReminder.svelte';
	import ReminderTokenRow from './ReminderTokenRow.svelte';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import AidMenu from '#lib/features/settings/AidMenu.svelte';
	import { readGameMode } from '#lib/features/modes/game-mode-store.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { dismissedGameEnds } from './device-notes.ts';
	import EndGameFields from './EndGameFields.svelte';
	import { tonight } from './night-steps.ts';
	import { isGeneric, reminderWords } from './reminders.ts';

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
	// A special rule under which an executed Demon wins it for good (Binary Supernovae).
	const demonExecutedBy = $derived(
		readGameMode(game.gameId)?.rules.find((r) => r.parts.winConditions?.kind === 'demon-executed')
			?.name
	);
	const ends = $derived(on ? gameEnds(game, characters, { dayEnded, demonExecutedBy }) : []);

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
	// Closed any way, Confirm too: dismissed until something changes, so a game ended here
	// and reopened doesn't ask again straight away (Trevor's report, 2026-10-27). Then a
	// condition not dismissed opens the prompt.
	$effect(() => {
		if (open) return;
		if (shown.length > 0) {
			dismissed = [...new Set([...dismissed, ...shown.map(dismissKey)])];
			shown = [];
			return;
		}
		if (!promptable(ends).some((e) => !dismissed.includes(dismissKey(e)))) return;
		// A Demon offered a rebirth (the Hindu's optional rule, when the game plays with it) may
		// yet pass on: ask once the Storyteller has picked a Traveller or left the Demon dead.
		if (grimoire.reincarnateAsk) return;
		shown = ends;
		winner = suggestedWinner(ends);
		open = true;
	});

	function confirm() {
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
			playerName={seatName(game, id)}
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
					<!-- The tokens themselves, as on the board (Trevor, 2026-10-30). -->
					<ReminderTokenRow inline>
						{#each s?.reminders.filter((r) => impairmentOfLabel(r.label) || r.label === 'No Ability') ?? [] as r (r.reminderId)}
							<BoardReminder
								label={reminderWords(r)}
								infinite={isGeneric(r)}
								character={characters.get(r.characterId)}
							/>
						{/each}
					</ReminderTokenRow>
				{:else}
					{@render ability(h.characterId)}
				{/if}
			{:else if h.rule === 'marked-alive'}
				Good can't win while {@render seat(h.seats[0])} and {@render seat(h.seats[1])} live.
			{:else if h.rule === 'becomes-demon'}
				{@render seat(h.seats[0])} may become the Demon.
			{:else if h.rule === 'extra-day'}
				{@render seat(h.seats[0])}: play for 1 more day.
			{:else if h.rule === 'death-passes'}
				{@render character(h.characterId)}: {#each h.seats as id (id)}{@render seat(id)}{/each} may become
				the Demon.
			{:else}
				{@render seat(h.seats[0])} is drunk, poisoned or has no ability.
			{/if}
		</span>
	</li>
{/snippet}

<ConfirmDialog bind:open title="End game?" danger onConfirm={confirm}>
	{#snippet headActions()}<AidMenu aid="gameEndPrompts" />{/snippet}
	<ul class="ends" data-testid="game-end-prompt">
		{#each shown as end (end.key)}
			<li data-rule={end.rule}>
				<span class="text">
					{#if !OWN_WORDING}
						{#each end.seats as id (id)}{@render seat(id)}{/each}
						{#if end.characterId}{@render ability(end.characterId)}{/if}
						{#if end.ruleName}<span class="rule">{end.ruleName}</span>{/if}
					{:else if end.rule === 'demon-dead'}
						{#each end.seats as id (id)}{@render seat(id)}{/each} dead.
					{:else if end.rule === 'two-alive'}
						Just 2 players alive.
					{:else if end.rule === 'executed-loses'}
						{@render seat(end.seats[0])} executed.
					{:else if end.rule === 'marked-executed'}
						{@render seat(end.seats[0])} executed, twin of {@render seat(end.seats[1])}.
					{:else if end.rule === 'day-without-execution' && end.characterId}
						{@render character(end.characterId)}: no execution on day {end.day}.
					{:else if end.rule === 'alive-at-dusk'}
						{@render seat(end.seats[0])}: few alive and no execution today.
					{:else if end.rule === 'executions-of-alignment' && end.characterId}
						{@render character(end.characterId)}:
						{#each end.seats as id (id)}{@render seat(id)}{/each} executed.
					{:else if end.rule === 'survives-day'}
						{@render seat(end.seats[0])} alive after day {end.day}.
					{:else if end.rule === 'nominated-marked-executed'}
						{@render seat(end.seats[1])} nominated and executed {@render seat(end.seats[0])}.
					{:else if end.rule === 'demon-executed'}
						{#each end.seats as id (id)}{@render seat(id)}{/each} executed ({end.ruleName}).
					{:else if end.rule === 'dead-without-demon' && end.day !== undefined && end.characterId}
						{@render character(end.characterId)}: no Demon made by night {end.day}.
					{:else if end.rule === 'dead-without-demon'}
						{#each end.seats as id (id)}{@render seat(id)}{/each} dead with no Demon.
					{:else if end.characterId && end.seats.length > 0}
						{@render character(end.characterId)}: {@render seat(end.seats[0])} executed on day {end.day}.
					{:else if end.characterId}
						{@render character(end.characterId)}: no execution on day {end.day}.
					{/if}
					<AlignmentPill alignment={end.winner} text={teamText(end.winner)} />
					{#if end.flippedBy?.seatId && OWN_WORDING}
						({@render seat(end.flippedBy.seatId)} flips it)
					{/if}
				</span>
			</li>
			{#if end.flippedBy?.seatId && !OWN_WORDING}
				<li class="hold" data-rule="invert-winner">
					<span class="text">
						{@render seat(end.flippedBy.seatId)}
						{@render ability(end.flippedBy.characterId)}
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
	.rule {
		font-weight: 600;
	}
	.winner {
		margin-top: var(--space-2);
	}
</style>
