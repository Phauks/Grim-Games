<script lang="ts">
	import AlignmentPill from './AlignmentPill.svelte';
	import CharacterHistoryDialog from './CharacterHistoryDialog.svelte';
	import { allowedOffScriptIn } from '#lib/features/modes/game-mode.ts';
	import NominationChooser from './NominationChooser.svelte';
	import { seatLabel as seatLabelFor } from '#lib/features/game/seat-label.ts';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import ClearableField from '#lib/ui/primitives/ClearableField.svelte';
	import type { Alignment, CharacterId } from '#lib/core/data/index.ts';
	import type { ReminderId, SeatId } from '#lib/core/model/index.ts';
	import { trueCharacter } from '#lib/core/model/index.ts';
	import ShowToPlayer from '#lib/features/show/ShowToPlayer.svelte';
	import {
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
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import {
		causeLabel,
		isOrphan,
		placingAlignment,
		recommendedTravellers,
		SEAT_TYPES,
		tableCheck
	} from './board.ts';
	import CauseName from './CauseName.svelte';
	import SeatStatusDialog from './SeatStatusDialog.svelte';
	import SeatMenu from './SeatMenu.svelte';
	import SeatReminderMenu from './SeatReminderMenu.svelte';
	import CharacterPicker from './CharacterPicker.svelte';
	import { pastNames, suggestNames } from './device-notes.ts';
	import { roomHost } from '#lib/features/room/host.svelte.ts';
	import type { Grimoire } from './grimoire.svelte.ts';
	import ReminderPicker from './ReminderPicker.svelte';
	import SeatChooser from './SeatChooser.svelte';
	import ReminderMoveConfirm from './ReminderMoveConfirm.svelte';
	import { seatChanges } from './history.ts';
	import DeadBadge from '#lib/ui/seating/DeadBadge.svelte';
	import { boardLooks } from './board-looks.svelte.ts';
	import { tokenLabel } from './reminders.ts';
	import SavantSheet from '#lib/features/savant/SavantSheet.svelte';
	import NoteSheet from '#lib/features/day/NoteSheet.svelte';
	import { LiveDay } from '#lib/features/day/live-day.svelte.ts';
	import { dayClaim } from '#lib/core/rules/index.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';

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
	const title = $derived(seat ? (seat.playerName ?? `Seat ${number}`) : '');
	/** "Seat 3 (Cat)", or "Seat 3" with no name. */
	const seatLabel = $derived(seatId === undefined ? '' : seatLabelFor(game, seatId));
	/** Custom tokens can look alike, so the type shows too (Trevor, 2026-10-22, plan L26). */
	const typeText = $derived(
		character ? character.type[0].toUpperCase() + character.type.slice(1) : ''
	);
	const alignmentText = $derived(
		seat?.alignment === 'evil' ? 'Evil' : seat?.alignment === 'good' ? 'Good' : 'None'
	);

	// ── Name, with suggestions from names used before on this device ──
	// A different seat (or the same seat renamed elsewhere) resets the field.
	let typed = $derived(seat?.playerName ?? '');
	let past = $state<string[]>([]);
	$effect(() => {
		if (open) past = pastNames.read();
	});
	const taken = $derived(
		game.seating.flatMap((id) =>
			id !== seatId && game.seats[id].playerName ? [game.seats[id].playerName!] : []
		)
	);
	// The room's phones connected now without a seat come before names from earlier games.
	const inRoom = $derived(roomHost().connectedUnseated.flatMap((m) => (m.name ? [m.name] : [])));
	const suggestions = $derived(suggestNames([...inRoom, ...past], typed, taken));

	// The name is edited in place in the sheet's header: the input takes the name's spot.
	let editingName = $state(false);
	let nameInput = $state<HTMLInputElement>();
	function editName() {
		typed = seat?.playerName ?? '';
		editingName = true;
	}
	$effect(() => {
		if (editingName) nameInput?.focus();
	});
	$effect(() => {
		if (!open) editingName = false;
	});
	function submitName(event: SubmitEvent) {
		event.preventDefault();
		finishName();
	}
	/** Saves the name and closes the keyboard (focus leaving the field closes it). */
	function finishName(name = typed) {
		if (!editingName) return;
		commitName(name);
		editingName = false;
	}
	function cancelName(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		// Escape leaves the name as it was, and does not also close the sheet.
		event.preventDefault();
		event.stopPropagation();
		typed = seat?.playerName ?? '';
		editingName = false;
	}

	function commitName(name = typed) {
		if (!seatId || (seat?.playerName ?? '') === name.trim()) return;
		grimoire.rename(seatId, name);
		typed = name.trim();
	}

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
	let pickerOpen = $state(false);
	let detailsOpen = $state(false);
	let alignmentFor = $state<CharacterId | undefined>();
	let alignmentOpen = $state(false);
	/** A character change waiting for its confirmation (the seat already had one). */
	let changeTo = $state<CharacterId | undefined>();
	let changeOpen = $state(false);
	let clearOpen = $state(false);

	function pick(id: CharacterId) {
		pickerOpen = false;
		if (!seatId || id === seat?.characterId) return;
		if (seat?.characterId) {
			changeTo = id;
			changeOpen = true;
			return;
		}
		assign(id);
	}

	/**
	 * The previous character's reminders, wherever they are, that a change of character
	 * takes off the board (Trevor, 2026-10-16), unless another seat still has that character.
	 */
	const dropped = $derived.by(() => {
		const old = seat?.characterId;
		if (!old || !seatId) return [];
		const still = game.seating.some((id) => id !== seatId && game.seats[id].characterId === old);
		if (still) return [];
		return game.seating.flatMap((id) =>
			game.seats[id].reminders
				.filter((r) => r.characterId === old)
				.map((reminder) => ({ seatId: id, reminder }))
		);
	});
	function confirmChange() {
		changeOpen = false;
		const to = changeTo;
		changeTo = undefined;
		if (!to) return;
		for (const { reminder } of dropped)
			grimoire.run({ type: 'RemoveReminder', reminderId: reminder.reminderId });
		assign(to);
	}

	// ── Changes to who this seat is during the game (Trevor, 2026-10-16) ──
	const changes = $derived(
		seatId
			? seatChanges(grimoire.open.session.log.entries, grimoire.open.session.log.cursor, seatId)
			: []
	);
	let changesOpen = $state(false);

	function assign(id: CharacterId) {
		if (!seatId) return;
		const chosen = characters.get(id);
		// A Traveller needs its alignment chosen, unless the seat already has one.
		if (chosen?.type === 'traveller' && seat?.alignment === undefined) {
			alignmentFor = id;
			alignmentOpen = true;
			return;
		}
		grimoire.run({ type: 'AssignCharacter', seatId, characterId: id });
	}

	/** Finishes assigning a Traveller, or changes the seat's alignment from the … menu. */
	function pickAlignment(alignment: Alignment | undefined) {
		alignmentOpen = false;
		if (seatId && alignmentFor)
			grimoire.run({ type: 'AssignCharacter', seatId, characterId: alignmentFor, alignment });
		else if (seatId && alignment && alignment !== seat?.alignment)
			grimoire.run({ type: 'SetAlignment', seatId, alignment });
		alignmentFor = undefined;
	}

	/** Assigns the Traveller with no alignment yet, then opens the draw for the seat. */
	function drawAlignment() {
		const id = seatId;
		pickAlignment(undefined);
		if (id) onDraw?.(id);
	}

	// ── The Apprentice ──
	// The Apprentice's token is swapped for the Townsfolk (if good) or Minion (if evil) whose
	// ability they gain, with "Is The Apprentice" on it
	// (https://wiki.bloodontheclocktower.com/Apprentice; Trevor, 2026-10-16).
	const apprentice = $derived(
		seatId !== undefined && trueCharacter(game, seatId, characters) === 'apprentice'
	);
	const gainTypes = $derived(
		seat?.alignment === 'good'
			? (['townsfolk'] as const)
			: seat?.alignment === 'evil'
				? (['minion'] as const)
				: (['townsfolk', 'minion'] as const)
	);
	let gainOpen = $state(false);
	function gain(id: CharacterId) {
		gainOpen = false;
		if (!seatId || !seat) return;
		const marked = seat.reminders.some(
			(r) => r.characterId === 'apprentice' && r.label === 'Is The Apprentice'
		);
		grimoire.run({ type: 'AssignCharacter', seatId, characterId: id, alignment: seat.alignment });
		if (!marked)
			grimoire.run({
				type: 'AddReminder',
				seatId,
				reminder: { characterId: 'apprentice', label: 'Is The Apprentice' }
			});
	}

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
		seat?.characterId === 'savant' && preferences.current.assistance.savantInfo
	);
	let remindersOpen = $state(false);
	/** A player's claim in town (L56): Guesses or Statement, as on their day row. */
	const claim = $derived.by(() => {
		const id = seat?.characterId;
		const c = id ? dayClaim(id, grimoire.open.characters) : undefined;
		return preferences.current.assistance.playerClaims && (c === 'guesses' || c === 'statement')
			? c
			: undefined;
	});
	let claimOpen = $state(false);
	const day = $derived(new LiveDay(grimoire.open));
