<script lang="ts">
	import type { Character, CharacterId, ReminderLabel } from '#lib/core/data/index.ts';
	import { GENERIC_REMINDER_ID, type GenericLook } from '#lib/core/model/index.ts';
	import type { PublicSeat } from '#lib/core/sync/public-projection.ts';
	import { matchesReminderSearch } from '#lib/features/characters/character-search.ts';
	import BoardReminder from '#lib/features/grimoire/BoardReminder.svelte';
	import GenericLookDialog from '#lib/features/grimoire/GenericLookDialog.svelte';
	import ReminderAbout from '#lib/features/grimoire/ReminderAbout.svelte';
	import ReminderInHand from '#lib/features/grimoire/ReminderInHand.svelte';
	import ReminderTray from '#lib/features/grimoire/ReminderTray.svelte';
	import { dropOnTap } from '#lib/features/grimoire/reminder-in-hand.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import SearchField from '#lib/ui/primitives/SearchField.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import type { SeatPoint } from '#lib/ui/seating/seat-layout.ts';
	import {
		guessesFirst,
		isGenericReminder,
		playerLook,
		scriptReminderGroups,
		type PlayerReminder
	} from './player-reminders.ts';
	import { TRAY_EXTRA } from './tray-ring.ts';

	/**
	 * A player's reminder tray (Trevor, 2026-10-31: the Storyteller's bank's own tray,
	 * ReminderTray), docked at the town's foot: the characters this player guessed first, then
	 * the rest of the script, then the generic ∞; pulled up, a search narrows them. Drag a token
	 * onto a seat, or tap it and then a seat. A player's tokens never run out: the same one may
	 * go on several seats. A token on a seat is picked up by a tap too, as on the board: a seat
	 * tapped next moves it there, the tray takes it back off.
	 */
	interface Props {
		characters: readonly Character[];
		/** Characters the player guessed on any seat, or knows (a Traveller): first. */
		guessed: readonly CharacterId[];
		seats: readonly PublicSeat[];
		/** Each seat's centre, in % of the town. */
		points: readonly SeatPoint[];
		/** The town, for where a token is dropped. */
		town: HTMLElement | undefined;
		/** Token and reminder diameters in px. */
		size: number;
		chip: number;
		characterOf: (id: CharacterId) => Character | undefined;
		/** Off while the eye hides the player's own reminders. */
		disabled?: boolean;
		onPlace: (seat: PublicSeat, reminder: PlayerReminder) => void;
		/** A token on a seat moved to another seat, or off it (`to` none). */
		onMove: (from: string, reminder: PlayerReminder, to?: string) => void;
		/** A placed ∞ token's new look. */
		onLook: (seatId: string, id: string, look: GenericLook) => void;
	}

	let {
		characters,
		guessed,
		seats,
		points,
		town,
		size,
		chip,
		characterOf,
		disabled = false,
		onPlace,
		onMove,
		onLook
	}: Props = $props();

	interface Token {
		key: string;
		reminder: PlayerReminder;
		character?: Character;
	}
	const GENERIC: Token = {
		key: 'generic',
		reminder: { characterId: GENERIC_REMINDER_ID as CharacterId, label: '' as ReminderLabel }
	};

	let open = $state(false);
	let query = $state('');
	const groups = $derived.by(() => {
		const parts = guessesFirst(
			scriptReminderGroups(characters).filter((g) => matchesReminderSearch(g, query)),
			guessed
		);
		const tokens = (list: typeof parts.first) =>
			list.flatMap((g) =>
				g.labels.map((label) => ({
					// eslint-disable-next-line grim/names-as-badges -- an identity key, never shown
					key: `${g.character.id}:${label}`,
					reminder: { characterId: g.character.id, label },
					character: g.character
				}))
			);
		return [
			{ key: 'guesses', caption: t('player.grim.yourGuesses'), items: tokens(parts.first) },
			{ key: 'script', caption: t('player.grim.onTheScript'), items: tokens(parts.rest) },
			{ key: 'generic', caption: '∞', items: query.trim() ? [] : [GENERIC] }
		];
	});

	// ── Drag a token onto a seat ──
	let drag = $state<{ token: Token; at: SeatPoint }>();
	function seatAt(at: SeatPoint): PublicSeat | undefined {
		if (!town) return undefined;
		const { width, height } = town.getBoundingClientRect();
		let best: PublicSeat | undefined;
		let bestDistance = size * 0.75;
		points.forEach((p, i) => {
			const d = Math.hypot(((p.x - at.x) / 100) * width, ((p.y - at.y) / 100) * height);
			if (d < bestDistance) {
				best = seats[i];
				bestDistance = d;
			}
		});
		return best;
	}
	function dragToken(token: Token, x: number, y: number, end: boolean) {
		if (!town) return;
		held = undefined;
		const rect = town.getBoundingClientRect();
		const at = { x: ((x - rect.left) / rect.width) * 100, y: ((y - rect.top) / rect.height) * 100 };
		if (!end) {
			drag = { token, at };
			return;
		}
		drag = undefined;
		const seat = seatAt(at);
		if (seat) onPlace(seat, token.reminder);
	}

	// ── The token in hand: from the tray, or picked up off a seat (Trevor, 2026-10-31) ──
	type Held =
		| { kind: 'tray'; token: Token; look: GenericLook }
		| { kind: 'placed'; seatId: string; reminder: PlayerReminder };
	let held = $state<Held>();
	const heldKey = $derived(held?.kind === 'tray' ? held.token.key : undefined);
	/** The held token as it would go on a seat. */
	const heldReminder = $derived(
		held?.kind === 'tray' ? { ...held.token.reminder, ...held.look } : held?.reminder
	);
	function tapToken(token: Token) {
		// Taken from the pulled-up tray, it lowers to its row, its tokens still there to see.
		open = false;
		held = heldKey === token.key ? undefined : { kind: 'tray', token, look: {} };
	}
	/** A token on a seat tapped: in hand, or put down if it is the one in hand. */
	export function pickUp(seatId: string, reminder: PlayerReminder): void {
		const same =
			held?.kind === 'placed' &&
			held.seatId === seatId &&
			(held.reminder.id ?? held.reminder.label) === (reminder.id ?? reminder.label) &&
			held.reminder.characterId === reminder.characterId;
		held = same ? undefined : { kind: 'placed', seatId, reminder };
	}
	/** A seat tapped while a token is in hand gets it; false when nothing is held. */
	export function placeOn(seat: PublicSeat): boolean {
		if (!held || !heldReminder) return false;
		if (held.kind === 'tray') onPlace(seat, heldReminder);
		else if (held.seatId !== seat.seatId) onMove(held.seatId, held.reminder, seat.seatId);
		held = undefined;
		return true;
	}
	/**
	 * A token on a seat dragged and let go (Trevor, 2026-11-01: as on the board): onto another
	 * seat it moves there; onto the tray it comes off.
	 */
	export function dropPlaced(from: string, reminder: PlayerReminder, x: number, y: number): void {
		held = undefined;
		const under = document.elementFromPoint(x, y);
		if (under && trayEl?.contains(under)) return onMove(from, reminder);
		if (!town) return;
		const rect = town.getBoundingClientRect();
		const seat = seatAt({
			x: ((x - rect.left) / rect.width) * 100,
			y: ((y - rect.top) / rect.height) * 100
		});
		if (seat && seat.seatId !== from) onMove(from, reminder, seat.seatId);
	}
	// The eye hides the player's reminders: nothing stays in hand.
	$effect(() => {
		if (disabled) held = undefined;
	});
	// A tap on the tray while a seat's token is in hand takes it off that seat, as the bank
	// takes back a board token (Trevor, 2026-10-30).
	let trayEl = $state<HTMLElement>();
	$effect(() => {
		const el = trayEl;
		const from = held?.kind === 'placed' ? held : undefined;
		if (!el || !from) return;
		return dropOnTap(
			el,
			(target) => !!target.closest('.grab'),
			() => {
				held = undefined;
				onMove(from.seatId, from.reminder);
			}
		);
	});

	// ── Its About and, for an ∞ token, Edit token (Trevor, 2026-10-31: the ⋯ holds only that) ──
	/**
	 * What About and Edit token show: a token tapped in the seat's sheet (Trevor, 2026-11-01: as
	 * the board's sheet opens its About), else the token in hand. `seatId` when it is on a seat.
	 */
	type Subject = { seatId?: string; reminder: PlayerReminder };
	let shown = $state<Subject>();
	const subject = $derived.by((): Subject | undefined => {
		if (shown) return shown;
		if (!held || !heldReminder) return undefined;
		return { seatId: held.kind === 'placed' ? held.seatId : undefined, reminder: heldReminder };
	});
	let aboutOpen = $state(false);
	let editOpen = $state(false);
	$effect(() => {
		if (!aboutOpen && !editOpen) shown = undefined;
	});
	/** A token on a seat, from the seat's sheet: its About, where it comes off. */
	export function showAbout(seatId: string, reminder: PlayerReminder): void {
		shown = { seatId, reminder };
		aboutOpen = true;
	}
	const subjectGeneric = $derived(!!subject && isGenericReminder(subject.reminder));
	const owner = $derived(
		subject && !subjectGeneric ? characterOf(subject.reminder.characterId) : undefined
	);
	const actions = $derived(
		heldReminder && isGenericReminder(heldReminder)
			? [{ value: 'edit', label: t('player.grim.editToken'), onSelect: () => (editOpen = true) }]
			: []
	);
	/** The look being edited, kept on the token in hand or on its seat. */
	function setLook(change: GenericLook) {
		const now = subject;
		if (!now) return;
		const reminder = { ...now.reminder, ...change };
		if (now.seatId && now.reminder.id) onLook(now.seatId, now.reminder.id, change);
		if (shown) shown = { ...shown, reminder };
		else if (held?.kind === 'tray') held = { ...held, look: { ...held.look, ...change } };
		else if (held) held = { ...held, reminder };
	}
	/** Off its seat (or, in hand from the tray, put down). */
	function remove() {
		const now = subject;
		editOpen = false;
		aboutOpen = false;
		if (now?.seatId) onMove(now.seatId, now.reminder);
		if (!shown || (held?.kind === 'placed' && held.seatId === now?.seatId)) held = undefined;
		shown = undefined;
	}
