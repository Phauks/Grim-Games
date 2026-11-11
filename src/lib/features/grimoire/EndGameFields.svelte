<script lang="ts">
	import type { Alignment } from '#lib/core/data/index.ts';
	import { trueCharacter, type SeatId } from '#lib/core/model/index.ts';
	import {
		detectedEndReason,
		endCharacters,
		endReasonCharacter,
		joinsWinners,
		type EndReason
	} from '#lib/core/rules/game-end/end-reason.ts';
	import { seatName } from '#lib/features/game/seat-label.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import AlignmentPill from './AlignmentPill.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import { endReasonLabel } from './end-reason-label.ts';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * What End game saves (Trevor, 2026-10-18): the winner, and how they won, so History's
	 * alternate wins count what happened rather than only what the grimoire shows. Picking a
	 * winner preselects how the grimoire says they won (`detectedEndReason`); the Storyteller
	 * can change it. "How it ended" is always shown, disabled with no winner, so nothing moves.
	 * A player who may win with the other team too (`joinsWinners`: the Politician winning with
	 * evil, Trevor, 2026-11-03) is a Winner of its own, "Evil and" that player (`alsoWon`).
	 */
	interface Props {
		grimoire: Grimoire;
		winner: Alignment | undefined;
		reason: EndReason | undefined;
		/** Players on the other team who win too, the Storyteller's call. */
		alsoWon?: SeatId[];
		/** Today is over, for the rules checked at dusk; End game from the menu counts it over. */
		dayEnded?: boolean;
	}

	let {
		grimoire,
		winner = $bindable(),
		reason = $bindable(),
		alsoWon = $bindable([]),
		dayEnded = true
	}: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);

	// A new winner (picked here or preselected by the caller) preselects how they won.
	let reasonFor: Alignment | undefined;
	$effect.pre(() => {
		if (winner === reasonFor) return;
		reasonFor = winner;
		reason = winner ? detectedEndReason(game, characters, winner, { dayEnded }) : undefined;
	});

	/** A Winner option: a team, or a team and one player who wins with it too (`team:seatId`). */
	const TEAMS: Alignment[] = ['good', 'evil'];
	const winners = $derived([
		...TEAMS.flatMap((team) => [
			{ value: team as string, label: team === 'good' ? 'Good' : 'Evil' },
			...joinsWinners(game, characters, team).map((id) => ({
				value: `${team}:${id}`,
				label: team === 'good' ? 'Good' : 'Evil'
			}))
		]),
		{ value: 'none', label: 'Not recorded' }
	]);
	const winnerValue = $derived(
		winner === undefined ? 'none' : alsoWon.length > 0 ? `${winner}:${alsoWon[0]}` : winner
	);
	function pickWinner(value: string) {
		const [team, seatId] = value.split(':');
		winner = team === 'good' || team === 'evil' ? team : undefined;
		alsoWon = winner && seatId ? [seatId as SeatId] : [];
	}

	const reasons = $derived(
		(
			[
				'demon-dead',
				'two-alive',
				...endCharacters(game, characters, reason).map((id): EndReason => `character:${id}`),
				'other'
			] as EndReason[]
		).map((value) => ({ value, label: endReasonLabel(value, characters) }))
	);
</script>

<!-- Good and Evil in their team colours (Trevor, 2026-11-01). -->
{#snippet winnerLabel(option: { value: string; label: string })}
	{@const [team, joined] = option.value.split(':') as [string, SeatId | undefined]}
	{#if team === 'good' || team === 'evil'}
		<span class="winner"
			><AlignmentPill alignment={team} text={option.label} />{#if joined}{@const as = trueCharacter(
					game,
					joined,
					characters
				)}and<CharacterPiece
					template="badge"
					characterId={as}
					character={as ? characters.get(as) : undefined}
					alignment={game.seats[joined]?.alignment}
					playerName={seatName(game, joined)}
				/>{/if}</span
		>
	{:else}
		{option.label}
	{/if}
{/snippet}

{#snippet reasonLabel(option: { value: EndReason; label: string })}
	{@const id = endReasonCharacter(option.value)}
	{#if id}
		<CharacterPiece template="badge" characterId={id} character={characters.get(id)} />
	{:else}
		{option.label}
	{/if}
{/snippet}

<div class="fields">
	<Select label="Winner" value={winnerValue} options={winners} onChange={pickWinner}>
		{#snippet item(option)}{@render winnerLabel(option)}{/snippet}
		{#snippet selected(option)}{@render winnerLabel(option)}{/snippet}
	</Select>
	<Select
		label="How it ended"
		value={reason}
		options={reasons}
		placeholder="None"
		disabled={winner === undefined}
		onChange={(next) => (reason = next)}
	>
		{#snippet item(option)}{@render reasonLabel(option)}{/snippet}
		{#snippet selected(option)}{@render reasonLabel(option)}{/snippet}
	</Select>
</div>

<style>
	.fields {
		display: grid;
		gap: var(--space-2);
	}
	.winner {
		display: inline-flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
</style>
