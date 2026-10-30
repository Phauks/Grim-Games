<!--
	Choosing who a seat is, for the seat sheet: the character picker and the confirmations a
	change asks for, a Traveller's alignment, an alignment change from ⋯, an ability gained
	by a swap (the Apprentice's), and one held without a token (the Boffin's, on the Demon).
-->
<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Alignment, CharacterId } from '#lib/core/data/index.ts';
	import { charactersInPlay, trueCharacter, type SeatId } from '#lib/core/model/index.ts';
	import { rulesOf } from '#lib/core/data/rules/index.ts';
	import { abilityGivers } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import BoardReminder from '#lib/features/grimoire/BoardReminder.svelte';
	import AlignmentPill from '#lib/features/grimoire/AlignmentPill.svelte';
	import CharacterPicker from '#lib/features/grimoire/CharacterPicker.svelte';
	import SeatBadge from '#lib/features/grimoire/SeatBadge.svelte';
	import TableCheck from '#lib/features/grimoire/TableCheck.svelte';
	import {
		placingAlignment,
		recommendedTravellers,
		SEAT_TYPES
	} from '#lib/features/grimoire/board.ts';
	import type { Grimoire } from '#lib/features/grimoire/grimoire.svelte.ts';
	import { placedLook } from '#lib/features/grimoire/reminders.ts';
	import { seatName } from '#lib/features/game/seat-label.ts';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ChangeList from '#lib/ui/primitives/ChangeList.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';

	interface Props {
		grimoire: Grimoire;
		seatId: SeatId | undefined;
		/** Opens the alignment draw for a seat, kept by the board (Trevor, 2026-10-19). */
		onDraw?: (seatId: SeatId) => void;
	}

	let { grimoire, seatId, onDraw }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const seat = $derived(seatId === undefined ? undefined : game.seats[seatId]);
	const number = $derived(seatId === undefined ? 0 : game.seating.indexOf(seatId) + 1);
	const character = $derived(seat?.characterId ? characters.get(seat.characterId) : undefined);
	const title = $derived(seat ? (seat.playerName ?? t('common.seat', { number })) : '');

	let pickerOpen = $state(false);
	let alignmentFor = $state<CharacterId | undefined>();
	let alignmentOpen = $state(false);
	/** A character change waiting for its confirmation (the seat already had one). */
	let changeTo = $state<CharacterId | undefined>();
	let changeOpen = $state(false);
	let clearOpen = $state(false);
	let gainOpen = $state(false);
	let heldOpen = $state(false);

	/** Opens the character picker. */
	export function choose() {
		pickerOpen = true;
	}
	/** Opens the picker for the ability gained by a swap (the Apprentice's). */
	export function chooseGain() {
		gainOpen = true;
	}
	/** Opens the picker for an ability held without a token (the Boffin's, on the Demon). */
	export function chooseHeld() {
		heldOpen = true;
	}
	/** Changes the seat's alignment (the ⋯ menu). */
	export function chooseAlignment() {
		alignmentFor = undefined;
		alignmentOpen = true;
	}

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

	// ── An ability gained by a swap ──
	// The player's token is swapped for a character of the types its rules block's
	// `swapsForAbility` gives for their alignment, with its token on them (the Apprentice: a
	// Townsfolk if good, a Minion if evil, with Is The Apprentice,
	// https://wiki.bloodontheclocktower.com/Apprentice; Trevor, 2026-10-16).
	const swapper = $derived.by(() => {
		const id = seatId === undefined ? undefined : trueCharacter(game, seatId, characters);
		const rule = id ? rulesOf(id, characters)?.swapsForAbility : undefined;
		return id && rule ? { id, rule } : undefined;
	});
	const gainTypes = $derived.by(() => {
		const rule = swapper?.rule;
		if (!rule) return [];
		if (seat?.alignment === 'good') return rule.good;
		if (seat?.alignment === 'evil') return rule.evil;
		return [...new Set([...rule.good, ...rule.evil])];
	});
	function gain(id: CharacterId) {
		gainOpen = false;
		const from = swapper;
		if (!seatId || !seat || !from) return;
		const reminder = { characterId: from.id, label: from.rule.token };
		const marked = seat.reminders.some(
			(r) => r.characterId === reminder.characterId && r.label === reminder.label
		);
		grimoire.run({ type: 'AssignCharacter', seatId, characterId: id, alignment: seat.alignment });
		if (!marked) grimoire.run({ type: 'AddReminder', seatId, reminder });
	}

	// ── An ability held without a token ──
	// Another character's `givesAbility` gives this player an ability: the Boffin's
	// not-in-play good character on the Demon (https://wiki.bloodontheclocktower.com/Boffin).
	const giver = $derived.by(() => {
		const id = seatId === undefined ? undefined : abilityGivers(game, seatId, characters)[0];
		const rule = id ? rulesOf(id, characters)?.givesAbility : undefined;
		return id && rule ? { id, rule } : undefined;
	});
	const held = $derived(seat?.abilities?.find((a) => a.via === giver?.id)?.characterId);
	const heldExclude = $derived.by(() => {
		if (!giver?.rule.notInPlay) return [];
		const tokens = charactersInPlay(game);
		const truly = game.seating.flatMap((s) => trueCharacter(game, s, characters) ?? []);
		return [...new Set([...tokens, ...truly])].filter((id) => id !== held);
	});
	function hold(characterId: CharacterId | undefined) {
		heldOpen = false;
		if (seatId && giver)
			grimoire.run({ type: 'SetHeldAbility', seatId, via: giver.id, characterId });
	}
