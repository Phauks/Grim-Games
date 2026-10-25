<script lang="ts">
	import type { CharacterLookup, Game, SeatId } from '#lib/core/model/index.ts';
	import { protection } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { seatLabel } from '#lib/features/game/seat-label.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';

	/**
	 * Ending a day asks who was executed (Trevor, 2026-10-22: "execution button instead of the
	 * end day button. no execution is a choice when ending each day"). Nothing is chosen until
	 * the Storyteller picks a player or No execution; today's nominees come first. An
	 * execution already logged today is chosen to start with.
	 */
	interface Props {
		open: boolean;
		game: Game;
		characters: CharacterLookup;
		/** Chosen to start with when nothing is logged yet (a seat's status chose Executed). */
		chosen?: SeatId;
		/** The player executed, or undefined for no execution; the dialog closes first. */
		onConfirm: (seatId: SeatId | undefined) => void;
	}

	let { open = $bindable(), game, characters, chosen, onConfirm }: Props = $props();

	const NONE = 'none';
	let choice = $state<string | undefined>();

	const executed = $derived(
		game.today.entries.findLast((e) => e.kind === 'execution')?.seatId as SeatId | undefined
	);
	$effect(() => {
		if (open) choice = executed ?? chosen;
	});

	/**
	 * Whether the player chosen is executed and does not die, and what saves them (Trevor,
	 * 2026-10-23), worked out as the Execute command will: shown before Confirm.
	 */
	const saved = $derived.by(() => {
		if (!choice || choice === NONE) return undefined;
		const seat = game.seats[choice as SeatId];
		if (!seat || seat.dead) return undefined;
		return protection(game, seat.seatId, characters, 'execution');
	});

	const options = $derived.by(() => {
		const nominees: SeatId[] = [];
		for (const e of game.today.entries)
			if (e.kind === 'nomination' && !nominees.includes(e.nominee)) nominees.push(e.nominee);
		const players = game.seating.filter((s) => !nominees.includes(s));
		return [
			{ value: NONE, label: t('day.noExecution') },
			...nominees.map((s) => ({
				value: s,
				label: seatLabel(game, s),
				group: t('day.nominatedToday')
			})),
			...players.map((s) => ({
				value: s,
				label: seatLabel(game, s),
				group: nominees.length > 0 ? t('day.otherPlayers') : undefined
			}))
		];
	});
</script>

<!-- Each player as the seat chooser cites them (Trevor, 2026-10-23): the seat, the character
     as its badge, and whether they are alive or dead with the day counts' icons. -->
{#snippet candidate(option: { value: string; label: string })}
	{@const seat = option.value === NONE ? undefined : game.seats[option.value as SeatId]}
	{#if seat}
		{@const character = seat.characterId ? characters.get(seat.characterId) : undefined}
		<span class="candidate"
			><span class="who">{option.label}</span>{#if character}<CharacterBadge
					characterId={character.id}
					{character}
					alignment={seat.alignment}
					interactive={false}
				/>{/if}<span class="state" data-dead={seat.dead || undefined}
				><Icon name={seat.dead ? 'dead' : 'alive'} />{t(
					seat.dead ? 'day.count.dead' : 'day.count.alive'
				)}</span
			></span
		>
	{:else}{option.label}{/if}
{/snippet}

<ConfirmDialog
	bind:open
	title={t('day.endDayConfirm')}
	disabled={choice === undefined}
	onConfirm={() => onConfirm(choice === NONE ? undefined : (choice as SeatId | undefined))}
>
	<div class="execution" data-testid="execution">
		<Select
			label={t('day.execution')}
			placeholder={t('day.executionChoose')}
			value={choice}
			{options}
			onChange={(value) => (choice = value)}
		>
			{#snippet item(option)}{@render candidate(option)}{/snippet}
			{#snippet selected(option)}{@render candidate(option)}{/snippet}
		</Select>
		<!-- Its line is always there, so choosing never moves the buttons (no reflow). -->
		<p class="saved" data-testid="execution-saved">
			{#if saved && choice}
				{t('day.logExecutedSurvived', {
					name: seatLabel(game, choice as SeatId)
				})}{#if saved !== 'override'}{@const by = characters.get(
						saved.characterId
					)}{#if by}<CharacterBadge
							characterId={by.id}
							character={by}
							interactive={false}
						/>{/if}{/if}
			{/if}
		</p>
	</div>
</ConfirmDialog>

<style>
	.candidate {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0 var(--space-2);
		min-width: 0;
	}
	.who {
		font-family: var(--font-player);
	}
	.state {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		color: var(--on-surface-muted);
	}
	.execution {
		display: grid;
		gap: var(--space-2);
		padding-block: var(--space-2);
	}
	.saved {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-2);
		min-height: 2lh;
		margin: 0;
	}
</style>
