<script lang="ts">
	import { rulesOf } from '#lib/core/data/rules/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import CharacterHistoryDialog from './CharacterHistoryDialog.svelte';
	import { allowedOffScriptIn } from '#lib/features/modes/game-mode.ts';
	import NominationChooser from './NominationChooser.svelte';
	import { seatCharacterLine, seatName } from '#lib/features/game/seat-label.ts';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import type { CharacterId } from '#lib/core/data/index.ts';
	import type { ReminderId, SeatId } from '#lib/core/model/index.ts';
	import { trueCharacter } from '#lib/core/model/index.ts';
	import ShowToPlayer from '#lib/features/show/ShowToPlayer.svelte';
	import {
		abilityGivers,
		abilityState,
		mayNominate,
		seatNominations,
		votesWithoutToken,
		type ImpairmentReason
	} from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import CharacterDialog from '#lib/features/characters/CharacterDialog.svelte';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { causeLabel, isOrphan, placingAlignment } from './board.ts';
	import CauseName from './CauseName.svelte';
	import SeatStatusDialog from './SeatStatusDialog.svelte';
	import SeatMenu from './SeatMenu.svelte';
	import SeatReminderMenu from './SeatReminderMenu.svelte';
	import SeatCharacterFlow from './SeatCharacterFlow.svelte';
	import SeatBadge from './SeatBadge.svelte';
	import TableCheck from './TableCheck.svelte';
	import ChangeList from '#lib/ui/primitives/ChangeList.svelte';
	import SeatNameField from './SeatNameField.svelte';
	import SeatNameSuggestions from './SeatNameSuggestions.svelte';
	import { SeatNameEdit } from './seat-name-edit.svelte.ts';
	import type { Grimoire } from './grimoire.svelte.ts';
	import SeatChooser from './SeatChooser.svelte';
	import ReminderMoveConfirm from './ReminderMoveConfirm.svelte';
	import { seatChanges } from './history.ts';
	import DeadBadge from '#lib/ui/seating/DeadBadge.svelte';
	import { boardLooks } from './board-looks.svelte.ts';
	import { isGeneric, reminderWords, tokenLabel } from './reminders.ts';
	import BoardReminder from './BoardReminder.svelte';
	import { shownReminderSize } from '#lib/ui/seating/last-board.svelte.ts';
	import { innerHeight, innerWidth } from 'svelte/reactivity/window';
	import SavantSheet from '#lib/features/savant/SavantSheet.svelte';
	import NoteSheet from '#lib/features/day/NoteSheet.svelte';
	import { LiveDay } from '#lib/features/day/live-day.svelte.ts';
	import { dayClaim } from '#lib/core/rules/index.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { gameSettings } from '#lib/features/game-settings/game-settings.svelte.ts';

	interface Props {
		open: boolean;
		grimoire: Grimoire;
		seatId: SeatId | undefined;
		/** Opens the alignment draw for a seat, kept by the board (Trevor, 2026-10-19). */
		onDraw?: (seatId: SeatId) => void;
		/** Edits this player's notes, which live in the board's Notes sheet. */
		onNotes?: (seatId: SeatId) => void;
		/** A nomination was recorded or changed: special rules may act on it (NominationAsk). */
		onNominated?: (nomination: { nominator: SeatId; nominee: SeatId }) => void;
		/**
		 * Executed from a living seat's status during the day: the same as the day's Execution
		 * (Trevor, 2026-10-23), so the board asks and ends the day. False when it isn't the day
		 * and the board left it to the seat, which logs the execution only.
		 */
		onExecute?: (seatId: SeatId) => boolean;
	}

	let {
		open = $bindable(),
		grimoire,
		seatId,
		onDraw,
		onNotes,
		onNominated,
		onExecute
	}: Props = $props();

	const game = $derived(grimoire.game);
	/** Characters a special rule put in play from off the script, not flagged (+1). */
	const offScriptOk = $derived(allowedOffScriptIn(game.gameId));
	const characters = $derived(grimoire.open.characters);
	const seat = $derived(seatId === undefined ? undefined : game.seats[seatId]);
	const number = $derived(seatId === undefined ? 0 : game.seating.indexOf(seatId) + 1);
	const character = $derived(seat?.characterId ? characters.get(seat.characterId) : undefined);
	const traveller = $derived(character?.type === 'traveller');
	const title = $derived(seat ? (seat.playerName ?? t('common.seat', { number })) : '');
	/** Custom tokens can look alike, so the type shows too (Trevor, 2026-10-22, plan L26). */
	const metaLine = $derived(seatCharacterLine(character?.type, seat?.alignment, number));
	/** The seat's reminder tokens, as on the board (Trevor, 2026-10-30). */
	const reminderSize = $derived(
		shownReminderSize(preferences.current.tokenAppearance, {
			width: innerWidth.current ?? 0,
			height: innerHeight.current ?? 0
		})
	);

	// ── Name, edited in the header ──
	const nameEdit = new SeatNameEdit({
		grimoire: () => grimoire,
		seatId: () => seatId,
		open: () => open
	});

	// ── What the rules say about this seat, in one line ──
	const ability = $derived(seatId ? abilityState(game, seatId, characters) : undefined);
	const really = $derived(
		ability?.characterId && ability.characterId !== seat?.characterId
			? characters.get(ability.characterId)
			: undefined
	);
	const impairmentWords: Record<ImpairmentReason, string> = {
		drunk: 'Drunk',
		poisoned: 'Poisoned',
		'no-ability': 'No ability'
	};
	/** Words, then a character as a badge, then more words ("Drunk (" [Vortox] ")"). */
	type LinePart = { text: string; characterId?: CharacterId; after?: string };
	const abilityLine = $derived.by((): LinePart[] => {
		if (!seat || !character) return [{ text: 'None' }];
		const parts: LinePart[] = [];
		if (isOrphan(seat, game.script, characters, offScriptOk))
			parts.push({ text: 'Not on the script' });
		if (really) parts.push({ text: 'Is the ', characterId: really.id });
		// Only what the sheet shows nowhere else (Trevor, 2026-10-18): a reminder on this seat
		// is in Reminders below, and death is in Status.
		const onSeat = new Set(seat.reminders.map((r) => r.reminderId));
		for (const impairment of ability?.impairments ?? []) {
			const from = impairment.source.reminderId;
			if (from && onSeat.has(from)) continue;
			const words = impairmentWords[impairment.reason];
			const by = impairment.source.characterId;
			parts.push(
				characters.has(by) ? { text: `${words} (`, characterId: by, after: ')' } : { text: words }
			);
		}
		// An ability works unless something says otherwise (Trevor, 2026-10-16): the line stays
		// reserved but empty.
		return parts;
	});
	const stateWarn = $derived(abilityLine.length > 0 && abilityLine[0].text !== 'None');

	// ── Character ──
	let flow = $state<ReturnType<typeof SeatCharacterFlow>>();
	let detailsOpen = $state(false);

	// ── Changes to who this seat is during the game (Trevor, 2026-10-16) ──
	const changes = $derived(
		seatId
			? seatChanges(grimoire.open.session.log.entries, grimoire.open.session.log.cursor, seatId)
			: []
	);
	let changesOpen = $state(false);

	// A character that gains an ability by a swap (the Apprentice) does so from ⋯
	// (SeatCharacterFlow), by its rules block's `swapsForAbility`.
	const gainsAbility = $derived(
		seatId !== undefined &&
			!!rulesOf(trueCharacter(game, seatId, characters) ?? '', characters)?.swapsForAbility
	);
	// One held without a token (the Boffin's on the Demon), by another's `givesAbility`.
	const holdsAbility = $derived(
		seatId !== undefined && abilityGivers(game, seatId, characters).length > 0
	);

	// ── Status: Alive, or dead with its cause, in one list (Trevor, 2026-10-16) ──
	let causeOpen = $state(false);
	const statusText = $derived(
		seat?.dead ? `Dead: ${causeLabel(seat.deathCause, characters, traveller)}` : 'Alive'
	);

	// ── Reminders and seats ──
	let moving = $state<ReminderId | undefined>();
	let moveOpen = $state(false);
	/** Which of the seat's nominations is being chosen (Track nominations). */
	let nominating = $state<{ seatId: SeatId; side: 'made' | 'received' }>();
	const nominations = $derived(
		seatId === undefined ? { allMade: [] } : seatNominations(game, seatId)
	);
	/**
	 * Dead but voting with no vote token (the Banshee killed by the Demon, `afterDeath`): no
	 * ghost vote to spend, so the row says how many votes they have instead.
	 */
	const tokenFreeVotes = $derived(
		seatId === undefined ? undefined : votesWithoutToken(game, seatId, characters)
	);
	/** The dead may not nominate, unless their character says so; a row already set stays editable. */
	const canNominate = $derived(
		seatId !== undefined && (!!nominations.made || mayNominate(game, seatId, characters))
	);
	let moveConfirm = $state<ReturnType<typeof ReminderMoveConfirm>>();
	let menuOpen = $state(false);
	let reminderMenuOpen = $state(false);
	/** Opens one reminder's own dialog over the sheet: a reminder tapped on the board. */
	export function showReminder(reminderId: ReminderId) {
		moving = reminderId;
		reminderMenuOpen = true;
	}
	const movingReminder = $derived(seat?.reminders.find((r) => r.reminderId === moving));
	let removeOpen = $state(false);
	let showOpen = $state(false);
	let savantOpen = $state(false);
	/** The Savant's information generator (L2), for a Savant seat while its switch is on. */
	const savant = $derived(
		seat?.characterId !== undefined &&
			dayClaim(seat.characterId, characters) === 'statements' &&
			preferences.current.assistance.savantInfo
	);
	/** A player's claim in town (L56): Guesses or Statement, as on their day row. */
	const claim = $derived.by(() => {
		const id = seat?.characterId;
		const c = id ? dayClaim(id, grimoire.open.characters) : undefined;
		return preferences.current.assistance.playerClaims && c !== undefined && c !== 'statements'
			? c
			: undefined;
	});
	let claimOpen = $state(false);
	const day = $derived(new LiveDay(grimoire.open));
