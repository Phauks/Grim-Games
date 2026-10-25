<script lang="ts">
	import type { CharacterId } from '#lib/core/data/types.ts';
	import type { CharacterLookup, Game, SeatId } from '#lib/core/model/index.ts';
	import { executionSavers, protection } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { seatLabel, seatName } from '#lib/features/game/seat-label.ts';
	import Sentence from '#lib/features/characters/Sentence.svelte';
	import { slot } from '#lib/features/characters/slots.ts';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
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
		/**
		 * The player executed, or undefined for no execution, and the Storyteller's Saved by:
		 * a character, `dies` for None, or undefined to leave it to the grimoire. The dialog
		 * closes first.
		 */
		onConfirm: (seatId: SeatId | undefined, save?: CharacterId | 'dies') => void;
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

	const DIES = 'dies';
	const OVERRIDE = 'override';
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

	/**
	 * Saved by (Trevor, 2026-10-24: "a modifier slot to the execution area"): every character
	 * on the script or in play that can stop an execution death, from its rules (`protects`),
	 * starting on the one the grimoire applies. The Storyteller may pick one that does not
	 * apply, or None, with the reason shown beside it (warn, never lock).
	 */
	const savers = $derived(
		executionSavers(
			game,
			(choice && choice !== NONE ? choice : game.seating[0]) as SeatId,
			characters
		)
	);
	let save = $derived<string>(saved === 'override' ? OVERRIDE : (saved?.characterId ?? DIES));
	/** No save for no execution, a dead player, or an execution already logged. */
	const saveOff = $derived(
		!choice || choice === NONE || choice === executed || !!game.seats[choice as SeatId]?.dead
	);
	const saveOptions = $derived([
		{ value: DIES, label: t('day.savedByNone') },
		...(saved === 'override' ? [{ value: OVERRIDE, label: t('day.savedByOverride') }] : []),
		...savers.map((s) => ({
			value: s.source.characterId as string,
			// eslint-disable-next-line grim/names-as-badges -- the option's accessible name and typeahead text; it shows as the badge (the saver snippet)
			label: characters.get(s.source.characterId)?.name ?? s.source.characterId,
			...(s.problem ? { description: t(`day.saveProblem.${s.problem}`) } : {})
		}))
	]);
	/** The character the slot says saves the player, for the line beneath. */
	const savedByNow = $derived(
		saveOff || save === DIES ? undefined : save === OVERRIDE ? OVERRIDE : save
	);

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
			><span class="who"><PlayerBadge name={seatName(game, seat.seatId)} /></span
			>{#if character}<CharacterBadge
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

<!-- A save as its character's badge, with why it may not apply beside it. -->
{#snippet saver(option: { value: string; label: string; description?: string })}
	{@const character = characters.get(option.value)}
	{#if character}
		<span class="candidate"
			><CharacterBadge
				characterId={character.id}
				{character}
				interactive={false}
			/>{#if option.description}<span class="problem"
					><Icon name="warning" />{option.description}</span
				>{/if}</span
		>
	{:else}{option.label}{/if}
{/snippet}

<ConfirmDialog
	bind:open
	title={t('day.endDayConfirm')}
	disabled={choice === undefined}
	onConfirm={() =>
		choice === NONE || choice === undefined
			? onConfirm(undefined)
			: onConfirm(
					choice as SeatId,
					saveOff || save === OVERRIDE ? undefined : (save as CharacterId | 'dies')
				)}
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
		{#if savers.length > 0 || saved === 'override'}
			<!-- Always there while the script has a save, disabled until a living player is
			     chosen, so choosing never moves the buttons (no reflow). -->
			<Select
				label={t('day.savedBy')}
				value={save}
				options={saveOptions}
				disabled={saveOff}
				onChange={(value) => (save = value)}
			>
				{#snippet item(option)}{@render saver(option)}{/snippet}
				{#snippet selected(option)}{@render saver(option)}{/snippet}
			</Select>
		{/if}
		<!-- Its line is always there, so choosing never moves the buttons (no reflow). -->
		<p class="saved" data-testid="execution-saved">
			{#if savedByNow && choice}
				<Sentence text={t('day.logExecutedSurvived', { name: slot('player') })}
					>{#snippet fill()}<PlayerBadge
							name={seatName(game, choice as SeatId)}
						/>{/snippet}</Sentence
				>{#if savedByNow !== OVERRIDE}{@const by =
						characters.get(savedByNow)}{#if by}<CharacterBadge
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
		display: inline-flex;
		min-width: 0;
	}
	.state {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		color: var(--on-surface-muted);
	}
	.problem {
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
