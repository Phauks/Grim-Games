<script lang="ts">
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import { numberSymbol, symbolNumber, type GenericLook } from '#lib/core/model/index.ts';
	import type { PlayersPhase } from '#lib/core/rules/game-phase.ts';
	import BankToken from '#lib/features/grimoire/BankToken.svelte';
	import BoardReminder from '#lib/features/grimoire/BoardReminder.svelte';
	import {
		playerBankItems,
		type BankGroup,
		type BankItem
	} from '#lib/features/grimoire/bank-items.ts';
	import DeleteTokenConfirm from '#lib/features/grimoire/DeleteTokenConfirm.svelte';
	import GenericLookDialog from '#lib/features/grimoire/GenericLookDialog.svelte';
	import HeldTokenPick from '#lib/features/grimoire/HeldTokenPick.svelte';
	import ReminderAbout from '#lib/features/grimoire/ReminderAbout.svelte';
	import ReminderInHand from '#lib/features/grimoire/ReminderInHand.svelte';
	import ReminderTray from '#lib/features/grimoire/ReminderTray.svelte';
	import { trayFace, type TrayGestures } from '#lib/features/grimoire/tray-gestures.svelte.ts';
	import { dropOnTap } from '#lib/features/grimoire/reminder-in-hand.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import SearchField from '#lib/ui/primitives/SearchField.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import {
		copiesOf,
		isGenericReminder,
		playerLook,
		type PlayerReminder
	} from './player-reminders.ts';
	import { placedAt, placedId } from './player-tray-places.ts';
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
		/**
		 * What the tray does with a finger: the Storyteller bank's own (tray-gestures.svelte.ts),
		 * with this player's tokens (player-tray-places.ts). Its token in hand is `gestures.hand`.
		 */
		gestures: TrayGestures;
		/** The town, which the pulled-up tray covers. */
		town: HTMLElement | undefined;
		/** Reminder diameter in px. */
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
		gestures,
		town,
		chip,
		characterOf,
		disabled = false,
		reminders,
		now
	}: Props = $props();

	const hand = $derived(gestures.hand);
	const lookup = $derived(new Map(characters.map((c) => [c.id, c])));
	$effect(() => reminders.atPhase(now));

	const CAPTIONS: Partial<Record<BankGroup, string>> = {
		guesses: t('player.grim.yourGuesses'),
		reminders: t('player.grim.onTheScript'),
		generic: '∞'
	};
	let query = $state('');
	const items = $derived(playerBankItems(characters, guessed, reminders.tokens, query));
	const groups = $derived(
		(['guesses', 'reminders', 'generic'] as const).map((group) => ({
			key: group,
			caption: CAPTIONS[group],
			items: items.filter((i) => i.group === group)
		}))
	);

	const editedToken = $derived(reminders.tokens.find((t) => t.tokenId === gestures.editing));
	const deletingToken = $derived(reminders.tokens.find((t) => t.tokenId === gestures.deleting));
	const deletingCopies = $derived(deletingToken ? copiesOf(reminders.current, deletingToken) : []);

	// ── The token in hand: from the tray, or picked up off a seat (Trevor, 2026-10-31) ──
	const held = $derived(hand.held);
	const heldKey = $derived(held?.kind === 'bank' ? held.item.key : undefined);
	/** A held token on a seat: where it is. */
	const heldPlaced = $derived(
		held?.kind === 'placed' ? placedAt(reminders, held.reminderId) : undefined
	);
	/** The held token as it would go on a seat. */
	const heldReminder = $derived.by((): PlayerReminder | undefined => {
		if (held?.kind === 'bank')
			return trayFace(held.item, held.item.number ? hand.number : undefined, hand.look);
		return heldPlaced?.reminder;
	});
	// A held token gone from its seat (taken off, moved) is let go, as on the board.
	$effect(() => {
		if (held?.kind === 'placed' && !heldPlaced) hand.putDown();
	});
	// The eye hides the player's reminders: nothing stays in hand.
	$effect(() => {
		if (disabled) hand.putDown();
	});
	// A tap on the tray while a seat's token is in hand takes it off that seat, as the bank
	// takes back a board token (Trevor, 2026-10-30).
	let trayEl = $state<HTMLElement>();
	$effect(() => {
		const el = trayEl;
		if (!el || held?.kind !== 'placed') return;
		return dropOnTap(
			el,
			// The pill's own controls and "+ New token" stay theirs, as on the board.
			(target) => !!target.closest('.grab, [data-testid="reminder-in-hand"], [data-new-token]'),
			(x, y) => gestures.drop(x, y)
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
		if (!heldReminder) return undefined;
		return { seatId: heldPlaced?.seatId, reminder: heldReminder };
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
	/**
	 * The pill's ✎ and trash (Trevor, 2026-11-10, option B): one of the tray's own ∞ tokens is
	 * edited or deleted itself, as the bank's; a token on a seat is edited (an ∞ one) or taken
	 * off there.
	 */
	const actions = $derived.by(() => {
		const label = t('player.grim.editToken');
		const tokenId = held?.kind === 'bank' ? held.item.token?.tokenId : undefined;
		if (tokenId)
			return [
				{ value: 'edit', label, onSelect: () => gestures.editToken(tokenId) },
				{
					value: 'delete',
					label: t('player.grim.deleteGeneric'),
					onSelect: () => gestures.askDelete(tokenId)
				}
			];
		const edit = { value: 'edit', label, onSelect: () => (editOpen = true) };
		// The tray's plain ∞ or #: its words and look before it goes on a seat.
		if (!heldPlaced) return heldReminder && isGenericReminder(heldReminder) ? [edit] : [];
		const takeOff = {
			value: 'remove',
			label: t('player.grim.removeReminder'),
			onSelect: () => remove()
		};
		return isGenericReminder(heldPlaced.reminder) ? [edit, takeOff] : [takeOff];
	});
	/** A held # token's number (plan M48), or which token of a stacked run: in its pill. */
	const heldNumber = $derived(symbolNumber(heldReminder?.symbol));
	const heldRun = $derived(
		held?.kind === 'bank' && held.item.run
			? { labels: held.item.run, label: held.item.label }
			: undefined
	);
	function pickNumber(n: number) {
		const symbol = numberSymbol(n);
		if (held?.kind === 'bank') {
			hand.number = n;
			hand.look = { ...hand.look, symbol };
		} else if (heldPlaced?.reminder.id)
			reminders.setLook(heldPlaced.seatId, heldPlaced.reminder.id, { symbol });
	}
	function pickRun(label: PlayerReminder['label']) {
		if (held?.kind === 'bank') hand.held = { kind: 'bank', item: { ...held.item, label } };
	}
	/** The look being edited, kept on the token in hand or on its seat. */
	function setLook(change: GenericLook) {
		const now = subject;
		if (!now) return;
		if (now.seatId && now.reminder.id) reminders.setLook(now.seatId, now.reminder.id, change);
		if (shown) shown = { ...shown, reminder: { ...now.reminder, ...change } };
		else if (held?.kind === 'bank') hand.look = { ...hand.look, ...change };
	}
	/** Off its seat (or, in hand from the tray, put down). */
	function remove() {
		const now = subject;
		editOpen = false;
		aboutOpen = false;
		if (now?.seatId) gestures.takeOff(placedId(now.seatId, now.reminder));
		else hand.putDown();
		shown = undefined;
	}
</script>

{#snippet tokenView(item: BankItem, inRow: boolean, floating = false)}
	<BankToken
		{item}
		characters={lookup}
		size={chip}
		disabled={floating || disabled}
		glow={gestures.glow}
		onNew={() => gestures.tap(item)}
		onTap={() => gestures.tap(item)}
		onMenu={() => gestures.menuFor(item)}
		onDrag={(x, y, end) => gestures.dragTray(item, x, y, end)}
		onCancel={() => gestures.cancel()}
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
	flags={(item) => ({
		lifted: heldKey === item.key || gestures.trayDrag?.item.key === item.key
	})}
	size={chip}
	inside={{ height: chip + TRAY_EXTRA }}
	bind:open={gestures.open}
	bind:el={trayEl}
	over={town}
	busy={!!gestures.trayDrag || !!held}
	lowered={!!gestures.trayDrag}
	onEscape={() => {
		if (!held) return false;
		hand.putDown();
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
			bind:menuOpen={gestures.hand.menuOpen}
			extra={heldPick}
			onAbout={() => (aboutOpen = true)}
			onPutDown={() => hand.putDown()}
		/>
	{/if}
</ReminderTray>

{#if gestures.trayDrag}
	{@const drag = gestures.trayDrag}
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
	deleteLabel={t('player.grim.removeReminder')}
	tokenKey={subject?.reminder.id ?? 'tray'}
	art={subject?.reminder.like ? characterOf(subject.reminder.like.characterId) : undefined}
	onCountsUp={now ? (countsUp) => setLook({ countsUp }) : undefined}
/>

<GenericLookDialog
	bind:open={gestures.editorOpen}
	look={editedToken}
	onChange={(change) => gestures.editing && reminders.setTokenLook(gestures.editing, change)}
	onDelete={() => gestures.editorDelete()}
	deleteLabel={t('player.grim.deleteGeneric')}
	tokenKey={gestures.editing}
	art={editedToken?.like ? characterOf(editedToken.like.characterId) : undefined}
	fresh={gestures.fresh}
	onConfirm={() => gestures.confirmed()}
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
