<script lang="ts">
	import type { CharacterId, ReminderLabel } from '#lib/core/data/index.ts';
	import type { GenericLook, Reminder, ReminderId, SeatId } from '#lib/core/model/index.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import type { SeatPoint } from '#lib/ui/seating/seat-layout.ts';
	import BoardReminder from './BoardReminder.svelte';
	import ReminderCount from './ReminderCount.svelte';
	import NewTokenButton from './NewTokenButton.svelte';
	import BankRunButton from './BankRunButton.svelte';
	import { placingAlignment } from './board.ts';
	import type { Grimoire } from './grimoire.svelte.ts';
	import type { StepFocus } from './step-focus.svelte.ts';
	import { copiedLook, isGeneric, type StepReminders } from './reminders.ts';
	import GenericTokenDialog from './GenericTokenDialog.svelte';
	import type { ReminderHand } from './reminder-hand.svelte.ts';
	import type { ReminderDragging } from './reminder-drag.svelte.ts';
	import ReminderHandPill from './ReminderHandPill.svelte';
	import ReminderTray from './ReminderTray.svelte';
	import { traySeats } from './setup-tray.ts';
	import { BANK_CAPTIONS, bankItems, type BankGroup, type BankItem } from './bank-items.ts';
	import { overNewToken } from './reminder-drag.svelte.ts';

	/**
	 * The reminder bank (Trevor, 2026-10-16), always docked under the board. During setup it
	 * holds core's suggested setup reminders; after that, every reminder of a character in
	 * play still off the board, with the walked-through step's character first and marked.
	 * Drag a token onto any seat, or tap it to hold it and then tap a seat (Trevor, 2026-10-30).
	 * Nothing is placed by itself, and a reminder removed from a seat comes back. The Storyteller can switch views at any time.
	 */
	interface Props {
		grimoire: Grimoire;
		/** The token in hand, shared with the board's tokens (reminder-hand.svelte.ts). */
		hand: ReminderHand;
		/** Drops a board token in hand where the board is tapped (ReminderHandPill). */
		remDrag: ReminderDragging;
		/** Takes a board token in hand off the board (ReminderMoveConfirm). */
		onRemove: (reminderId: ReminderId) => void;
		board: HTMLElement | undefined;
		/** Token diameter in px. */
		size: number;
		/** The character whose night step is being walked through. */
		focus?: StepReminders;
		/** How `focus` is shown (step-focus.svelte.ts). */
		focusMode?: StepFocus['mode'];
		/** The seat under a point (in % of the board), if any. */
		seatAt: (at: SeatPoint, onToken?: boolean) => SeatId | undefined;
		/** The Fabled or Loric under a client point, if any. */
		ruleAt: (x: number, y: number, reminder: Reminder) => CharacterId | undefined;
		/**
		 * Gives a Fabled or Loric a new reminder (asking first when it isn't theirs); `tokenId`
		 * when it is a copy of one of the bank's ∞ tokens.
		 */
		onRule: (reminder: Reminder, characterId: CharacterId, tokenId?: string) => void;
		/** Seats to mark: suggested ones, the one under a dragged token, and the token itself. */
		onHints: (hints: { seats: SeatId[]; target?: SeatId; reminder?: Reminder }) => void;
		/**
		 * At the bank's right end (Trevor, 2026-10-18): the game's next phase (Set up, Start game,
		 * End night, End day, or Run night to pick a stopped walk-through up). Always there, so the
		 * bank never moves. `hint`: a count; each rise lights it up for a moment.
		 */
		/** A spectator's board (Trevor, 2026-10-19): every token shown, none taken. */
		disabled?: boolean;
		/**
		 * A reminder on the board is being dragged, and whether it is over "+ New token", which
		 * glows to say it takes it (Trevor, 2026-10-27).
		 */
		dropping?: boolean;
		dropOver?: boolean;
		run?: {
			/** Its accessible name, and the shorter words shown. */
			label: string;
			text: string;
			icon: 'bag' | 'day' | 'night';
			disabled: boolean;
			onclick: () => void;
			hint?: number;
		};
	}

	let {
		grimoire,
		remDrag,
		onRemove,
		hand,
		board,
		size,
		focus,
		focusMode = 'front',
		seatAt,
		ruleAt,
		onRule,
		onHints,
		run: runButton,
		disabled = false,
		dropping = false,
		dropOver = false
	}: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	/** The character whose art a generic copy shows (Trevor, 2026-10-27), if any. */
	const artOf = (look: GenericLook | undefined) =>
		look?.like ? characters.get(look.like.characterId) : undefined;

	const items = $derived(
		bankItems(game, characters, {
			focus,
			focusMode,
			stack: preferences.current.assistance.stackReminders,
			copies: grimoire.copies,
			bankCopies: grimoire.bankCopies
		})
	);
	/**
	 * The bank pulled up by its handle bar (Trevor, 2026-10-30: "a drag up with a handle bar",
	 * one area, not a caret and a second sheet): every token at once (ReminderTray).
	 */
	let binOpen = $state(false);
	/** Every stretch, empty ones too, so each caption is measured before it first shows. */
	const groups = $derived(
		[
			...new Set([...items.map((i) => i.group), ...(Object.keys(BANK_CAPTIONS) as BankGroup[])])
		].map((group) => ({
			key: group,
			caption: BANK_CAPTIONS[group],
			items: items.filter((i) => i.group === group)
		}))
	);
	const dimRest = $derived(focusMode === 'highlight' && items.some((i) => i.now));
	let list = $state<HTMLElement>();
	// A new step's reminders are at the front, or ringed in place: show them.
	$effect(() => {
		void focus;
		void focusMode;
		if (focusMode !== 'highlight') return list?.scrollTo({ left: 0 });
		list?.querySelector('li.now')?.scrollIntoView({ inline: 'center', block: 'nearest' });
	});

	const seatsFor = (item: BankItem) => (item.setup ? traySeats(item.setup.suggestion) : []);
	/** The seats marked for a token in hand, dragged or held. */
	const hintsFor = (item: BankItem, target?: SeatId) => ({
		seats: seatsFor(item),
		target,
		reminder: item.token?.like ?? { characterId: item.characterId, label: item.label }
	});

	function place(
		item: Pick<BankItem, 'characterId' | 'label' | 'ownerSeatId' | 'token'>,
		seatId: SeatId
	) {
		const { characterId, ownerSeatId, token } = item;
		// A copy of an ∞ token takes its words from the token's look, not as a label.
		const label = token ? ('' as ReminderLabel) : item.label;
		return grimoire.run({
			type: 'AddReminder',
			seatId,
			reminder: { characterId, label, ownerSeatId },
			tokenId: token?.tokenId
		});
	}

	// ── Drag a token from the bank onto a seat ──
	let drag = $state<{ item: BankItem; at: SeatPoint; overNew: boolean } | undefined>();
	/** "+ New token" glows while a reminder is dragged, brighter under it (Trevor, 2026-10-27). */
	const newGlow = $derived(
		drag?.overNew || dropOver ? 'over' : drag || dropping ? 'ready' : undefined
	);
	function dragItem(item: BankItem, x: number, y: number, end: boolean, tap = false) {
		if (!board) return;
		const rect = board.getBoundingClientRect();
		const at = { x: ((x - rect.left) / rect.width) * 100, y: ((y - rect.top) / rect.height) * 100 };
		const overNew = overNewToken(x, y);
		const target = overNew ? undefined : seatAt(at, tap);
		if (!end) {
			hand.putDown();
			drag = { item, at, overNew };
			onHints(overNew ? { seats: [] } : hintsFor(item, target));
			return;
		}
		drag = undefined;
		onHints({ seats: [] });
		// On "+ New token": a new ∞ token like it; the reminder stays in the bank.
		if (overNew) return newTokenLike(item);
		const tokenId = item.token?.tokenId;
		const reminder = {
			characterId: item.characterId,
			label: tokenId ? ('' as ReminderLabel) : item.label,
			ownerSeatId: item.ownerSeatId
		};
		// On a Fabled or Loric: it holds the reminder (Trevor, 2026-10-17).
		const rule = ruleAt(x, y, reminder);
		if (rule) return onRule(reminder, rule, tokenId);
		if (!target) return;
		// Any seat will do: the Storyteller can override the suggestion.
		place(item, target);
	}
	function newTokenLike({ characterId, label, token }: BankItem) {
		hand.putDown();
		grimoire.run({ type: 'AddGenericToken', look: copiedLook({ characterId, label, ...token }) });
	}
	function cancelDrag() {
		drag = undefined;
		onHints({ seats: [] });
	}

	// ── Tap: the token is held, and goes where the board is tapped next (Trevor, 2026-10-30) ──
	/** The bank token in hand, if the hand holds one (ReminderHandPill shows it). */
	const held = $derived(hand.held?.kind === 'bank' ? hand.held.item : undefined);
	function tap(item: BankItem) {
		// Taken from the pulled-up bank, it lowers to its row, its tokens still there to see.
		binOpen = false;
		if (!item.makesToken) hand.toggle({ kind: 'bank', item });
		// Holding a reminder, "+ New token" takes it as a drop there does.
		else if (held) newTokenLike(held);
		else makeToken();
	}
	/** Marks the seats for the token in hand, as for one dragged; a board token's are the board's. */
	$effect(() => {
		if (drag || hand.held?.kind === 'placed') return;
		onHints(held ? hintsFor(held) : { seats: [] });
	});
	// A held token that leaves the bank (dragged out, removed, the game moved on) is let go.
	$effect(() => {
		if (held && !items.some((i) => i.key === held.key)) hand.putDown();
	});
	/** A held bank token dropped where the board was tapped, as a drag let go there. */
	function dropAt(item: BankItem, x: number, y: number) {
		dragItem(item, x, y, true, true);
	}
	/** Right-click (desktop): the token in hand, its ⋯ open. Touch keeps hold-to-drag. */
	function menuFor(item: BankItem) {
		if (item.makesToken) return;
		hand.held = { kind: 'bank', item };
		hand.menuOpen = true;
	}

	// ── The bank's reusable ∞ tokens (plan B9) ──
	let editing = $state<string | undefined>();
	let editorOpen = $state(false);
	/** Opens an ∞ token's editor (its ⋯ > Edit token). */
	function editToken(tokenId: string) {
		editing = tokenId;
		editorOpen = true;
	}
	/** A new ∞ token at the end of the others, opened to set its look. */
	function makeToken() {
		if (!grimoire.run({ type: 'AddGenericToken' })) return;
		editing = grimoire.game.genericTokens?.at(-1)?.tokenId;
		editorOpen = true;
	}
