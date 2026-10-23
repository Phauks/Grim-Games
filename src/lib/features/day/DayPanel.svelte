<script lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import type { Game, SeatId } from '#lib/core/model/index.ts';
	import {
		blockThreshold,
		dayReminders,
		dayClaim,
		dayStateFromGame,
		isOnceOnlyDayAbility,
		daySentence
	} from '#lib/core/rules/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import CharacterEntry from '#lib/features/characters/CharacterEntry.svelte';
	import { provideCharacters } from '#lib/features/characters/character-context.ts';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import Sentence from '#lib/features/characters/Sentence.svelte';
	import { slot } from '#lib/features/characters/slots.ts';
	import { explainBlock } from '#lib/features/glossary/glossary.svelte.ts';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import type { Assistance } from '#lib/ui/assistance.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Chip from '#lib/ui/primitives/Chip.svelte';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import DayTimer from './DayTimer.svelte';
	import DayAnnouncements from './DayAnnouncements.svelte';
	import DayCounts from './DayCounts.svelte';
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
	/** Section headers stick just under the toolbar (Trevor, 2026-10-17). */
	let toolbarSize = $state<ResizeObserverSize[]>();
	// The exact (fractional) height: a rounded one leaves a sliver between toolbar and header.
	const toolbarHeight = $derived(toolbarSize?.[0]?.blockSize ?? 0);

	// ── A player's day button, on their ability row ──
	/** The claim a character's player makes in town, from its rules block (L56). */
	const claimOf = (characterId: CharacterId | undefined) =>
		characterId === undefined ? undefined : dayClaim(characterId, game.characters);
	/**
	 * Used for a once-per-game day ability; for a player's claim in town, Guesses (the
	 * Juggler) or Statement (the Gossip) while "Log player claims" is on.
	 */
	const noteClaim = (characterId: CharacterId | undefined) => {
		const claim = claimOf(characterId);
		return assistance.playerClaims && (claim === 'guesses' || claim === 'statement')
			? claim
			: undefined;
	};
	const hasDayButton = (characterId: CharacterId | undefined) =>
		characterId !== undefined &&
		(isOnceOnlyDayAbility(characterId) ||
			noteClaim(characterId) !== undefined ||
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
		claimOf(characterId) === 'statements' && assistance.savantInfo && onSavant !== undefined;
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
	{:else if characterId && noteClaim(characterId)}
		{@const claim = noteClaim(characterId)}
		<Chip
			marked={hasNote({ characterId, seatId })}
			data-testid="claim"
			aria-label={t(claim === 'guesses' ? 'day.guessesLabel' : 'day.statementLabel', { who })}
			onclick={() => openNote({ characterId, seatId })}
		>
			{t(claim === 'guesses' ? 'day.guesses' : 'day.statement')}
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
	{:else if characterId && savantButton(characterId)}
		{@const set = hasNote({ characterId, seatId })}
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
		<DayCounts {game} />
	</div>
	<!-- Beside the toolbar on a wide screen (Trevor, 2026-10-23: L45), under it on a phone. -->
	<div class="sections">
		<DayAnnouncements {game} />

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
									<!-- The character's band, the ability under it, then a strip joined below with
									     what is known and the button (Trevor, 2026-10-23). -->
									<CharacterEntry
										characterId={character.id}
										alignment={head?.ref.seatId ? g.seats[head.ref.seatId]?.alignment : undefined}
										playerName={head?.ref.seatId ? game.seatName(head.ref.seatId) : undefined}
									>
										{#snippet footer()}{@const seatId =
												buttonRows[reminder.key]}{@render sentence()}{#if seatId}{@render dayEnd(
													reminder.characterId,
													seatId
												)}{/if}{/snippet}
										<span class="ability">{character.ability}</span>
									</CharacterEntry>
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
								<!-- As the reminders above: band, ability, then the button's strip (Trevor, 2026-10-23). -->
								{#if hasDayButton(seat.characterId)}
									<CharacterEntry
										characterId={character.id}
										alignment={seat.alignment}
										playerName={game.seatName(seat.seatId)}
									>
										{#snippet footer()}{@render dayEnd(seat.characterId, seat.seatId)}{/snippet}
										<span class="ability">{character.ability}</span>
									</CharacterEntry>
								{:else}
									<CharacterEntry
										characterId={character.id}
										alignment={seat.alignment}
										playerName={game.seatName(seat.seatId)}
									>
										<span class="ability">{character.ability}</span>
									</CharacterEntry>
								{/if}
							{/if}
						</li>
					{/each}
				</ul>
			</Collapsible>
		{/if}
	</div>
</div>

<NoteSheet bind:open={noteOpen} {game} target={noteTarget} />

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
	.day-end {
		display: flex;
		align-items: center;
		margin-inline-start: auto;
	}
	.ability {
		font-family: var(--font-ability);
		font-size: 0.8rem;
		line-height: 1.3;
		opacity: 0.9;
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
	.day-end :global(.recommend) {
		border-color: var(--accent);
		background: var(--accent);
		color: var(--on-accent);
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
