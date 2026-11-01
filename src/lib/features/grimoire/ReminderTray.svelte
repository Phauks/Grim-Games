<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import SheetHandle from '#lib/ui/primitives/SheetHandle.svelte';
	import ReminderGroups from './ReminderGroups.svelte';
	import { escapeCloses, pressedOutside } from './bin-dismiss.ts';

	/**
	 * The reminder tray (Trevor, 2026-10-31: the player's and the Storyteller's are one): a
	 * strip of tokens docked at the foot of a board, under captions on its top edge, that
	 * scrolls sideways within itself. Its handle bar pulls it up over the board to hold every
	 * token at once (ReminderGroups), or back down; a tap outside it or Escape lowers it. The
	 * token in hand's pill (ReminderInHand) sits over it. The Storyteller's bank
	 * (ReminderBank) and a player's bin (PlayerReminderBin) each say only what their tokens
	 * are and what a tap or drag does.
	 *
	 * By default it docks just under the board, which leaves room for it and sets `--tray-h`,
	 * its height; `inside`, within the board's foot.
	 */
	interface Props {
		/** The strip's accessible name. */
		label: string;
		/** Pulled up: its accessible name. */
		binLabel: string;
		/** Its handle bar's accessible name. */
		handleLabel: string;
		/** In order, each under its caption; an empty group still has its caption measured. */
		groups: readonly { key: string; caption?: string; items: readonly T[] }[];
		keyOf: (item: T) => string;
		/** A token; `inRow` while in the strip, which pans sideways (BoardReminder `panX`). */
		item: Snippet<[T, boolean]>;
		/** How each token is marked: in hand, a copy past the game's, the step's, faded back. */
		flags?: (item: T) => { lifted?: boolean; extra?: boolean; now?: boolean; dim?: boolean };
		/** The tokens' diameter in px. */
		size: number;
		/**
		 * Docked inside its board's foot rather than under it (a player's town, which can't leave
		 * room under itself), `height` px tall.
		 */
		inside?: { height: number };
		/** Pulled up. */
		open?: boolean;
		/** What it is pulled up over: it reaches most of its height. */
		over: HTMLElement | undefined;
		/** A token is in hand or dragged: a press outside leaves it up. */
		busy?: boolean;
		/** A token is being dragged out: pulled up, it drops back to its row until let go. */
		lowered?: boolean;
		/** Escape, before it lowers: true when that took it (a token in hand put down). */
		onEscape?: () => boolean;
		/** Pulled up, above the tokens: a search field. */
		header?: Snippet;
		/** At its right end, kept at the foot when pulled up (BankRunButton). */
		run?: Snippet;
		/** Drawn in the tokens' row instead of them, the run button kept: Seating's bar. */
		instead?: Snippet;
		/** The token in hand's pill, over its foot. */
		children?: Snippet;
		/** The strip, for its holder to scroll a token into view. */
		row?: HTMLElement;
		/** The whole tray, for its holder to take taps on it. */
		el?: HTMLElement;
	}

	let {
		label,
		binLabel,
		handleLabel,
		groups,
		keyOf,
		item,
		flags,
		size,
		inside,
		open = $bindable(false),
		over,
		busy = false,
		lowered = false,
		onEscape,
		header,
		run,
		instead,
		children,
		row = $bindable(),
		el = $bindable()
	}: Props = $props();

	interface Entry {
		item: T;
		key: string;
		group: string;
	}
	const items = $derived(
		groups.flatMap((g) => g.items.map((i): Entry => ({ item: i, key: keyOf(i), group: g.key })))
	);
	const captionOf = $derived(Object.fromEntries(groups.map((g) => [g.key, g.caption])));

	/** How far above its row it reaches pulled up, in px: most of what it is over. */
	let openH = $state(0);
	/** While its handle is pulled, how far above its row it reaches, in px. */
	let pullH = $state<number>();
	const tall = $derived(open || pullH !== undefined);
	function reach() {
		openH = Math.round((over?.clientHeight ?? 0) * 0.6);
	}
	function toggle() {
		reach();
		open = !open;
	}
	/** How far a pull goes before it opens or closes, in px. */
	const PULL = 24;
	function pull(up: number, end: boolean) {
		if (pullH === undefined) reach();
		const h = Math.min(openH, Math.max(0, (open ? openH : 0) + up));
		if (!end) {
			pullH = h;
			return;
		}
		pullH = undefined;
		// A short pull is enough either way: up opens it, down closes it.
		if (open ? up < -PULL : up > PULL) open = !open;
	}
	const binGroups = $derived(groups.filter((g) => g.items.length > 0));
	/** A solid line goes before each stretch but the first. */
	const startsGroup = (i: number) => i > 0 && items[i - 1].group !== items[i].group;
	const endsGroup = (i: number) => i === items.length - 1 || items[i + 1].group !== items[i].group;

	/**
	 * The captions on its top edge, like the day timer's Timer and Stopwatch (Trevor,
	 * 2026-10-18): one over each captioned stretch, from its line on, kept at the row's start
	 * once the line scrolls past until the next caption reaches it. As shares of its width.
	 */
	const dividers = $state<Record<string, HTMLElement>>({});
	const captionW = $state<Record<string, number>>({});
	let scrolled = $state(0);
	/**
	 * Measured after it is drawn (Trevor, 2026-10-22: the ∞ sat over the Reminders, not its own
	 * token): a stretch's line moves once the spacers and token widths are known, so the
	 * captions are placed again whenever those or its size change.
	 */
	let captions = $state<{ group: string; text: string; left: number }[]>([]);
	/** The handle bar's width, kept clear of captions. */
	let grabW = $state(0);
	let resized = $state(0);
	$effect(() => {
		if (!el || !row) return;
		const observer = new ResizeObserver(() => resized++);
		observer.observe(el);
		observer.observe(row);
		return () => observer.disconnect();
	});
	$effect(() => {
		void items;
		void spacers;
		void resized;
		void grabW;
		captions = placeCaptions();
	});
	function placeCaptions(): { group: string; text: string; left: number }[] {
		const list = row;
		if (!el || !list) return [];
		const width = el.clientWidth || 1;
		const start = list.offsetLeft;
		const pct = (x: number) => (x / width) * 100;
		const placed: { group: string; text: string; left: number }[] = [];
		const shown = [...new Set(items.map((i) => i.group))];
		shown.forEach((group, i) => {
			const text = captionOf[group];
			if (!text) return;
			if (i === 0) {
				placed.push({ group, text, left: pct(start) });
				return;
			}
			const divider = dividers[group];
			if (!divider) return;
			const line = start + divider.offsetLeft - scrolled;
			// Once all of it fits in the row, never past the row's end over the run button
			// (Trevor, 2026-10-19: Dead players ran into Start game). Its stretch is at least as
			// wide as it (`spacers`), so it always fits over its own tokens.
			const end = start + list.clientWidth;
			if (line + gap + (captionW[group] ?? 0) > end) return;
			placed.push({ group, text, left: pct(Math.max(start, line)) });
		});
		// Clear of the handle bar in the middle of its top edge (Trevor, 2026-10-30).
		const middle = width / 2;
		const half = grabW * 0.375 + gap; // half its tab, 3.75 of the handle's 5 units wide
		placed.forEach((c, i) => {
			const x = (c.left / 100) * width + gap;
			const w = captionW[c.group] ?? 0;
			if (x >= middle + half || x + w <= middle - half) return;
			// Moved past it unless that runs into the next caption or the run button: then it
			// stays, drawn over the bar, rather than going.
			const next = placed[i + 1];
			const moved = middle + half - gap;
			const limit = next ? (next.left / 100) * width : start + list.clientWidth;
			if (limit >= moved + gap + w) c.left = pct(moved);
		});
		// A caption goes once the next one reaches it, so no two overlap (Trevor, 2026-10-19).
		return placed.filter((c, i) => {
			const next = placed[i + 1];
			return !next || next.left >= c.left + pct(gap + (captionW[c.group] ?? 0));
		});
	}
	/** The strip's gap, which is also each caption's inset from its line (both `--space-2`). */
	const gap = $derived(row ? parseFloat(getComputedStyle(row).columnGap) || 0 : 0);
	/** Each token's width in the strip, to size its stretch. */
	const itemW = $state<Record<string, number>>({});
	/**
	 * Room added after a captioned stretch narrower than its caption, so the caption sits over
	 * its own tokens (Trevor, 2026-10-19: Dead players over one token ran over the ∞). A margin
	 * on the stretch's last token, so the list holds only tokens.
	 */
	const spacers = $derived.by(() => {
		const out: Record<string, number> = {};
		for (const g of groups) {
			const own = items.filter((i) => i.group === g.key);
			const caption = captionW[g.key];
			if (!g.caption || own.length === 0 || caption === undefined) continue;
			const tokens = own.reduce((n, i) => n + (itemW[i.key] ?? 0), 0);
			const room = caption - tokens - own.length * gap;
			if (room > 0) out[g.key] = room;
		}
		return out;
	});
	/** More tokens off either end of the row: its edge fades (Trevor, 2026-10-19). */
	let more = $state({ start: false, end: false });
	function measure() {
		if (!row) return;
		const { scrollLeft, clientWidth, scrollWidth } = row;
		more = { start: scrollLeft > 1, end: scrollLeft + clientWidth < scrollWidth - 1 };
	}
	$effect(() => {
		void items;
		if (!row) return;
		const observer = new ResizeObserver(measure);
		observer.observe(row);
		measure();
		return () => observer.disconnect();
	});
