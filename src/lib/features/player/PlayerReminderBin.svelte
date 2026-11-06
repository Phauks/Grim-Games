<script lang="ts">
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import { numberSymbol, symbolNumber, type GenericLook } from '#lib/core/model/index.ts';
	import type { PlayersPhase } from '#lib/core/rules/game-phase.ts';
	import type { PublicSeat } from '#lib/core/sync/public-projection.ts';
	import BankToken from '#lib/features/grimoire/BankToken.svelte';
	import BoardReminder from '#lib/features/grimoire/BoardReminder.svelte';
	import {
		bankLabel,
		bankLook,
		playerBankItems,
		type BankGroup,
		type BankItem
	} from '#lib/features/grimoire/bank-items.ts';
	import GenericLookDialog from '#lib/features/grimoire/GenericLookDialog.svelte';
	import HeldTokenPick from '#lib/features/grimoire/HeldTokenPick.svelte';
	import ReminderAbout from '#lib/features/grimoire/ReminderAbout.svelte';
	import ReminderInHand from '#lib/features/grimoire/ReminderInHand.svelte';
	import ReminderTray from '#lib/features/grimoire/ReminderTray.svelte';
	import { overNewToken } from '#lib/features/grimoire/reminder-drag.svelte.ts';
	import { dropOnTap } from '#lib/features/grimoire/reminder-in-hand.ts';
	import { copiedLook } from '#lib/features/grimoire/reminders.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import SearchField from '#lib/ui/primitives/SearchField.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import type { SeatPoint } from '#lib/ui/seating/seat-layout.ts';
	import { isGenericReminder, playerLook, type PlayerReminder } from './player-reminders.ts';
	import type { PlayerReminderState } from './player-reminders.svelte.ts';
	import { TRAY_EXTRA } from './tray-ring.ts';

	/**
	 * A player's reminder tray, built from the Storyteller's bank's own pieces (Trevor,
	 * 2026-11-06: "I want them to use the same components for parity"): its tokens come from
	 * `playerBankItems` (bank-items.ts) and are drawn by `BankToken`, held in `ReminderInHand`
	 * with `HeldTokenPick`, in the one `ReminderTray`. Docked at the town's foot: the characters
	 * this player guessed first, then the rest of the script, each counting run stacked as one
	 * token, then the ∞, the # and the phone's own ∞ tokens with "+ New token"; pulled up, a
	 * search narrows them. Drag a token onto a seat, or tap it and then a seat. A player's
	 * tokens never run out. A token on a seat is picked up by a tap too, as on the board: a seat
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
		/** The player's reminders and ∞ tokens for this game. */
		reminders: PlayerReminderState;
		/** The game's phase from the room: # tokens count up at dusk or dawn. None offline. */
		now?: PlayersPhase;
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
		reminders,
		now
	}: Props = $props();

	const lookup = $derived(new Map(characters.map((c) => [c.id, c])));
	$effect(() => reminders.atPhase(now));

	const CAPTIONS: Partial<Record<BankGroup, string>> = {
		guesses: t('player.grim.yourGuesses'),
		reminders: t('player.grim.onTheScript'),
		generic: '∞'
	};
	let open = $state(false);
	let query = $state('');
	const items = $derived(playerBankItems(characters, guessed, reminders.tokens, query));
	const groups = $derived(
		(['guesses', 'reminders', 'generic'] as const).map((group) => ({
			key: group,
			caption: CAPTIONS[group],
			items: items.filter((i) => i.group === group)
		}))
	);

	/** A tray token as it goes on a seat: a # with the number picked, an ∞ token's look. */
	function trayReminder(item: BankItem, number?: number): PlayerReminder {
		const { tokenId: _id, ...look } = item.token ?? { tokenId: '' };
		void _id;
		return {
			characterId: item.characterId,
			label: bankLabel(item),
			...(item.token ? look : bankLook(item, number))
		};
	}
	/** A new ∞ token in the tray like `reminder` (dropped or tapped onto "+ New token"). */
	function newTokenLike(reminder: PlayerReminder) {
		held = undefined;
		reminders.addToken(copiedLook(reminder));
	}
	let editingToken = $state<string>();
	let tokenEditorOpen = $state(false);
	function editToken(tokenId: string) {
		held = undefined;
		editingToken = tokenId;
		tokenEditorOpen = true;
	}
	const editedToken = $derived(reminders.tokens.find((t) => t.tokenId === editingToken));

	// ── Drag a token onto a seat, or onto "+ New token" ──
	let drag = $state<{ item: BankItem; at: SeatPoint; overNew: boolean }>();
	const glow = $derived(drag?.overNew ? 'over' : drag ? 'ready' : undefined);
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
	function dragToken(item: BankItem, x: number, y: number, end: boolean) {
		if (!town) return;
		held = undefined;
		const rect = town.getBoundingClientRect();
		const at = { x: ((x - rect.left) / rect.width) * 100, y: ((y - rect.top) / rect.height) * 100 };
		const overNew = overNewToken(x, y);
		if (!end) {
			drag = { item, at, overNew };
			return;
		}
		drag = undefined;
		if (overNew) return newTokenLike(trayReminder(item));
		const seat = seatAt(at);
		if (seat) reminders.place(seat.seatId, trayReminder(item));
	}

	// ── The token in hand: from the tray, or picked up off a seat (Trevor, 2026-10-31) ──
	type Held =
		| { kind: 'tray'; item: BankItem; number: number; look: GenericLook }
		| { kind: 'placed'; seatId: string; reminder: PlayerReminder };
	let held = $state<Held>();
	let menuOpen = $state(false);
	const heldKey = $derived(held?.kind === 'tray' ? held.item.key : undefined);
	/** The held token as it would go on a seat. */
	const heldReminder = $derived(
		held?.kind === 'tray'
			? { ...trayReminder(held.item, held.item.number ? held.number : undefined), ...held.look }
			: held?.reminder
	);
	function tapToken(item: BankItem) {
		// Taken from the pulled-up tray, it lowers to its row, its tokens still there to see.
		open = false;
		if (item.makesToken) {
			// Holding a token, "+ New token" takes it as a drop there does.
			if (heldReminder) return newTokenLike(heldReminder);
			const tokenId = reminders.addToken();
			if (tokenId) editToken(tokenId);
			return;
		}
		held = heldKey === item.key ? undefined : { kind: 'tray', item, number: 1, look: {} };
	}
	/** Right-click (desktop): the token in hand, its ⋯ open, as on the board. */
	function menuFor(item: BankItem) {
		if (item.makesToken) return;
		held = { kind: 'tray', item, number: 1, look: {} };
		menuOpen = true;
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
		if (held.kind === 'tray') reminders.place(seat.seatId, heldReminder);
		else if (held.seatId !== seat.seatId) reminders.move(held.seatId, held.reminder, seat.seatId);
		held = undefined;
		return true;
	}
	/**
	 * A token on a seat dragged and let go (Trevor, 2026-11-01: as on the board): onto another
	 * seat it moves there; onto "+ New token" it stays and a new ∞ token like it is made; onto
	 * the tray it comes off.
	 */
	export function dropPlaced(from: string, reminder: PlayerReminder, x: number, y: number): void {
		held = undefined;
		if (overNewToken(x, y)) return newTokenLike(reminder);
		const under = document.elementFromPoint(x, y);
		if (under && trayEl?.contains(under)) return reminders.move(from, reminder);
		if (!town) return;
		const rect = town.getBoundingClientRect();
		const seat = seatAt({
			x: ((x - rect.left) / rect.width) * 100,
			y: ((y - rect.top) / rect.height) * 100
		});
		if (seat && seat.seatId !== from) reminders.move(from, reminder, seat.seatId);
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
			// The pill's own controls and "+ New token" stay theirs, as on the board.
			(target) => !!target.closest('.grab, [data-testid="reminder-in-hand"], [data-new-token]'),
			() => {
				held = undefined;
				reminders.move(from.seatId, from.reminder);
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
	const actions = $derived.by(() => {
		const label = t('player.grim.editToken');
		// One of the tray's own ∞ tokens: its editor changes the token itself, as the bank's.
		const tokenId = held?.kind === 'tray' ? held.item.token?.tokenId : undefined;
		if (tokenId) return [{ value: 'edit', label, onSelect: () => editToken(tokenId) }];
		return heldReminder && isGenericReminder(heldReminder)
			? [{ value: 'edit', label, onSelect: () => (editOpen = true) }]
			: [];
	});
	/** A held # token's number (plan M48), or which token of a stacked run: in its pill. */
	const heldNumber = $derived(symbolNumber(heldReminder?.symbol));
	const heldRun = $derived(
		held?.kind === 'tray' && held.item.run
			? { labels: held.item.run, label: held.item.label }
			: undefined
	);
	function pickNumber(n: number) {
		const symbol = numberSymbol(n);
		if (held?.kind === 'tray') held = { ...held, number: n, look: { ...held.look, symbol } };
		else if (held?.kind === 'placed' && held.reminder.id) {
			reminders.setLook(held.seatId, held.reminder.id, { symbol });
			held = { ...held, reminder: { ...held.reminder, symbol } };
		}
	}
	function pickRun(label: PlayerReminder['label']) {
		if (held?.kind === 'tray') held = { ...held, item: { ...held.item, label } };
	}
	/** The look being edited, kept on the token in hand or on its seat. */
	function setLook(change: GenericLook) {
		const now = subject;
		if (!now) return;
		const reminder = { ...now.reminder, ...change };
		if (now.seatId && now.reminder.id) reminders.setLook(now.seatId, now.reminder.id, change);
		if (shown) shown = { ...shown, reminder };
		else if (held?.kind === 'tray') held = { ...held, look: { ...held.look, ...change } };
		else if (held) held = { ...held, reminder };
	}
	/** Off its seat (or, in hand from the tray, put down). */
	function remove() {
		const now = subject;
		editOpen = false;
		aboutOpen = false;
		if (now?.seatId) reminders.move(now.seatId, now.reminder);
		if (!shown || (held?.kind === 'placed' && held.seatId === now?.seatId)) held = undefined;
		shown = undefined;
	}
</script>

{#snippet tokenView(item: BankItem, inRow: boolean, floating = false)}
	<BankToken
		{item}
		characters={lookup}
		size={chip}
		disabled={floating || disabled}
		{glow}
		onNew={() => tapToken(item)}
		onTap={() => tapToken(item)}
		onMenu={() => menuFor(item)}
		onDrag={(x, y, end) => dragToken(item, x, y, end)}
		onCancel={() => (drag = undefined)}
		panX={inRow}
	/>
{/snippet}
{#snippet trayToken(item: BankItem, inRow: boolean)}{@render tokenView(item, inRow)}{/snippet}

{#snippet heldView()}
	{#if heldReminder}<BoardReminder {...playerLook(heldReminder, characterOf)} />{/if}
{/snippet}
{#snippet heldPick()}
	<HeldTokenPick number={heldNumber} onNumber={pickNumber} run={heldRun} onRun={pickRun} />
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
	flags={(item) => ({ lifted: heldKey === item.key || drag?.item.key === item.key })}
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
			bind:menuOpen
			extra={heldPick}
			onAbout={() => (aboutOpen = true)}
			onPutDown={() => (held = undefined)}
		/>
	{/if}
</ReminderTray>

{#if drag}
	<div class="floating" style:left="{drag.at.x}%" style:top="{drag.at.y}%" aria-hidden="true">
		{@render tokenView(drag.item, false, true)}
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
	art={subject?.reminder.like ? characterOf(subject.reminder.like.characterId) : undefined}
	onCountsUp={now ? (countsUp) => setLook({ countsUp }) : undefined}
/>

<GenericLookDialog
	bind:open={tokenEditorOpen}
	look={editedToken}
	onChange={(change) => editingToken && reminders.setTokenLook(editingToken, change)}
	onDelete={() => editingToken && reminders.removeToken(editingToken)}
	deleteLabel={t('player.grim.deleteGeneric')}
	tokenKey={editingToken}
	art={editedToken?.like ? characterOf(editedToken.like.characterId) : undefined}
/>

<style>
	.floating {
		position: absolute;
		z-index: var(--z-held);
		translate: -50% -50%;
		scale: 1.15;
		pointer-events: none;
	}
</style>