</script>

{#snippet tokenView(token: Token, inRow: boolean, floating = false)}
	<BoardReminder
		label={token.character ? token.reminder.label : ('' as ReminderLabel)}
		character={token.character}
		infinite={!token.character}
		size={chip}
		disabled={floating || disabled}
		onTap={() => tapToken(token)}
		onDrag={(x, y, end) => dragToken(token, x, y, end)}
		onCancel={() => (drag = undefined)}
		panX={inRow}
	/>
{/snippet}
{#snippet trayToken(token: Token, inRow: boolean)}{@render tokenView(token, inRow)}{/snippet}

{#snippet heldView()}
	{#if heldReminder}<BoardReminder {...playerLook(heldReminder, characterOf)} />{/if}
{/snippet}
{#snippet subjectView()}
	{#if subject}<BoardReminder {...playerLook(subject.reminder, characterOf)} />{/if}
{/snippet}

<ReminderTray
	label={t('player.grim.reminderBank')}
	binLabel={t('player.grim.reminderBin')}
	handleLabel={t('player.grim.everyReminder')}
	{groups}
	keyOf={(item) => item.key}
	item={trayToken}
	flags={(item) => ({ lifted: heldKey === item.key || drag?.token.key === item.key })}
	size={chip}
	inside={{ height: chip + TRAY_EXTRA }}
	bind:open
	bind:el={trayEl}
	over={town}
	busy={!!drag || !!held}
	lowered={!!drag}
	onEscape={() => {
		if (!held) return false;
		held = undefined;
		return true;
	}}
>
	{#snippet header()}<SearchField
			label={t('common.searchReminders')}
			bind:value={query}
		/>{/snippet}
	<!-- In hand until a seat is tapped, over the town's foot: the Storyteller's own pill. -->
	{#if held}
		<ReminderInHand
			token={heldView}
			{actions}
			onAbout={() => (aboutOpen = true)}
			onPutDown={() => (held = undefined)}
		/>
	{/if}
</ReminderTray>

{#if drag}
	<div class="floating" style:left="{drag.at.x}%" style:top="{drag.at.y}%" aria-hidden="true">
		{@render tokenView(drag.token, false, true)}
	</div>
{/if}

<ReminderAbout bind:open={aboutOpen} {owner} scriptNames={characters.map((c) => c.name)}>
	{#snippet token()}{@render subjectView()}{/snippet}
	{#snippet headActions()}
		{#if subject?.seatId}
			{#if subjectGeneric}<IconButton
					icon="edit"
					label={t('player.grim.editToken')}
					onclick={() => (editOpen = true)}
				/>{/if}
			<DeleteButton label={t('player.grim.removeReminder')} onclick={remove} />
		{/if}
	{/snippet}
</ReminderAbout>

<GenericLookDialog
	bind:open={editOpen}
	look={subject && subjectGeneric ? subject.reminder : undefined}
	onChange={setLook}
	onDelete={remove}
	deleteLabel={t('player.grim.deleteGeneric')}
	tokenKey={subject?.reminder.id ?? 'tray'}
/>

<style>
	.floating {
		position: absolute;
		z-index: 4;
		translate: -50% -50%;
		scale: 1.15;
		pointer-events: none;
	}
</style>
