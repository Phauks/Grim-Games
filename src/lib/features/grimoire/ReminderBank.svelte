<script lang="ts">
	import type { CharacterId, ReminderLabel } from '#lib/core/data/index.ts';
	import type { GenericLook, Reminder, SeatId } from '#lib/core/model/index.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import type { SeatPoint } from '#lib/ui/seating/seat-layout.ts';
	import BoardReminder from './BoardReminder.svelte';
	import ReminderCount from './ReminderCount.svelte';
	import NewTokenButton from './NewTokenButton.svelte';
	import ReminderBinSheet from './ReminderBinSheet.svelte';
	import { placingAlignment } from './board.ts';
	import type { Grimoire } from './grimoire.svelte.ts';
	import type { StepFocus } from './step-focus.svelte.ts';
	import { boardLooks } from './board-looks.svelte.ts';
	import { copiedLook, isGeneric, type StepReminders } from './reminders.ts';
	import BankSeatChooser from './BankSeatChooser.svelte';
	import SetupReminderDialog from './SetupReminderDialog.svelte';
	import GenericTokenDialog from './GenericTokenDialog.svelte';
	import { traySeats, type TrayItem } from './setup-tray.ts';
	import { BANK_CAPTIONS, bankItems, type BankGroup, type BankItem } from './bank-items.ts';
	import { overNewToken } from './reminder-drag.svelte.ts';

	/**
	 * The reminder bank (Trevor, 2026-10-16), always docked under the board. During setup it
	 * holds core's suggested setup reminders; after that, every reminder of a character in
	 * play still off the board, with the walked-through step's character first and marked.
	 * Drag a token onto any seat, or tap it to choose one. Nothing is placed by itself, and a
	 * reminder removed from a seat comes back. The Storyteller can switch views at any time.
	 */
	interface Props {
		grimoire: Grimoire;
		board: HTMLElement | undefined;
		/** Token diameter in px. */
		size: number;
		/** The character whose night step is being walked through. */
		focus?: StepReminders;
		/** How `focus` is shown (step-focus.svelte.ts). */
		focusMode?: StepFocus['mode'];
		/** The seat under a point (in % of the board), if any. */
		seatAt: (at: SeatPoint) => SeatId | undefined;
		/** Whether a reminder may stay at this client point (not over the bank or buttons). */
		spotAllowed: (x: number, y: number) => boolean;
		/** The Fabled or Loric under a client point, if any. */
		ruleAt: (x: number, y: number, reminder: Reminder) => CharacterId | undefined;
		/**
		 * Gives a Fabled or Loric a new reminder (asking first when it isn't theirs); `tokenId`
		 * when it is a copy of one of the bank's ∞ tokens.
		 */
		onRule: (reminder: Reminder, characterId: CharacterId, tokenId?: string) => void;
		/** Seats to mark while a token is dragged or open, and the one under the drag. */
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
		board,
		size,
		focus,
		focusMode = 'front',
		seatAt,
		spotAllowed,
		ruleAt,
		onRule,
		onHints,
		run,
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
			dismissed: grimoire.trayDismissed,
			focus,
			focusMode,
			stack: preferences.current.assistance.stackReminders,
			copies: grimoire.copies,
			bankCopies: grimoire.bankCopies
		})
	);
	/** The bank pulled up into a sheet of every token at once, under the same captions. */
	let binOpen = $state(false);
	const binGroups = $derived(
		[...new Set(items.map((i) => i.group))].map((group) => ({
			key: group,
			caption: BANK_CAPTIONS[group],
			items: items.filter((i) => i.group === group)
		}))
	);
	const dimRest = $derived(focusMode === 'highlight' && items.some((i) => i.now));
	/** A solid line goes before each stretch but the first. */
	const startsGroup = (i: number) => i > 0 && items[i - 1].group !== items[i].group;

	/**
	 * The captions on the bank's top edge, like the day timer's Timer and Stopwatch (Trevor,
	 * 2026-10-18): one over each captioned stretch, from its line on, kept at the row's start
	 * once the line scrolls past until the next caption reaches it. As shares of the bank's
	 * width.
	 */
	let bankEl = $state<HTMLElement>();
	let list = $state<HTMLElement>();
	const dividers = $state<Partial<Record<BankGroup, HTMLElement>>>({});
	const captionW = $state<Partial<Record<BankGroup, number>>>({});
	let scrolled = $state(0);
	/**
	 * Measured after the bank is drawn (Trevor, 2026-10-22: the ∞ sat over the Reminders, not
	 * its own token): a stretch's line moves once the spacers and token widths are known, so
	 * the captions are placed again whenever those or the bank's size change.
	 */
	let captions = $state<{ group: BankGroup; text: string; left: number }[]>([]);
	let resized = $state(0);
	$effect(() => {
		if (!bankEl || !list) return;
		const observer = new ResizeObserver(() => resized++);
		observer.observe(bankEl);
		observer.observe(list);
		return () => observer.disconnect();
	});
	$effect(() => {
		void items;
		void spacers;
		void resized;
		captions = placeCaptions();
	});
	function placeCaptions(): { group: BankGroup; text: string; left: number }[] {
		const row = list;
		if (!bankEl || !row) return [];
		const width = bankEl.clientWidth || 1;
		const start = row.offsetLeft;
		const pct = (x: number) => (x / width) * 100;
		const placed: { group: BankGroup; text: string; left: number }[] = [];
		const groups = [...new Set(items.map((i) => i.group))];
		groups.forEach((group, i) => {
			const text = BANK_CAPTIONS[group];
			if (!text) return;
			if (i === 0) {
				placed.push({ group, text, left: pct(start) });
				return;
			}
			const divider = dividers[group];
			if (!divider) return;
			const line = start + divider.offsetLeft - scrolled;
			// Once all of it fits in the row, never past the row's end over the Run night button
			// (Trevor, 2026-10-19: Dead players ran into Start game). Its stretch is at least as
			// wide as it (`spacers`), so it always fits over its own tokens.
			const end = start + row.clientWidth;
			if (line + gap + (captionW[group] ?? 0) > end) return;
			placed.push({ group, text, left: pct(Math.max(start, line)) });
		});
		// A caption goes once the next one reaches it, so no two overlap (Trevor, 2026-10-19).
		return placed.filter((c, i) => {
			const next = placed[i + 1];
			return !next || next.left >= c.left + pct(gap + (captionW[c.group] ?? 0));
		});
	}
	/** The tray's gap, which is also each caption's inset from its line (both `--space-2`). */
	const gap = $derived(list ? parseFloat(getComputedStyle(list).columnGap) || 0 : 0);
	/** Each token's width in the bank, to size its stretch. */
	const itemW = $state<Record<string, number>>({});
	/**
	 * Room added after a captioned stretch narrower than its caption, so the caption sits over
	 * its own tokens (Trevor, 2026-10-19: Dead players over one token ran over the ∞). A margin
	 * on the stretch's last token, so the list holds only tokens.
	 */
	const spacers = $derived.by(() => {
		const out: Partial<Record<BankGroup, number>> = {};
		for (const group of Object.keys(BANK_CAPTIONS) as BankGroup[]) {
			const own = items.filter((i) => i.group === group);
			const caption = captionW[group];
			if (own.length === 0 || caption === undefined) continue;
			const tokens = own.reduce((n, i) => n + (itemW[i.key] ?? 0), 0);
			const room = caption - tokens - own.length * gap;
			if (room > 0) out[group] = room;
		}
		return out;
	});
	const endsGroup = (i: number) => i === items.length - 1 || items[i + 1].group !== items[i].group;
	/** More tokens off either end of the row: its edge fades (Trevor, 2026-10-19). */
	let more = $state({ start: false, end: false });
	function measure() {
		if (!list) return;
		const { scrollLeft, clientWidth, scrollWidth } = list;
		more = { start: scrollLeft > 1, end: scrollLeft + clientWidth < scrollWidth - 1 };
	}
	$effect(() => {
		void items;
		if (!list) return;
		const observer = new ResizeObserver(measure);
		observer.observe(list);
		measure();
		return () => observer.disconnect();
	});
	// A new step's reminders are at the front, or ringed in place: show them.
	$effect(() => {
		void focus;
		void focusMode;
		if (focusMode !== 'highlight') return list?.scrollTo({ left: 0 });
		list?.querySelector('li.now')?.scrollIntoView({ inline: 'center', block: 'nearest' });
	});

	const seatsFor = (item: BankItem) => (item.setup ? traySeats(item.setup.suggestion) : []);

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

	/**
	 * Loose mode ("stay where dropped", Trevor 2026-10-18): nothing is given to a seat. A
	 * token goes where it is dropped, seats are not marked, and a tap doesn't offer seats.
	 */
	const loose = $derived(boardLooks.current.reminders === 'free');

	// ── End night lights up when Next is tapped past the last step ──
	let hinting = $state(false);
	$effect(() => {
		if (!run?.hint) return;
		// Off for a frame first, so a second tap starts the pulse again.
		hinting = false;
		let off: ReturnType<typeof setTimeout> | undefined;
		const on = requestAnimationFrame(() => {
			hinting = true;
			off = setTimeout(() => (hinting = false), 2000);
		});
		return () => {
			cancelAnimationFrame(on);
			clearTimeout(off);
		};
	});

	// ── Drag a token from the bank onto a seat ──
	let drag = $state<{ item: BankItem; at: SeatPoint; overNew: boolean } | undefined>();
	/** "+ New token" glows while a reminder is dragged, brighter under it (Trevor, 2026-10-27). */
	const newGlow = $derived(
		drag?.overNew || dropOver ? 'over' : drag || dropping ? 'ready' : undefined
	);
	function dragItem(item: BankItem, x: number, y: number, end: boolean) {
		if (!board) return;
		const rect = board.getBoundingClientRect();
		const at = { x: ((x - rect.left) / rect.width) * 100, y: ((y - rect.top) / rect.height) * 100 };
		const overNew = overNewToken(x, y);
		const target = overNew ? undefined : seatAt(at);
		if (!end) {
			drag = { item, at, overNew };
			onHints(
				loose || overNew
					? { seats: [] }
					: {
							seats: seatsFor(item),
							target,
							reminder: item.token?.like ?? { characterId: item.characterId, label: item.label }
						}
			);
			return;
		}
		drag = undefined;
		onHints({ seats: [] });
		// On "+ New token": a new ∞ token like it; the reminder stays in the bank.
		if (overNew) {
			grimoire.run({
				type: 'AddGenericToken',
				look: copiedLook({ characterId: item.characterId, label: item.label, ...item.token })
			});
			return;
		}
		const tokenId = item.token?.tokenId;
		const reminder = {
			characterId: item.characterId,
			label: tokenId ? ('' as ReminderLabel) : item.label,
			ownerSeatId: item.ownerSeatId
		};
		// On a Fabled or Loric: it holds the reminder (Trevor, 2026-10-17).
		const rule = ruleAt(x, y, reminder);
		if (rule) return onRule(reminder, rule, tokenId);
		const free = loose && spotAllowed(x, y);
		// Loose mode: anywhere in the board's open area, seats too; it belongs to no one.
		if (loose) {
			if (free && grimoire.run({ type: 'PlaceLooseReminder', reminder, tokenId })) {
				const added = grimoire.game.looseReminders?.at(-1);
				if (added) grimoire.setReminderSpot(added.reminderId, at);
			}
			return;
		}
		if (!target) return;
		// Any seat will do: the Storyteller can override the suggestion.
		place(item, target);
	}
	function cancelDrag() {
		drag = undefined;
		onHints({ seats: [] });
	}

	// ── Tap: a setup suggestion says what it is for; any other token asks for a seat ──
	let shown = $state<TrayItem | undefined>();
	let shownOpen = $state(false);
	let choosing = $state<BankItem | undefined>();
	let chooserOpen = $state(false);
	function tap(item: BankItem) {
		if (item.makesToken) return makeToken();
		if (item.setup) {
			shown = item.setup;
			shownOpen = true;
			if (!loose)
				onHints({
					seats: seatsFor(item),
					reminder: { characterId: item.characterId, label: item.label }
				});
		} else if (!loose) {
			choosing = item;
			chooserOpen = true;
		}
	}
	$effect(() => {
		if (!shownOpen && !drag) onHints({ seats: [] });
	});

	// ── The bank's reusable ∞ tokens (plan B9) ──
	let editing = $state<string | undefined>();
	let editorOpen = $state(false);
	/** A new ∞ token at the end of the others, opened to set its look. */
	function makeToken() {
		if (!grimoire.run({ type: 'AddGenericToken' })) return;
		editing = grimoire.game.genericTokens?.at(-1)?.tokenId;
		editorOpen = true;
	}
	function placeShown(seatId: SeatId) {
		if (shown) place(shown.suggestion, seatId);
		shownOpen = false;
	}
	function dismissShown() {
		if (shown) grimoire.dismissTray(shown.key);
		shownOpen = false;
	}