</script>

<BottomSheet bind:open {title} description={`Seat ${number}`}>
	<!-- The character's name is the biggest thing here; alignment and seat are easy to see
	     on the token already (Trevor, 2026-10-16). -->
	{#snippet subtitle()}
		<!-- eslint-disable-next-line grim/names-as-badges -- caption beside its own token (lead) -->
		{#if character}<span class="role">{character.name}</span>
			<span class="meta">{typeText} · {alignmentText} · Seat {number}</span>{:else}<span
				class="meta">Seat {number}</span
			>{/if}
	{/snippet}
	{#snippet lead()}
		<button
			type="button"
			class="lead-token"
			aria-label={character ? `About the ${character.name}` : 'Choose character'}
			onclick={() => (character ? (detailsOpen = true) : (pickerOpen = true))}
		>
			{#if character}
				<CharacterToken {character} alignment={seat?.alignment} size={60} />
			{:else}
				<span class="no-token">{number}</span>
			{/if}
		</button>
	{/snippet}
	{#snippet heading()}
		{#if editingName}
			<!-- A form, so a phone keyboard's Done or Enter key submits it even when the key
				 press arrives without key events (Android keyboards). -->
			<form class="name-form" onsubmit={submitName}>
				<ClearableField bind:value={typed}>
					<input
						bind:this={nameInput}
						class="name-input"
						type="text"
						aria-label="Player name"
						autocomplete="off"
						enterkeyhint="done"
						placeholder={`Seat ${number}`}
						bind:value={typed}
						onkeydown={cancelName}
						onblur={() => finishName()}
					/>
				</ClearableField>
			</form>
		{:else}
			<span class="player-name" class:no-name={!seat?.playerName}
				>{seat?.playerName ?? 'No name'}</span
			>
		{/if}
	{/snippet}
	{#snippet titleEnd()}
		<span class="ink"
			><IconButton
				icon="edit"
				label="Edit player name"
				disabled={editingName}
				onclick={editName}
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
			<!-- Names used before on this device, laid over the sheet so nothing moves. -->
			{#if editingName && suggestions.length > 0}
				<div class="suggestions" aria-label="Name suggestions" role="group">
					{#each suggestions as name (name)}
						<!-- Pressing a name keeps focus in the field, so it is not saved half-typed. -->
						<button
							type="button"
							class="chip"
							onpointerdown={(event) => event.preventDefault()}
							onclick={() => finishName(name)}>{name}</button
						>
					{/each}
				</div>
			{/if}
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
			{#if preferences.current.assistance.trackNominations}
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
							>{nominations.allMade.length
								? nominations.allMade.map((n) => seatLabelFor(game, n.nominee)).join(', ')
								: 'None'}</span
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
							>{nominations.received
								? seatLabelFor(game, nominations.received.nominator)
								: 'None'}</span
						>
					</button>
				</div>
			{/if}

			<div class="row reminders-head">
				<h3>Reminders</h3>
				<!-- A + only (Trevor, 2026-10-19). -->
				<IconButton icon="add" label="Add reminder" onclick={() => (remindersOpen = true)} />
			</div>
			{#if seat.reminders.length === 0}
				<p class="none">None</p>
			{:else}
				<ul class="reminders">
					{#each seat.reminders as reminder (reminder.reminderId)}
						<!-- Just the token: tapping it opens its actions, delete among them (Trevor,
						     2026-10-19: no tick box, no owner, no ⋯; the icon says whose it is). -->
						<li>
							<button
								type="button"
								class="reminder-tap"
								aria-label={`Actions for ${tokenLabel(reminder)}`}
								onclick={() => {
									moving = reminder.reminderId;
									reminderMenuOpen = true;
								}}
							>
								<ReminderToken
									label={tokenLabel(reminder)}
									character={characters.get(reminder.characterId)}
									alignment={placingAlignment(game, reminder, characters)}
								/>
							</button>
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

<ReminderPicker
	bind:open={remindersOpen}
	{grimoire}
	{seatId}
	{title}
	onRemove={(id) => moveConfirm?.requestReturn(id)}
	onMove={(id, to) => moveConfirm?.request(id, to)}
/>

<CharacterPicker
	bind:open={gainOpen}
	title={`Ability ${title} gains`}
	{characters}
	script={game.script}
	types={gainTypes}
	onPick={gain}
/>

<CharacterPicker
	bind:open={pickerOpen}
	title={`Character for ${title}`}
	{characters}
	script={game.script}
	types={SEAT_TYPES}
	recommended={recommendedTravellers(game.script, characters)}
	current={seat?.characterId}
	onPick={pick}
	onNone={seat?.characterId
		? () => {
				pickerOpen = false;
				clearOpen = true;
			}
		: undefined}
/>

{#if character}<CharacterDialog
		bind:open={detailsOpen}
		{character}
		seat={{ number, alignment: seat?.alignment }}
	/>{/if}

<!-- Every change of state says what it is now and what it becomes (Trevor, 2026-10-16). -->
<ConfirmDialog bind:open={changeOpen} title="Change character?" onConfirm={confirmChange}>
	{#if seat?.characterId && changeTo}
		<dl class="change">
			<dt>Player</dt>
			<dd><strong>{seatLabel}</strong></dd>
			<dt>Current role</dt>
			<dd>
				<CharacterBadge characterId={seat.characterId} {character} alignment={seat.alignment} />
			</dd>
			<dt>New role</dt>
			<dd>
				<CharacterBadge characterId={changeTo} character={characters.get(changeTo)} />
			</dd>
		</dl>
		<p class="note">
			Reminders on this player will remain in place. Reminders from the previous character will be
			removed.
		</p>
		<h3>Removed</h3>
		{#if dropped.length === 0}
			<p class="none">None</p>
		{:else}
			<ul class="dropped" data-testid="dropped-reminders">
				{#each dropped as { seatId: on, reminder } (reminder.reminderId)}
					<li>
						<ReminderToken
							label={tokenLabel(reminder)}
							character={characters.get(reminder.characterId)}
							alignment={placingAlignment(game, reminder, characters)}
						/>
						<span>on {@render seatBadge(on)}</span>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</ConfirmDialog>

<CharacterHistoryDialog bind:open={changesOpen} {grimoire} {seatId} />

<!-- How the change affects the table: players (Travellers not counted) and the setup sheet. -->
{#snippet table(kind: 'remove-seat' | 'remove-character', id: SeatId)}
	{@const check = tableCheck(game, characters, { kind, seatId: id })}
	<dl class="change" data-testid="table-check">
		<dt>Players</dt>
		<dd>
			{check.players.before === check.players.after
				? `${check.players.after}, unchanged`
				: `${check.players.before} → ${check.players.after}`}
		</dd>
		<dt>Setup</dt>
		<dd>
			{#if check.problems.length === 0}
				Still matches the setup sheet
			{:else}
				<span class="off"
					>{check.wasOff ? 'Already did not match' : 'No longer matches'} the setup sheet:</span
				>
				{#each check.problems as problem (problem)}<span class="problem">{problem}</span>{/each}
			{/if}
		</dd>
	</dl>
{/snippet}

<ConfirmDialog
	bind:open={clearOpen}
	title="Remove character?"
	danger
	onConfirm={() => seatId && grimoire.run({ type: 'ClearCharacter', seatId })}
>
	<dl class="change">
		<dt>Now</dt>
		<dd>{@render seatBadge(seatId)}</dd>
		<dt>Becomes</dt>
		<dd><strong>{title}</strong>, no character</dd>
	</dl>
	{#if clearOpen && seatId}{@render table('remove-character', seatId)}{/if}
</ConfirmDialog>

<Dialog
	bind:open={alignmentOpen}
	title="Alignment"
	description={alignmentFor ? 'Travellers can be good or evil.' : undefined}
>
	{#if alignmentFor}
		<div class="choices">
			<Button onclick={() => pickAlignment('good')}>Good</Button>
			<Button onclick={() => pickAlignment('evil')}>Evil</Button>
			<!-- The Traveller draws it from face-down tokens (Trevor, 2026-10-19). -->
			{#if onDraw}<Button onclick={drawAlignment}>Draw</Button>{/if}
			<!-- Often chosen later: the night order asks for it first (Trevor, 2026-10-16). -->
			<Button variant="quiet" onclick={() => pickAlignment(undefined)}>Decide later</Button>
		</div>
	{:else}
		{@const next = seat?.alignment === 'evil' ? 'good' : 'evil'}
		<dl class="change">
			<dt>Now</dt>
			<dd>{@render seatBadge(seatId)} is <AlignmentPill alignment={seat?.alignment} /></dd>
			<dt>Becomes</dt>
			<dd>
				{#if seat?.alignment === undefined}<AlignmentPill alignment="good" /> or <AlignmentPill
						alignment="evil"
					/>{:else}<AlignmentPill alignment={next} />{/if}
			</dd>
		</dl>
		<div class="choices">
			{#if seat?.alignment === undefined}
				<Button onclick={() => pickAlignment('good')}>Good</Button>
				<Button onclick={() => pickAlignment('evil')}>Evil</Button>
			{:else}
				<ModalActions
					onCancel={() => (alignmentOpen = false)}
					onConfirm={() => pickAlignment(next)}
				/>
			{/if}
		</div>
	{/if}
</Dialog>

<SeatStatusDialog bind:open={causeOpen} {grimoire} {seatId} sheetOpen={open} {onExecute} />

{#snippet seatBadge(id: SeatId | undefined)}
	{@const other = id ? game.seats[id] : undefined}
	{#if other}
		{@const n = game.seating.indexOf(other.seatId) + 1}
		{#if other.characterId}
			<CharacterBadge
				characterId={other.characterId}
				character={characters.get(other.characterId)}
				alignment={other.alignment}
				playerName={other.playerName ?? `Seat ${n}`}
			/>
		{:else}
			<strong>{other.playerName ?? `Seat ${n}`}</strong>
		{/if}
	{/if}
{/snippet}

<!-- The seat's less frequent actions, in an overlay so the sheet stays short. -->
<SeatMenu
	bind:open={menuOpen}
	{title}
	{number}
	{seat}
	{character}
	{apprentice}
	{savant}
	{claim}
	hasChanges={changes.length > 0}
	onChangeCharacter={() => (pickerOpen = true)}
	onGain={() => (gainOpen = true)}
	onSavant={() => (savantOpen = true)}
	onClaim={() => (claimOpen = true)}
	onAlignment={() => {
		alignmentFor = undefined;
		alignmentOpen = true;
	}}
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
	<dl class="change">
		<dt>Now</dt>
		<dd>{game.seating.length} seats, with {@render seatBadge(seatId)} in Seat {number}</dd>
		<dt>Becomes</dt>
		<dd>{game.seating.length - 1} seats</dd>
	</dl>
	{#if removeOpen && seatId}{@render table('remove-seat', seatId)}{/if}
	<p class="note">
		The seat, its character and its reminders leave the grimoire. History can bring them back.
	</p>
</ConfirmDialog>

<style>
	.ink {
		display: contents;
	}
	.change {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-1) var(--space-3);
		align-items: center;
		margin: 0 0 var(--space-2);
	}
	.change dt {
		color: var(--on-surface-muted);
		font-size: 0.85rem;
	}
	.change dd {
		margin: 0;
	}
	.off {
		color: var(--evil);
	}
	.problem {
		display: block;
		font-size: 0.9rem;
	}
	.note {
		color: var(--on-surface-muted);
		font-size: 0.9rem;
	}
	.name-form {
		display: contents;
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
	.no-name {
		color: var(--on-surface-muted);
	}
	.player-name {
		font-size: 1.05rem;
	}
	.role {
		font-family: var(--font-heading);
		font-weight: var(--font-heading-weight);
		font-size: 1.45rem;
		letter-spacing: 0.04em;
		color: var(--on-surface);
	}
	.meta {
		font-size: 0.8rem;
	}
	.dropped,
	.dropped li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
	}
	/* The same box as the name it replaces. */
	.name-input {
		box-sizing: border-box;
		width: 100%;
		height: 1.6em;
		margin: 0;
		padding: 0 var(--space-1);
		border: 0;
		border-bottom: 2px solid var(--accent);
		border-radius: 0;
		background: var(--surface-raised);
		color: inherit;
		font: inherit;
		letter-spacing: inherit;
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
	.suggestions {
		position: absolute;
		inset: 0 0 auto;
		z-index: 2;
		display: flex;
		gap: var(--space-1);
		padding: var(--space-1) 0;
		overflow-x: auto;
		scrollbar-width: none;
		background: var(--surface);
		box-shadow: 0 6px 8px -6px rgb(0 0 0 / 0.4); /* colour-ok: a shadow is darkness, not a theme colour */
	}
	.chip {
		flex: none;
		min-height: var(--tap-target);
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-full);
		background: transparent;
		color: inherit;
		font-family: var(--font-player);
		cursor: pointer;
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
	.reminders {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.reminder-tap {
		display: inline-flex;
		align-items: center;
		min-height: var(--tap-target);
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.choices {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}
</style>
