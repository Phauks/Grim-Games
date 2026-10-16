<script lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import { recentDeaths } from '#lib/core/engine/index.ts';
	import type { DeathCause, Game, SeatId } from '#lib/core/model/index.ts';
	import {
		afterDawn,
		blockThreshold,
		dayNumber,
		dayReminders,
		dayStateFromGame,
		isOnceOnlyDayAbility,
		type Night,
		validDeathCauses,
		type DayReminder,
		type ValidDeathCause
	} from '#lib/core/rules/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import NightText from '#lib/features/reference/NightText.svelte';
	import { iconUrl } from '#lib/features/characters/icon-url.ts';
	import { explainBlock } from '#lib/features/glossary/glossary.svelte.ts';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import type { Assistance } from '#lib/ui/assistance.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
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

	// ── Confirming a change: what it is now, and what it will be ──
	interface Pending {
		title: string;
		now: string;
		after: string;
		label: string;
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
		pendingOpen = false;
	}

	function askUsed(seatId: SeatId, characterId: CharacterId) {
		const who = t('day.who', {
			character: game.characterName(characterId),
			seat: game.seatName(seatId)
		});
		const token = game.characters.get(characterId)?.reminders.includes('No Ability');
		ask({
			title: t('day.markUsedTitle', { who }),
			now: t('day.markUsedNow', { who }),
			after: t(token ? 'day.markUsedAfterToken' : 'day.markUsedAfter', { who }),
			label: t('day.markUsed'),
			run: () => game.run({ type: 'UseAbility', seatId, characterId })
		});
	}

	/**
	 * Unmarks a used ability (Trevor: "need to be able to undo something being marked as
	 * used"): removes today's use, which also takes back the No Ability reminder it placed,
	 * or else the No Ability reminder itself. No confirm: nothing is lost, and History has it.
	 */
	function unmarkUsed(seatId: SeatId, characterId: CharacterId) {
		const entry = g.today.entries.findLast(
			(e) => e.kind === 'ability' && e.seatId === seatId && e.characterId === characterId
		);
		if (entry) {
			game.run({ type: 'RemoveDayEntry', entryId: entry.entryId });
			return;
		}
		const token = g.seats[seatId].reminders.find(
			(r) => r.characterId === characterId && r.label === 'No Ability'
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
				return game.characterName(cause);
		}
	}

	/** Why a cause is offered with a caution, in a few words. */
	function causeCaution(option: ValidDeathCause): string | undefined {
		const flag = option.flags[0];
		if (!flag) return undefined;
		switch (flag.code) {
			case 'registers':
				return t('day.cautionRegisters', {
					character: game.characterName(flag.source.characterId)
				});
			case 'impaired':
				return t('day.cautionImpaired');
			case 'unknown':
				return t('day.cautionUnknown');
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
	{@const who = seatId
		? t('day.who', { character: game.characterName(characterId), seat: game.seatName(seatId) })
		: game.characterName(characterId)}
	<span class="row-actions">
		{#if characterId && seatId && isOnceOnlyDayAbility(characterId)}
			{@const isUsed = used(seatId, characterId)}
			<button
				type="button"
				class="chip"
				aria-pressed={isUsed}
				aria-label={t('day.usedLabel', { who })}
				onclick={() => (isUsed ? unmarkUsed(seatId, characterId) : askUsed(seatId, characterId))}
			>
				<span class="tick"><Icon name="check" /></span>{t('day.used')}
			</button>
		{/if}
		{#if characterId}
			<button
				type="button"
				class="chip"
				data-has-note={hasNote({ characterId, seatId })}
				aria-label={t('day.noteLabel', { who })}
				onclick={() => openNote({ characterId, seatId })}
			>
				<Icon name="notes" />{t('day.note')}
			</button>
		{/if}
	</span>
{/snippet}

<div class="panel">
	<div class="toolbar">
		{#if onOpenNight}
			<Button icon="night" onclick={onOpenNight}>{t('day.nightOrder')}</Button>
		{/if}
		<!--
			Votes the first nominee needs to go on the block (Trevor: a badge, not a sentence),
			from who is alive now, so a death mid-day updates it. Nominations and votes are not
			tracked, so "more than the player on the block" is left to the Storyteller.
		-->
		<span
			class="votes"
			role="note"
			data-testid="votes-needed"
			aria-label={t('day.votesBadgeLabel', { count: block.needed, alive: block.alive })}
			title={t('day.votesBadgeLabel', { count: block.needed, alive: block.alive })}
			>{t('day.votesBadge', { count: block.needed })}</span
		>
	</div>

	<Collapsible title={t('day.announcements')} storageKey="day.announcements">
		<ul class="reminders" data-testid="announcements">
			{#each died as death (death.seatId)}
				{@const seat = g.seats[death.seatId]}
				<li>
					<span class="sentence">
						{#if seat.characterId}
							<CharacterBadge
								characterId={seat.characterId}
								alignment={seat.alignment}
								playerName={game.seatName(seat.seatId)}
							/>
						{:else}
							<span>{game.seatName(seat.seatId)}</span>
						{/if}
						<span>{diedText(death.cause)}</span>
					</span>
				</li>
			{/each}
			{#each announcers as a (a.character.id)}
				<li data-character={a.character.id}>
					<span class="sentence">
						<CharacterBadge
							characterId={a.character.id}
							alignment={g.seats[a.seatId].alignment}
							playerName={game.seatName(a.seatId)}
						/>
						<span><NightText text={a.text} character={a.character} night={a.night} /></span>
					</span>
				</li>
			{/each}
			{#if died.length === 0 && announcers.length === 0}
				<li>{t('common.none')}</li>
			{/if}
		</ul>
	</Collapsible>

	<Collapsible title={t('day.players')} storageKey="day.players">
		<p class="prompt">{t('day.tapPlayer')}</p>
		<div class="seats">
			{#each seats as seat (seat.seatId)}
				{@const character = seat.characterId ? game.characters.get(seat.characterId) : undefined}
				{@const icon = character && iconUrl(character, seat.alignment)}
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
						><span class="skull" data-testid="dead-mark"><Icon name="dead" /></span></span
					>
					<span class="seat-text">
						<span class="seat-character" data-team={seat.alignment ?? 'neutral'}
							>{character?.name ?? t('day.noCharacter')}</span
						>
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
		<Collapsible title={t('day.today')} storageKey="day.today">
			{#each reminders.groups as group (group.group)}
				<Collapsible title={group.title} level={3} storageKey={`day.group.${group.group}`}>
					<ul class="reminders">
						{#each group.reminders as reminder (reminder.key)}
							{@const explained = explainBlock(
								reminder.segments.map((s) => (s.kind === 'text' ? s.text : ''))
							)}
							<li data-character={reminder.characterId}>
								<span class="sentence">
									{#each reminder.segments as segment, i (i)}
										{#if segment.kind === 'character'}
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
							</li>
						{/each}
					</ul>
				</Collapsible>
			{/each}
		</Collapsible>
	{:else}
		<Collapsible title={t('day.abilitiesAndNotes')} storageKey="day.abilities">
			<ul class="reminders">
				{#each seats as seat (seat.seatId)}
					{#if seat.characterId}
						<li data-character={seat.characterId}>
							<span class="sentence">
								<CharacterBadge
									characterId={seat.characterId}
									alignment={seat.alignment}
									playerName={seat.playerName}
								/>
							</span>
							{@render ability(seat.characterId)}
							{@render actions(seat.characterId, seat.seatId)}
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

<BottomSheet
	bind:open={causeOpen}
	title={causeSeatDead
		? t('day.markAliveTitle', { name: game.seatName(causeSeat) })
		: t('day.howDied', { name: game.seatName(causeSeat) })}
	description={causeSeatDead ? t('day.markAliveState') : t('day.howDiedState')}
>
	<div class="causes">
		{#if causeSeatDead}
			<Button onclick={markAlive}>{t('day.markAlive')}</Button>
		{:else}
			{#each causes as option (option.cause)}
				{@const caution = causeCaution(option)}
				<Button onclick={() => markDead(option.cause)}>
					{causeLabel(option.cause)}{#if caution}<span class="caution">({caution})</span>{/if}
				</Button>
			{/each}
		{/if}
		<!-- Set apart and tinted, so it is never mistaken for a cause (Trevor, 2026-10-16). -->
		<div class="cancel">
			<Button variant="quiet" onclick={() => (causeOpen = false)}>{t('common.cancel')}</Button>
		</div>
	</div>
</BottomSheet>

<Dialog bind:open={pendingOpen} role="alertdialog" title={pending?.title ?? ''}>
	{#if pending}
		<p class="state"><span class="state-label">{t('day.now')}</span>{pending.now}</p>
		<p class="state"><span class="state-label">{t('day.after')}</span>{pending.after}</p>
	{/if}
	{#snippet actions()}
		<Button variant="quiet" onclick={() => (pendingOpen = false)}>{t('common.cancel')}</Button>
		<Button onclick={confirmPending}>{pending?.label ?? ''}</Button>
	{/snippet}
</Dialog>

<style>
	.panel {
		display: grid;
		gap: var(--space-5);
	}
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.prompt {
		margin: 0;
		color: var(--on-surface-muted);
	}
	.seats {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, calc(10 * var(--u))), 1fr));
		gap: var(--space-2);
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
		padding: var(--space-1) var(--space-2);
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
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.reminders li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		padding: var(--space-2);
		border-radius: var(--radius-md);
		background: var(--card-background, var(--surface-raised));
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
	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-width: var(--tap-target);
		min-height: var(--tap-target);
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-full);
		background: transparent;
		color: inherit;
		font: inherit;
		font-family: var(--font-control);
		cursor: pointer;
	}
	.chip[aria-pressed='true'] {
		background: var(--accent);
		color: var(--on-accent);
		opacity: 1;
	}
	.chip:disabled {
		cursor: default;
	}
	/* The tick is always laid out, so pressing Used never changes the chip's width. */
	.tick {
		display: inline-grid;
		visibility: hidden;
	}
	.chip[aria-pressed='true'] .tick {
		visibility: visible;
	}
	.chip[data-has-note='true'] {
		border-color: var(--heading);
	}
	/* Fixed width (room for "10 votes"), so the number changing never moves anything. */
	.votes {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 8.5ch;
		min-height: var(--tap-target);
		margin-left: auto;
		padding: 0 var(--space-3);
		border: 1px solid var(--heading);
		border-radius: var(--radius-full);
		color: var(--heading);
		font-family: var(--font-control);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
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
		background: color-mix(in srgb, var(--good) 16%, transparent);
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
	.caution {
		margin-left: var(--space-1);
		color: var(--on-surface-muted);
		font-weight: normal;
	}
</style>