</script>

<BottomSheet bind:open {title} description={t('common.seat', { number })}>
	<!-- The character's name is the biggest thing here; alignment and seat are easy to see
	     on the token already (Trevor, 2026-10-16). Type, alignment and seat start their own
	     line under the name (Trevor, 2026-10-30). -->
	{#snippet subtitle()}
		<!-- eslint-disable-next-line grim/names-as-badges -- caption beside its own token (lead) -->
		{#if character}<span class="role">{character.name}</span>{/if}
		<span class="meta" data-testid="seat-meta">{metaLine}</span>
	{/snippet}
	{#snippet lead()}
		<button
			type="button"
			class="lead-token"
			aria-label={character ? `About the ${character.name}` : 'Choose character'}
			onclick={() => (character ? (detailsOpen = true) : flow?.choose())}
		>
			{#if character}
				<CharacterToken {character} alignment={seat?.alignment} size={60} />
			{:else}
				<span class="no-token">{number}</span>
			{/if}
		</button>
	{/snippet}
	{#snippet heading()}
		<SeatNameField edit={nameEdit} placeholder={t('common.seat', { number })} />
	{/snippet}
	{#snippet titleEnd()}
		<span class="ink"
			><IconButton
				icon="edit"
				label="Edit player name"
				disabled={nameEdit.editing}
				onclick={() => nameEdit.edit()}
			/></span
		>
	{/snippet}
	{#snippet actions()}
		<!-- Show to player sits beside ⋯ (Trevor, 2026-10-16); disabled until the seat has a character. -->
		<span class="ink"
			><IconButton
				icon="showToPlayer"
				label="Show to player"
				disabled={!character}
				onclick={() => {
					// The player view opens over the sheet, which stays open under it (Trevor,
					// 2026-10-17); the view is opaque, so the sheet never shows through.
					showOpen = true;
				}}
			/></span
		>
		<span class="ink"
			><IconButton icon="more" label="Seat actions" onclick={() => (menuOpen = true)} /></span
		>
	{/snippet}
	<!--
		Inside the sheet, so the sheet stays open under it (Trevor, 2026-10-17): a modal dialog
		drawn in the top layer, opaque, and the sheet does not count taps on it as outside.
	-->
	<ShowToPlayer
		bind:open={showOpen}
		characters={character ? [{ character, alignment: seat?.alignment }] : []}
	/>
	{#if seat && seatId}
		<div class="sheet">
			<SeatNameSuggestions edit={nameEdit} />
			<!-- The character's ability (TPI's text), always shown under the header. -->
			<div class="ability">
				{#if character}
					<p class="ability-text">
						<GlossaryText text={character.ability} names={[character.name]} />
					</p>
				{:else}
					<p class="none">No character</p>
				{/if}
				<!-- One reserved line for what the rules say about this seat. -->
				<p class="state" class:warn={stateWarn}>
					{#if isOrphan(seat, game.script, characters, offScriptOk)}<Icon name="warning" />{/if}
					{#each abilityLine as part, i (i)}{#if i > 0}
							·
						{/if}{part.text}{#if part.characterId}<CharacterBadge
								characterId={part.characterId}
								character={characters.get(part.characterId)}
							/>{/if}{part.after ?? ''}{/each}
				</p>
			</div>

			<div class="row">
				<span class="label">Status</span>
				<button
					type="button"
					class="value status"
					data-dead={seat.dead || undefined}
					aria-label={`Status: ${statusText}`}
					onclick={() => (causeOpen = true)}
				>
					<Icon name={seat.dead ? 'dead' : 'alive'} />
					<span class="status-text"
						>{#if seat.dead}Dead: <CauseName
								cause={seat.deathCause}
								{characters}
								{traveller}
								interactive={false}
							/>{:else}Alive{/if}</span
					>
				</button>
			</div>

			<!-- Always here, so nothing moves when the player dies (Trevor, 2026-10-17). -->
			<div class="row">
				<span class="label" id={`ghost-${seat.seatId}`}>Ghost vote</span>
				<!-- One toggle, as wide as the buttons around it (Trevor, 2026-10-18): two states. -->
				<button
					type="button"
					class="value ghost"
					aria-labelledby={`ghost-${seat.seatId}`}
					aria-pressed={seat.dead && tokenFreeVotes === undefined ? seat.ghostVoteUsed : undefined}
					disabled={!seat.dead || tokenFreeVotes !== undefined}
					onclick={() =>
						grimoire.run({
							type: seat.ghostVoteUsed ? 'RestoreGhostVote' : 'SpendGhostVote',
							seatId: seat.seatId
						})}
				>
					<!-- The board's badge (Trevor, 2026-10-19: one ghost vote look in and out of the sheet). -->
					<DeadBadge
						vote={tokenFreeVotes !== undefined ? undefined : seat.ghostVoteUsed ? 'used' : 'unused'}
						usedLook={boardLooks.current.usedGhostVote}
						testid="sheet-ghost-vote"
					/>
					<!-- As wide as "Not used", so toggling moves only the text (Trevor, 2026-10-19). Not
					     the longer "None while alive", which only shows while alive: reserving that
					     left "Not used" off centre in its button (Trevor, 2026-10-23). -->
					<span class="ghost-text" data-reserve="Not used"
						>{!seat.dead
							? 'None while alive'
							: tokenFreeVotes !== undefined
								? `${tokenFreeVotes} votes`
								: seat.ghostVoteUsed
									? 'Used'
									: 'Not used'}</span
					>
				</button>
			</div>

			<!-- Nomination tracking (Trevor, 2026-10-22: "if enabled, just add beneath dead vote the
			     same area there to track it"). Both rows always show while the setting is on. -->
			{#if gameSettings.current.trackNominations}
				<div class="row">
					<span class="label" id={`nominated-${seat.seatId}`}>Nominated</span>
					<button
						type="button"
						class="value nomination"
						aria-labelledby={`nominated-${seat.seatId}`}
						data-testid="sheet-nominated"
						disabled={!canNominate}
						onclick={() => seatId !== undefined && (nominating = { seatId, side: 'made' })}
					>
						<Icon name="nominator" />
						<span
							>{#each nominations.allMade as n, i (i)}{i > 0 ? ', ' : ''}<PlayerBadge
									name={seatName(game, n.nominee)}
								/>{:else}None{/each}</span
						>
					</button>
				</div>
				<div class="row">
					<span class="label" id={`nominated-by-${seat.seatId}`}>Nominated by</span>
					<button
						type="button"
						class="value nomination"
						aria-labelledby={`nominated-by-${seat.seatId}`}
						data-testid="sheet-nominated-by"
						onclick={() => seatId !== undefined && (nominating = { seatId, side: 'received' })}
					>
						<Icon name="nominated" />
						<span
							>{#if nominations.received}<PlayerBadge
									name={seatName(game, nominations.received.nominator)}
								/>{:else}None{/if}</span
						>
					</button>
				</div>
			{/if}

			<div class="row reminders-head">
				<!-- Added from the reminder bank only, by drag or tap (Trevor, 2026-10-29). -->
				<h3>Reminders</h3>
			</div>
			{#if seat.reminders.length === 0}
				<p class="none">None</p>
			{:else}
				<ul class="reminders" style:--reminder-gap="{Math.round(reminderSize * 0.6)}px">
					{#each seat.reminders as reminder (reminder.reminderId)}
						<!-- Just the token: tapping it opens its actions, delete among them (Trevor,
						     2026-10-19: no tick box, no owner, no ⋯; the icon says whose it is). -->
						<!-- The token as on the board, not its name (Trevor, 2026-10-30). -->
						<li>
							<BoardReminder
								label={reminderWords(reminder)}
								infinite={isGeneric(reminder)}
								symbol={reminder.symbol}
								symbolColour={reminder.symbolColour}
								symbolFill={reminder.symbolFill}
								art={reminder.like ? characters.get(reminder.like.characterId) : undefined}
								character={characters.get(reminder.characterId)}
								alignment={placingAlignment(game, reminder, characters)}
								size={reminderSize}
								ariaLabel={`Actions for ${tokenLabel(reminder)}`}
								onTap={() => {
									moving = reminder.reminderId;
									reminderMenuOpen = true;
								}}
							/>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</BottomSheet>

<ReminderMoveConfirm bind:this={moveConfirm} {grimoire} />

<SavantSheet bind:open={savantOpen} {grimoire} {seatId} />
{#if claim && seat?.characterId}
	<NoteSheet bind:open={claimOpen} game={day} target={{ characterId: seat.characterId, seatId }} />
{/if}

<SeatCharacterFlow bind:this={flow} {grimoire} {seatId} {onDraw} />

{#if character}<CharacterDialog
		bind:open={detailsOpen}
		{character}
		seat={{ number, alignment: seat?.alignment }}
	/>{/if}

<CharacterHistoryDialog bind:open={changesOpen} {grimoire} {seatId} />

<SeatStatusDialog bind:open={causeOpen} {grimoire} {seatId} sheetOpen={open} {onExecute} />

<!-- The seat's less frequent actions, in an overlay so the sheet stays short. -->
<SeatMenu
	bind:open={menuOpen}
	{title}
	{number}
	{seat}
	{character}
	{gainsAbility}
	{holdsAbility}
	{savant}
	{claim}
	hasChanges={changes.length > 0}
	onChangeCharacter={() => flow?.choose()}
	onGain={() => flow?.chooseGain()}
	onHeld={() => flow?.chooseHeld()}
	onSavant={() => (savantOpen = true)}
	onClaim={() => (claimOpen = true)}
	onAlignment={() => flow?.chooseAlignment()}
	onNotes={() => {
		if (seatId) onNotes?.(seatId);
	}}
	onHistory={() => (changesOpen = true)}
	onRemove={() => (removeOpen = true)}
/>

<SeatReminderMenu
	bind:open={reminderMenuOpen}
	{grimoire}
	{seatId}
	reminderId={moving}
	onMove={() => (moveOpen = true)}
	onReturn={() => {
		// Taken off the seat, it waits in the reminder bank again.
		if (moving) moveConfirm?.requestReturn(moving);
		moving = undefined;
	}}
/>

<NominationChooser {grimoire} {characters} bind:asking={nominating} {onNominated} />

<SeatChooser
	bind:open={moveOpen}
	title="Move reminder to"
	{game}
	{characters}
	exclude={seatId}
	onChoose={(toSeatId) => {
		moveOpen = false;
		if (moving) moveConfirm?.request(moving, toSeatId);
		moving = undefined;
	}}
>
	<!-- It says which reminder moves (Trevor, 2026-10-19). -->
	{#snippet heading()}
		Move {#if movingReminder}<ReminderToken
				label={tokenLabel(movingReminder)}
				character={characters.get(movingReminder.characterId)}
				alignment={placingAlignment(game, movingReminder, characters)}
			/>{:else}reminder{/if} to
	{/snippet}
</SeatChooser>

<ConfirmDialog
	bind:open={removeOpen}
	title={`Remove ${title}?`}
	danger
	onConfirm={() => {
		open = false;
		if (seatId) grimoire.removeSeat(seatId);
	}}
>
	<ChangeList>
		<dt>Now</dt>
		<dd>
			{game.seating.length} seats, with <SeatBadge {game} {characters} {seatId} /> in Seat {number}
		</dd>
		<dt>Becomes</dt>
		<dd>{game.seating.length - 1} seats</dd>
	</ChangeList>
	{#if removeOpen && seatId}<TableCheck {game} {characters} kind="remove-seat" {seatId} />{/if}
	<p class="note">
		The seat, its character and its reminders leave the grimoire. History can bring them back.
	</p>
</ConfirmDialog>

<style>
	.ink {
		display: contents;
	}
	.note {
		color: var(--on-surface-muted);
		font-size: 0.9rem;
	}
	.lead-token {
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: none;
		cursor: pointer;
		display: grid;
		place-items: center;
		width: calc(3.75 * var(--u));
		height: calc(3.75 * var(--u));
	}
	.no-token {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		border: 2px dashed var(--border);
		border-radius: 50%;
		font: 600 1.1rem / 1 var(--font-control);
		color: var(--on-surface-muted);
	}
	.role {
		font-family: var(--font-heading);
		font-weight: var(--font-heading-weight);
		font-size: 1.45rem;
		letter-spacing: 0.04em;
		color: var(--on-surface);
	}
	.meta {
		display: block;
		font-size: 0.8rem;
	}
	.sheet {
		position: relative;
		display: grid;
		gap: var(--space-2);
		padding-bottom: var(--space-4);
	}
	.label {
		font-family: var(--font-control);
		font-size: 0.8rem;
		letter-spacing: 0.04em;
		color: var(--on-surface-muted);
	}
	/* Lines between the ability, the controls and the reminders (Trevor, 2026-10-17). */
	.ability {
		display: grid;
		gap: calc(0.125 * var(--u));
		padding-bottom: var(--space-2);
		border-bottom: 1px solid var(--border);
	}
	.reminders-head {
		padding-top: var(--space-2);
		border-top: 1px solid var(--border);
	}
	.ability p {
		margin: 0;
	}
	.ability-text {
		font-family: var(--font-ability);
		line-height: 1.35;
	}
	.state {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		min-height: 1.3em;
		overflow: hidden;
		font-size: 0.85rem;
		white-space: nowrap;
		text-overflow: ellipsis;
		color: var(--on-surface-muted);
		--icon-size: 1em;
	}
	.state.warn {
		color: var(--accent);
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		min-height: var(--tap-target);
	}
	/* One look for each state, here and on the board: Alive is plain ink with a heartbeat;
	   Dead is the seat token's dark shroud with its skull. */
	.status {
		min-width: 0;
	}
	.status-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.status[data-dead] {
		background: var(--backdrop);
		color: var(--on-surface);
	}
	.value {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
		min-height: var(--tap-target);
		padding: 0 var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--button-radius);
		background: transparent;
		color: inherit;
		font: var(--button-font);
		font-size: 0.8rem;
		cursor: pointer;
	}
	.value:disabled {
		opacity: 0.45;
		cursor: default;
	}
	/* One width whatever they say (Trevor, 2026-10-16): Alive or the longest cause alike. */
	.value {
		width: min(70%, 16rem);
	}
	/* Used shows whatever has focus (Trevor, 2026-10-18). */
	.value.ghost {
		--badge-size: calc(1.6 * var(--u));
	}
	/* Used is grey, like the spent ghost on the badge (Trevor, 2026-10-19: not red). */
	.value.ghost[aria-pressed='true'] {
		border-color: var(--ghost-used-rim);
		background: var(--ghost-used-wash);
	}
	.nomination span {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	/* As wide as "Not used", the longer of a dead player's two, with the words centred in it
	   (Trevor, 2026-10-23: "Not used" sat to one side, in room kept for "None while alive").
	   Toggling still moves only the words. */
	.ghost-text {
		display: inline-grid;
		justify-items: center;
		text-align: center;
	}
	.ghost-text::before {
		content: attr(data-reserve);
		height: 0;
		overflow: hidden;
		visibility: hidden;
	}
	h3 {
		margin: var(--space-2) 0 0;
		font-size: 0.95rem;
		color: inherit;
	}
	.none {
		margin: 0;
		color: var(--on-surface-muted);
	}
	/* Room beside each token for its words, which run wider than it, and under a row for the
	   words' band (as CharacterSummary). */
	.reminders {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3) var(--reminder-gap);
		margin: 0;
		padding: 0 0 var(--space-2) calc(var(--reminder-gap) / 4);
		list-style: none;
	}
</style>
