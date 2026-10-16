<script lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import type { DeathCause, Game, SeatId } from '#lib/core/model/index.ts';
	import {
		blockThreshold,
		dayReminders,
		dayStateFromGame,
		isOnceOnlyDayAbility,
		validDeathCauses,
		type DayReminder,
		type ValidDeathCause
	} from '#lib/core/rules/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { explainBlock } from '#lib/features/glossary/glossary.svelte.ts';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import type { Assistance } from '#lib/ui/assistance.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
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

	let confirmNewDay = $state(false);
	function newDay() {
		game.run({ type: 'NewDay' });
		confirmNewDay = false;
	}
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
				disabled={isUsed}
				onclick={() => askUsed(seatId, characterId)}
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

{#snippet votes()}
	{@const block = blockThreshold(g)}
	<!-- Always shown, so the list below never moves when players die. -->
	<p class="votes" data-testid="votes-needed">
		<strong>{block.needed}</strong>
		{t('day.votesNeeded', { count: block.needed, alive: block.alive })}
	</p>
{/snippet}

<div class="panel">
	<div class="toolbar">
		<Button icon="day" variant="quiet" onclick={() => (confirmNewDay = true)}
			>{t('day.newDay')}</Button
		>
		{#if onOpenNight}
			<Button icon="night" onclick={onOpenNight}>{t('day.nightOrder')}</Button>
		{/if}
	</div>

	<section aria-labelledby="seats-heading">
		<h2 id="seats-heading">{t('day.players')}</h2>
		<p class="prompt">{t('day.tapPlayer')}</p>
		<div class="seats">
			{#each seats as seat (seat.seatId)}
				<button
					type="button"
					class="seat"
					aria-label={t('day.seatButton', { name: game.seatName(seat.seatId) })}
					data-dead={seat.dead}
					onclick={() => tapSeat(seat.seatId)}
				>
					<span class="dead-mark" aria-hidden="true"><Icon name="dead" /></span>
					<span>{game.seatName(seat.seatId)}</span>
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
	</section>

	{#if assistance.preDayReminders}
		<section aria-labelledby="reminders-heading">
			<h2 id="reminders-heading">{t('day.today')}</h2>
			{@render votes()}
			{#each reminders.groups as group (group.group)}
				<h3>{group.title}</h3>
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
							{@render actions(reminder.characterId, seatOf(reminder))}
						</li>
					{/each}
				</ul>
			{/each}
		</section>
	{:else}
		<section aria-labelledby="abilities-heading">
			<h2 id="abilities-heading">{t('day.abilitiesAndNotes')}</h2>
			{@render votes()}
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
							{@render actions(seat.characterId, seat.seatId)}
						</li>
					{/if}
				{/each}
			</ul>
		</section>
	{/if}
</div>

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

<Dialog bind:open={confirmNewDay} role="alertdialog" title={t('day.newDayTitle')}>
	<p class="state">
		<span class="state-label">{t('day.now')}</span>{t('day.newDayNow', {
			count: g.today.entries.length
		})}
	</p>
	<p class="state">
		<span class="state-label">{t('day.after')}</span>{t('day.newDayAfter')}
	</p>
	{#snippet actions()}
		<Button variant="quiet" onclick={() => (confirmNewDay = false)}>{t('common.cancel')}</Button>
		<Button onclick={newDay}>{t('day.startNewDay')}</Button>
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
	section {
		display: grid;
		gap: var(--space-2);
	}
	h2 {
		margin: 0;
		font-size: 1.15rem;
		color: var(--heading);
	}
	h3 {
		margin: var(--space-3) 0 0;
		font-size: 0.95rem;
		color: var(--on-surface-muted);
	}
	.prompt {
		margin: 0;
		color: var(--on-surface-muted);
	}
	.seats {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--space-2);
		touch-action: manipulation;
	}
	.seat {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
		min-height: var(--tap-target);
		padding: 0 var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: var(--on-surface);
		font: inherit;
		font-family: var(--font-player);
		font-weight: 600;
		cursor: pointer;
	}
	/* Always there, shown only when dead, so names never shift. */
	.dead-mark {
		display: inline-grid;
		visibility: hidden;
	}
	.seat[data-dead='true'] .dead-mark {
		visibility: visible;
	}
	.seat[data-dead='true'] {
		color: var(--on-surface-muted);
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
	.votes {
		margin: 0;
		font-family: var(--font-ability);
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
