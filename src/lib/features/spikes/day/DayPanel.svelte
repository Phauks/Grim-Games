<script lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import {
		GENERAL_DEATH_CAUSES,
		type DeathCause,
		type Game,
		type SeatId
	} from '#lib/core/model/index.ts';
	import {
		dayReminders,
		dayStateFromGame,
		isOnceOnlyDayAbility,
		type DayReminder
	} from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { explainBlock } from '#lib/features/glossary/glossary.svelte.ts';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import type { Assistance } from '#lib/ui/assistance.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import Segmented from '#lib/ui/primitives/Segmented.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import type { DayGame } from './day-game.svelte.ts';
	import NoteSheet, { type NoteTarget } from './NoteSheet.svelte';

	interface Props {
		game: DayGame;
		assistance: Assistance;
		onOpenNight: () => void;
	}

	let { game, assistance, onOpenNight }: Props = $props();

	const g = $derived(game.game);
	const seats = $derived(g.seating.map((id) => g.seats[id]));
	const hasFlowergirl = $derived(seats.some((s) => s.characterId === 'flowergirl'));

	// ── Seat strip: nominate, or mark dead ──
	type Mode = 'nominate' | 'dead';
	let mode = $state<Mode>('nominate');
	let nominator = $state<SeatId | undefined>();

	const prompt = $derived(
		mode === 'dead'
			? 'Tap a player to mark them dead or alive.'
			: nominator
				? `${game.seatName(nominator)} nominates… tap the nominee.`
				: 'Tap the nominator, then the nominee.'
	);

	let causeOpen = $state(false);
	let causeSeat = $state<SeatId | undefined>();

	function tapSeat(seatId: SeatId) {
		if (mode === 'dead') {
			const dead = !g.seats[seatId].dead;
			if (!game.run({ type: 'SetDead', seatId, dead })) return;
			if (dead && assistance.deathCause) {
				causeSeat = seatId;
				causeOpen = true;
			}
			return;
		}
		if (!nominator) {
			nominator = seatId;
			return;
		}
		game.run({ type: 'Nominate', nominator, nominee: seatId });
		nominator = undefined;
	}

	function setCause(cause: DeathCause) {
		if (causeSeat) game.run({ type: 'SetDeathCause', seatId: causeSeat, cause });
		causeOpen = false;
	}

	const CAUSE_LABELS: Record<(typeof GENERAL_DEATH_CAUSES)[number], string> = {
		execution: 'Executed',
		demon: 'Killed by the Demon',
		other: 'Something else'
	};

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
		dayReminders(dayStateFromGame(atDayStart(g), (id) => game.characters.get(id)))
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
		nominator = undefined;
		confirmNewDay = false;
	}
</script>

