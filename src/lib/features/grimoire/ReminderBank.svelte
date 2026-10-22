<script lang="ts">
	import type { CharacterId, ReminderLabel } from '#lib/core/data/index.ts';
	import type { Reminder, SeatId } from '#lib/core/model/index.ts';
	import { characterNames } from '#lib/core/rules/character-names.ts';
	import { deadCharacters, prepTextSegments } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import type { SeatPoint } from '#lib/ui/seating/seat-layout.ts';
	import BoardReminder from './BoardReminder.svelte';
	import ReminderCount from './ReminderCount.svelte';
	import { placingAlignment } from './board.ts';
	import type { Grimoire } from './grimoire.svelte.ts';
	import type { StepFocus } from './step-focus.svelte.ts';
	import { boardLooks } from './board-looks.svelte.ts';
	import {
		bankOwners,
		bankReminders,
		byLabel,
		isGeneric,
		type StepReminders
	} from './reminders.ts';
	import { GENERIC_REMINDER_ID, scriptCharacterIds } from '#lib/core/model/index.ts';
	import SeatChooser from './SeatChooser.svelte';
	import ReminderMoreButton from './ReminderMoreButton.svelte';
	import { pendingSetup, traySeats, type TrayItem } from './setup-tray.ts';

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
		/** Gives a Fabled or Loric a new reminder (asking first when it isn't theirs). */
		onRule: (reminder: Reminder, characterId: CharacterId) => void;
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
		 * While a seat's token is held (Trevor, 2026-10-19): whether a token is one of its
		 * character's; those light up and the rest dim.
		 */
		lit?: (item: Pick<Reminder, 'characterId' | 'ownerSeatId'>) => boolean;
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
		lit,
		seatAt,
		spotAllowed,
		ruleAt,
		onRule,
		onHints,
		run,
		disabled = false
	}: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const names = $derived(characterNames([...characters.values()]));

	/**
	 * The bank's stretches, left to right (Trevor, 2026-10-19): Setup (what the Storyteller
	 * sees first), Reminders, the generic ∞ in a cell of its own, then the reminders of
	 * characters whose players are all dead and whose ability ended with them.
	 */
	type Group = 'setup' | 'reminders' | 'generic' | 'dead';
	const CAPTIONS: Partial<Record<Group, string>> = {
		setup: 'Setup',
		reminders: 'Reminders',
		// Over the generic reminder's cell (Trevor, 2026-10-19).
		generic: '∞',
		dead: 'Dead players'
	};

	/** One token in the bank: a setup suggestion, or a reminder still off the board. */
	interface Item {
		key: string;
		characterId: CharacterId;
		label: ReminderLabel;
		/** Shown once with ×count when "Stack duplicate reminders" is on. */
		count: number;
		setup?: TrayItem;
		/** Whose copy it is, when its character is on more than one seat (`bankOwners`). */
		ownerSeatId?: SeatId;
		/** Used by the walked-through step tonight. */
		now?: boolean;
		/** Its stretch of the bank, each set off by a line. */
		group: Group;
	}

	// Script order, then reminder name (Trevor, 2026-10-16), like every reminder list.
	const scriptOrder = $derived(scriptCharacterIds(game.script));
	const at = (id: CharacterId) => {
		const i = scriptOrder.indexOf(id);
		return i < 0 ? scriptOrder.length : i;
	};
	const setupItems = $derived(
		pendingSetup(game, characters, grimoire.trayDismissed).sort(
			(a, b) =>
				at(a.suggestion.characterId) - at(b.suggestion.characterId) ||
				byLabel(a.suggestion.label, b.suggestion.label)
		)
	);
	const items = $derived.by((): Item[] => {
		const stack = preferences.current.assistance.stackReminders;
		const nowFor = (characterId: CharacterId, label: string) =>
			focus?.characterId === characterId && focus.labels.includes(label);
		const setup: Item[] = [];
		for (const item of setupItems) {
			const { characterId, label } = item.suggestion;
			const same = stack
				? setup.find((i) => i.characterId === characterId && i.label === label)
				: undefined;
			if (same) same.count += 1;
			else
				setup.push({
					key: item.key,
					characterId,
					label,
					count: 1,
					setup: item,
					now: nowFor(characterId, label),
					group: 'setup'
				});
		}
		// The setup reminders too (Trevor, 2026-10-17: the first night opens on Setup).
		if (focusMode === 'front') setup.sort((a, b) => Number(!!b.now) - Number(!!a.now));
		// The setup reminders still to place come first, captioned "Setup" (Trevor, 2026-10-18:
		// no Setup/All switch), then a solid line and every other copy still off the board.
		const pending: Record<string, number> = {};
		for (const item of setupItems) {
			// eslint-disable-next-line grim/names-as-badges -- an identity key, never shown
			const k = `${item.suggestion.characterId}:${item.suggestion.label}`;
			pending[k] = (pending[k] ?? 0) + 1;
		}
		const dead = deadCharacters(game, characters);
		const rest = bankReminders(
			game,
			characters,
			focus,
			focusMode === 'front',
			grimoire.copies,
			grimoire.bankCopies
		).flatMap(({ characterId, label, left, now }) => {
			const key = `${characterId}:${label}`;
			const n = left - (pending[key] ?? 0);
			if (n <= 0) return [];
			const group: Group = dead.has(characterId) ? 'dead' : 'reminders';
			// Each seat's own copies, when the character is on more than one (Trevor, 2026-10-19).
			const owners = bankOwners(game, characters, { characterId, label }, n, grimoire.copies);
			return owners.flatMap(({ ownerSeatId, count }) => {
				const k = ownerSeatId === undefined ? key : `${key}:${ownerSeatId}`;
				// Prefixed: a setup suggestion's key has the same shape (setup-tray.ts).
				if (stack)
					return [{ key: `bank:${k}`, characterId, label, ownerSeatId, count, now, group }];
				return Array.from({ length: count }, (_, i) => ({
					key: `bank:${k}:${i}`,
					characterId,
					label,
					ownerSeatId,
					count: 1,
					now,
					group
				}));
			});
		});
		// The generic ∞ reminder, as many as needed (Trevor, 2026-10-18), after the reminders.
		const generic: Item = {
			key: 'generic',
			characterId: GENERIC_REMINDER_ID,
			label: '',
			count: 1,
			group: 'generic'
		};
		return only([
			...setup,
			...rest.filter((i) => i.group === 'reminders'),
			generic,
			...rest.filter((i) => i.group === 'dead')
		]);
	});
	/** "Only this character": the step's reminders alone, while a step is walked through. */
	function only(list: Item[]): Item[] {
		return focus && focusMode === 'only' ? list.filter((i) => i.now) : list;
	}
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
	const dividers = $state<Partial<Record<Group, HTMLElement>>>({});
	const captionW = $state<Partial<Record<Group, number>>>({});
	let scrolled = $state(0);
	const captions = $derived.by((): { group: Group; text: string; left: number }[] => {
		void items;
		const row = list;
		if (!bankEl || !row) return [];
		const width = bankEl.clientWidth || 1;
		const start = row.offsetLeft;
		const pct = (x: number) => (x / width) * 100;
		const placed: { group: Group; text: string; left: number }[] = [];
		const groups = [...new Set(items.map((i) => i.group))];
		groups.forEach((group, i) => {
			const text = CAPTIONS[group];
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
	});
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
		const out: Partial<Record<Group, number>> = {};
		for (const group of Object.keys(CAPTIONS) as Group[]) {
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

	const seatName = (seatId: SeatId) =>
		game.seats[seatId]?.playerName ?? `Seat ${game.seating.indexOf(seatId) + 1}`;
	const seatsFor = (item: Item) => (item.setup ? traySeats(item.setup.suggestion) : []);

	function place(item: Pick<Item, 'characterId' | 'label' | 'ownerSeatId'>, seatId: SeatId) {
		const { characterId, label, ownerSeatId } = item;
		return grimoire.run({
			type: 'AddReminder',
			seatId,
			reminder: { characterId, label, ownerSeatId }
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
	let drag = $state<{ item: Item; at: SeatPoint } | undefined>();
	function dragItem(item: Item, x: number, y: number, end: boolean) {
		if (!board) return;
		const rect = board.getBoundingClientRect();
		const at = { x: ((x - rect.left) / rect.width) * 100, y: ((y - rect.top) / rect.height) * 100 };
		const target = seatAt(at);
		if (!end) {
			drag = { item, at };
			onHints(
				loose
					? { seats: [] }
					: {
							seats: seatsFor(item),
							target,
							reminder: { characterId: item.characterId, label: item.label }
						}
			);
			return;
		}
		drag = undefined;
		onHints({ seats: [] });
		const reminder = {
			characterId: item.characterId,
			label: item.label,
			ownerSeatId: item.ownerSeatId
		};
		// On a Fabled or Loric: it holds the reminder (Trevor, 2026-10-17).
		const rule = ruleAt(x, y, reminder);
		if (rule) return onRule(reminder, rule);
		const free = loose && spotAllowed(x, y);
		// Loose mode: anywhere in the board's open area, seats too; it belongs to no one.
		if (loose) {
			if (free && grimoire.run({ type: 'PlaceLooseReminder', reminder })) {
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
	let choosing = $state<Item | undefined>();
	let chooserOpen = $state(false);
	function tap(item: Item) {
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
	function placeShown(seatId: SeatId) {
		if (shown) place(shown.suggestion, seatId);
		shownOpen = false;
	}
	function dismissShown() {
		if (shown) grimoire.dismissTray(shown.key);
		shownOpen = false;
	}
</script>

<div class="bank" data-tray bind:this={bankEl}>
	{#each captions as caption (caption.group)}<span
			class="caption"
			data-group={caption.group}
			data-testid="bank-{caption.group}"
			bind:offsetWidth={captionW[caption.group]}
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
				class:now={item.now || lit?.(item)}
				class:dim={lit ? !lit(item) : dimRest && !item.now}
				data-lit={lit?.(item) || undefined}
				style:margin-inline-end={endsGroup(i) && spacers[item.group]
					? `${spacers[item.group]}px`
					: undefined}
			>
				{#if item.count > 1}<ReminderCount count={item.count} />{/if}
				<BoardReminder
					label={item.label}
					character={characters.get(item.characterId)}
					alignment={placingAlignment(game, item, characters)}
					infinite={isGeneric(item)}
					{size}
					{disabled}
					onTap={() => tap(item)}
					onDrag={(x, y, end) => dragItem(item, x, y, end)}
					onCancel={cancelDrag}
					panX
				/>
			</li>
		{:else}
			<li class="none">None</li>
		{/each}
	</ul>
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

{#if drag}
	<div class="floating" style:left="{drag.at.x}%" style:top="{drag.at.y}%" aria-hidden="true">
		<BoardReminder
			label={drag.item.label}
			character={characters.get(drag.item.characterId)}
			alignment={placingAlignment(game, drag.item, characters)}
			infinite={isGeneric(drag.item)}
			{size}
			disabled
			onTap={() => {}}
		/>
	</div>
{/if}

<SeatChooser
	bind:open={chooserOpen}
	title="Put on"
	{game}
	{characters}
	onChoose={(seatId) => {
		chooserOpen = false;
		if (choosing) place(choosing, seatId);
		choosing = undefined;
	}}
>
	{#snippet heading()}
		Put {#if choosing}<ReminderToken
				label={isGeneric(choosing) ? '∞' : choosing.label}
				character={characters.get(choosing.characterId)}
			/>{/if} on
	{/snippet}
	{#snippet headActions()}
		<!-- Duplicate from the bank too; the copy stays in the bank (Trevor, 2026-10-20). -->
		{#if choosing && !isGeneric(choosing)}
			<ReminderMoreButton
				{grimoire}
				reminder={choosing}
				onDone={() => {
					chooserOpen = false;
					choosing = undefined;
				}}
			/>
		{/if}
	{/snippet}
</SeatChooser>

<Dialog bind:open={shownOpen} title="Setup reminder">
	{#snippet heading()}
		{#if shown}<ReminderToken
				label={shown.suggestion.label}
				character={characters.get(shown.suggestion.characterId)}
			/>{/if}
	{/snippet}
	{#snippet subtitle()}
		{#if shown}<CharacterBadge
				characterId={shown.suggestion.characterId}
				character={characters.get(shown.suggestion.characterId)}
			/>{/if}
	{/snippet}
	{#if shown}
		{@const s = shown.suggestion}
		{@const owner = characters.get(s.characterId)}
		<p class="text">
			{#each prepTextSegments(s.text, names) as part, j (j)}{#if part.kind === 'reminder'}<ReminderToken
						label={part.label}
						character={owner}
					/>{:else if part.kind === 'character'}<CharacterBadge
						characterId={part.id}
						character={characters.get(part.id)}
					/>{:else}{part.text}{/if}{/each}
		</p>
		<!-- Loose mode gives nothing to a seat: it is dragged onto the board. -->
		{#if !loose}
			{@const seats = traySeats(s)}
			<p class="hint">
				{seats.length > 0
					? 'Suggested seats, or drag it onto any seat.'
					: 'Drag it onto any seat, or choose one.'}
			</p>
			<ul class="seats">
				{#each seats as seatId (seatId)}
					{@const id = game.seats[seatId]?.characterId}
					<li>
						{#if id}
							<CharacterBadge
								characterId={id}
								character={characters.get(id)}
								alignment={game.seats[seatId].alignment}
								playerName={seatName(seatId)}
							/>
						{:else}
							{seatName(seatId)}
						{/if}
						<span class="spacer"></span>
						<Button
							variant="quiet"
							aria-label={`Place on ${seatName(seatId)}`}
							onclick={() => placeShown(seatId)}>Place</Button
						>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
	{#snippet actions()}
		<Button variant="quiet" icon="close" onclick={dismissShown}>Dismiss</Button>
		<!-- Any seat will do (a Drunk decided later goes anywhere). -->
		<Button
			variant="quiet"
			disabled={loose}
			onclick={() => {
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
			}}>Choose seat</Button
		>
		<Button variant="quiet" onclick={() => (shownOpen = false)}>Close</Button>
	{/snippet}
</Dialog>

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
	/* Cut into the bank's top edge, like the day timer's mode (DayTimer .caption). */
	.caption {
		position: absolute;
		top: 0;
		z-index: 3;
		margin-left: var(--space-2);
		padding: 0 var(--space-1);
		background: var(--board-bar-background);
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
	.floating {
		position: absolute;
		z-index: 4;
		translate: -50% -50%;
		scale: 1.15;
		pointer-events: none;
	}
	.text {
		margin: 0 0 var(--space-2);
		line-height: 1.9;
	}
	.hint {
		margin: 0 0 var(--space-1);
		font-size: 0.9rem;
		color: var(--on-surface-muted);
	}
	.seats {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.seats li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		border-bottom: 1px solid var(--border);
	}
	.spacer {
		flex: 1;
	}
</style>
