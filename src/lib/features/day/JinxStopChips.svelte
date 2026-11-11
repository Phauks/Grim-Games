<script module lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import type { CharacterLookup, Game } from '#lib/core/model/index.ts';
	import type { DayReminders } from '#lib/core/rules/day/day-reminders.ts';
	import { jinxStoppers, type JinxStopper } from '#lib/core/rules/jinxes/jinx-ends.ts';

	/**
	 * Who may stop a character's ability by a jinx (`jinxStoppers`: the Mayor stopping the
	 * riot, L112), by the key of that character's first day row today, which carries the chips.
	 */
	export function jinxStopRows(
		reminders: DayReminders,
		game: Game,
		characters: CharacterLookup
	): Record<string, JinxStopper[]> {
		const rows: Record<string, JinxStopper[]> = {};
		const seen: CharacterId[] = [];
		for (const reminder of reminders.groups.flatMap((g) => g.reminders)) {
			const owner = reminder.characterId;
			if (!owner || seen.includes(owner)) continue;
			seen.push(owner);
			const stoppers = jinxStoppers(game, owner, characters);
			if (stoppers.length > 0) rows[reminder.key] = stoppers;
		}
		return rows;
	}
</script>

<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import Sentence from '#lib/features/characters/Sentence.svelte';
	import { slot } from '#lib/features/characters/slots.ts';
	import SeatBadge from '#lib/features/grimoire/SeatBadge.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Chip from '#lib/ui/primitives/Chip.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import type { DayPort } from './day-port.ts';

	/**
	 * Stopped by, on a character's day row, for each player whose jinx with it lets them stop
	 * its ability (the Mayor stopping the riot, https://wiki.bloodontheclocktower.com/Riot).
	 * Confirmed like Used (now and after): the choice is their day use with `stops`, and the
	 * game end it gives opens End game; tapped again, it is taken back.
	 */
	interface Props {
		game: DayPort;
		/** The character whose ability is stopped (the Riot). */
		owner: CharacterId;
		stoppers: JinxStopper[];
	}

	let { game, owner, stoppers }: Props = $props();

	let asking = $state<JinxStopper>();
	let open = $state(false);

	const who = slot('who');
	const other = slot('other');
	const notYet = t('day.markStoppedNow', { who, other });
	const done = t('day.markStoppedAfter', { who, other });

	function ask(stopper: JinxStopper) {
		asking = stopper;
		open = true;
	}

	function confirm() {
		if (!asking) return;
		const { partner: characterId, seatId, stopped } = asking;
		if (!stopped) {
			game.run({ type: 'UseAbility', seatId, characterId, stops: owner });
			return;
		}
		const entry = game.game.today.entries.findLast(
			(e) =>
				e.kind === 'ability' &&
				e.seatId === seatId &&
				e.characterId === characterId &&
				e.stops === owner
		);
		if (entry) game.run({ type: 'RemoveDayEntry', entryId: entry.entryId });
	}
</script>

{#each stoppers as stopper (stopper.seatId)}
	<!-- eslint-disable grim/names-as-badges -- accessible names (aria-label) only -->
	{@const label = t('day.who', {
		character: game.characterName(stopper.partner),
		seat: game.seatName(stopper.seatId)
	})}
	<!-- eslint-enable grim/names-as-badges -->
	<Chip
		pressed={stopper.stopped}
		data-testid="jinx-stop"
		aria-label={t('day.stoppedByLabel', { who: label })}
		onclick={() => ask(stopper)}
		><span class="tick" data-on={stopper.stopped || undefined}><Icon name="check" /></span>{t(
			'day.stoppedBy'
		)}
		<CharacterPiece
			template="badge"
			characterId={stopper.partner}
			character={game.characters.get(stopper.partner)}
			interactive={false}
		/></Chip
	>
{/each}

{#snippet fill(name: string)}{#if name === 'who'}{#if asking}<SeatBadge
				game={game.game}
				seatId={asking.seatId}
				characterId={asking.partner}
				interactive={false}
			/>{/if}{:else if name === 'seat'}{#if asking}<SeatBadge
				game={game.game}
				seatId={asking.seatId}
			/>{/if}{:else}{@const id = name === 'other' ? owner : asking?.partner}{#if id}<CharacterPiece
				template="badge"
				characterId={id}
				character={game.characters.get(id)}
			/>{/if}{/if}{/snippet}

<ConfirmDialog
	bind:open
	title={t(asking?.stopped ? 'day.unmarkStopped' : 'day.markStopped')}
	onConfirm={confirm}
>
	{#snippet heading()}
		<Sentence
			text={t(asking?.stopped ? 'day.unmarkStoppedTitle' : 'day.markStoppedTitle', { who, other })}
			{fill}
		/>
	{/snippet}
	{#if asking}
		<p class="state">
			<span class="state-label">{t('day.now')}</span><Sentence
				text={asking.stopped ? done : notYet}
				{fill}
			/>
		</p>
		<p class="state">
			<span class="state-label">{t('day.after')}</span><Sentence
				text={asking.stopped ? notYet : done}
				{fill}
			/>
		</p>
	{/if}
</ConfirmDialog>

<style>
	/* As Used's on the day rows (DayPanel): the tick keeps its room while off, so nothing moves. */
	.tick {
		display: inline-grid;
		visibility: hidden;
	}
	.tick[data-on] {
		visibility: visible;
	}
	.state {
		margin: 0 0 var(--space-2);
	}
	.state-label {
		display: inline-block;
		min-width: calc(4 * var(--u));
		margin-right: var(--space-2);
		font-weight: 700;
	}
</style>
