<script lang="ts">
	import type { Alignment, CharacterId } from '#lib/core/data/index.ts';
	import type { DeathCause, ReminderId, SeatId } from '#lib/core/model/index.ts';
	import { gameDeathCauses } from '#lib/core/rules/index.ts';
	import ShowToPlayer from '#lib/features/show/ShowToPlayer.svelte';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Segmented from '#lib/ui/primitives/Segmented.svelte';
	import { causeLabel, deathCauseOptions, isOrphan, SEAT_TYPES } from './board.ts';
	import CharacterPicker from './CharacterPicker.svelte';
	import { pastNames, suggestNames } from './device-notes.ts';
	import type { Grimoire } from './grimoire.svelte.ts';
	import ReminderPicker from './ReminderPicker.svelte';
	import SeatChooser from './SeatChooser.svelte';

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
	const title = $derived(seat ? (seat.playerName ?? `Seat ${number}`) : '');

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

	function commitName(name = typed) {
		if (!seatId || (seat?.playerName ?? '') === name.trim()) return;
		grimoire.rename(seatId, name);
		typed = name.trim();
	}

	// ── Character ──
	let pickerOpen = $state(false);
	let alignmentFor = $state<CharacterId | undefined>();
	let alignmentOpen = $state(false);

	function pick(id: CharacterId) {
		pickerOpen = false;
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

	function pickAlignment(alignment: Alignment) {
		alignmentOpen = false;
		if (seatId && alignmentFor)
			grimoire.run({ type: 'AssignCharacter', seatId, characterId: alignmentFor, alignment });
		alignmentFor = undefined;
	}

	// ── Death ──
	let causeOpen = $state(false);
	const causes = $derived(
		deathCauseOptions(gameDeathCauses(game, characters), characters, seat?.characterId)
	);

	function toggleDead() {
		if (!seat || !seatId) return;
		const dead = !seat.dead;
		if (!grimoire.run({ type: 'SetDead', seatId, dead })) return;
		if (dead && preferences.current.assistance.deathCause) causeOpen = true;
	}

	function setCause(cause: DeathCause | undefined) {
		causeOpen = false;
		if (seatId) grimoire.run({ type: 'SetDeathCause', seatId, cause });
	}

	// ── Reminders and seats ──
	let moving = $state<ReminderId | undefined>();
	let moveOpen = $state(false);
	let swapOpen = $state(false);
	let removeOpen = $state(false);
	let showOpen = $state(false);
	let remindersOpen = $state(false);
</script>

<BottomSheet bind:open {title} description={seat?.playerName ? `Seat ${number}` : 'No name'}>
	{#if seat && seatId}
		<div class="sheet">
			<label class="field">
				<span class="label">Player name</span>
				<input
					type="text"
					autocomplete="off"
					enterkeyhint="done"
					placeholder={`Seat ${number}`}
					bind:value={typed}
					onchange={() => commitName()}
					onkeydown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
				/>
			</label>
			<!-- A fixed-height row: suggestions come and go without moving anything. -->
			<div class="suggestions" aria-label="Name suggestions" role="group">
				{#each suggestions as name (name)}
					<button type="button" class="chip" onclick={() => commitName(name)}>{name}</button>
				{/each}
			</div>

			<div class="character">
				<span class="slot">
					{#if character}<CharacterToken {character} alignment={seat.alignment} size={48} />{/if}
				</span>
				<span class="who">
					<span class="role">{character?.name ?? 'None'}</span>
					<span class="orphan" class:shown={isOrphan(seat, game.script, characters)}>
						<Icon name="warning" /> Not on the script
					</span>
				</span>
				<Button variant="quiet" icon="swap" onclick={() => (pickerOpen = true)}>
					{character ? 'Replace' : 'Choose'}
				</Button>
				<IconButton
					icon="remove"
					label="Remove character"
					disabled={!character}
					onclick={() => grimoire.run({ type: 'ClearCharacter', seatId })}
				/>
			</div>

			<div class="row">
				<span class="label" id="alignment-label">Alignment</span>
				{#if seat.alignment}
					<Segmented
						label="Alignment"
						labelledBy="alignment-label"
						value={seat.alignment}
						options={[
							{ value: 'good', label: 'Good' },
							{ value: 'evil', label: 'Evil' }
						]}
						onChange={(alignment) => grimoire.run({ type: 'SetAlignment', seatId, alignment })}
					/>
				{:else}
					<span class="none">None</span>
				{/if}
			</div>

			<div class="toggles">
				<button type="button" class="toggle" aria-pressed={seat.dead} onclick={toggleDead}>
					<Icon name="dead" /> Dead
				</button>
				<button
					type="button"
					class="toggle"
					aria-pressed={seat.dead && seat.ghostVoteUsed}
					disabled={!seat.dead}
					onclick={() =>
						grimoire.run({
							type: seat.ghostVoteUsed ? 'RestoreGhostVote' : 'SpendGhostVote',
							seatId
						})}
				>
					<Icon name="ghostVote" /> Vote used
				</button>
				<button
					type="button"
					class="toggle"
					aria-pressed={grimoire.isFlipped(seatId)}
					onclick={() => grimoire.toggleFlipped(seatId)}
				>
					<Icon name="upsideDown" /> Upside down
				</button>
			</div>

			<div class="row">
				<span class="label">Cause of death</span>
				<button
					type="button"
					class="value"
					disabled={!seat.dead}
					onclick={() => (causeOpen = true)}
				>
					{seat.dead ? causeLabel(seat.deathCause, characters) : 'None'}
				</button>
			</div>

			<div class="row">
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
							<ReminderToken
								label={reminder.label}
								type={characters.get(reminder.characterId)?.type}
							/>
							<span class="spacer"></span>
							<IconButton
								icon="move"
								label={`Move ${reminder.label} to another seat`}
								onclick={() => {
									moving = reminder.reminderId;
									moveOpen = true;
								}}
							/>
							<IconButton
								icon="remove"
								label={`Remove ${reminder.label}`}
								onclick={() =>
									grimoire.run({ type: 'RemoveReminder', reminderId: reminder.reminderId })}
							/>
						</li>
					{/each}
				</ul>
			{/if}

			<h3>Seat</h3>
			<div class="actions">
				<Button
					variant="quiet"
					disabled={!character}
					onclick={() => {
						// The sheet closes first: it is Storyteller-only, and the shown token covers the screen.
						open = false;
						showOpen = true;
					}}
				>
					Show to player
				</Button>
				<Button variant="quiet" icon="swap" onclick={() => (swapOpen = true)}>Swap seats</Button>
				<Button variant="quiet" icon="remove" onclick={() => (removeOpen = true)}>
					Remove seat
				</Button>
			</div>
		</div>
	{/if}
</BottomSheet>

<ReminderPicker bind:open={remindersOpen} {grimoire} {seatId} {title} />

<ShowToPlayer
	bind:open={showOpen}
	characters={character ? [{ character, alignment: seat?.alignment }] : []}
/>

<CharacterPicker
	bind:open={pickerOpen}
	title={`Character for ${title}`}
	{characters}
	script={game.script}
	types={SEAT_TYPES}
	current={seat?.characterId}
	onPick={pick}
/>

<Dialog bind:open={alignmentOpen} title="Alignment" description="Travellers can be good or evil.">
	<div class="choices">
		<Button onclick={() => pickAlignment('good')}>Good</Button>
		<Button onclick={() => pickAlignment('evil')}>Evil</Button>
	</div>
</Dialog>

<Dialog bind:open={causeOpen} title={`How did ${title} die?`}>
	<div class="causes">
		{#each causes as cause (cause)}
			{@const killer = characters.get(cause)}
			<button
				type="button"
				class="cause"
				aria-pressed={seat?.deathCause === cause}
				onclick={() => setCause(cause)}
			>
				<span class="slot"
					>{#if killer}<CharacterToken character={killer} size={32} />{/if}</span
				>
				{causeLabel(cause, characters)}
			</button>
		{/each}
	</div>
	{#snippet actions()}
		<Button variant="quiet" onclick={() => setCause(undefined)}>None</Button>
		<Button variant="quiet" onclick={() => (causeOpen = false)}>Skip</Button>
	{/snippet}
</Dialog>

<SeatChooser
	bind:open={swapOpen}
	title={`Swap ${title} with`}
	{game}
	{characters}
	exclude={seatId}
	onChoose={(other) => {
		swapOpen = false;
		if (seatId) grimoire.run({ type: 'SwapSeats', seatA: seatId, seatB: other });
	}}
/>

<SeatChooser
	bind:open={moveOpen}
	title="Move reminder to"
	{game}
	{characters}
	exclude={seatId}
	onChoose={(toSeatId) => {
		moveOpen = false;
		if (moving) grimoire.run({ type: 'MoveReminder', reminderId: moving, toSeatId });
		moving = undefined;
	}}
/>

<Dialog bind:open={removeOpen} title={`Remove ${title}?`} role="alertdialog">
	<p>The seat, its character and its reminders leave the grimoire. Undo brings them back.</p>
	{#snippet actions()}
		<Button variant="quiet" onclick={() => (removeOpen = false)}>Cancel</Button>
		<Button
			variant="accent"
			onclick={() => {
				removeOpen = false;
				open = false;
				if (seatId) grimoire.removeSeat(seatId);
			}}>Remove</Button
		>
	{/snippet}
</Dialog>

<style>
	.sheet {
		/* Icon buttons take the sheet's ink, not the dark page's. */
		--on-surface: var(--on-sheet);
		--surface-selected: rgb(0 0 0 / 0.08);
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
	.field {
		display: grid;
		gap: 2px;
	}
	input {
		min-height: var(--tap-target);
		padding: 0 var(--space-3);
		border: 1px solid var(--on-sheet-muted);
		border-radius: var(--radius-md);
		background: transparent;
		color: inherit;
		font-family: var(--font-player);
		font-size: 1.05rem;
	}
	.suggestions {
		display: flex;
		gap: var(--space-1);
		height: var(--tap-target);
		overflow-x: auto;
		scrollbar-width: none;
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
	.character {
		display: grid;
		grid-template-columns: 48px 1fr auto auto;
		align-items: center;
		gap: var(--space-2);
	}
	.slot {
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
	}
	.who {
		display: grid;
		min-width: 0;
	}
	.role {
		font-family: var(--font-character);
		font-weight: var(--font-character-weight);
	}
	.orphan {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		font-size: 0.85rem;
		color: var(--accent);
		visibility: hidden;
		--icon-size: 1em;
	}
	.orphan.shown {
		visibility: visible;
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		min-height: var(--tap-target);
	}
	.toggles {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--space-1);
	}
	.toggle,
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
	.toggle[aria-pressed='true'] {
		border-color: var(--accent);
		background: var(--accent);
		color: var(--on-accent);
	}
	.toggle:disabled,
	.value:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.value {
		min-width: calc(9 * var(--u));
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
	}
	.actions,
	.choices {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.choices {
		margin-top: var(--space-3);
	}
	.causes {
		display: grid;
		gap: 2px;
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
	.cause .slot {
		width: 32px;
		height: 32px;
	}
</style>
