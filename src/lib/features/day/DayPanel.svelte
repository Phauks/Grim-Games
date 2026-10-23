<script lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import { recentDeaths, recentRevivals } from '#lib/core/engine/index.ts';
	import type { DeathCause, Game, SeatId } from '#lib/core/model/index.ts';
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
		daySentence,
		type DayCount
	} from '#lib/core/rules/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import CountDialog from './CountDialog.svelte';
	import { gameModeOf } from '#lib/features/modes/game-mode.ts';
	import CharacterEntry from '#lib/features/characters/CharacterEntry.svelte';
	import CharacterRow from '#lib/features/characters/CharacterRow.svelte';
	import { provideCharacters } from '#lib/features/characters/character-context.ts';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import NightText from '#lib/features/reference/NightText.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import Sentence from '#lib/features/characters/Sentence.svelte';
	import { slot } from '#lib/features/characters/slots.ts';
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
		/** Opens the Savant information sheet for a seat (the grimoire's); none in the spike. */
		onSavant?: (seatId: SeatId) => void;
	}

	// No Undo or History here (Trevor, 2026-10-16): each day action is one entry in the
	// game's History, in the grimoire's menu.
	let { game, assistance, onOpenNight, onSavant }: Props = $props();
	// Every badge on the day screen names the script's own characters, homebrew included.
	provideCharacters(() => game.characters);

	const g = $derived(game.game);
	const seats = $derived(g.seating.map((id) => g.seats[id]));
	const hasFlowergirl = $derived(seats.some((s) => s.characterId === 'flowergirl'));
	/**
	 * The Flowergirl learns each night whether the Demon voted today (Trevor, 2026-10-19:
	 * "we need quick action in day for that"): one tap on her own row (Trevor, 2026-10-23:
	 * L43, not at the top of the day). Today's mark is the day log's, so it starts unset each
	 * new day and History can undo it.
	 */
	const demonVoted = $derived(g.today.demonVoted === true);

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
	/** And everyone brought back to life in that night (Trevor, 2026-10-20: L9). */
	const revived = $derived(recentRevivals(game.log, g));

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
			case 'survives-first-death':
			case 'may-bounce':
				return [because.source];
		}
	}

	/**
	 * Announcing a death (Trevor, 2026-10-19: "show the exact statement"): what to say, in
	 * normal text, by seat and name and never by character; then for the Storyteller only,
	 * in italics, the character and the cause.
	 */
	function spokenDeath(seatId: SeatId): string {
		const seat = g.seating.indexOf(seatId) + 1;
		const name = g.seats[seatId].playerName;
		return name ? t('day.announce.died', { name, seat }) : t('day.announce.diedUnnamed', { seat });
	}
	function spokenRevival(seatId: SeatId): string {
		const seat = g.seating.indexOf(seatId) + 1;
		const name = g.seats[seatId].playerName;
		return name
			? t('day.announce.revived', { name, seat })
			: t('day.announce.revivedUnnamed', { seat });
	}
	function privateDeath(cause: DeathCause | undefined): string {
		const how =
			cause === undefined
				? t('day.announce.noCause')
				: cause === 'execution'
					? t('day.announce.executed')
					: cause === 'exile'
						? t('day.announce.exiled')
						: cause === 'demon'
							? t('day.announce.demon')
							: cause === 'other'
								? t('day.announce.other')
								: t('day.announce.killedBy', { killer: slot('cause') });
		return t('day.announce.private', { character: slot('character'), how });
	}
	/**
	 * A custom character is in play (Trevor, 2026-10-20: L28): the app doesn't know what it
	 * announces, so Announcements says it may be missing some.
	 */
	const customInPlay = $derived(
		g.seating.some((s) => {
			const id = g.seats[s].characterId;
			return g.script.entries.some((e) => e.kind === 'custom' && e.character.id === id);
		})
	);
	/** A dawn has come (End night), so "Nobody died in the night" means something. */
	const dawned = $derived(
		game.log.entries
			.slice(0, game.log.cursor)
			.some((e) => e.events.some((ev) => ev.type === 'DayStarted'))
	);
	/**
	 * With "I See Dead People" on, deaths are never announced (World Cup thread, 2026-10-19):
	 * the spoken line says so instead.
	 */
	const privateDeaths = $derived(gameModeOf(g.gameId)?.parts.deaths?.kind === 'private');

	const reminders = $derived(
		dayReminders(
			dayStateFromGame(atDayStart(g), (id) => game.characters.get(id), undefined, game.characters)
		)
	);

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
	const aliveLabel = $derived(t('day.aliveLabel', { count: teams.alive, total: g.seating.length }));
	const goodLabel = $derived(t('day.goodLabel', { count: teams.good }));
	const evilLabel = $derived(t('day.evilLabel', { count: teams.evil }));
	const ghostLabel = $derived(t('day.ghostVotesLabel', { count: ghostVotes }));
	const votesLabel = $derived(
		t('day.votesBadgeLabel', { count: block.needed, alive: block.alive })
	);
	// ── How a count was worked out, from tapping it ──
	let countOpen = $state(false);
	let countShown = $state<DayCount | 'votes'>();
	let countTitle = $state('');
	function openCount(count: DayCount | 'votes', title: string) {
		countShown = count;
		countTitle = title;
		countOpen = true;
	}
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

	// ── A player's day button, on their ability row ──
	/** Used for a once-per-game day ability, Guesses for the Juggler. */
	const hasDayButton = (characterId: CharacterId | undefined) =>
		characterId !== undefined &&
		(isOnceOnlyDayAbility(characterId) ||
			characterId === 'juggler' ||
			savantButton(characterId) ||
			demonVotedButton(characterId));
	/** The Flowergirl's Demon voted, on her row while its setting is on (L43). */
	const demonVotedButton = (characterId: CharacterId | undefined) =>
		characterId === 'flowergirl' && assistance.demonVotedButton;
	/**
	 * The Savant's information for today, recommended until it is set (Trevor, 2026-10-20: L5):
	 * with "Suggest Savant information" on, where the grimoire can open its sheet.
	 */
	const savantButton = (characterId: CharacterId | undefined) =>
		characterId === 'savant' && assistance.savantInfo && onSavant !== undefined;
	/** The first pre-day reminder row headed by each seat's own character carries its button. */
	const buttonRows = $derived.by(() => {
		const rows: Record<string, SeatId> = {};
		const taken: SeatId[] = [];
		for (const group of reminders.groups) {
			for (const reminder of group.reminders) {
				const head = reminder.segments[0];
				const seatId = head?.kind === 'character' ? head.ref.seatId : undefined;
				if (!seatId || taken.includes(seatId)) continue;
				if (g.seats[seatId]?.characterId !== reminder.characterId) continue;
				if (!hasDayButton(reminder.characterId)) continue;
				rows[reminder.key] = seatId;
				taken.push(seatId);
			}
		}
		return rows;
	});
	/** Seats with a day button but no reminder row today, listed on their own under Abilities. */
	const unlisted = $derived(
		assistance.preDayReminders
			? seats.filter(
					(s) => hasDayButton(s.characterId) && !Object.values(buttonRows).includes(s.seatId)
				)
			: []
	);
