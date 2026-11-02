<script lang="ts">
	import type { CharacterId } from '#lib/core/data/types.ts';
	import type { CharacterLookup, Game, SeatId } from '#lib/core/model/index.ts';
	import {
		executedInstead,
		executionOutcomes,
		executionSavers,
		insteadCandidates,
		extraNominators,
		nominatorsAfterExecution,
		outcomeHolders,
		protection,
		suggestedMark,
		unsetMarks,
		type DayMark,
		type ExecutionOutcome,
		type OutcomeHolder,
		type OutcomeKind
	} from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { seatLabel, seatName } from '#lib/features/game/seat-label.ts';
	import Sentence from '#lib/features/characters/Sentence.svelte';
	import { slot } from '#lib/features/characters/slots.ts';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';

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
		 * Start game not yet tapped (Trevor, 2026-11-01): a warning says so, and Confirm still
		 * works (warn, never lock).
		 */
		notStarted?: boolean;
		/**
		 * The player executed, or undefined for no execution; the Storyteller's Saved by: a
		 * character, `dies` for None, or undefined to leave it to the grimoire; and today's
		 * facts still unmarked, as confirmed here; whether to keep the day going instead of
		 * ending it; and the ability that failed or forced the execution, if any. The dialog
		 * closes first.
		 */
		onConfirm: (
			seatId: SeatId | undefined,
			save: CharacterId | 'dies' | undefined,
			marks: Partial<Record<DayMark, boolean>>,
			keepGoing: boolean,
			outcome?: ExecutionOutcome
		) => void;
	}

	let {
		open = $bindable(),
		game,
		characters,
		chosen,
		notStarted = false,
		onConfirm
	}: Props = $props();

	const NONE = 'none';
	let choice = $state<string | undefined>();

	const executed = $derived(
		game.today.entries.findLast((e) => e.kind === 'execution')?.seatId as SeatId | undefined
	);
	/**
	 * Today's yes-or-no facts nobody marked (Trevor, 2026-10-24: "On day end, it should confirm
	 * demon did not vote"): each is asked here, off unless what was recorded says yes (a Minion's
	 * recorded nomination), and Confirm marks it either way.
	 */
	let marks = $state<Partial<Record<DayMark, boolean>>>({});
	let keepGoing = $state(false);
	$effect(() => {
		if (!open) return;
		choice = executed ?? chosen;
		keepGoing = false;
		marks = Object.fromEntries(
			unsetMarks(game, characters).map((m) => [m, suggestedMark(game, m, characters) ?? false])
		);
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
	/**
	 * What an ability does to the execution (`executionOutcome`, M9d), one row per character
	 * whose ability works, there for the whole time the dialog is open (no reflow) and
	 * disabled until a living player is chosen:
	 * - Only evil voted (the Legion, https://wiki.bloodontheclocktower.com/Legion): on, the
	 *   execution fails and nobody dies;
	 * - Ruling (the Judge, https://wiki.bloodontheclocktower.com/Judge): None, Forced to pass or
	 *   Forced to fail; either marks the Judge's ability used;
	 * - Executed at once (the Vizier, https://wiki.bloodontheclocktower.com/Vizier).
	 * Votes aren't recorded yet, so the Storyteller answers; why one may not apply shows beside
	 * it, and Confirm records it anyway (warn, never lock).
	 */
	const YES = 'yes';
	const RULING_NONE = 'none';
	const RULING_PASS = 'pass';
	const RULING_FAIL = 'fail';
	const holders = $derived(outcomeHolders(game, characters).filter((h) => h.works));
	const offers = $derived(saveOff ? [] : executionOutcomes(game, choice as SeatId, characters));
	let answers = $state<Partial<Record<OutcomeKind, string>>>({});
	// Unanswered each time the dialog opens or another player is chosen (not on closing:
	// Confirm reads them after the dialog closes).
	$effect(() => {
		if (!open) return;
		void choice;
		answers = {};
	});
	const problemOf = (holder: OutcomeHolder) =>
		offers.find((o) => o.kind === holder.kind && o.characterId === holder.characterId)?.problem;
	/** The outcome Confirm records: the Judge's ruling first, then the Vizier, then the Legion. */
	const outcome = $derived.by((): ExecutionOutcome | undefined => {
		if (saveOff) return undefined;
		const by = (kind: OutcomeKind) => holders.find((h) => h.kind === kind)?.characterId;
		const ruling = answers.force;
		if (ruling === RULING_PASS || ruling === RULING_FAIL) {
			const characterId = by('force');
			if (characterId) return { kind: ruling === RULING_PASS ? 'forced' : 'failed', characterId };
		}
		for (const [kind, result] of [
			['execute-now', 'forced'],
			['fails', 'failed']
		] as const) {
			const characterId = by(kind);
			if (characterId && answers[kind] === YES) return { kind: result, characterId };
		}
		return undefined;
	});
	const rulingOptions = $derived.by(() => {
		const holder = holders.find((h) => h.kind === 'force');
		const problem = holder ? problemOf(holder) : undefined;
		const description = problem ? t(`day.outcomeProblem.${problem}`) : undefined;
		return [
			{ value: RULING_NONE, label: t('day.rulingNone') },
			{ value: RULING_PASS, label: t('day.rulingPass'), ...(description ? { description } : {}) },
			{ value: RULING_FAIL, label: t('day.rulingFail'), ...(description ? { description } : {}) }
		];
	});

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
		saveOff || save === DIES || outcome?.kind === 'failed'
			? undefined
			: save === OVERRIDE
				? OVERRIDE
				: save
	);

	/**
	 * Keep the day going (Trevor, 2026-10-26, on the Butcher): while a player could still
	 * nominate after this execution (`nominationsAfterExecution`), Confirm may record it and
	 * leave the day open; off to start with, so Confirm ends the day as before. The switch is
	 * there whenever such a player is in play, and disabled while the choice gives none.
	 */
	const extraShown = $derived(extraNominators(game, characters).length > 0);
	const keepAvailable = $derived.by(() => {
		if (!extraShown || !choice || choice === NONE) return false;
		const seatId = choice as SeatId;
		const dies = !game.seats[seatId]?.dead && savedByNow === undefined;
		return nominatorsAfterExecution(game, { seatId, dies }, characters).length > 0;
	});

	/**
	 * Executed instead (the Scapegoat, https://wiki.bloodontheclocktower.com/Scapegoat): while
	 * such a player lives the switch is there, disabled unless the player chosen has, or might
	 * register as, their alignment. On, Confirm executes them in the chosen player's place.
	 */
	const insteadShown = $derived(insteadCandidates(game, characters));
	const insteadFor = $derived(saveOff ? [] : executedInstead(game, choice as SeatId, characters));
	let instead = $state(false);
	$effect(() => {
		if (!open || insteadFor.length === 0) instead = false;
	});
	const insteadOf = $derived(instead ? insteadFor[0] : undefined);
	/**
	 * A failed execution (the Legion's, the Judge's) is no execution, so the day stays open for
	 * another nomination (https://wiki.bloodontheclocktower.com/Legion: someone else is
	 * executed instead).
	 */
	const failed = $derived(outcome?.kind === 'failed' && !insteadOf);

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
			? onConfirm(undefined, undefined, { ...marks }, false)
			: onConfirm(
					insteadOf?.seatId ?? (choice as SeatId),
					saveOff || insteadOf || save === OVERRIDE || outcome?.kind === 'failed'
						? undefined
						: (save as CharacterId | 'dies'),
					{ ...marks },
					failed || (keepAvailable && keepGoing),
					...(outcome && !insteadOf ? [outcome] : [])
				)}
