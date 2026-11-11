<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Reminder, SeatId } from '#lib/core/model/index.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import BoardReminder from '#lib/features/board/BoardReminder.svelte';
	import BankToken from '#lib/features/board/BankToken.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import SearchField from '#lib/ui/primitives/SearchField.svelte';
	import BankRunButton from './BankRunButton.svelte';
	import { reminderPlacing } from './board.ts';
	import type { Grimoire } from './grimoire.svelte.ts';
	import type { StepFocus } from '#lib/features/board/step-focus.svelte.ts';
	import {
		isGeneric,
		looksLike,
		onBoard,
		type StepReminders
	} from '#lib/features/board/reminders.ts';
	import DeleteTokenConfirm from './DeleteTokenConfirm.svelte';
	import GenericTokenDialog from './GenericTokenDialog.svelte';
	import type { TrayGestures } from '#lib/features/board/tray-gestures.svelte.ts';
	import ReminderHandPill from './ReminderHandPill.svelte';
	import ReminderTray from './ReminderTray.svelte';
	import { traySeats } from '#lib/features/board/setup-tray.ts';
	import {
		BANK_CAPTIONS,
		searchBank,
		bankItems,
		bankView,
		type BankGroup,
		type BankItem
	} from '#lib/features/board/bank-items.ts';

	/**
	 * The reminder bank (Trevor, 2026-10-16), always docked under the board. During setup it
	 * holds core's suggested setup reminders; after that, every reminder of a character in
	 * play still off the board, with the walked-through step's character first and marked.
	 * Drag a token onto any seat, or tap it to hold it and then tap a seat (Trevor, 2026-10-30).
	 * Nothing is placed by itself, and a reminder removed from a seat comes back. The Storyteller can switch views at any time.
	 */
	interface Props {
		grimoire: Grimoire;
		/**
		 * What the bank does with a finger, shared with a player's tray (tray-gestures.svelte.ts):
		 * its token in hand, drags, "+ New token", the ∞ token editor and Delete's question.
		 */
		gestures: TrayGestures;
		board: HTMLElement | undefined;
		/** Token diameter in px. */
		size: number;
		/** The character whose night step is being walked through. */
		focus?: StepReminders;
		/** How `focus` is shown (step-focus.svelte.ts). */
		focusMode?: StepFocus['mode'];
		/** Seats to mark: suggested ones, the one under a dragged token, and the token itself. */
		onHints: (hints: { seats: SeatId[]; target?: SeatId; reminder?: Reminder }) => void;
		/** A spectator's board (Trevor, 2026-10-19): every token shown, none taken. */
		disabled?: boolean;
		/**
		 * At the bank's right end (Trevor, 2026-10-18): the game's next phase (Set up, Start game,
		 * End night, End day, or Run night to pick a stopped walk-through up). Always there, so the
		 * bank never moves. `hint`: a count; each rise lights it up for a moment.
		 */
		run?: {
			/** Its accessible name, and the shorter words shown. */
			label: string;
			text: string;
			icon: 'bag' | 'day' | 'night' | 'check';
			disabled: boolean;
			onclick: () => void;
			hint?: number;
		};
		/** Over the bank where the token in hand shows: the board's Execution bar. */
		children?: Snippet;
	}

	let {
		grimoire,
		gestures,
		board,
		size,
		focus,
		focusMode = 'front',
		onHints,
		run: runButton,
		disabled = false,
		children
	}: Props = $props();

	const hand = $derived(gestures.hand);
	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);

	/** Pulled up, a search narrows it, as a player's tray (Trevor, 2026-11-06: one tray). */
	let query = $state('');
	const all = $derived(
		bankItems(game, characters, {
			focus,
			focusMode,
			stack: preferences.current.assistance.stackReminders,
			copies: grimoire.copies,
			bankCopies: grimoire.bankCopies
		})
	);
	const items = $derived(searchBank(all, characters, query));
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
	/** Marks the seats for a bank token dragged (GrimoireBoard's `TrayPlaces.hint`). */
	export function hint(item: BankItem | undefined, target?: SeatId): void {
		onHints(item ? hintsFor(item, target) : { seats: [] });
	}

	/** The bank token in hand, if the hand holds one (ReminderHandPill shows it). */
	const held = $derived(hand.held?.kind === 'bank' ? hand.held.item : undefined);
	/**
	 * A night step's reminder taken from the step (Trevor, 2026-11-06: back to the board, not a
	 * list of players): its bank token in hand, as if tapped here. False when the bank has none.
	 */
	export function hold(reminder: Pick<Reminder, 'characterId' | 'label'>): boolean {
		const mine = all.filter((i) => !i.token && !i.number && i.characterId === reminder.characterId);
		const item =
			mine.find((i) => i.label === reminder.label) ??
			mine.find((i) => i.run?.includes(reminder.label));
		if (!item) return false;
		gestures.open = false;
		hand.hold({ kind: 'bank', item });
		return true;
	}
	/** Marks the seats for the token in hand, as for one dragged; a board token's are the board's. */
	$effect(() => {
		if (gestures.trayDrag || hand.held?.kind === 'placed') return;
		onHints(held ? hintsFor(held) : { seats: [] });
	});
	// A held token that leaves the bank (dragged out, removed, the game moved on) is let go.
	$effect(() => {
		if (held && !all.some((i) => i.key === held.key)) hand.putDown();
	});

	// ── Deleting one of its ∞ tokens: how many copies are on the board ──
	const deletingToken = $derived(game.genericTokens.find((t) => t.tokenId === gestures.deleting));
	const deletingCopies = $derived(
		deletingToken ? onBoard(game).filter((r) => isGeneric(r) && looksLike(r, deletingToken)) : []
	);