</script>

<!--
	A player's day button sits on their ability row, on the same line as their character and
	name (Trevor, 2026-10-19, option B; the Players section is gone, Trevor 2026-10-20): Used
	for a once-per-game day ability, and Guesses for the Juggler, whose guesses feed his night
	answer.
-->
<!-- The day's button at a row's end, centred like character selection's lock. -->
{#snippet dayEnd(characterId: CharacterId | undefined, seatId: SeatId)}
	{#if hasDayButton(characterId)}
		<span class="day-end">{@render dayButton(characterId, seatId)}</span>
	{/if}
{/snippet}

{#snippet dayButton(characterId: CharacterId | undefined, seatId: SeatId)}
	<!-- eslint-disable grim/names-as-badges -- accessible names (aria-label) only -->
	{@const who = t('day.who', {
		character: game.characterName(characterId),
		seat: game.seatName(seatId)
	})}
	<!-- eslint-enable grim/names-as-badges -->
	{#if characterId && isOnceOnlyDayAbility(characterId)}
		{@const isUsed = used(seatId, characterId)}
		<Chip
			pressed={isUsed}
			aria-label={t('day.usedLabel', { who })}
			onclick={() => (isUsed ? askUnmarkUsed(seatId, characterId) : askUsed(seatId, characterId))}
		>
			<span class="tick" data-on={isUsed || undefined}><Icon name="check" /></span>{t('day.used')}
		</Chip>
	{:else if characterId === 'juggler'}
		<Chip
			marked={hasNote({ characterId, seatId })}
			aria-label={t('day.guessesLabel', { who })}
			onclick={() => openNote({ characterId, seatId })}
		>
			{t('day.guesses')}
		</Chip>
	{:else if demonVotedButton(characterId)}
		<Chip
			pressed={demonVoted}
			data-testid="demon-voted"
			onclick={() => game.run({ type: 'SetDemonVoted', voted: !demonVoted })}
		>
			<span class="tick" data-on={demonVoted || undefined}><Icon name="check" /></span>{t(
				'day.demonVoted'
			)}
		</Chip>
	{:else if savantButton(characterId)}
		{@const set = hasNote({ characterId: 'savant', seatId })}
		<!-- Not set yet: recommended, in the accent colour. -->
		<Chip
			marked={set}
			class={set ? undefined : 'recommend'}
			data-testid="savant-info"
			aria-label={t('day.savantInfoLabel', { who })}
			onclick={() => onSavant?.(seatId)}
		>
			{t('day.savantInfo')}
		</Chip>
	{/if}
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
			<!-- Each one opens how it was worked out (Trevor, 2026-10-19). -->
			<button
				type="button"
				class="badge alive"
				data-testid="alive-count"
				aria-label={aliveLabel}
				title={aliveLabel}
				onclick={() => openCount('alive', aliveLabel)}
				><Icon name="alive" />{t('day.aliveBadge', {
					count: teams.alive,
					total: g.seating.length
				})}</button
			>
			<button
				type="button"
				class="badge good"
				data-testid="alive-good"
				aria-label={goodLabel}
				title={goodLabel}
				onclick={() => openCount('good', goodLabel)}>{teams.good}</button
			>
			<button
				type="button"
				class="badge evil"
				data-testid="alive-evil"
				aria-label={evilLabel}
				title={evilLabel}
				onclick={() => openCount('evil', evilLabel)}>{teams.evil}</button
			>
			<button
				type="button"
				class="badge ghost"
				data-testid="ghost-votes"
				aria-label={ghostLabel}
				title={ghostLabel}
				onclick={() => openCount('ghostVotes', ghostLabel)}
				><Icon name="ghostVote" weight="fill" />{ghostVotes}</button
			>
			<!--
				Votes the first nominee needs to go on the block, from who is alive now, so a death
				mid-day updates it. Nominations and votes are not tracked, so "more than the player
				on the block" is left to the Storyteller.
			-->
			<button
				type="button"
				class="badge votes"
				data-testid="votes-needed"
				aria-label={votesLabel}
				title={votesLabel}
				onclick={() => openCount('votes', votesLabel)}><Icon name="vote" />{block.needed}</button
			>
		</div>
	</div>
	<!-- Beside the toolbar on a wide screen (Trevor, 2026-10-23: L45), under it on a phone. -->
	<div class="sections">
		<Collapsible
			title={t('day.announcements')}
			storageKey="day.announcements"
			count={died.length + revived.length + announcers.length}
		>
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
			{#if customInPlay}
				<p class="custom-note" data-testid="custom-announcements">{t('day.announce.custom')}</p>
			{/if}
			<ul class="reminders" data-testid="announcements">
				{#each died as death (death.seatId)}
					{@const seat = g.seats[death.seatId]}
					<li class="death" data-seat={death.seatId}>
						{#if privateDeaths}
							<span class="dont-announce" data-testid="dont-announce">{t('day.announce.dont')}</span
							>
						{:else}
							<span class="spoken" data-testid="spoken">{spokenDeath(death.seatId)}</span>
						{/if}
						<em class="private" data-testid="storyteller-only"
							><Sentence text={privateDeath(death.cause)}
								>{#snippet fill(
									name
								)}{#if name === 'character'}{#if seat.characterId}<CharacterBadge
												characterId={seat.characterId}
												alignment={seat.alignment}
											/>{:else}{t('day.announce.noCharacter')}{/if}{:else}{@render badge(
											death.cause
										)}{/if}{/snippet}</Sentence
							></em
						>
					</li>
				{/each}
				{#each revived as seatId (seatId)}
					{@const seat = g.seats[seatId]}
					<li class="death" data-seat={seatId} data-testid="revived">
						{#if privateDeaths}
							<span class="dont-announce">{t('day.announce.dont')}</span>
						{:else}
							<span class="spoken">{spokenRevival(seatId)}</span>
						{/if}
						<em class="private"
							><Sentence
								text={t('day.announce.private', {
									character: slot('character'),
									how: t('day.announce.backToLife')
								})}
								>{#snippet fill()}{#if seat.characterId}<CharacterBadge
											characterId={seat.characterId}
											alignment={seat.alignment}
										/>{:else}{t('day.announce.noCharacter')}{/if}{/snippet}</Sentence
							></em
						>
					</li>
				{/each}
				{#if died.length === 0 && dawned}
					<li class="death"><span class="spoken">{t('day.announce.nobody')}</span></li>
				{/if}
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
				{#if died.length === 0 && !dawned && revived.length === 0 && announcers.length === 0}
					<li>{t('common.none')}</li>
				{/if}
			</ul>
		</Collapsible>

		<!-- The Flowergirl's switch, when it isn't in the toolbar. -->
		{#if hasFlowergirl && !assistance.demonVotedButton}
			<div class="demon-voted">
				<Toggle
					label={t('day.demonVoted')}
					checked={g.today.demonVoted === true}
					onChange={(checked) => game.run({ type: 'SetDemonVoted', voted: checked })}
				/>
			</div>
		{/if}

		{#if assistance.preDayReminders}
			<!-- Each group is its own section; no "Today" wrapper (Trevor, 2026-10-17). -->
			{#each reminders.groups as group (group.group)}
				<Collapsible
					title={group.title}
					storageKey={`day.group.${group.group}`}
					count={group.reminders.length}
				>
					<ul class="reminders rows">
						{#each group.reminders as reminder (reminder.key)}
							{@const head =
								reminder.segments[0]?.kind === 'character' ? reminder.segments[0] : undefined}
							<!-- The heading is the character; the rest is a written sentence (Trevor, 2026-10-18). -->
							{@const line = daySentence(head ? reminder.segments.slice(1) : reminder.segments)}
							{@const explained = explainBlock(
								line.segments.map((s) => (s.kind === 'text' ? s.text : ''))
							)}
							{@const character = head ? game.characters.get(head.ref.characterId) : undefined}
							<li data-character={reminder.characterId}>
								{#if character}
									<CharacterRow
										{character}
										alignment={head?.ref.seatId ? g.seats[head.ref.seatId]?.alignment : undefined}
										note={head?.ref.seatId ? game.seatName(head.ref.seatId) : undefined}
										info
									>
										{#snippet end()}{@const seatId =
												buttonRows[reminder.key]}{#if seatId}{@render dayEnd(
													reminder.characterId,
													seatId
												)}{/if}{/snippet}
										<!-- The ability first, beside the name; the state under it (Trevor, 2026-10-18). -->
										{@render sentence()}
									</CharacterRow>
								{:else}
									<CharacterEntry characterId={head?.ref.characterId}>
										{#snippet end()}{@const seatId =
												buttonRows[reminder.key]}{#if seatId}{@render dayButton(
													reminder.characterId,
													seatId
												)}{/if}{/snippet}
										{@render sentence()}
									</CharacterEntry>
								{/if}
								{#snippet sentence()}
									<span class="sentence" data-testid="day-state">
										{#each line.segments as segment, i (i)}
											{@const stop = line.stop && i === line.segments.length - 1}
											{#if segment.kind === 'character'}
												<span class="glued"
													><CharacterBadge
														characterId={segment.ref.characterId}
														alignment={segment.ref.seatId
															? g.seats[segment.ref.seatId]?.alignment
															: undefined}
														playerName={segment.ref.seatId
															? game.seatName(segment.ref.seatId)
															: undefined}
													/>{#if stop}.{/if}</span
												>
											{:else if segment.kind === 'value'}
												<!-- A value the Storyteller entered during prep (the Yaggababble's phrase). -->
												<span
													>({segment.value ?? segment.placeholder}){#if stop}.{/if}</span
												>
											{:else}
												<span><GlossaryText segments={explained[i] ?? []} /></span>
											{/if}
										{/each}
									</span>
								{/snippet}
							</li>
						{/each}
					</ul>
				</Collapsible>
			{/each}
		{/if}
		{#if !assistance.preDayReminders || unlisted.length > 0}
			{@const listed = assistance.preDayReminders ? unlisted : seats.filter((s) => s.characterId)}
			<Collapsible title={t('day.abilities')} storageKey="day.abilities" count={listed.length}>
				<ul class="reminders rows">
					{#each listed as seat (seat.seatId)}
						{@const character = seat.characterId
							? game.characters.get(seat.characterId)
							: undefined}
						<li data-character={seat.characterId}>
							{#if character}
								<!-- Drawn like character selection (Trevor, 2026-10-20: L12). -->
								<CharacterRow
									{character}
									alignment={seat.alignment}
									note={game.seatName(seat.seatId)}
									info
								>
									{#snippet end()}{@render dayEnd(seat.characterId, seat.seatId)}{/snippet}
								</CharacterRow>
							{/if}
						</li>
					{/each}
				</ul>
			</Collapsible>
		{/if}
	</div>
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

<!-- A character as a badge; false inside a button, so it does not open the character. -->
{#snippet badge(id: CharacterId | undefined, interactive = true)}{#if id}<CharacterBadge
			characterId={id}
			character={game.characters.get(id)}
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

<CountDialog bind:open={countOpen} game={g} count={countShown} title={countTitle} />

<style>
	.panel,
	.sections {
		display: grid;
		gap: var(--space-5);
		align-items: start;
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
	.demon-voted {
		min-width: calc(12 * var(--u));
	}
	.reminders {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* Laid out like a jinx (CharacterEntry): the ability, then the state and actions. */
	.reminders li :global(.body) {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
	/* While a section scrolls, its header stays just under the toolbar (Trevor, 2026-10-17). */
	.sections > :global(.collapsible > .head) {
		position: sticky;
		/* Tucked 1px under the toolbar, so no scrolled content shows between them (Trevor). */
		top: calc(var(--toolbar-height, 0px) - 1px); /* px-ok: hairline overlap */
		z-index: 1;
		background: var(--dialog-background, var(--surface));
	}
	.glued {
		display: inline-flex;
		align-items: center;
	}
	.sentence {
		font-family: var(--font-ability);
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-2);
	}
	/* Under the name, before the state and actions (Trevor, 2026-10-18). */
	.ability {
		flex-basis: 100%;
		margin: 0;
		font-family: var(--font-ability);
		font-size: 0.9rem;
	}
	.day-end {
		display: flex;
		align-items: center;
		padding-inline-end: var(--space-2);
	}
	/*
	 * Character rows read as one list split by dividers, not boxes with the background showing
	 * between them (Trevor, 2026-10-23: L44).
	 */
	.rows {
		border-radius: var(--radius-md);
		background: var(--choice-background);
		box-shadow: inset 0 0 0 1px var(--border);
		overflow: hidden;
	}
	.rows > li + li {
		border-top: 1px solid var(--border); /* px-ok: hairline divider */
	}
	.rows > li > :global(.row) {
		border-radius: 0;
		background: none;
		box-shadow: none;
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
	/* Every count is filled, the number on top (Trevor, 2026-10-19): the team counts in their
	   team's colour. --on-good reads on both teams (badge-colours.test.ts). */
	.badge {
		border-color: var(--surface-selected);
		background: var(--surface-selected);
		color: var(--on-surface);
		font-family: inherit;
		cursor: pointer;
	}
	.badge.good {
		border-color: var(--good);
		background: var(--good);
		color: var(--on-good);
	}
	.badge.evil {
		border-color: var(--evil);
		background: var(--evil);
		color: var(--on-good);
	}
	/* Each count in its own colour (Trevor, 2026-10-20: L21). The living are both teams, so
	   half blue, half red; --on-good reads on both halves. */
	.badge.alive {
		border-color: transparent;
		background: var(--evil) linear-gradient(to right, var(--good) 50%, var(--evil) 50%) border-box;
		color: var(--on-good);
	}
	/* Ghost votes left in an unused ghost vote's colours (DeadBadge.svelte), inverted: a dark
	   ghost on white (Trevor, 2026-10-22). */
	.badge.ghost {
		border-color: var(--ghost-vote-rim);
		background: var(--ghost-vote);
		color: var(--ghost-vote-badge);
	}
	/* Votes needed in gold; --heading on --surface is a theme contrast pair. */
	.badge.votes {
		border-color: var(--heading);
		background: var(--heading);
		color: var(--surface);
		font-family: var(--font-control);
	}
	/* The words to say, then the Storyteller's own detail under them in italics. */
	.death {
		display: grid;
		gap: var(--space-1);
	}
	.private {
		color: var(--on-surface-muted);
	}
	/* Only the words are italic; a character's name stays upright (Trevor, 2026-10-19). */
	.private :global(.badge) {
		font-style: normal;
	}
	.day-end :global(.recommend) {
		border-color: var(--accent);
		background: var(--accent);
		color: var(--on-accent);
	}
	.custom-note {
		margin: 0 0 var(--space-2);
		color: var(--on-surface-muted);
	}
	.dont-announce {
		justify-self: start;
		padding: 0 var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-full);
		font-variant: small-caps;
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
	/*
	 * A wide day in two columns (Trevor, 2026-10-23: L45): the timer, counts and Night order
	 * stay put on the left while the day's sections scroll on the right.
	 */
	@container day (min-width: 60rem) {
		.panel {
			grid-template-columns: minmax(22rem, 1fr) minmax(0, 2fr);
		}
		.sections {
			--toolbar-height: 0px; /* px-ok: nothing above the section headers here */
		}
	}
</style>