</script>

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
			onDrag={(x, y, end) => dragItem(item, x, y, end)}
			onCancel={cancelDrag}
			{panX}
		/>
	{/if}
{/snippet}

<div class="bank" data-tray bind:this={bankEl}>
	<!-- Every caption measured from the start, hidden, so each stretch has its room before its
	     caption first shows (a caption measured only once shown widened the row as it was
	     scrolled to its end). -->
	{#each Object.entries(BANK_CAPTIONS) as [group, text] (group)}<span
			class="caption measure"
			data-group={group}
			aria-hidden="true"
			bind:offsetWidth={captionW[group as BankGroup]}>{text}</span
		>{/each}
	{#each captions as caption (caption.group)}<span
			class="caption"
			data-group={caption.group}
			data-testid="bank-{caption.group}"
			style:left="{caption.left}%">{caption.text}</span
		>{/each}
	<ul
		class="tray"
		bind:this={list}
		aria-label="Reminder bank"
		data-more-start={more.start || undefined}
		data-more-end={more.end || undefined}
		onscroll={(e) => {
			scrolled = e.currentTarget.scrollLeft;
			measure();
		}}
	>
		{#each items as item, i (item.key)}
			{#if startsGroup(i)}<li
					class="divider"
					aria-hidden="true"
					bind:this={dividers[item.group]}
				></li>{/if}
			<li
				bind:offsetWidth={itemW[item.key]}
				class:lifted={drag?.item.key === item.key && item.count === 1}
				class:extra={item.extra}
				data-extra={item.extra ? '' : undefined}
				class:now={item.now}
				class:dim={dimRest && !item.now}
				style:margin-inline-end={endsGroup(i) && spacers[item.group]
					? `${spacers[item.group]}px`
					: undefined}
			>
				{@render token(item, true)}
			</li>
		{:else}
			<li class="none">None</li>
		{/each}
	</ul>
	<!-- Pulls the bank up into a sheet of every token (Trevor, 2026-10-29), its own cell at the
	     tray's end: clear of the captions, and not on the run button (Trevor: "a drag above the
	     red button is bad placement"). -->
	<button
		type="button"
		class="pull-up"
		aria-label="Show every reminder"
		aria-pressed={binOpen}
		data-bin-opener
		onclick={() => (binOpen = !binOpen)}><Icon name="expand" /></button
	>
	{#if run}
		<!-- Rounded on the right like the box. -->
		<button
			type="button"
			class="run"
			aria-label={run.label}
			data-hint={hinting ? '' : undefined}
			disabled={run.disabled}
			onclick={run.onclick}
		>
			<Icon name={run.icon} />
			<span>{run.text}</span>
		</button>
	{/if}
</div>

<ReminderBinSheet
	bind:open={binOpen}
	label="Reminder bin"
	groups={binGroups}
	keyOf={(item) => item.key}
	lowered={!!drag}
>
	{#snippet item(item)}{@render token(item, false)}{/snippet}
</ReminderBinSheet>

{#if drag}
	<div class="floating" style:left="{drag.at.x}%" style:top="{drag.at.y}%" aria-hidden="true">
		<BoardReminder
			label={drag.item.label}
			character={characters.get(drag.item.characterId)}
			alignment={placingAlignment(game, drag.item, characters)}
			infinite={isGeneric(drag.item)}
			symbol={drag.item.token?.symbol}
			symbolColour={drag.item.token?.symbolColour}
			symbolFill={drag.item.token?.symbolFill}
			art={artOf(drag.item.token)}
			{size}
			disabled
			onTap={() => {}}
		/>
	</div>
{/if}

<BankSeatChooser
	{grimoire}
	bind:open={chooserOpen}
	item={choosing}
	onChoose={(seatId) => {
		chooserOpen = false;
		if (choosing) place(choosing, seatId);
		choosing = undefined;
	}}
	onDone={() => {
		chooserOpen = false;
		choosing = undefined;
	}}
	onEditToken={(tokenId) => {
		chooserOpen = false;
		editing = tokenId;
		editorOpen = true;
	}}
/>

<GenericTokenDialog {grimoire} bind:open={editorOpen} tokenId={editing} />

<SetupReminderDialog
	{grimoire}
	bind:open={shownOpen}
	{shown}
	{loose}
	onPlace={placeShown}
	onDismiss={dismissShown}
	onChooseSeat={() => {
		const s = shown?.suggestion;
		shownOpen = false;
		if (s) {
			choosing = {
				key: shown!.key,
				characterId: s.characterId,
				label: s.label,
				count: 1,
				group: 'setup'
			};
			chooserOpen = true;
		}
	}}
/>

<style>
	/* Docked under the board (Trevor, 2026-10-16): a strip of tokens that scrolls sideways
	   within itself, so the seats stay uncovered. The board leaves room for it. */
	.bank {
		position: absolute;
		left: 0;
		right: 0;
		top: calc(100% + var(--space-2));
		z-index: 2;
		display: flex;
		align-items: center;
		height: var(--tray-h);
		box-sizing: border-box;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--board-bar-background);
	}
	.run {
		flex: none;
		align-self: stretch;
		display: grid;
		place-items: center;
		align-content: center;
		gap: var(--space-1);
		width: 5.5rem;
		padding: 0 var(--space-1);
		border: 0;
		border-inline-start: 1px solid var(--border);
		border-start-end-radius: calc(var(--radius-md) - 1px);
		border-end-end-radius: calc(var(--radius-md) - 1px);
		background: var(--accent);
		/* The buttons' edge, so it never blends into the bank (Trevor, 2026-10-22). */
		box-shadow: inset 0 0 0 1px var(--accent-edge);
		color: var(--on-accent);
		font: 600 0.8rem var(--font-control);
		cursor: pointer;
	}
	.run :global(svg) {
		width: 1.6em;
		height: 1.6em;
	}
	/* Next past the last step points here (Trevor, 2026-10-19): a ring that pulses, or just
	   shows under reduced motion (the duration tokens are 0ms then). An inset ring on the
	   cell's own edge, so it follows its rounded corners (Trevor, 2026-10-20: it sat in from
	   the edges). */
	.run[data-hint] {
		box-shadow: inset 0 0 0 0.2rem var(--on-accent);
		animation: end-hint var(--duration-slow) ease-in-out 4 alternate;
	}
	@keyframes end-hint {
		to {
			box-shadow: inset 0 0 0 0.2rem transparent;
		}
	}
	.run:disabled {
		background: none;
		color: var(--on-surface-muted);
		cursor: default;
	}
	/*
	 * On the bank's top edge, half over the board, so it is the seat name's pill (PlayerNameMark):
	 * a band of the bank's own see-through colour didn't match every board background (Trevor,
	 * 2026-10-23).
	 */
	.caption {
		position: absolute;
		top: 0;
		z-index: 3;
		/* Every pill as tall as the ∞ one (Trevor, 2026-10-27), its words centred in it. */
		display: flex;
		align-items: center;
		height: calc(0.65rem * 1.6);
		margin-left: var(--space-2);
		padding: 0 var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-full);
		background: var(--surface-raised);
		color: var(--on-surface-muted);
		font: 600 0.65rem / 1 var(--font-control);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		white-space: nowrap;
		pointer-events: none;
		transform: translateY(-50%);
	}
	/*
	 * The ∞ as tall as the other captions' capitals (Trevor, 2026-10-19). Measured in Cinzel:
	 * its ink is about 0.62 of a capital's height, so 1.6 times the size matches them.
	 */
	.caption.measure {
		left: 0;
		visibility: hidden;
	}
	.caption[data-group='generic'] {
		font-size: calc(0.65rem * 1.6);
		letter-spacing: 0;
	}
	.tray {
		flex: 1;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
		height: 100%;
		box-sizing: border-box;
		margin: 0;
		padding: var(--space-1) var(--space-2);
		overflow-x: auto;
		overflow-y: hidden;
		overscroll-behavior: contain;
		/* Scrolls by swipe or wheel; no bar drawn over the tokens (Trevor, 2026-10-16). */
		scrollbar-width: none;
		list-style: none;
	}
	.tray::-webkit-scrollbar {
		display: none;
	}
	/* More tokens past an edge: that edge fades out, drawn over nothing so nothing moves. */
	.tray {
		--fade: calc(1.5 * var(--u));
		--shown: rgb(0 0 0); /* colour-ok: a mask's opacity, not a colour */
	}
	.tray[data-more-start] {
		mask-image: linear-gradient(to right, transparent, var(--shown) var(--fade));
	}
	.tray[data-more-end] {
		mask-image: linear-gradient(to left, transparent, var(--shown) var(--fade));
	}
	.tray[data-more-start][data-more-end] {
		mask-image: linear-gradient(
			to right,
			transparent,
			var(--shown) var(--fade),
			var(--shown) calc(100% - var(--fade)),
			transparent
		);
	}
	/* The walked-through step's reminders, at the front: a ring that hugs the round token. */
	li.now > :global(.reminder) {
		/* A ring, glow or both, as set in Settings > Tokens (Trevor, 2026-10-20). */
		outline: var(--reminder-lit-ring, 0.2rem solid var(--accent));
		outline-offset: 0.15rem;
		filter: var(--reminder-lit-glow, none);
	}
	.tray > li {
		flex: none;
		/* Room for the name band, which is wider than the token. */
		padding-inline: 0.75rem;
	}
	li {
		display: grid;
		place-items: center;
		/* Room for the label band under each token. */
		padding-bottom: calc(0.375 * var(--u));
	}
	li.lifted {
		opacity: 0.3;
	}
	/* A copy beyond what the game gives, as the board marks it (GrimoireBoard .chip-slot.extra). */
	li.extra > :global(.reminder) {
		outline: 0.15rem dashed var(--on-surface);
		outline-offset: 0.15rem;
		opacity: 0.75;
	}
	/* Highlight: everything but the step's reminders fades back. */
	li.dim {
		opacity: 0.4;
	}
	.tray > li {
		position: relative;
	}
	/* Between the setup reminders and the rest, in All: a solid line (Trevor, 2026-10-16). */
	.tray > li.divider {
		align-self: stretch;
		padding: 0;
		border-inline-start: 1px solid var(--on-surface-muted);
	}
	.none {
		color: var(--on-surface-muted);
	}
	/* A cell between the tokens and the run button, so the sheet, which opens over the board
	   only, leaves the bank, its run button and the night strip in place (Trevor, 2026-10-29:
	   "where the night order button goes"). */
	.pull-up {
		flex: none;
		align-self: stretch;
		display: grid;
		place-items: center;
		width: var(--tap-target);
		padding: 0;
		border: 0;
		border-inline-start: 1px solid var(--border);
		background: none;
		color: var(--on-surface);
		cursor: pointer;
	}
	.pull-up :global(svg) {
		rotate: 180deg;
		transition: rotate var(--duration-fast) ease;
	}
	.pull-up[aria-pressed='true'] :global(svg) {
		rotate: 0deg;
	}
	.floating {
		position: absolute;
		z-index: 4;
		translate: -50% -50%;
		scale: 1.15;
		pointer-events: none;
	}
</style>