{#snippet actions(characterId: CharacterId | undefined, seatId: SeatId | undefined)}
	{@const who = `${game.characterName(characterId)}${seatId ? ` (${game.seatName(seatId)})` : ''}`}
	<span class="row-actions">
		{#if characterId && seatId && isOnceOnlyDayAbility(characterId)}
			{@const isUsed = used(seatId, characterId)}
			<button
				type="button"
				class="chip"
				aria-pressed={isUsed}
				aria-label={`Used: ${who}`}
				disabled={isUsed}
				onclick={() => game.run({ type: 'UseAbility', seatId, characterId })}
			>
				<span class="tick"><Icon name="check" /></span>Used
			</button>
		{/if}
		{#if characterId}
			<button
				type="button"
				class="chip"
				data-has-note={hasNote({ characterId, seatId })}
				aria-label={`Note: ${who}`}
				onclick={() => openNote({ characterId, seatId })}
			>
				<Icon name="notes" />Note
			</button>
		{/if}
	</span>
{/snippet}

<div class="panel">
	<div class="toolbar">
		<Button icon="undo" variant="quiet" disabled={!game.canUndo} onclick={() => game.undo()}>
			Undo
		</Button>
		<Button icon="day" variant="quiet" onclick={() => (confirmNewDay = true)}>New day</Button>
		<Button icon="night" onclick={onOpenNight}>Night order</Button>
	</div>

	<section aria-labelledby="seats-heading">
		<div class="section-head">
			<h2 id="seats-heading">Nominations</h2>
			<Segmented
				label="Tapping a player"
				hideLabel
				value={mode}
				options={[
					{ value: 'nominate', label: 'Nominate' },
					{ value: 'dead', label: 'Dead' }
				]}
				onChange={(value) => {
					mode = value;
					nominator = undefined;
				}}
			/>
		</div>
		<p class="prompt" aria-live="polite">{prompt}</p>
		<div class="seats">
			{#each seats as seat (seat.seatId)}
				<button
					type="button"
					class="seat"
					aria-label={`Seat: ${seat.playerName}`}
					aria-pressed={seat.seatId === nominator}
					data-dead={seat.dead}
					onclick={() => tapSeat(seat.seatId)}
				>
					<span class="dead-mark" aria-hidden="true"><Icon name="dead" /></span>
					<span>{seat.playerName}</span>
				</button>
			{/each}
		</div>
		<div class="strip-foot">
			<Button variant="quiet" disabled={!nominator} onclick={() => (nominator = undefined)}>
				Cancel nomination
			</Button>
			{#if hasFlowergirl}
				<div class="demon-voted">
					<Toggle
						label="Demon voted"
						checked={g.today.demonVoted === true}
						onChange={(checked) => game.run({ type: 'SetDemonVoted', voted: checked })}
					/>
				</div>
			{/if}
		</div>
	</section>

	{#if assistance.preDayReminders}
		<section aria-labelledby="reminders-heading">
			<h2 id="reminders-heading">Today</h2>
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
			<h2 id="abilities-heading">Abilities and notes</h2>
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

	<!-- Last on the page, so a new entry never moves anything above it. -->
	<section aria-labelledby="log-heading">
		<h2 id="log-heading">Logged since the last new day</h2>
		{#if g.today.entries.length === 0}
			<p class="muted" data-testid="log-empty">Nothing logged yet.</p>
		{:else}
			<ol class="log" data-testid="day-log">
				{#each g.today.entries as entry (entry.entryId)}
					<li data-kind={entry.kind}>
						<span class="entry-text">{game.describe(entry)}</span>
						<span class="row-actions">
							{#if entry.kind === 'nomination'}
								<button
									type="button"
									class="chip"
									onclick={() => game.run({ type: 'Execute', seatId: entry.nominee })}
								>
									Execute {game.seatName(entry.nominee)}
								</button>
							{:else if entry.kind === 'note'}
								<button
									type="button"
									class="chip"
									onclick={() => openNote({ characterId: entry.characterId, seatId: entry.seatId })}
								>
									Edit
								</button>
							{/if}
							<button
								type="button"
								class="chip"
								aria-label={`Remove: ${game.describe(entry)}`}
								onclick={() => game.run({ type: 'RemoveDayEntry', entryId: entry.entryId })}
							>
								<Icon name="close" />
							</button>
						</span>
					</li>
				{/each}
			</ol>
		{/if}
	</section>
</div>

<NoteSheet bind:open={noteOpen} {game} target={noteTarget} />

<BottomSheet
	bind:open={causeOpen}
	title={`How did ${game.seatName(causeSeat)} die?`}
	description="Optional. You can set it later."
>
	<div class="causes">
		{#each GENERAL_DEATH_CAUSES as cause (cause)}
			<Button variant="quiet" onclick={() => setCause(cause)}>{CAUSE_LABELS[cause]}</Button>
		{/each}
		<Button variant="quiet" onclick={() => (causeOpen = false)}>Skip</Button>
	</div>
</BottomSheet>

<Dialog bind:open={confirmNewDay} role="alertdialog" title="Start a new day?">
	<p>Today’s log moves to history and an empty one starts. You can undo this.</p>
	{#snippet actions()}
		<Button variant="quiet" onclick={() => (confirmNewDay = false)}>Cancel</Button>
		<Button onclick={newDay}>Start new day</Button>
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
	.section-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
	.prompt {
		margin: 0;
		min-height: 1.5em;
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
	.seat[aria-pressed='true'] {
		background: var(--accent);
		color: var(--on-accent);
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
	.strip-foot {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.demon-voted {
		min-width: calc(12 * var(--u));
	}
	.reminders,
	.log {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.reminders li,
	.log li {
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
	/* Long notes show their start here; Edit opens the whole note in a sheet. */
	.entry-text {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		overflow: hidden;
		flex: 1 1 calc(12 * var(--u));
		white-space: pre-line;
		overflow-wrap: anywhere;
	}
	.muted {
		margin: 0;
		color: var(--on-surface-muted);
	}
	.causes {
		display: grid;
		gap: var(--space-2);
	}
</style>