</script>

<CharacterPicker
	bind:open={heldOpen}
	title={`Ability ${title} holds`}
	{characters}
	script={game.script}
	types={giver?.rule.types ?? []}
	current={held}
	exclude={heldExclude}
	onPick={hold}
	onNone={held ? () => hold(undefined) : undefined}
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

<!-- Every change of state says what it is now and what it becomes (Trevor, 2026-10-16). -->
<ConfirmDialog bind:open={changeOpen} title="Change character?" onConfirm={confirmChange}>
	{#if seat?.characterId && changeTo}
		<ChangeList>
			<dt>Player</dt>
			<dd>
				{#if seatId}<PlayerBadge name={seatName(game, seatId)} />{/if}
			</dd>
			<dt>Current role</dt>
			<dd>
				<CharacterBadge characterId={seat.characterId} {character} alignment={seat.alignment} />
			</dd>
			<dt>New role</dt>
			<dd>
				<CharacterBadge characterId={changeTo} character={characters.get(changeTo)} />
			</dd>
		</ChangeList>
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
						<!-- The token itself, as on the board (Trevor, 2026-10-30). -->
						<BoardReminder
							{...placedLook(reminder, characters)}
							alignment={placingAlignment(game, reminder, characters)}
						/>
						<span>on <SeatBadge {game} {characters} seatId={on} /></span>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</ConfirmDialog>

<ConfirmDialog
	bind:open={clearOpen}
	title="Remove character?"
	danger
	onConfirm={() => seatId && grimoire.run({ type: 'ClearCharacter', seatId })}
>
	<ChangeList>
		<dt>Now</dt>
		<dd><SeatBadge {game} {characters} {seatId} /></dd>
		<dt>Becomes</dt>
		<dd><strong>{title}</strong>, no character</dd>
	</ChangeList>
	{#if clearOpen && seatId}<TableCheck {game} {characters} kind="remove-character" {seatId} />{/if}
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
		<ChangeList>
			<dt>Now</dt>
			<dd>
				<SeatBadge {game} {characters} {seatId} /> is <AlignmentPill alignment={seat?.alignment} />
			</dd>
			<dt>Becomes</dt>
			<dd>
				{#if seat?.alignment === undefined}<AlignmentPill alignment="good" /> or <AlignmentPill
						alignment="evil"
					/>{:else}<AlignmentPill alignment={next} />{/if}
			</dd>
		</ChangeList>
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

<style>
	.note {
		color: var(--on-surface-muted);
		font-size: 0.9rem;
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
	.dropped,
	.dropped li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
	}
	/* Room under each token for its words' band. */
	.dropped {
		gap: var(--space-3);
		margin: 0;
		padding: 0 0 var(--space-2);
		list-style: none;
	}
	.choices {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}
</style>