</script>

<!-- A token that only shows, while dragged. -->
{#snippet still(item: BankItem)}
	<BoardReminder
		{...bankView(item, characters)}
		{...reminderPlacing(game, item, characters)}
		{size}
	/>
{/snippet}

{#snippet token(item: BankItem, panX: boolean)}
	<BankToken
		{item}
		{characters}
		placing={item.makesToken ? undefined : reminderPlacing(game, item, characters)}
		{size}
		{disabled}
		glow={gestures.glow}
		onNew={() => gestures.tap(item)}
		onTap={() => gestures.tap(item)}
		onMenu={() => gestures.menuFor(item)}
		onDrag={(x, y, end) => gestures.dragTray(item, x, y, end)}
		onCancel={() => gestures.cancel()}
		{panX}
	/>
{/snippet}

<ReminderTray
	label="Reminder bank"
	binLabel="Reminder bin"
	handleLabel="Every reminder"
	{groups}
	keyOf={(item) => item.key}
	item={token}
	flags={(item) => ({
		lifted:
			held?.key === item.key || (gestures.trayDrag?.item.key === item.key && item.count === 1),
		extra: item.extra,
		now: item.now,
		dim: dimRest && !item.now
	})}
	{size}
	bind:open={gestures.open}
	bind:row={list}
	over={board}
	busy={!!gestures.trayDrag || !!held}
	lowered={!!gestures.trayDrag}
	onEscape={() => {
		if (!hand.held) return false;
		hand.putDown();
		return true;
	}}
>
	{#snippet header()}<SearchField
			label={t('common.searchReminders')}
			bind:value={query}
		/>{/snippet}
	{#snippet run()}{#if runButton}<BankRunButton run={runButton} />{/if}{/snippet}
	<ReminderHandPill {grimoire} {gestures} {board} {onHints} />
	{@render children?.()}
</ReminderTray>

{#if gestures.trayDrag}
	{@const drag = gestures.trayDrag}
	<div class="floating" style:left="{drag.at.x}%" style:top="{drag.at.y}%" aria-hidden="true">
		{@render still(drag.item)}
	</div>
{/if}

<GenericTokenDialog
	{grimoire}
	bind:open={gestures.editorOpen}
	tokenId={gestures.editing}
	fresh={gestures.fresh}
	onConfirm={() => gestures.confirmed()}
	onDelete={(tokenId) => gestures.askDelete(tokenId)}
	onDuplicate={(look) => gestures.duplicate(look)}
/>
<DeleteTokenConfirm
	bind:open={gestures.deleteOpen}
	look={deletingToken}
	copies={deletingCopies.length}
	onConfirm={(withCopies) => gestures.deleteConfirmed(withCopies)}
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
