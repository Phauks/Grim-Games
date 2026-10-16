<script lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import type { SeatId } from '#lib/core/model/index.ts';
	import { characterNames } from '#lib/core/rules/character-names.ts';
	import { prepTextSegments, setupReminders } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import type { SeatPoint } from '#lib/ui/seating/seat-layout.ts';
	import BoardReminder from './BoardReminder.svelte';
	import { placingAlignment } from './board.ts';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { bankReminders, byLabel, type StepReminders } from './reminders.ts';
	import { scriptCharacterIds } from '#lib/core/model/index.ts';
	import SeatChooser from './SeatChooser.svelte';
	import type { BankView } from './setup-tray.ts';
	import { pendingTray, trayItems, traySeats, type TrayItem } from './setup-tray.ts';

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
		view: BankView;
		onView: (view: BankView) => void;
		/** The character whose night step is being walked through. */
		focus?: StepReminders;
		/** The seat under a point (in % of the board), if any. */
		seatAt: (at: SeatPoint) => SeatId | undefined;
		/** Seats to mark while a token is dragged or open, and the one under the drag. */
		onHints: (hints: { seats: SeatId[]; target?: SeatId }) => void;
	}

	let { grimoire, board, size, view, onView, focus, seatAt, onHints }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const names = $derived(characterNames([...characters.values()]));

	/** One token in the bank: a setup suggestion, or a reminder still off the board. */
	interface Item {
		key: string;
		characterId: CharacterId;
		label: string;
		/** Shown once with ×count when "Stack duplicate reminders" is on. */
		count: number;
		setup?: TrayItem;
		/** Used by the walked-through step tonight. */
		now?: boolean;
	}

	// Script order, then reminder name (Trevor, 2026-10-16), like every reminder list.
	const scriptOrder = $derived(scriptCharacterIds(game.script));
	const at = (id: CharacterId) => {
		const i = scriptOrder.indexOf(id);
		return i < 0 ? scriptOrder.length : i;
	};
	const setupItems = $derived(
		pendingTray(trayItems(setupReminders(game, characters)), game, grimoire.trayDismissed).sort(
			(a, b) =>
				at(a.suggestion.characterId) - at(b.suggestion.characterId) ||
				byLabel(a.suggestion.label, b.suggestion.label)
		)
	);
	const items = $derived.by((): Item[] => {
		const stack = preferences.current.assistance.stackReminders;
		if (view === 'setup') {
			const out: Item[] = [];
			for (const item of setupItems) {
				const { characterId, label } = item.suggestion;
				const same = stack
					? out.find((i) => i.characterId === characterId && i.label === label)
					: undefined;
				if (same) same.count += 1;
				else out.push({ key: item.key, characterId, label, count: 1, setup: item });
			}
			return out;
		}
		return bankReminders(game, characters, focus).flatMap(({ characterId, label, left, now }) => {
			const key = `${characterId}:${label}`;
			if (stack) return [{ key, characterId, label, count: left, now }];
			return Array.from({ length: left }, (_, i) => ({
				key: `${key}:${i}`,
				characterId,
				label,
				count: 1,
				now
			}));
		});
	});

	// A new step's reminders are at the front: show them.
	let list = $state<HTMLElement>();
	$effect(() => {
		void focus;
		list?.scrollTo({ left: 0 });
	});

	const seatName = (seatId: SeatId) =>
		game.seats[seatId]?.playerName ?? `Seat ${game.seating.indexOf(seatId) + 1}`;
	const seatsFor = (item: Item) => (item.setup ? traySeats(item.setup.suggestion) : []);

	function place(item: Pick<Item, 'characterId' | 'label'>, seatId: SeatId) {
		const { characterId, label } = item;
		grimoire.run({ type: 'AddReminder', seatId, reminder: { characterId, label } });
	}

	// ── Drag a token from the bank onto a seat ──
	let drag = $state<{ item: Item; at: SeatPoint } | undefined>();
	function dragItem(item: Item, x: number, y: number, end: boolean) {
		if (!board) return;
		const rect = board.getBoundingClientRect();
		const at = { x: ((x - rect.left) / rect.width) * 100, y: ((y - rect.top) / rect.height) * 100 };
		const target = seatAt(at);
		if (!end) {
			drag = { item, at };
			onHints({ seats: seatsFor(item), target });
			return;
		}
		drag = undefined;
		onHints({ seats: [] });
		// Any seat will do: the Storyteller can override the suggestion.
		if (target) place(item, target);
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
			onHints({ seats: seatsFor(item) });
		} else {
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

<div class="bank" data-tray>
	<button
		type="button"
		class="view"
		aria-label={view === 'setup'
			? 'Showing setup reminders; show all reminders'
			: 'Showing all reminders; show setup reminders'}
		onclick={() => onView(view === 'setup' ? 'all' : 'setup')}
	>
		{view === 'setup' ? 'Setup' : 'All'}
	</button>
	<ul
		class="tray"
		bind:this={list}
		aria-label={view === 'setup' ? 'Setup reminders' : 'Reminder bank'}
	>
		{#each items as item (item.key)}
			<li class:lifted={drag?.item.key === item.key && item.count === 1} class:now={item.now}>
				{#if item.count > 1}<span class="count" aria-label={`${item.count} copies`}
						>×{item.count}</span
					>{/if}
				<BoardReminder
					label={item.label}
					character={characters.get(item.characterId)}
					alignment={placingAlignment(game, item.characterId, characters)}
					{size}
					onTap={() => tap(item)}
					onDrag={(x, y, end) => dragItem(item, x, y, end)}
					onCancel={cancelDrag}
				/>
			</li>
		{:else}
			<li class="none">None</li>
		{/each}
	</ul>
</div>

{#if drag}
	<div class="floating" style:left="{drag.at.x}%" style:top="{drag.at.y}%" aria-hidden="true">
		<BoardReminder
			label={drag.item.label}
			character={characters.get(drag.item.characterId)}
			alignment={placingAlignment(game, drag.item.characterId, characters)}
			{size}
			disabled
			onTap={() => {}}
		/>
	</div>
{/if}

<SeatChooser
	bind:open={chooserOpen}
	title={choosing ? `Put ${choosing.label} on` : 'Put on'}
	{game}
	{characters}
	onChoose={(seatId) => {
		chooserOpen = false;
		if (choosing) place(choosing, seatId);
		choosing = undefined;
	}}
/>

<Dialog
	bind:open={shownOpen}
	title={shown?.suggestion.label ?? ''}
	description={shown ? (characters.get(shown.suggestion.characterId)?.name ?? '') : ''}
>
	{#if shown}
		{@const s = shown.suggestion}
		{@const type = characters.get(s.characterId)?.type}
		<p class="text">
			{#each prepTextSegments(s.text, names) as part, j (j)}{#if part.kind === 'reminder'}<ReminderToken
						label={part.label}
						{type}
					/>{:else if part.kind === 'character'}<CharacterBadge
						characterId={part.id}
						character={characters.get(part.id)}
						inline
					/>{:else}{part.text}{/if}{/each}
		</p>
		{@const seats = traySeats(s)}
		<p class="hint">
			{seats.length > 0 ? 'Suggested seats, or drag it onto any seat.' : 'Drag it onto any seat.'}
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
							inline
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
	{#snippet actions()}
		<Button variant="quiet" icon="remove" onclick={dismissShown}>Dismiss</Button>
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
		border: 1px dashed var(--border);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--surface) 85%, transparent);
	}
	.view {
		flex: none;
		align-self: stretch;
		min-width: var(--tap-target);
		padding: 0 var(--space-2);
		border: 0;
		border-inline-end: 1px solid var(--border);
		background: none;
		color: var(--on-surface);
		font: 600 0.85rem var(--font-control);
		cursor: pointer;
	}
	.view:hover {
		background: var(--surface-selected);
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
	/* The walked-through step's reminders, at the front: a ring that hugs the round token. */
	li.now > :global(.reminder) {
		outline: 0.2rem solid var(--accent);
		outline-offset: 0.15rem;
	}
	.tray > li {
		flex: none;
	}
	li {
		display: grid;
		place-items: center;
		/* Room for the label band under each token. */
		padding-bottom: 6px;
	}
	li.lifted {
		opacity: 0.3;
	}
	.tray > li {
		position: relative;
	}
	.count {
		position: absolute;
		top: 0;
		right: 0;
		z-index: 1;
		min-width: 1.4em;
		padding: 0 3px;
		border-radius: 999px;
		background: var(--accent);
		color: var(--on-accent);
		font: 700 0.75rem / 1.4 var(--font-control);
		text-align: center;
		pointer-events: none;
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