>
	<div class="execution" data-testid="execution">
		{#if notStarted}
			<p class="not-started" role="alert" data-testid="execution-not-started">
				<Icon name="warning" />{t('day.executionNotStarted')}
			</p>
		{/if}
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
		{#if insteadShown.length > 0}
			<!-- Its character as a badge, then the switch (hidden label: its accessible name). -->
			{@const by = insteadFor[0] ?? insteadShown[0]}
			{@const character = characters.get(by.characterId)}
			<div class="instead" data-testid="executed-instead">
				<span class="candidate"
					>{#if character}<CharacterBadge
							characterId={character.id}
							{character}
							interactive={false}
						/>{/if}{t('day.executedInstead')}</span
				>
				<!-- eslint-disable grim/names-as-badges -- hidden label (accessible name) only -->
				<Toggle
					hideLabel
					label={t('day.executedInsteadLabel', { who: character?.name ?? by.characterId })}
					checked={!!insteadOf}
					disabled={insteadFor.length === 0}
					onChange={(checked) => (instead = checked)}
				/>
				<!-- eslint-enable grim/names-as-badges -->
			</div>
		{/if}
		{#each holders as holder (holder.kind + holder.characterId)}
			{@const character = characters.get(holder.characterId)}
			{@const problem = problemOf(holder)}
			<div class="instead" data-testid={`outcome-${holder.kind}`}>
				<span class="candidate"
					>{#if character}<CharacterBadge
							characterId={character.id}
							{character}
							interactive={false}
						/>{/if}{#if holder.kind === 'force'}{t('day.ruling')}{:else}{t(
							holder.kind === 'fails' ? 'day.onlyEvilVoted' : 'day.executeNow'
						)}{/if}{#if problem && holder.kind !== 'force'}<span class="problem"
							><Icon name="warning" />{t(`day.outcomeProblem.${problem}`)}</span
						>{/if}</span
				>
				<!-- eslint-disable grim/names-as-badges -- hidden labels (accessible names) only -->
				{#if holder.kind === 'force'}
					<Select
						hideLabel
						label={t('day.rulingLabel', { who: character?.name ?? holder.characterId })}
						value={answers.force ?? RULING_NONE}
						options={rulingOptions}
						disabled={saveOff}
						testid="outcome-ruling"
						onChange={(value) => (answers = { ...answers, force: value })}
					/>
				{:else}
					<Toggle
						hideLabel
						label={t(holder.kind === 'fails' ? 'day.onlyEvilVotedLabel' : 'day.executeNowLabel', {
							who: character?.name ?? holder.characterId
						})}
						checked={answers[holder.kind] === YES}
						disabled={saveOff}
						onChange={(checked) =>
							(answers = { ...answers, [holder.kind]: checked ? YES : undefined })}
					/>
				{/if}
				<!-- eslint-enable grim/names-as-badges -->
			</div>
		{/each}
		{#each Object.keys(marks) as DayMark[] as mark (mark)}
			<Toggle
				label={t(`day.mark.${mark}`)}
				checked={marks[mark] === true}
				onChange={(checked) => (marks[mark] = checked)}
			/>
		{/each}
		{#if extraShown}
			<Toggle
				label={t('day.keepDayGoing')}
				checked={keepAvailable && keepGoing}
				disabled={!keepAvailable}
				onChange={(checked) => (keepGoing = checked)}
			/>
		{/if}
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
	.not-started {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: 0;
		color: var(--evil-text);
	}
	.execution {
		display: grid;
		gap: var(--space-2);
		padding-block: var(--space-2);
	}
	.instead {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
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
