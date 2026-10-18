<script lang="ts">
	import { untrack } from 'svelte';
	import type { Alignment, CharacterId } from '#lib/core/data/index.ts';
	import { trueCharacter, type SeatId } from '#lib/core/model/index.ts';
	import { gameEnds, suggestedWinner, type GameEnd, type GameHold } from '#lib/core/rules/index.ts';
	import { impairmentOfLabel } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { dismissedGameEnds } from './device-notes.ts';
	import { tonight } from './night-steps.ts';

	/**
	 * When a game end condition is met (Trevor, 2026-10-18), list every one met, with what may
	 * keep the game going, and offer End game. A recommendation, never a requirement: Cancel
	 * (or closing it) dismisses those conditions until they change, and the winner is only
	 * preselected when every condition agrees. Rules: `#lib/core/rules/game-end.ts`.
	 */
	interface Props {
		grimoire: Grimoire;
		/** False once the game has ended. */
		active: boolean;
		onEnd: (winner: Alignment | undefined) => void;
	}

	let { grimoire, active, onEnd }: Props = $props();

	/**
	 * Our own sentences ("Saint executed."), off until Trevor approves them: no new authored
	 * content (Trevor, 2026-10-15). Off, each line is the players' badges, the character's TPI
	 * ability text and the wiki link.
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

	// Kept on this device, so reopening the game doesn't ask again.
	let dismissed = $state<readonly string[]>(
		dismissedGameEnds.read(untrack(() => grimoire.game.gameId))
	);
	$effect(() => dismissedGameEnds.write(game.gameId, dismissed));
	let shown = $state<GameEnd[]>([]);
	let open = $state(false);
	let winner = $state<Alignment | 'none'>('none');

	// A condition that stops holding can prompt again if it comes back.
	$effect(() => {
		if (!on) return;
		const keys = new Set(ends.map((e) => e.key));
		if (dismissed.some((k) => !keys.has(k))) dismissed = dismissed.filter((k) => keys.has(k));
	});
	// Closed any way but Confirm: dismissed until something changes. Then a condition not
	// dismissed opens the prompt.
	let ending = false;
	$effect(() => {
		if (open) return;
		if (shown.length > 0) {
			if (!ending) dismissed = [...new Set([...dismissed, ...shown.map((e) => e.key)])];
			ending = false;
			shown = [];
			return;
		}
		if (!ends.some((e) => !dismissed.includes(e.key))) return;
		shown = ends;
		winner = suggestedWinner(ends) ?? 'none';
		open = true;
	});

	function confirm() {
		ending = true;
		onEnd(winner === 'none' ? undefined : winner);
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
			inline
		/>
	{/if}
{/snippet}

{#snippet character(id: CharacterId)}
	<CharacterBadge characterId={id} character={characters.get(id)} inline />
{/snippet}

{#snippet ability(id: CharacterId)}
	{@const c = characters.get(id)}
	{#if c}<span class="ability"><GlossaryText text={c.ability} names={[c.name]} /></span>{/if}
{/snippet}

{#snippet wiki(href: string)}
	<!-- External wiki page (the rules authority), not an app route. -->
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
	<a class="wiki" {href} target="_blank" rel="noopener" aria-label="Open wiki entry">
		<Icon name="wiki" />
	</a>
{/snippet}

{#snippet hold(h: GameHold)}
	<li class="hold" data-rule={h.rule}>
		<span class="text">
			{#if !OWN_WORDING}
				{#each h.seats as id (id)}{@render seat(id)}{/each}
				{#if h.rule === 'impaired'}
					{@const s = game.seats[h.seats[0]]}
					{#each s?.reminders.filter((r) => impairmentOfLabel(r.label) || r.label === 'No Ability') ?? [] as r (r.reminderId)}
						<ReminderToken label={r.label} character={characters.get(r.characterId)} />
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
			{:else}
				{@render seat(h.seats[0])} is drunk, poisoned or has no ability.
			{/if}
		</span>
		{@render wiki(h.wiki)}
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
				{@render wiki(end.wiki)}
			</li>
			{#if end.flippedBy?.seatId && !OWN_WORDING}
				<li class="hold" data-rule="heretic">
					<span class="text">
						{@render seat(end.flippedBy.seatId)}
						{@render ability('heretic')}
					</span>
					{@render wiki('https://wiki.bloodontheclocktower.com/Heretic')}
				</li>
			{/if}
			{#each end.holds as h, i (i)}{@render hold(h)}{/each}
		{/each}
	</ul>
	<div class="winner">
		<Select
			label="Winner"
			value={winner}
			options={[
				{ value: 'good', label: 'Good' },
				{ value: 'evil', label: 'Evil' },
				{ value: 'none', label: 'Not recorded' }
			]}
			onChange={(team) => (winner = team)}
		/>
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
	.wiki {
		display: inline-grid;
		place-items: center;
		min-width: var(--tap-target);
		min-height: var(--tap-target);
		border-radius: var(--radius-md);
		color: var(--on-surface);
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