</script>

{#snippet binToken(entry: T)}{@render item(entry, false)}{/snippet}

<svelte:window
	onpointerdown={(event) => {
		if (open && !busy && pressedOutside(event, el)) open = false;
	}}
	onkeydowncapture={(event) => {
		// Before a dialog's own Escape takes it away, so that Escape leaves the token in hand.
		if (!escapeCloses(event)) return;
		// Escape puts the token in hand down first, then lowers the tray.
		if (onEscape?.()) return;
		if (open) open = false;
	}}
/>

<div
	class="tray"
	class:tall
	class:pulling={pullH !== undefined}
	class:lowered={tall && lowered}
	class:running={!!run}
	class:inside={!!inside}
	data-tray
	bind:this={el}
	style:--reach={tall ? `${pullH ?? openH}px` : undefined}
	style:--tray-h={inside ? `${inside.height}px` : undefined}
>
	<!-- Every caption measured from the start, hidden, so each stretch has its room before its
	     caption first shows (a caption measured only once shown widened the row as it was
	     scrolled to its end). -->
	{#each groups as g (g.key)}{#if g.caption}<span
				class="caption measure"
				data-group={g.key}
				aria-hidden="true"
				bind:offsetWidth={captionW[g.key]}>{g.caption}</span
			>{/if}{/each}
	{#if instead && !tall}
		{@render instead()}
	{:else if tall}
		<div class="every" aria-label={binLabel} role="region" data-testid="reminder-bin">
			{@render header?.()}
			<ReminderGroups label={binLabel} groups={binGroups} {keyOf} item={binToken} {size} />
		</div>
	{:else}
		{#each captions as caption (caption.group)}<span
				class="caption"
				data-group={caption.group}
				data-testid="bank-{caption.group}"
				style:left="{caption.left}%">{caption.text}</span
			>{/each}
		<ul
			class="row"
			bind:this={row}
			aria-label={label}
			data-more-start={more.start || undefined}
			data-more-end={more.end || undefined}
			onscroll={(e) => {
				scrolled = e.currentTarget.scrollLeft;
				measure();
			}}
		>
			{#each items as entry, i (entry.key)}
				{@const f = flags?.(entry.item) ?? {}}
				{#if startsGroup(i)}<li
						class="divider"
						aria-hidden="true"
						bind:this={dividers[entry.group]}
					></li>{/if}
				<li
					bind:offsetWidth={itemW[entry.key]}
					class:lifted={f.lifted}
					class:extra={f.extra}
					data-extra={f.extra ? '' : undefined}
					class:now={f.now}
					class:dim={f.dim}
					style:margin-inline-end={endsGroup(i) && spacers[entry.group]
						? `${spacers[entry.group]}px`
						: undefined}
				>
					{@render item(entry.item, true)}
				</li>
			{:else}
				<li class="none">None</li>
			{/each}
		</ul>
	{/if}
	<!-- The handle bar in the middle of its top edge: pulls it up over the board, or back down
	     (Trevor, 2026-10-30). Clear of the run button (Trevor, 2026-10-29: "a drag above the
	     red button is bad placement"). -->
	{#if !instead}<div class="grab" bind:clientWidth={grabW}>
			<SheetHandle label={handleLabel} expanded={open} onToggle={toggle} onPull={pull} />
		</div>{/if}
	{@render run?.()}
	<!-- Over the board's foot, above the handle bar (Trevor, 2026-10-30). -->
	{@render children?.()}
</div>

<style>
	/* Docked under the board (Trevor, 2026-10-16): a strip of tokens that scrolls sideways
	   within itself, so the seats stay uncovered. The board leaves room for it. */
	.tray {
		position: absolute;
		left: 0;
		right: 0;
		/* Its foot fixed, so pulled up it grows over the board (Trevor, 2026-10-30). */
		bottom: calc(-1 * (var(--tray-h) + var(--space-2)));
		z-index: 2;
		display: flex;
		align-items: center;
		height: var(--tray-h);
		box-sizing: border-box;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--board-bar-background);
		/* The token in hand's pill, over the board's foot above the handle bar. */
		--hand-bottom: calc(100% + var(--tap-target) / 2 + var(--space-2));
	}
	.tray.inside {
		left: var(--space-2);
		right: var(--space-2);
		bottom: var(--space-2);
	}
	.tray.running {
		--run-w: 5.5rem;
	}
	/* Pulled up: every token in rows above the run button, which keeps its place at the foot. */
	.tray.tall {
		z-index: 3;
		align-items: stretch;
		/* As tall as its tokens need, up to most of the board, so no empty space sits above the
		   run button. */
		height: auto;
		max-height: calc(var(--tray-h) + var(--reach));
		background: var(--surface-raised);
		box-shadow: var(--shadow);
	}
	/* Pulled by its handle: it follows the finger. */
	.tray.pulling {
		height: calc(var(--tray-h) + var(--reach));
	}
	.every {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-width: 0;
		padding: calc(var(--tap-target) / 2) var(--space-2) var(--space-2);
		box-sizing: border-box;
	}
	/* A token on its way out of it: back down to its row, the tokens still there to come back. */
	.tray.tall.lowered {
		height: var(--tray-h);
	}
	.tray.lowered .every {
		opacity: 0;
	}
	/* The run button keeps its corner cell at the foot, the size it is in the row, its own
	   rounded corner towards the tokens (Trevor, 2026-10-30: it looked bad pulled up). */
	.tray.tall :global(.run) {
		position: absolute;
		right: 0;
		bottom: 0;
		height: calc(var(--tray-h) - 2px); /* px-ok: the tray's two borders */
		border-start-start-radius: calc(var(--radius-md) - 1px);
	}
	/* The tokens to its left, so the last row sits beside it. */
	.tray.tall .every {
		min-height: calc(var(--tray-h) * 2);
		padding-inline-end: calc(var(--run-w, 0rem) + var(--space-2));
	}
	/* The handle bar, centred on its top edge, half over the board (Trevor, 2026-10-30). */
	.grab {
		position: absolute;
		top: 0;
		left: 50%;
		/* Under the captions, which let a press through to it. */
		z-index: 2;
		display: grid;
		place-items: center;
		translate: -50% -50%;
	}
	/* Its bar sits in a tab the captions' pill shape, so it reads as part of the tray rather
	   than a mark across its border. The button around it stays a full tap target. */
	.grab::before {
		content: '';
		position: absolute;
		width: calc(2.75 * var(--u) + 2 * var(--space-2));
		height: calc(0.65rem * 1.6);
		box-sizing: border-box;
		border: 1px solid var(--border);
		border-radius: var(--radius-full);
		background: var(--surface-raised);
		pointer-events: none;
	}
	.grab :global(.handle) {
		position: relative;
	}
	/*
	 * On its top edge, half over the board, so it is the seat name's pill (PlayerNameMark): a
	 * band of the tray's own see-through colour didn't match every board background (Trevor,
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
	.caption.measure {
		left: 0;
		visibility: hidden;
	}
	/*
	 * The ∞ as tall as the other captions' capitals (Trevor, 2026-10-19). Measured in Cinzel:
	 * its ink is about 0.62 of a capital's height, so 1.6 times the size matches them.
	 */
	.caption[data-group='generic'] {
		font-size: calc(0.65rem * 1.6);
		letter-spacing: 0;
	}
	.row {
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
	.row::-webkit-scrollbar {
		display: none;
	}
	/* More tokens past an edge: that edge fades out, drawn over nothing so nothing moves. */
	.row {
		--fade: calc(1.5 * var(--u));
		--shown: rgb(0 0 0); /* colour-ok: a mask's opacity, not a colour */
	}
	.row[data-more-start] {
		mask-image: linear-gradient(to right, transparent, var(--shown) var(--fade));
	}
	.row[data-more-end] {
		mask-image: linear-gradient(to left, transparent, var(--shown) var(--fade));
	}
	.row[data-more-start][data-more-end] {
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
	.row > li {
		position: relative;
		flex: none;
		display: grid;
		place-items: center;
		/* Room for the name band, which is wider than the token, and the band under it. */
		padding-inline: 0.75rem;
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
	/* Between one stretch and the next: a solid line (Trevor, 2026-10-16). */
	.row > li.divider {
		align-self: stretch;
		padding: 0;
		border-inline-start: 1px solid var(--on-surface-muted);
	}
	.none {
		color: var(--on-surface-muted);
	}
</style>
