<script lang="ts">
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import CharacterSummary from '#lib/features/characters/CharacterSummary.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import { untrack } from 'svelte';
	import ClearableField from '#lib/ui/primitives/ClearableField.svelte';
	import type { Alignment, CharacterId } from '#lib/core/data/index.ts';
	import type { DeathCause, ReminderId, SeatId } from '#lib/core/model/index.ts';
	import { setupReminders, validDeathCauses, type ValidDeathCause } from '#lib/core/rules/index.ts';
	import { trueCharacter } from '#lib/core/model/index.ts';
	import ShowToPlayer from '#lib/features/show/ShowToPlayer.svelte';
	import { abilityState, type ImpairmentReason } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import ReminderOrigin from './ReminderOrigin.svelte';
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
		causeFlagText,
		causeLabel,
		isOrphan,
		placingAlignment,
		recommendedTravellers,
		SEAT_TYPES,
		tableCheck
	} from './board.ts';
	import CauseName from './CauseName.svelte';
	import CharacterPicker from './CharacterPicker.svelte';
	import { pastNames, suggestNames } from './device-notes.ts';
	import type { Grimoire } from './grimoire.svelte.ts';
	import ReminderPicker from './ReminderPicker.svelte';
	import SeatChooser from './SeatChooser.svelte';
	import ReminderMoveConfirm from './ReminderMoveConfirm.svelte';
	import { seatChanges } from './history.ts';

	interface Props {
		open: boolean;
		grimoire: Grimoire;
		seatId: SeatId | undefined;
	}

	let { open = $bindable(), grimoire, seatId }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const seat = $derived(seatId === undefined ? undefined : game.seats[seatId]);
	const number = $derived(seatId === undefined ? 0 : game.seating.indexOf(seatId) + 1);
	const character = $derived(seat?.characterId ? characters.get(seat.characterId) : undefined);
	const traveller = $derived(character?.type === 'traveller');
	const title = $derived(seat ? (seat.playerName ?? `Seat ${number}`) : '');
	/** "Seat 3 (Cat)", or "Seat 3" with no name. */
	const seatLabel = $derived(
		seat?.playerName ? `Seat ${number} (${seat.playerName})` : `Seat ${number}`
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
	const suggestions = $derived(suggestNames(past, typed, taken));

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
		if (isOrphan(seat, game.script, characters)) parts.push({ text: 'Not on the script' });
		if (really) parts.push({ text: 'Is the ', characterId: really.id });
		for (const impairment of ability?.impairments ?? []) {
			const words = impairmentWords[impairment.reason];
			const by = impairment.source.characterId;
			parts.push(
				characters.has(by) ? { text: `${words} (`, characterId: by, after: ')' } : { text: words }
			);
		}
		if (ability?.dead) parts.push({ text: 'Dead: no ability' });
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

	// ── The Storyteller's note on this player (Trevor, 2026-10-16): a Mezepheles' secret word,
	// the Amnesiac's ability. Never shown to players. ──
	let noteOpen = $state(false);
	let noteDraft = $state('');
	let noteFor: SeatId | undefined;
	function editNote() {
		noteDraft = seat?.note ?? '';
		noteFor = seatId;
		noteOpen = true;
	}
	/**
	 * Saved as it closes, however it closes (Trevor, 2026-10-17: no Save or Cancel; a swipe down
	 * keeps it), as one History entry per edit. Also if the app is put away mid-edit.
	 */
	function saveNote() {
		const on = noteFor;
		if (!on) return;
		const before = grimoire.game.seats[on]?.note ?? '';
		if (noteDraft.trim() === before.trim()) return;
		grimoire.run({ type: 'SetSeatNote', seatId: on, note: noteDraft });
	}
	$effect(() => {
		if (noteOpen) return;
		untrack(() => {
			saveNote();
			noteFor = undefined;
		});
	});

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
	let reviveOpen = $state(false);
	const statusText = $derived(
		seat?.dead ? `Dead: ${causeLabel(seat.deathCause, characters, traveller)}` : 'Alive'
	);
	// Only the causes that fit this player (core, which no longer offers "Something else").
	const causes = $derived(seatId && open ? validDeathCauses(game, seatId, characters) : []);
	let flagged = $state<ValidDeathCause | undefined>();
	let flagOpen = $state(false);

	// A death always has a cause (Trevor, 2026-10-16: "dead, no cause" does not exist). Alive
	// brings a dead player back, after a confirm that states both sides.
	function pickAlive() {
		causeOpen = false;
		if (seat?.dead) reviveOpen = true;
	}
	function revive() {
		reviveOpen = false;
		if (seatId) grimoire.run({ type: 'SetDead', seatId, dead: false });
	}

	function setCause(cause: DeathCause) {
		causeOpen = false;
		if (!seat || !seatId) return;
		if (seat.dead) grimoire.run({ type: 'SetDeathCause', seatId, cause });
		else grimoire.run({ type: 'SetDead', seatId, dead: true, cause });
	}

	// ── Reminders and seats ──
	let moving = $state<ReminderId | undefined>();
	let moveOpen = $state(false);
	let moveConfirm = $state<ReturnType<typeof ReminderMoveConfirm>>();
	let menuOpen = $state(false);
	let reminderMenuOpen = $state(false);
	/** Opens one reminder's own dialog over the sheet: a reminder tapped on the board. */
	export function showReminder(reminderId: ReminderId) {
		moving = reminderId;
		reminderMenuOpen = true;
	}
	const movingReminder = $derived(seat?.reminders.find((r) => r.reminderId === moving));
	/** A setup reminder can go back to the Setup reminders tray (Trevor, 2026-10-16). */
	const fromSetup = $derived.by(() => {
		const r = movingReminder;
		if (!r || !seat || !seatId) return false;
		// Suggested at setup once this token is off the board again.
		const without = {
			...game,
			seats: {
				...game.seats,
				[seatId]: { ...seat, reminders: seat.reminders.filter((x) => x !== r) }
			}
		};
		return setupReminders(without, characters).some(
			(s) => s.characterId === r.characterId && s.label === r.label
		);
	});
	/** Runs a menu action after closing the menu. */
	function fromMenu(action: () => void) {
		menuOpen = false;
		reminderMenuOpen = false;
		action();
	}
	let removeOpen = $state(false);
	let showOpen = $state(false);
	let remindersOpen = $state(false);
</script>

<BottomSheet bind:open {title} description={`Seat ${number}`}>
	<!-- The character's name is the biggest thing here; alignment and seat are easy to see
	     on the token already (Trevor, 2026-10-16). -->
	{#snippet subtitle()}
		<!-- eslint-disable-next-line grim/names-as-badges -- caption beside its own token (lead) -->
		{#if character}<span class="role">{character.name}</span>
			<span class="meta">{alignmentText} · Seat {number}</span>{:else}<span class="meta"
				>Seat {number}</span
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
				icon="rename"
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
					{#if isOrphan(seat, game.script, characters)}<Icon name="warning" />{/if}
					{#each abilityLine as part, i (i)}{#if i > 0}
							·
						{/if}{part.text}{#if part.characterId}<CharacterBadge
								characterId={part.characterId}
								character={characters.get(part.characterId)}
								inline
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
				<span class="value ghost">
					{#if seat.dead}
						<Select
							label="Ghost vote"
							labelledBy={`ghost-${seat.seatId}`}
							value={seat.ghostVoteUsed ? 'used' : 'unused'}
							options={[
								{ value: 'unused', label: 'Not used' },
								{ value: 'used', label: 'Used' }
							]}
							onChange={(v) =>
								grimoire.run({
									type: v === 'used' ? 'SpendGhostVote' : 'RestoreGhostVote',
									seatId: seat.seatId
								})}
						/>
					{:else}<span class="ghost-none">None while alive</span>{/if}
				</span>
			</div>

			<div class="row">
				<span class="label">Changes</span>
				<button
					type="button"
					class="value"
					disabled={changes.length === 0}
					aria-label={changes.length === 0
						? 'Changes: None'
						: `Changes: ${changes.length}, show them`}
					onclick={() => (changesOpen = true)}
				>
					{changes.length === 0
						? 'None'
						: `${changes.length} ${changes.length === 1 ? 'change' : 'changes'}`}
				</button>
			</div>

			<div class="row">
				<span class="label">Notes</span>
				<button
					type="button"
					class="value note-value"
					aria-label={seat.note ? `Notes: ${seat.note}` : 'Notes: None'}
					onclick={editNote}
				>
					<span class="note-text">{seat.note ?? 'None'}</span>
				</button>
			</div>

			<div class="row reminders-head">
				<h3>Reminders</h3>
				<Button variant="quiet" icon="add" onclick={() => (remindersOpen = true)}>
					Add reminder
				</Button>
			</div>
			{#if seat.reminders.length === 0}
				<p class="none">None</p>
			{:else}
				<ul class="reminders">
					{#each seat.reminders as reminder (reminder.reminderId)}
						<li>
							<!-- Ticking a reminder off takes it off the seat (History can bring it back). -->
							<button
								type="button"
								class="tick"
								aria-label={`Done: remove ${reminder.label}`}
								onclick={() => moveConfirm?.requestReturn(reminder.reminderId)}
							></button>
							<ReminderToken
								label={reminder.label}
								type={characters.get(reminder.characterId)?.type}
								alignment={placingAlignment(game, reminder.characterId, characters)}
							/>
							<!-- Whose it is (Trevor, 2026-10-17). -->
							<span class="spacer"
								><ReminderOrigin {game} {characters} characterId={reminder.characterId} /></span
							>
							<IconButton
								icon="more"
								label={`Actions for ${reminder.label}`}
								onclick={() => {
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

{#if character}<CharacterDialog bind:open={detailsOpen} {character} />{/if}

{#snippet team(alignment: Alignment | undefined)}
	<strong class="team" data-team={alignment ?? 'neutral'}
		>{alignment === 'good' ? 'Good' : alignment === 'evil' ? 'Evil' : 'Not set'}</strong
	>
{/snippet}

<!-- Every change of state says what it is now and what it becomes (Trevor, 2026-10-16). -->
<ConfirmDialog bind:open={changeOpen} title="Change character?" onConfirm={confirmChange}>
	{#if seat?.characterId && changeTo}
		<dl class="change">
			<dt>Player</dt>
			<dd><strong>{seatLabel}</strong></dd>
			<dt>Current role</dt>
			<dd>
				<CharacterBadge
					characterId={seat.characterId}
					{character}
					alignment={seat.alignment}
					inline
				/>
			</dd>
			<dt>New role</dt>
			<dd>
				<CharacterBadge characterId={changeTo} character={characters.get(changeTo)} inline />
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
							label={reminder.label}
							type={characters.get(reminder.characterId)?.type}
							alignment={placingAlignment(game, reminder.characterId, characters)}
						/>
						<span>on {@render seatBadge(on)}</span>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</ConfirmDialog>

<svelte:document
	onvisibilitychange={() => {
		if (document.visibilityState === 'hidden' && noteOpen) saveNote();
	}}
/>

<Dialog bind:open={noteOpen} title={`Notes for ${seatLabel}`}>
	<!-- Several lines: Enter starts a new line. Kept on close. Never shown to players. -->
	<textarea
		bind:value={noteDraft}
		readonly={grimoire.open.viewOnly}
		rows="5"
		aria-label="Notes"
		data-testid="seat-note"></textarea>
</Dialog>

<Dialog bind:open={changesOpen} title={`Changes for ${seatLabel}`}>
	<ol class="changes" data-testid="seat-changes">
		{#each changes as change, i (i)}
			<li>
				{#if change.kind === 'character'}
					<CharacterBadge
						characterId={change.from}
						character={characters.get(change.from)}
						inline
					/>
					→
					<CharacterBadge characterId={change.to} character={characters.get(change.to)} inline />
				{:else}
					{@render team(change.from)} → {@render team(change.to)}
				{/if}
			</li>
		{/each}
	</ol>
</Dialog>

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
			<!-- Often chosen later: the night order asks for it first (Trevor, 2026-10-16). -->
			<Button variant="quiet" onclick={() => pickAlignment(undefined)}>Decide later</Button>
		</div>
	{:else}
		{@const next = seat?.alignment === 'evil' ? 'good' : 'evil'}
		<dl class="change">
			<dt>Now</dt>
			<dd>{@render seatBadge(seatId)} is {@render team(seat?.alignment)}</dd>
			<dt>Becomes</dt>
			<dd>
				{#if seat?.alignment === undefined}{@render team('good')} or {@render team(
						'evil'
					)}{:else}{@render team(next)}{/if}
			</dd>
		</dl>
		<div class="choices">
			{#if seat?.alignment === undefined}
				<Button onclick={() => pickAlignment('good')}>Good</Button>
				<Button onclick={() => pickAlignment('evil')}>Evil</Button>
			{:else}
				<Button variant="quiet" onclick={() => (alignmentOpen = false)}>Cancel</Button>
				<Button variant="accent" onclick={() => pickAlignment(next)}
					>{next === 'good' ? 'Good' : 'Evil'}</Button
				>
			{/if}
		</div>
	{/if}
</Dialog>

<Dialog bind:open={causeOpen} title={`Status of ${title}`}>
	<div class="causes">
		<div class="cause-row">
			<button type="button" class="cause" aria-pressed={!seat?.dead} onclick={pickAlive}>
				<span class="slot status-icon"><Icon name="alive" /></span>
				Alive
			</button>
		</div>
		{#each causes as { cause, flags, gained }, i (cause)}
			{@const killer = characters.get(cause)}
			<div class="cause-row">
				<button
					type="button"
					class="cause"
					aria-pressed={seat?.deathCause === cause}
					onclick={() => setCause(cause)}
				>
					<span class="slot" class:status-icon={!killer} data-dead
						>{#if killer}<CharacterToken character={killer} size={32} />{:else}<Icon
								name="dead"
							/>{/if}</span
					>
					{causeLabel(cause, characters, traveller)}
					<!-- The gained ability that kills, as on the day sheet: "Cannibal (Slayer)". -->
					{#if gained}<span class="gained"
							>(<CharacterBadge
								characterId={gained}
								character={characters.get(gained)}
								inline
								interactive={false}
							/>)</span
						>{/if}
				</button>
				{#if flags.length > 0}
					<IconButton
						icon="warning"
						label={`Why ${causeLabel(cause, characters, traveller)} is marked`}
						onclick={() => {
							flagged = causes[i];
							flagOpen = true;
						}}
					/>
				{/if}
			</div>
		{/each}
	</div>
	{#snippet actions()}
		<!-- Solid, unlike the causes above, so it never reads as one of them. -->
		<Button variant="solid" icon="close" onclick={() => (causeOpen = false)}>Cancel</Button>
	{/snippet}
</Dialog>

<ConfirmDialog bind:open={reviveOpen} title={`Bring ${title} back to life?`} onConfirm={revive}>
	<dl class="change">
		<dt>Now</dt>
		<dd>
			<span class="state-pill" data-dead
				><Icon name="dead" />Dead: <CauseName
					cause={seat?.deathCause}
					{characters}
					{traveller}
				/></span
			>
		</dd>
		<dt>Becomes</dt>
		<dd><span class="state-pill"><Icon name="alive" />Alive</span></dd>
	</dl>
</ConfirmDialog>

<Dialog
	bind:open={flagOpen}
	title={flagged ? causeLabel(flagged.cause, characters, traveller) : ''}
	description="Offered with a caution"
>
	{#if flagged}
		<ul class="flags">
			{#each flagged.flags as flag, i (i)}
				{@const why = causeFlagText(flag, game, characters, title)}
				<li>
					{why.text}{#if why.by}
						(<CharacterBadge
							characterId={why.by}
							character={characters.get(why.by)}
							inline
						/>).{/if}
				</li>
			{/each}
		</ul>
	{/if}
	{#snippet actions()}
		{@const registers = flagged?.flags.find((f) => f.code === 'registers')}
		{#if registers?.code === 'registers'}
			<!-- External wiki page (the rules authority), not an app route. -->
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a class="wiki" href={registers.wiki} target="_blank" rel="noopener">
				<Icon name="wiki" /><span>Open wiki entry</span>
			</a>
		{/if}
		<Button variant="quiet" onclick={() => (flagOpen = false)}>Close</Button>
	{/snippet}
</Dialog>

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
				inline
			/>
		{:else}
			<strong>{other.playerName ?? `Seat ${n}`}</strong>
		{/if}
	{/if}
{/snippet}

<!-- The seat's less frequent actions, in an overlay so the sheet stays short. -->
<Dialog bind:open={menuOpen} {title} description={`Seat ${number}`}>
	{#snippet lead()}
		{#if seat?.characterId}
			<CharacterBadge
				characterId={seat.characterId}
				{character}
				alignment={seat.alignment}
				inline
			/>
		{/if}
	{/snippet}
	<div class="menu">
		<Button variant="quiet" icon="swap" onclick={() => fromMenu(() => (pickerOpen = true))}>
			{character ? 'Change character' : 'Choose character'}
		</Button>
		{#if apprentice}
			<Button variant="quiet" icon="swap" onclick={() => fromMenu(() => (gainOpen = true))}>
				Gained ability…
			</Button>
		{/if}
		<Button
			variant="quiet"
			icon="alignment"
			disabled={!character}
			onclick={() =>
				fromMenu(() => {
					alignmentFor = undefined;
					alignmentOpen = true;
				})}
		>
			Change alignment
		</Button>
	</div>
	{#snippet headActions()}
		<!-- Beside the close X, as on every sheet (Trevor, 2026-10-17). Removing the character
		     is "None" in Change character. -->
		<DeleteButton label="Remove seat" onclick={() => fromMenu(() => (removeOpen = true))} />
	{/snippet}
</Dialog>

<Dialog bind:open={reminderMenuOpen} title="Reminder">
	{#snippet heading()}
		{#if movingReminder}<ReminderToken
				label={movingReminder.label}
				type={characters.get(movingReminder.characterId)?.type}
				alignment={placingAlignment(game, movingReminder.characterId, characters)}
			/>{:else}Reminder{/if}
	{/snippet}
	{#snippet subtitle()}
		{#if movingReminder && seatId}From <ReminderOrigin
				{game}
				{characters}
				characterId={movingReminder.characterId}
				on={seatId}
			/>{/if}
	{/snippet}
	<!-- Whose ability it comes from, first, so an unfamiliar reminder makes sense (Trevor,
	     2026-10-17). -->
	{#if movingReminder}
		{@const source = characters.get(movingReminder.characterId)}
		{#if source}
			<p class="source">
				<CharacterBadge characterId={source.id} character={source} inline />
			</p>
			<CharacterSummary character={source} reminders={false} />
		{/if}
	{/if}
	<div class="menu">
		<Button variant="quiet" icon="move" onclick={() => fromMenu(() => (moveOpen = true))}>
			Move to another seat
		</Button>
		<Button
			variant="quiet"
			icon="reminder"
			disabled={!fromSetup}
			onclick={() =>
				fromMenu(() => {
					// Taken off the seat, it waits in the reminder bank again.
					if (moving) moveConfirm?.requestReturn(moving);
					moving = undefined;
				})}
		>
			Return to reminder bank
		</Button>
	</div>
	{#snippet headActions()}
		<DeleteButton
			label="Remove reminder"
			onclick={() =>
				fromMenu(() => {
					if (moving) moveConfirm?.requestReturn(moving);
					moving = undefined;
				})}
		/>
	{/snippet}
</Dialog>

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
/>

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
	/* Header buttons take the sheet's ink, not the dark page's. */
	.ink {
		display: contents;
		--on-surface: var(--on-sheet);
		--surface-selected: rgb(0 0 0 / 0.08);
	}
	.gained {
		color: var(--on-surface-muted);
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
	.team {
		display: inline-block;
		padding: 0 var(--space-2);
		border-radius: var(--radius-full);
		background: var(--surface-raised);
		color: var(--on-surface);
	}
	.team[data-team='good'] {
		background: var(--good);
		color: var(--on-good);
	}
	.team[data-team='evil'] {
		background: var(--evil);
		color: var(--on-evil);
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
	.menu {
		display: grid;
		gap: var(--space-2);
		margin-top: var(--space-3);
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
		border: 2px dashed var(--on-sheet-muted);
		border-radius: 50%;
		font: 600 1.1rem / 1 var(--font-control);
		color: var(--on-sheet-muted);
	}
	.no-name {
		color: var(--on-sheet-muted);
	}
	.player-name {
		font-size: 1.05rem;
	}
	.role {
		font-family: var(--font-heading);
		font-weight: var(--font-heading-weight);
		font-size: 1.45rem;
		letter-spacing: 0.04em;
		color: var(--on-sheet);
	}
	.meta {
		font-size: 0.8rem;
	}
	.dropped,
	.changes {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.dropped li,
	.changes li {
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
		background: rgb(0 0 0 / 0.06);
		color: inherit;
		font: inherit;
		letter-spacing: inherit;
	}
	.sheet {
		/* Icon buttons take the sheet's ink, not the dark page's. */
		--on-surface: var(--on-sheet);
		--surface-selected: rgb(0 0 0 / 0.08);
		position: relative;
		display: grid;
		gap: var(--space-2);
		padding-bottom: var(--space-4);
	}
	.label {
		font-family: var(--font-control);
		font-size: 0.8rem;
		letter-spacing: 0.04em;
		color: var(--on-sheet-muted);
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
		background: var(--sheet, var(--surface-raised));
		box-shadow: 0 6px 8px -6px rgb(0 0 0 / 0.4);
	}
	.chip {
		flex: none;
		min-height: var(--tap-target);
		padding: 0 var(--space-3);
		border: 1px solid var(--on-sheet-muted);
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
		border-bottom: 1px solid var(--on-sheet-muted);
	}
	.reminders-head {
		padding-top: var(--space-2);
		border-top: 1px solid var(--on-sheet-muted);
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
		color: var(--on-sheet-muted);
		--icon-size: 1em;
	}
	.state.warn {
		color: var(--accent);
	}
	.slot {
		display: grid;
		place-items: center;
		width: calc(3 * var(--u));
		height: calc(3 * var(--u));
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
	.status[data-dead],
	.state-pill[data-dead],
	.status-icon[data-dead] {
		background: var(--backdrop);
		color: var(--on-surface);
	}
	.state-pill {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: 0 var(--space-2);
		border: 1px solid var(--on-sheet-muted);
		border-radius: var(--radius-full);
	}
	.status-icon {
		border-radius: 50%;
		--icon-size: calc(1.25 * var(--u));
	}
	.value {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
		min-height: var(--tap-target);
		padding: 0 var(--space-2);
		border: 1px solid var(--on-sheet-muted);
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
	/* One line in the sheet, so a long note never moves anything; the dialog shows it all. */
	/* The note looks as it does in its editor (Trevor, 2026-10-17): the sheet's own text,
	   not the buttons' font. */
	.source {
		margin: 0 0 var(--space-1);
	}
	.value.ghost {
		display: grid;
		padding: 0;
		border: 0;
		cursor: default;
	}
	/* The same size and text as the other values in these rows (Trevor, 2026-10-17). */
	.value.ghost :global([data-scope='select'][data-part='trigger']) {
		width: 100%;
		min-height: var(--tap-target);
		padding-block: 0;
		border: 1px solid var(--on-sheet-muted);
		border-radius: var(--button-radius);
		background: transparent;
		color: inherit;
		font: var(--button-font);
		font-size: 0.8rem;
	}
	.ghost-none {
		align-self: center;
		padding: 0 var(--space-2);
		color: var(--on-sheet-muted);
	}
	.note-value {
		justify-content: flex-start;
		font: inherit;
		text-transform: none;
		letter-spacing: normal;
		font-variant: normal;
	}
	.note-text {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	textarea[data-testid='seat-note'] {
		width: 100%;
		min-height: calc(7 * var(--u));
		padding: var(--space-3);
		border: 1px solid var(--on-surface-muted);
		border-radius: var(--radius-md);
		background: transparent;
		color: inherit;
		font: inherit;
		resize: vertical;
	}
	h3 {
		margin: var(--space-2) 0 0;
		font-size: 0.95rem;
		color: inherit;
	}
	.none {
		margin: 0;
		color: var(--on-sheet-muted);
	}
	.reminders {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.reminders li {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
	.spacer {
		flex: 1;
		min-width: 0;
	}
	.choices {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}
	.causes {
		display: grid;
		gap: calc(0.125 * var(--u));
		margin-top: var(--space-2);
	}
	.cause {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
		padding: 0 var(--space-2);
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.cause:hover {
		background: var(--surface-selected);
	}
	.cause[aria-pressed='true'] {
		border-color: var(--focus);
	}
	.tick {
		flex: none;
		width: var(--tap-target);
		height: var(--tap-target);
		border: 2px solid var(--border);
		border-radius: var(--radius-md);
		background: none;
		cursor: pointer;
	}
	.tick:hover {
		background: var(--surface-selected);
	}
	.cause-row {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
	}
	.wiki {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
		padding: 0 var(--space-4);
		border-radius: var(--radius-md);
		background: var(--accent);
		color: var(--on-accent, var(--on-surface));
		text-decoration: none;
		font-weight: 600;
	}
	.flags {
		margin: var(--space-2) 0 0;
		padding-left: var(--space-3);
	}
	.flags li + li {
		margin-top: var(--space-1);
	}
	.cause .slot {
		width: calc(2 * var(--u));
		height: calc(2 * var(--u));
	}
</style>
