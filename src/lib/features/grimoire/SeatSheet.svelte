<script lang="ts">
	import type { Alignment, CharacterId } from '#lib/core/data/index.ts';
	import type { DeathCause, ReminderId, SeatId } from '#lib/core/model/index.ts';
	import { validDeathCauses, type ValidDeathCause } from '#lib/core/rules/index.ts';
	import ShowToPlayer from '#lib/features/show/ShowToPlayer.svelte';
	import { abilityState, type ImpairmentReason } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import CharacterDialog from '#lib/features/characters/CharacterDialog.svelte';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { causeFlagText, causeLabel, isOrphan, SEAT_TYPES } from './board.ts';
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
	const traveller = $derived(character?.type === 'traveller');
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
	const abilityLine = $derived.by(() => {
		if (!seat || !character) return 'None';
		const parts: string[] = [];
		if (isOrphan(seat, game.script, characters)) parts.push('Not on the script');
		if (really) parts.push(`Is the ${really.name}`);
		for (const impairment of ability?.impairments ?? []) {
			const by = characters.get(impairment.source.characterId)?.name;
			parts.push(`${impairmentWords[impairment.reason]}${by ? ` (${by})` : ''}`);
		}
		if (ability?.dead) parts.push('Dead: no ability');
		// An ability works unless something says otherwise (Trevor, 2026-10-16): the line stays
		// reserved but empty.
		return parts.join(' · ');
	});
	const stateWarn = $derived(abilityLine !== '' && abilityLine !== 'None');

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

	// ── Death ──
	let causeOpen = $state(false);
	// Only the causes that fit this player (core); "Something else" is always last.
	// "Something else" is not offered (Trevor, 2026-10-16): None covers an unknown cause.
	const causes = $derived(
		seatId && open
			? validDeathCauses(game, seatId, characters).filter((c) => c.cause !== 'other')
			: []
	);
	let flagged = $state<ValidDeathCause | undefined>();
	let flagOpen = $state(false);

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
	let swapWith = $state<SeatId | undefined>();
	let swapConfirmOpen = $state(false);
	let menuOpen = $state(false);
	let reminderMenuOpen = $state(false);
	const movingReminder = $derived(seat?.reminders.find((r) => r.reminderId === moving));
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

<BottomSheet
	bind:open
	{title}
	description={character
		? `${character.name} · ${seat?.alignment === 'evil' ? 'Evil' : seat?.alignment === 'good' ? 'Good' : 'None'} · Seat ${number}`
		: `Seat ${number}`}
>
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
			</form>
		{:else}
			<span class:no-name={!seat?.playerName}>{seat?.playerName ?? 'No name'}</span>
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
		<span class="ink"
			><IconButton icon="more" label="Seat actions" onclick={() => (menuOpen = true)} /></span
		>
	{/snippet}
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
					{abilityLine}
				</p>
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
			</div>

			<div class="row">
				<span class="label">Cause of death</span>
				<button
					type="button"
					class="value"
					disabled={!seat.dead}
					onclick={() => (causeOpen = true)}
				>
					{seat.dead ? causeLabel(seat.deathCause, characters, traveller) : 'None'}
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
							<!-- Ticking a reminder off takes it off the seat (History can bring it back). -->
							<button
								type="button"
								class="tick"
								aria-label={`Done: remove ${reminder.label}`}
								onclick={() =>
									grimoire.run({ type: 'RemoveReminder', reminderId: reminder.reminderId })}
							></button>
							<ReminderToken
								label={reminder.label}
								type={characters.get(reminder.characterId)?.type}
							/>
							<span class="spacer"></span>
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

