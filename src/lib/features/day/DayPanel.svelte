<script lang="ts">
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import type { CharacterId } from '#lib/core/data/index.ts';
	import { recentDeaths } from '#lib/core/engine/index.ts';
	import {
		registersAsDead,
		type DeathCause,
		type Game,
		type SeatId
	} from '#lib/core/model/index.ts';
	import {
		afterDawn,
		blockThreshold,
		dayNumber,
		dayReminders,
		dayStateFromGame,
		isOnceOnlyDayAbility,
		ghostVotesLeft,
		livingByTeam,
		preventedDeaths,
		type PreventedBecause,
		type Night,
		validDeathCauses,
		type DayReminder,
		type ValidDeathCause
	} from '#lib/core/rules/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import CharacterEntry from '#lib/features/characters/CharacterEntry.svelte';
	import { provideCharacters } from '#lib/features/characters/character-context.ts';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import NightText from '#lib/features/reference/NightText.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import Sentence from '#lib/features/characters/Sentence.svelte';
	import { slot } from '#lib/features/characters/slots.ts';
	import { iconUrl } from '#lib/features/characters/icon-url.ts';
	import { explainBlock } from '#lib/features/glossary/glossary.svelte.ts';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import type { Assistance } from '#lib/ui/assistance.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Chip from '#lib/ui/primitives/Chip.svelte';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import DayTimer from './DayTimer.svelte';
	import type { DayPort } from './day-port.ts';
	import NoteSheet, { type NoteTarget } from './NoteSheet.svelte';

	interface Props {
		game: DayPort;
		assistance: Assistance;
		/** Shows a Night order button (the day spike); the grimoire has its own. */
		onOpenNight?: () => void;
	}

	// No Undo or History here (Trevor, 2026-10-16): each day action is one entry in the
	// game's History, in the grimoire's menu.
	let { game, assistance, onOpenNight }: Props = $props();
	// Every badge on the day screen names the script's own characters, homebrew included.
	provideCharacters(() => game.characters);

	const g = $derived(game.game);
	const seats = $derived(g.seating.map((id) => g.seats[id]));
	const hasFlowergirl = $derived(seats.some((s) => s.characterId === 'flowergirl'));

	// ── Players: tap one to mark a death (with its cause) or bring them back ──
	// Nominations happen off the grimoire, so they are not tracked here (Trevor, 2026-10-16).
	let causeOpen = $state(false);
	let causeSeat = $state<SeatId | undefined>();

	function tapSeat(seatId: SeatId) {
		causeSeat = seatId;
		causeOpen = true;
	}

	/**
	 * Every death has a cause (Trevor, 2026-10-16). An execution or exile is logged as one,
	 * so the Undertaker and the one-execution reminder see it.
	 */
	function markDead(cause: DeathCause) {
		const seatId = causeSeat;
		causeOpen = false;
		if (!seatId) return;
		if (cause === 'execution') game.run({ type: 'Execute', seatId });
		else if (cause === 'exile') game.run({ type: 'Exile', seatId });
		else game.run({ type: 'SetDead', seatId, dead: true, cause });
	}

	function markAlive() {
		if (causeSeat) game.run({ type: 'SetDead', seatId: causeSeat, dead: false });
		causeOpen = false;
	}

	const causeSeatDead = $derived(causeSeat ? g.seats[causeSeat]?.dead === true : false);
	const causeGhostVoteUsed = $derived(
		causeSeat ? g.seats[causeSeat]?.ghostVoteUsed === true : false
	);

	/** Marks the tapped dead player's ghost vote used, or gives it back (Trevor, 2026-10-18). */
	function toggleCauseGhostVote() {
		const seatId = causeSeat;
		causeOpen = false;
		if (!seatId) return;
		game.run({ type: causeGhostVoteUsed ? 'RestoreGhostVote' : 'SpendGhostVote', seatId });
	}

	// ── Confirming a change: what it is now, and what it will be ──
	// TPI's reminder token text (game data, not interface text).
	const NO_ABILITY = 'No Ability';
	// The texts hold slots (slots.ts): `character` and `reminder` show as badges.
	interface Pending {
		/** The dialog's own title (its action). */
		action: string;
		title: string;
		now: string;
		after: string;
		characterId: CharacterId;
		run: () => void;
	}
	let pending = $state<Pending>();
	let pendingOpen = $state(false);

	function ask(change: Pending) {
		pending = change;
		pendingOpen = true;
	}

	function confirmPending() {
		pending?.run();
	}

	function askUsed(seatId: SeatId, characterId: CharacterId) {
		const who = t('day.who', { character: slot('character'), seat: game.seatName(seatId) });
		const token = game.characters.get(characterId)?.reminders.includes(NO_ABILITY);
		ask({
			action: t('day.markUsed'),
			title: t('day.markUsedTitle', { who }),
			now: t('day.markUsedNow', { who }),
			after: token
				? t('day.markUsedAfterToken', { who, reminder: slot('reminder') })
				: t('day.markUsedAfter', { who }),
			characterId,
			run: () => game.run({ type: 'UseAbility', seatId, characterId })
		});
	}

	/**
	 * Unmarks a used ability (Trevor: "need to be able to undo something being marked as
	 * used"): removes today's use, which also takes back the No Ability reminder it placed,
	 * or else the No Ability reminder itself. Confirmed like marking it (Trevor, 2026-10-17:
	 * "require confirmation on the undoing").
	 */
	function askUnmarkUsed(seatId: SeatId, characterId: CharacterId) {
		const who = t('day.who', { character: slot('character'), seat: game.seatName(seatId) });
		const token = g.seats[seatId].reminders.find(
			(r) => r.characterId === characterId && r.label === NO_ABILITY
		);
		ask({
			action: t('day.unmarkUsed'),
			title: t('day.unmarkUsedTitle', { who }),
			now: token
				? t('day.unmarkUsedNowToken', { who, reminder: slot('reminder') })
				: t('day.markUsedAfter', { who }),
			after: t('day.markUsedNow', { who }),
			characterId,
			run: () => unmarkUsed(seatId, characterId)
		});
	}

	function unmarkUsed(seatId: SeatId, characterId: CharacterId) {
		const entry = g.today.entries.findLast(
			(e) => e.kind === 'ability' && e.seatId === seatId && e.characterId === characterId
		);
		if (entry) {
			game.run({ type: 'RemoveDayEntry', entryId: entry.entryId });
			return;
		}
		const token = g.seats[seatId].reminders.find(
			(r) => r.characterId === characterId && r.label === NO_ABILITY
		);
		if (token) game.run({ type: 'RemoveReminder', reminderId: token.reminderId });
	}

	/** Only the causes that could be true for this player (core `validDeathCauses`). */
	const causes = $derived(causeSeat ? validDeathCauses(g, causeSeat, game.characters) : []);

	function causeLabel(cause: DeathCause): string {
		switch (cause) {
			case 'execution':
				return t('day.causeExecuted');
			case 'exile':
				return t('day.causeExiled');
			case 'demon':
				return t('day.causeDemon');
			case 'other':
				return t('day.causeOther');
			default:
				// The killing character, as a badge (causeSlots).
				return slot('cause');
		}
	}

	/** Why a cause is offered with a caution, in a few words. */
	/** `text` may hold the `character` slot, for `characterId`. */
	function causeCaution(
		option: ValidDeathCause
	): { text: string; characterId?: CharacterId } | undefined {
		const flag = option.flags[0];
		if (!flag) return undefined;
		switch (flag.code) {
			case 'registers':
				return {
					text: t('day.cautionRegisters', { character: slot('character') }),
					characterId: flag.source.characterId
				};
			case 'impaired':
				return { text: t('day.cautionImpaired') };
			case 'unknown':
				return { text: t('day.cautionUnknown') };
		}
	}

	// ── Pre-day reminders ──
	/**
	 * The reminders as the day started: tokens placed by today's ability uses are left out,
	 * so "has an unused shot" stays put (with Used pressed) instead of vanishing mid-day.
	 */
	function atDayStart(game: Game): Game {
		const placed = new Set(
			game.today.entries.flatMap((e) =>
				e.kind === 'ability' && e.reminderId ? [e.reminderId] : []
			)
		);
		if (placed.size === 0) return game;
		const seats = Object.fromEntries(
			Object.entries(game.seats).map(([id, seat]) => [
				id,
				{ ...seat, reminders: seat.reminders.filter((r) => !placed.has(r.reminderId)) }
			])
		);
		return { ...game, seats };
	}

	/** Everyone who died since the previous day ended, to announce (Trevor, 2026-10-16). */
	const died = $derived(recentDeaths(game.log, g));

	// ── What didn't happen: a kill whose Dead token sits on a living player (Trevor) ──
	const prevented = $derived(preventedDeaths(g, game.characters));
	let preventedOpen = $state(false);

	/** The characters that explain a survival, with their seats, for their ability text. */
	function blockers(because: PreventedBecause): { characterId: CharacterId; seatId?: SeatId }[] {
		switch (because.kind) {
			case 'protected':
				return because.source === 'override' ? [] : [because.source];
			case 'killer-impaired':
				return because.impairments.map((i) => i.source);
			case 'fool':
			case 'mayor':
				return [{ characterId: because.kind, seatId: because.seatId }];
		}
	}

	function diedText(cause: DeathCause | undefined): string {
		return cause === undefined
			? t('day.diedNoCause')
			: t('day.diedCause', { cause: causeLabel(cause) });
	}

	const reminders = $derived(
		dayReminders(
			dayStateFromGame(atDayStart(g), (id) => game.characters.get(id), undefined, game.characters)
		)
	);

	/** The seat a reminder is about: its own character's badge. */
	function seatOf(reminder: DayReminder): SeatId | undefined {
		const self = reminder.segments.find(
			(s) => s.kind === 'character' && s.ref.characterId === reminder.characterId
		);
		return self?.kind === 'character' ? self.ref.seatId : undefined;
	}

	function used(seatId: SeatId, characterId: CharacterId): boolean {
		return (
			g.today.entries.some(
				(e) => e.kind === 'ability' && e.seatId === seatId && e.characterId === characterId
			) ||
			g.seats[seatId].reminders.some(
				(r) => r.characterId === characterId && r.label === 'No Ability'
			)
		);
	}

	function hasNote(target: NoteTarget): boolean {
		return g.today.entries.some(
			(e) => e.kind === 'note' && e.characterId === target.characterId && e.seatId === target.seatId
		);
	}

	let noteOpen = $state(false);
	let noteTarget = $state<NoteTarget>();
	function openNote(target: NoteTarget) {
		noteTarget = target;
		noteOpen = true;
	}

	/** Votes for the first nominee, from who is alive now (core `blockThreshold`). */
	const block = $derived(blockThreshold(g));
	/** Living players on each team (Trevor, 2026-10-17), beside the votes badge. */
	const teams = $derived(livingByTeam(g));
	const ghostVotes = $derived(ghostVotesLeft(g));
	/** Section headers stick just under the toolbar (Trevor, 2026-10-17). */
	let toolbarSize = $state<ResizeObserverSize[]>();
	// The exact (fractional) height: a rounded one leaves a sliver between toolbar and header.
	const toolbarHeight = $derived(toolbarSize?.[0]?.blockSize ?? 0);

	/**
	 * Announcements as the day begins (Trevor, 2026-10-16): TPI's steps after Dawn for the
	 * night that just ended (the Vizier, the Leviathan), for characters in play, with TPI's
	 * night text. A new day starts when the night ends, so Day 1 follows the first night.
	 */
	const announcers = $derived.by(() => {
		const day = dayNumber(g);
		const sheet = officialData.current?.nightSheet;
		if (day === 0 || !sheet) return [];
		const night: Night = day === 1 ? 'first' : 'other';
		return afterDawn(sheet, night).flatMap((characterId) => {
			const character = game.characters.get(characterId);
			const text =
				night === 'first' ? character?.firstNightReminder : character?.otherNightReminder;
			const seatId = g.seating.find((s) => g.seats[s].characterId === characterId);
			return character && text && seatId ? [{ character, text, seatId, night }] : [];
		});
	});