</script>

<!-- A token that only shows, while dragged. -->
{#snippet still(item: BankItem)}
	<BoardReminder
		label={item.label}
		character={characters.get(item.characterId)}
		alignment={placingAlignment(game, item, characters)}
		infinite={isGeneric(item)}
		symbol={item.token?.symbol}
		symbolColour={item.token?.symbolColour}
		symbolFill={item.token?.symbolFill}
		art={artOf(item.token)}
		{size}
	/>
{/snippet}

{#snippet token(item: BankItem, panX: boolean)}
	{#if item.makesToken}
		<NewTokenButton glow={newGlow} {size} {disabled} onclick={makeToken} />
	{:else}
		{#if item.count > 1}<ReminderCount count={item.count} />{/if}
		<BoardReminder
			label={item.label}
			character={characters.get(item.characterId)}
			alignment={placingAlignment(game, item, characters)}
			infinite={isGeneric(item)}
			symbol={item.token?.symbol}
			symbolColour={item.token?.symbolColour}
			symbolFill={item.token?.symbolFill}
			art={artOf(item.token)}
			{size}
			{disabled}
			onTap={() => tap(item)}
			onMenu={() => menuFor(item)}
			onDrag={(x, y, end) => dragItem(item, x, y, end)}
			onCancel={cancelDrag}
			{panX}
		/>
	{/if}
{/snippet}

<ReminderTray
	label="Reminder bank"
	binLabel="Reminder bin"
	handleLabel="Every reminder"
	{groups}
	keyOf={(item) => item.key}
	item={token}
	flags={(item) => ({
		lifted: held?.key === item.key || (drag?.item.key === item.key && item.count === 1),
		extra: item.extra,
		now: item.now,
		dim: dimRest && !item.now
	})}
	{size}
	bind:open={binOpen}
	bind:row={list}
	over={board}
	busy={!!drag || !!held}
	lowered={!!drag}
	onEscape={() => {
		if (!hand.held) return false;
		hand.putDown();
		return true;
	}}
>
	{#snippet run()}{#if runButton}<BankRunButton run={runButton} />{/if}{/snippet}
	<ReminderHandPill
		{grimoire}
		{hand}
		{board}
		{remDrag}
		dropBank={dropAt}
		{editToken}
		{onRemove}
		{onHints}
	/>
</ReminderTray>

{#if drag}
	<div class="floating" style:left="{drag.at.x}%" style:top="{drag.at.y}%" aria-hidden="true">
		{@render still(drag.item)}
	</div>
{/if}

<GenericTokenDialog {grimoire} bind:open={editorOpen} tokenId={editing} />

<style>
	.floating {
		position: absolute;
		z-index: 4;
		translate: -50% -50%;
		scale: 1.15;
		pointer-events: none;
	}
</style>