{#if character}<CharacterDialog bind:open={detailsOpen} {character} />{/if}

{#snippet team(alignment: Alignment | undefined)}
	<strong class="team" data-team={alignment ?? 'neutral'}
		>{alignment === 'good' ? 'Good' : alignment === 'evil' ? 'Evil' : 'Not set'}</strong
	>
{/snippet}

<!-- Every change of state says what it is now and what it becomes (Trevor, 2026-10-16). -->
<Dialog bind:open={changeOpen} title="Change character?" role="alertdialog">
	{#if seat?.characterId && changeTo}
		<dl class="change">
			<dt>Now</dt>
			<dd>{@render seatBadge(seatId)}</dd>
			<dt>Becomes</dt>
			<dd>
				<CharacterBadge
					characterId={changeTo}
					character={characters.get(changeTo)}
					playerName={title}
					inline
				/>
			</dd>
		</dl>
		<p class="note">Reminders stay on the seat. History can undo this.</p>
	{/if}
	{#snippet actions()}
		<Button variant="quiet" onclick={() => (changeOpen = false)}>Cancel</Button>
		<Button
			variant="accent"
			onclick={() => {
				changeOpen = false;
				if (changeTo) assign(changeTo);
				changeTo = undefined;
			}}>Change</Button
		>
	{/snippet}
</Dialog>

<Dialog bind:open={clearOpen} title="Remove character?" role="alertdialog">
	<dl class="change">
		<dt>Now</dt>
		<dd>{@render seatBadge(seatId)}</dd>
		<dt>Becomes</dt>
		<dd><strong>{title}</strong>, no character</dd>
	</dl>
	{#snippet actions()}
		<Button variant="quiet" onclick={() => (clearOpen = false)}>Cancel</Button>
		<Button
			variant="accent"
			icon="remove"
			onclick={() => {
				clearOpen = false;
				if (seatId) grimoire.run({ type: 'ClearCharacter', seatId });
			}}>Remove</Button
		>
	{/snippet}
</Dialog>

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

<Dialog bind:open={causeOpen} title={`How did ${title} die?`}>
	<div class="causes">
		{#each causes as { cause, flags }, i (cause)}
			{@const killer = characters.get(cause)}
			<div class="cause-row">
				<button
					type="button"
					class="cause"
					aria-pressed={seat?.deathCause === cause}
					onclick={() => setCause(cause)}
				>
					<span class="slot"
						>{#if killer}<CharacterToken character={killer} size={32} />{/if}</span
					>
					{causeLabel(cause, characters, traveller)}
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
		<Button variant="quiet" onclick={() => setCause(undefined)}>None</Button>
		<Button variant="quiet" onclick={() => (causeOpen = false)}>Skip</Button>
	{/snippet}
</Dialog>

<Dialog
	bind:open={flagOpen}
	title={flagged ? causeLabel(flagged.cause, characters, traveller) : ''}
	description="Offered with a caution"
>
	{#if flagged}
		<ul class="flags">
			{#each flagged.flags as flag, i (i)}
				<li>{causeFlagText(flag, game, characters, title)}</li>
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

<SeatChooser
	bind:open={swapOpen}
	title={`Swap ${title} with`}
	{game}
	{characters}
	exclude={seatId}
	onChoose={(other) => {
		swapOpen = false;
		swapWith = other;
		swapConfirmOpen = true;
	}}
/>

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

<!-- Swapping moves two players at once, so it is confirmed on its own. -->
<Dialog bind:open={swapConfirmOpen} title="Swap seats?" role="alertdialog">
	<p class="swap">Swap {@render seatBadge(seatId)} and {@render seatBadge(swapWith)}?</p>
	{#if seatId && swapWith}
		<dl class="change">
			<dt>Now</dt>
			<dd>
				{@render seatBadge(seatId)} in Seat {number}, {@render seatBadge(swapWith)} in Seat {game.seating.indexOf(
					swapWith
				) + 1}
			</dd>
			<dt>Becomes</dt>
			<dd>
				{@render seatBadge(seatId)} in Seat {game.seating.indexOf(swapWith) + 1}, {@render seatBadge(
					swapWith
				)} in Seat {number}
			</dd>
		</dl>
	{/if}
	{#snippet actions()}
		<Button variant="quiet" onclick={() => (swapConfirmOpen = false)}>Cancel</Button>
		<Button
			variant="accent"
			icon="swap"
			onclick={() => {
				swapConfirmOpen = false;
				if (seatId && swapWith) grimoire.run({ type: 'SwapSeats', seatA: seatId, seatB: swapWith });
				swapWith = undefined;
			}}>Swap</Button
		>
	{/snippet}
</Dialog>

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
		<Button
			variant="quiet"
			disabled={!character}
			onclick={() =>
				fromMenu(() => {
					// The sheet closes first: it is Storyteller-only, and the shown token covers the screen.
					open = false;
					showOpen = true;
				})}
		>
			Show to player
		</Button>
		<Button variant="quiet" icon="swap" onclick={() => fromMenu(() => (pickerOpen = true))}>
			{character ? 'Change character' : 'Choose character'}
		</Button>
		<Button
			variant="quiet"
			disabled={!character}
			onclick={() =>
				fromMenu(() => {
					alignmentFor = undefined;
					alignmentOpen = true;
				})}
		>
			Change alignment
		</Button>
		<Button variant="quiet" icon="swap" onclick={() => fromMenu(() => (swapOpen = true))}>
			Swap seats
		</Button>
		<Button
			variant="quiet"
			icon="remove"
			disabled={!character}
			onclick={() => fromMenu(() => (clearOpen = true))}
		>
			Remove character
		</Button>
		<Button variant="quiet" icon="remove" onclick={() => fromMenu(() => (removeOpen = true))}>
			Remove seat
		</Button>
	</div>
</Dialog>

<Dialog bind:open={reminderMenuOpen} title={movingReminder?.label ?? 'Reminder'}>
	<div class="menu">
		<Button variant="quiet" icon="move" onclick={() => fromMenu(() => (moveOpen = true))}>
			Move to another seat
		</Button>
		<Button
			variant="quiet"
			icon="remove"
			onclick={() =>
				fromMenu(() => {
					if (moving) grimoire.run({ type: 'RemoveReminder', reminderId: moving });
					moving = undefined;
				})}
		>
			Remove
		</Button>
	</div>
</Dialog>

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
	<dl class="change">
		<dt>Now</dt>
		<dd>{game.seating.length} seats, with {@render seatBadge(seatId)} in Seat {number}</dd>
		<dt>Becomes</dt>
		<dd>{game.seating.length - 1} seats</dd>
	</dl>
	<p class="note">
		The seat, its character and its reminders leave the grimoire. History can bring them back.
	</p>
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
	/* Header buttons take the sheet's ink, not the dark page's. */
	.ink {
		display: contents;
		--on-surface: var(--on-sheet);
		--surface-selected: rgb(0 0 0 / 0.08);
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
		border-radius: 999px;
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
	.note {
		color: var(--on-surface-muted);
		font-size: 0.9rem;
	}
	.menu {
		display: grid;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}
	.swap {
		margin: 0;
		line-height: 2;
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
		width: 60px;
		height: 60px;
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
	.ability {
		display: grid;
		gap: 2px;
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
		width: 48px;
		height: 48px;
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
	.choices {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
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
		width: 32px;
		height: 32px;
	}
</style>