</script>

{#snippet actions(characterId: CharacterId | undefined, seatId: SeatId | undefined)}
	<!-- eslint-disable grim/names-as-badges -- accessible names (aria-label) only -->
	{@const who = seatId
		? t('day.who', { character: game.characterName(characterId), seat: game.seatName(seatId) })
		: game.characterName(characterId)}
	<!-- eslint-enable grim/names-as-badges -->
	<span class="row-actions">
		{#if characterId && seatId && isOnceOnlyDayAbility(characterId)}
			{@const isUsed = used(seatId, characterId)}
			<Chip
				pressed={isUsed}
				aria-label={t('day.usedLabel', { who })}
				onclick={() => (isUsed ? askUnmarkUsed(seatId, characterId) : askUsed(seatId, characterId))}
			>
				<span class="tick" data-on={isUsed || undefined}><Icon name="check" /></span>{t('day.used')}
			</Chip>
		{/if}
		{#if characterId}
			<Chip
				marked={hasNote({ characterId, seatId })}
				aria-label={t('day.noteLabel', { who })}
				onclick={() => openNote({ characterId, seatId })}
			>
				<Icon name="notes" />{t('day.note')}
			</Chip>
		{/if}
	</span>
{/snippet}

<div class="panel" style:--toolbar-height={`${toolbarHeight}px`}>
	<!-- Stays in view while the day scrolls (Trevor, 2026-10-17). -->
	<div class="toolbar" data-testid="day-toolbar" bind:borderBoxSize={toolbarSize}>
		<DayTimer alive={block.alive} />
		{#if onOpenNight}
			<Button icon="night" onclick={onOpenNight}>{t('day.nightOrder')}</Button>
		{/if}
		<!--
			One line on every phone (Trevor, 2026-10-17): living of all players, each team's
			living, ghost votes left and votes to put a nominee on the block. Numbers with icons
			or team colours; the words are in each one's accessible name.
		-->
		<div class="counts">
			<span
				class="badge"
				role="note"
				data-testid="alive-count"
				aria-label={t('day.aliveLabel', {
					count: teams.alive,
					total: g.seating.length,
					good: teams.good,
					evil: teams.evil
				})}
				title={t('day.aliveLabel', {
					count: teams.alive,
					total: g.seating.length,
					good: teams.good,
					evil: teams.evil
				})}
				><Icon name="alive" />{t('day.aliveBadge', {
					count: teams.alive,
					total: g.seating.length
				})}</span
			>
			<span
				class="badge good"
				data-testid="alive-good"
				role="note"
				aria-label={t('day.goodLabel', { count: teams.good })}
				title={t('day.goodLabel', { count: teams.good })}>{teams.good}</span
			>
			<span
				class="badge evil"
				data-testid="alive-evil"
				role="note"
				aria-label={t('day.evilLabel', { count: teams.evil })}
				title={t('day.evilLabel', { count: teams.evil })}>{teams.evil}</span
			>
			<span
				class="badge"
				role="note"
				data-testid="ghost-votes"
				aria-label={t('day.ghostVotesLabel', { count: ghostVotes })}
				title={t('day.ghostVotesLabel', { count: ghostVotes })}
				><Icon name="ghostVote" />{ghostVotes}</span
			>
			<!--
				Votes the first nominee needs to go on the block, from who is alive now, so a death
				mid-day updates it. Nominations and votes are not tracked, so "more than the player
				on the block" is left to the Storyteller.
			-->
			<span
				class="badge votes"
				role="note"
				data-testid="votes-needed"
				aria-label={t('day.votesBadgeLabel', { count: block.needed, alive: block.alive })}
				title={t('day.votesBadgeLabel', { count: block.needed, alive: block.alive })}
				><Icon name="vote" />{block.needed}</span
			>
		</div>
	</div>

	<Collapsible title={t('day.announcements')} storageKey="day.announcements">
		{#snippet aside()}
			<Button
				variant="quiet"
				icon="protected"
				data-testid="prevented-button"
				disabled={prevented.length === 0}
				aria-label={t('day.preventedButton', { count: prevented.length })}
				title={t('day.preventedButton', { count: prevented.length })}
				onclick={() => (preventedOpen = true)}>{prevented.length}</Button
			>
		{/snippet}
		<ul class="reminders" data-testid="announcements">
			{#each died as death (death.seatId)}
				{@const seat = g.seats[death.seatId]}
				<li>
					<CharacterEntry
						characterId={seat.characterId}
						alignment={seat.alignment}
						playerName={game.seatName(seat.seatId)}
						label={game.seatName(seat.seatId)}
					>
						<span class="sentence"
							><Sentence text={diedText(death.cause)}
								>{#snippet fill()}{@render badge(death.cause)}{/snippet}</Sentence
							></span
						>
					</CharacterEntry>
				</li>
			{/each}
			{#each announcers as a (a.character.id)}
				<li data-character={a.character.id}>
					<CharacterEntry
						characterId={a.character.id}
						alignment={g.seats[a.seatId].alignment}
						playerName={game.seatName(a.seatId)}
					>
						<span class="sentence"
							><NightText text={a.text} character={a.character} night={a.night} /></span
						>
					</CharacterEntry>
				</li>
			{/each}
			{#if died.length === 0 && announcers.length === 0}
				<li>{t('common.none')}</li>
			{/if}
		</ul>
	</Collapsible>

	<Collapsible title={t('day.players')} storageKey="day.players">
		<div class="seats">
			{#each seats as seat (seat.seatId)}
				{@const character = seat.characterId ? game.characters.get(seat.characterId) : undefined}
				{@const icon = character && iconUrl(character, seat.alignment)}
				{@const ghost = registersAsDead(g, seat.seatId) && !seat.ghostVoteUsed}
				<button
					type="button"
					class="seat"
					aria-label={t('day.seatButton', { name: game.seatName(seat.seatId) })}
					data-dead={seat.dead}
					onclick={() => tapSeat(seat.seatId)}
				>
					<!-- Icon two lines tall, character name above, player name below (Trevor). -->
					<span class="seat-icon" aria-hidden="true"
						><span class="face"
							>{#if icon}<img src={icon} alt="" width="40" height="40" />{/if}</span
						><span class="skull" data-testid="dead-mark"><Icon name="dead" /></span><span
							class="ghost-mark"
							data-testid="ghost-mark"
							data-shown={ghost}
							title={t('day.hasGhostVote')}><Icon name="ghostVote" /></span
						></span
					>
					<span class="seat-text">
						<!-- eslint-disable grim/names-as-badges -- caption beside its own icon -->
						<span class="seat-character" data-team={seat.alignment ?? 'neutral'}
							>{character?.name ?? t('day.noCharacter')}</span
						>
						<!-- eslint-enable grim/names-as-badges -->
						<span class="seat-player">{game.seatName(seat.seatId)}</span>
					</span>
				</button>
			{/each}
		</div>
		{#if hasFlowergirl}
			<div class="demon-voted">
				<Toggle
					label={t('day.demonVoted')}
					checked={g.today.demonVoted === true}
					onChange={(checked) => game.run({ type: 'SetDemonVoted', voted: checked })}
				/>
			</div>
		{/if}
	</Collapsible>

	{#if assistance.preDayReminders}
		<!-- Each group is its own section; no "Today" wrapper (Trevor, 2026-10-17). -->
		{#each reminders.groups as group (group.group)}
			<Collapsible title={group.title} storageKey={`day.group.${group.group}`}>
				<ul class="reminders">
					{#each group.reminders as reminder (reminder.key)}
						{@const explained = explainBlock(
							reminder.segments.map((s) => (s.kind === 'text' ? s.text : ''))
						)}
						{@const head =
							reminder.segments[0]?.kind === 'character' ? reminder.segments[0] : undefined}
						<li data-character={reminder.characterId}>
							<CharacterEntry
								characterId={head?.ref.characterId}
								alignment={head?.ref.seatId ? g.seats[head.ref.seatId]?.alignment : undefined}
								playerName={head?.ref.playerName}
							>
								<span class="sentence">
									{#each reminder.segments as segment, i (i)}
										{#if segment === head}{:else if segment.kind === 'character'}
											<CharacterBadge
												characterId={segment.ref.characterId}
												alignment={segment.ref.seatId
													? g.seats[segment.ref.seatId]?.alignment
													: undefined}
												playerName={segment.ref.playerName}
											/>
										{:else if segment.kind === 'value'}
											<!-- A value the Storyteller entered during prep (the Yaggababble's phrase). -->
											<span>({segment.value ?? segment.placeholder})</span>
										{:else}
											<span><GlossaryText segments={explained[i] ?? []} /></span>
										{/if}
									{/each}
								</span>
								{@render ability(reminder.characterId)}
								{@render actions(reminder.characterId, seatOf(reminder))}
							</CharacterEntry>
						</li>
					{/each}
				</ul>
			</Collapsible>
		{/each}
	{:else}
		<Collapsible title={t('day.abilitiesAndNotes')} storageKey="day.abilities">
			<ul class="reminders">
				{#each seats as seat (seat.seatId)}
					{#if seat.characterId}
						<li data-character={seat.characterId}>
							<CharacterEntry
								characterId={seat.characterId}
								alignment={seat.alignment}
								playerName={seat.playerName}
							>
								{@render ability(seat.characterId)}
								{@render actions(seat.characterId, seat.seatId)}
							</CharacterEntry>
						</li>
					{/if}
				{/each}
			</ul>
		</Collapsible>
	{/if}
</div>

{#snippet ability(characterId: string | undefined)}
	<!-- TPI's ability text, so the Storyteller sees what the reminder is about. -->
	{@const text = characterId ? game.characters.get(characterId)?.ability : undefined}
	{#if text}<p class="ability" data-testid="ability">{text}</p>{/if}
{/snippet}

<NoteSheet bind:open={noteOpen} {game} target={noteTarget} />

<BottomSheet bind:open={preventedOpen} title={t('day.prevented')}>
	<ul class="prevented" data-testid="prevented">
		{#each prevented as p (p.reminderId)}
			{@const target = g.seats[p.seatId]}
			<li>
				<!-- Laid out like a jinx, as every row of the day (Trevor, 2026-10-18). -->
				<CharacterEntry
					characterId={p.killer}
					alignment={p.killerSeats[0] ? g.seats[p.killerSeats[0]].alignment : undefined}
					playerName={p.killerSeats[0] ? game.seatName(p.killerSeats[0]) : undefined}
				>
					<span class="sentence">
						<span>{t('day.preventedChose')}</span>
						{#if target.characterId}
							<CharacterBadge
								characterId={target.characterId}
								alignment={target.alignment}
								playerName={game.seatName(p.seatId)}
							/>
						{:else}
							<span>{game.seatName(p.seatId)}</span>
						{/if}
					</span>
					<ul class="because">
						{#each p.because as because, i (i)}
							{#if because.kind === 'protected' && because.source === 'override'}
								<li>{t('day.preventedOverride')}</li>
							{/if}
							{#each blockers(because) as b (b.characterId)}
								<li data-character={b.characterId}>
									<CharacterEntry
										characterId={b.characterId}
										alignment={b.seatId ? g.seats[b.seatId].alignment : undefined}
										playerName={b.seatId ? game.seatName(b.seatId) : undefined}
									>
										{@render ability(b.characterId)}
									</CharacterEntry>
								</li>
							{/each}
						{:else}
							<li>{t('day.preventedNoReason')}</li>
						{/each}
					</ul>
				</CharacterEntry>
			</li>
		{/each}
	</ul>
</BottomSheet>

<BottomSheet
	bind:open={causeOpen}
	title={causeSeatDead
		? t('day.deadPlayerTitle', { name: game.seatName(causeSeat) })
		: t('day.howDied', { name: game.seatName(causeSeat) })}
>
	<div class="causes">
		{#if causeSeatDead}
			<Button onclick={markAlive}>{t('day.markAlive')}</Button>
			<!-- The ghost vote, one tap away (Trevor, 2026-10-18). -->
			<Button icon="ghostVote" onclick={toggleCauseGhostVote}
				>{causeGhostVoteUsed ? t('day.restoreGhostVote') : t('day.spendGhostVote')}</Button
			>
		{:else}
			{#each causes as option (option.cause)}
				{@const caution = causeCaution(option)}
				<Button onclick={() => markDead(option.cause)}>
					<Sentence text={causeLabel(option.cause)}
						>{#snippet fill()}{@render badge(option.cause, false)}{/snippet}</Sentence
					>{#if option.gained}<span class="gained">({@render badge(option.gained, false)})</span
						>{/if}{#if caution}<span class="caution"
							>(<Sentence text={caution.text}
								>{#snippet fill()}{@render badge(caution.characterId, false)}{/snippet}</Sentence
							>)</span
						>{/if}
				</Button>
			{/each}
		{/if}
		<!-- Set apart and tinted, so it is never mistaken for a cause (Trevor, 2026-10-16). -->
		<div class="cancel">
			<ModalActions onCancel={() => (causeOpen = false)} />
		</div>
	</div>
</BottomSheet>

<!-- A character as a badge; false inside a button, so it does not open the character. -->
{#snippet badge(id: CharacterId | undefined, interactive = true)}{#if id}<CharacterBadge
			characterId={id}
			character={game.characters.get(id)}
			inline
			{interactive}
		/>{/if}{/snippet}
{#snippet pendingSlot(name: string)}{#if name === 'reminder'}<ReminderToken
			label={NO_ABILITY}
			character={pending ? game.characters.get(pending.characterId) : undefined}
		/>{:else}{@render badge(pending?.characterId)}{/if}{/snippet}

<ConfirmDialog bind:open={pendingOpen} title={pending?.action ?? ''} onConfirm={confirmPending}>
	{#snippet heading()}
		<Sentence text={pending?.title ?? ''} fill={pendingSlot} />
	{/snippet}
	{#if pending}
		<p class="state">
			<span class="state-label">{t('day.now')}</span><Sentence
				text={pending.now}
				fill={pendingSlot}
			/>
		</p>
		<p class="state">
			<span class="state-label">{t('day.after')}</span><Sentence
				text={pending.after}
				fill={pendingSlot}
			/>
		</p>
	{/if}
</ConfirmDialog>

<style>
	.panel {
		display: grid;
		gap: var(--space-5);
	}
	.toolbar {
		position: sticky;
		top: 0;
		z-index: 2;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		padding-block: var(--space-1);
		background: var(--dialog-background, var(--surface));
	}
	.seats {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, calc(10 * var(--u))), 1fr));
		gap: var(--space-1);
		touch-action: manipulation;
	}
	.seat {
		display: grid;
		position: relative;
		grid-template-columns: auto minmax(0, 1fr);
		min-width: 0;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
		padding: var(--space-1);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: var(--on-surface);
		font: inherit;
		text-align: start;
		cursor: pointer;
	}
	.seat-icon {
		position: relative;
		display: inline-grid;
		width: calc(2.25 * var(--u) * var(--character-icon-scale, 1));
		height: calc(2.25 * var(--u) * var(--character-icon-scale, 1));
	}
	.face {
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: var(--token-face, var(--on-surface));
		overflow: hidden;
	}
	.face img {
		width: 88%;
		height: 88%;
	}
	.seat-text {
		display: grid;
		min-width: 0;
	}
	.seat-character {
		/* Breaks mid-word only when the word is wider than the tile (largest text sizes). */
		overflow-wrap: anywhere;
		hyphens: auto;
		font-family: var(--font-character);
		font-weight: var(--font-character-weight, 600);
	}
	/* Alignment as the rim colour, so names keep full contrast. */
	.seat:has(.seat-character[data-team='good']) {
		border-left: 4px solid var(--good);
	}
	.seat:has(.seat-character[data-team='evil']) {
		border-left: 4px solid var(--evil);
	}
	.seat-player {
		overflow-wrap: anywhere;
		font-family: var(--font-player);
	}
	/*
	 * Dead, as on the board (Trevor, 2026-10-16): the icon dimmed with its colour kept, and
	 * a skull badge on its lower-left rim. Names keep full contrast (dimming text is harder
	 * to read). Always laid out, shown only when dead, so nothing shifts.
	 */
	.seat[data-dead='true'] .face {
		filter: brightness(0.55);
	}
	.skull {
		position: absolute;
		left: -10%;
		bottom: -6%;
		display: grid;
		place-items: center;
		width: 45%;
		height: 45%;
		border: calc(0.125 * var(--u)) solid var(--on-surface);
		border-radius: 50%;
		background: var(--dialog-background);
		color: var(--on-surface);
		visibility: hidden;
		--icon-size: calc(0.6 * var(--u) * var(--character-icon-scale, 1));
	}
	.seat[data-dead='true'] .skull {
		visibility: visible;
	}
	.demon-voted {
		min-width: calc(12 * var(--u));
	}
	.reminders {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* Laid out like a jinx (CharacterEntry): the text, ability and actions under the bar. */
	.reminders li :global(.body) {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
	/* While a section scrolls, its header stays just under the toolbar (Trevor, 2026-10-17). */
	.panel > :global(.collapsible > .head) {
		position: sticky;
		/* Tucked 1px under the toolbar, so no scrolled content shows between them (Trevor). */
		top: calc(var(--toolbar-height, 0px) - 1px); /* px-ok: hairline overlap */
		z-index: 1;
		background: var(--dialog-background, var(--surface));
	}
	/* The ghost vote still to use, on the icon's upper rim, as the board shows it. */
	.ghost-mark {
		position: absolute;
		right: -10%;
		top: -6%;
		display: grid;
		place-items: center;
		width: 45%;
		height: 45%;
		border-radius: 50%;
		background: var(--dialog-background);
		color: var(--on-surface);
		visibility: hidden;
		--icon-size: calc(0.6 * var(--u) * var(--character-icon-scale, 1));
	}
	.ghost-mark[data-shown='true'] {
		visibility: visible;
	}
	.sentence {
		font-family: var(--font-ability);
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-2);
	}
	.ability {
		flex-basis: 100%;
		order: 1;
		margin: 0;
		font-family: var(--font-ability);
		font-size: 0.9rem;
	}
	.row-actions {
		display: inline-flex;
		gap: var(--space-2);
		margin-left: auto;
	}
	/* The tick is always laid out, so pressing Used never changes the chip's width. */
	.tick {
		display: inline-grid;
		visibility: hidden;
	}
	.tick[data-on] {
		visibility: visible;
	}
	/*
	 * One line however narrow (Trevor, 2026-10-17): five equal cells sharing the width, the
	 * numbers shrinking only on the narrowest phones with the largest text.
	 */
	.counts {
		container-type: inline-size;
		display: flex;
		flex-basis: 100%;
		gap: var(--space-1);
	}
	.badge {
		display: inline-flex;
		flex: 1 1 0;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
		min-width: 0;
		min-height: var(--tap-target);
		padding: 0 var(--space-1);
		border: 1px solid var(--border);
		border-radius: var(--radius-full);
		font-size: clamp(0.75rem, 5cqi, 1rem);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	/* Team colour on the border only: the text stays readable on a phone (Trevor). */
	.badge.good {
		border-color: var(--good);
	}
	.badge.evil {
		border-color: var(--evil);
	}
	.badge.votes {
		border-color: var(--heading);
		color: var(--heading);
		font-family: var(--font-control);
	}
	.causes {
		display: grid;
		gap: var(--space-2);
	}
	.cancel {
		display: grid;
		margin-top: var(--space-2);
		padding-top: var(--space-3);
		border-top: 1px solid var(--border);
	}
	.cancel :global(.button) {
		/* A cool tint, unlike the parchment cause buttons. */
		background: var(--good-wash);
		border: 1px solid var(--good);
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
	.gained,
	.caution {
		margin-left: var(--space-1);
		color: var(--on-surface-muted);
		font-weight: normal;
	}
	.prevented,
	.because {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
	}
	.because {
		margin-block-start: var(--space-1);
	}
</style>
