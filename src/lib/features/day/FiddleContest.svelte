<script lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import type { SeatId } from '#lib/core/model/index.ts';
	import {
		contestChoosers,
		contestOpponents,
		contestRule,
		contestWinner
	} from '#lib/core/rules/game-end/contest.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import Sentence from '#lib/features/characters/Sentence.svelte';
	import { slot } from '#lib/features/characters/slots.ts';
	import AlignmentPill from '#lib/features/board/AlignmentPill.svelte';
	import { requestEndGame } from '#lib/features/grimoire/end-game-request.svelte.ts';
	import SeatBadge from '#lib/features/board/SeatBadge.svelte';
	import { TYPE_LABELS } from '#lib/features/reference/labels.ts';
	import Chip from '#lib/ui/primitives/Chip.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import NumberSelect from '#lib/ui/primitives/NumberSelect.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import type { DayPort } from './day-port.ts';

	/**
	 * Contest, on the row of a rule character whose ability ends the game in a contest
	 * (`gameEnd.contest`: the Fiddler, https://wiki.bloodontheclocktower.com/Fiddler). Its own
	 * dialog (Trevor, 2026-11-03: "fiddler in it's own screen probably makes more sense from a
	 * modularity point of view"): the chooser (the Demon), the player they picked from the other
	 * alignment, and each one's votes, counted outside the app (Trevor, 2026-11-01). The result
	 * says which team wins, the rule's team on a tie; Confirm opens End game with it filled in.
	 */
	interface Props {
		game: DayPort;
		characterId: CharacterId;
	}

	let { game, characterId }: Props = $props();

	const g = $derived(game.game);
	const rule = $derived(contestRule(g, characterId, game.characters));
	const choosers = $derived(contestChoosers(g, characterId, game.characters));
	let open = $state(false);
	let chooser = $state<SeatId>();
	let picked = $state<SeatId>();
	let chooserVotes = $state(0);
	let pickedVotes = $state(0);
	const opponents = $derived(
		chooser ? contestOpponents(g, characterId, chooser, game.characters) : []
	);
	const winner = $derived(
		chooser && picked
			? contestWinner(
					g,
					characterId,
					{ seatId: chooser, votes: chooserVotes },
					{ seatId: picked, votes: pickedVotes },
					game.characters
				)
			: undefined
	);
	const chooserLabel = $derived(rule ? TYPE_LABELS[rule.chooser] : '');
	const seatOptions = (ids: SeatId[]) => ids.map((id) => ({ value: id, label: game.seatName(id) }));
	const title = t('day.contestTitle', { character: slot('character') });

	function start() {
		chooser = choosers[0];
		picked = undefined;
		chooserVotes = 0;
		pickedVotes = 0;
		open = true;
	}
	function confirm() {
		if (winner) requestEndGame(winner, `character:${characterId}`);
	}
</script>

{#snippet fill(name: string)}{#if name === 'character'}<CharacterPiece
			template="badge"
			{characterId}
			character={game.characters.get(characterId)}
			interactive={false}
		/>{/if}{/snippet}

{#snippet seat(option: { value: string })}<SeatBadge
		game={g}
		characters={game.characters}
		seatId={option.value}
		interactive={false}
	/>{/snippet}

<!-- eslint-disable grim/names-as-badges -- accessible name (aria-label) only -->
<Chip
	data-testid="day-contest"
	disabled={choosers.length === 0}
	aria-label={t('day.contestLabel', { character: game.characterName(characterId) })}
	onclick={start}>{t('day.contest')}</Chip
>

<ConfirmDialog
	bind:open
	title={t('day.contestTitle', { character: game.characterName(characterId) })}
	disabled={winner === undefined}
	onConfirm={confirm}
>
	<!-- eslint-enable grim/names-as-badges -->
	{#snippet heading()}<Sentence text={title} {fill} />{/snippet}
	<div class="contest" data-testid="contest-fields">
		<span></span>
		<span></span>
		<span class="head">{t('day.contestVotes')}</span>
		<span class="head">{chooserLabel}</span>
		<Select
			label={chooserLabel}
			hideLabel
			value={chooser}
			options={seatOptions(choosers)}
			placeholder={t('day.useOnNone')}
			item={seat}
			selected={seat}
			onChange={(id) => {
				chooser = id;
				if (picked && !contestOpponents(g, characterId, id, game.characters).includes(picked))
					picked = undefined;
			}}
		/>
		<NumberSelect
			bind:value={chooserVotes}
			label={t('day.contestVotesOf', { name: chooserLabel })}
			hideLabel
			max={g.seating.length}
		/>
		<span class="head">{t('day.contestPicked')}</span>
		<Select
			label={t('day.contestPicked')}
			hideLabel
			value={picked}
			options={seatOptions(opponents)}
			placeholder={t('day.useOnNone')}
			item={seat}
			selected={seat}
			onChange={(id) => (picked = id)}
		/>
		<NumberSelect
			bind:value={pickedVotes}
			label={t('day.contestVotesOf', { name: t('day.contestPicked') })}
			hideLabel
			max={g.seating.length}
		/>
	</div>
	<p class="result" data-testid="contest-result">
		{#if winner}
			{#if chooserVotes === pickedVotes}{t('day.contestTie')}{/if}
			<AlignmentPill
				alignment={winner}
				text={winner === 'good' ? t('day.contestGoodWins') : t('day.contestEvilWins')}
			/>
		{:else}
			{t('day.useOnNone')}
		{/if}
	</p>
</ConfirmDialog>

<style>
	.contest {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) calc(var(--u) * 5);
		gap: var(--space-2) var(--space-3);
		align-items: center;
	}
	.head {
		color: var(--on-surface-muted);
		font-size: 0.85rem;
	}
	.result {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
		margin: var(--space-3) 0 0;
		padding-top: var(--space-3);
		border-top: 1px solid var(--border);
	}
</style>
