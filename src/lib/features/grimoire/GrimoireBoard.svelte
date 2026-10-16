<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Alignment, CharacterId } from '#lib/core/data/index.ts';
	import type { ReminderId, SeatId } from '#lib/core/model/index.ts';
	import { setupComplete } from '#lib/core/rules/index.ts';
	import BluffsSheet from '#lib/features/bluffs/BluffsSheet.svelte';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import {
		DEFAULT_SEAT_LAYOUT,
		gapPoints,
		isDefaultLayout,
		nextGap,
		keepInside,
		seatPoints,
		seatTokenSize,
		towardsMiddle,
		withGap,
		withPlaced,
		withShape,
		type SeatPoint
	} from '#lib/ui/seating/seat-layout.ts';
	import { isOrphan } from './board.ts';
	import CharacterPicker from './CharacterPicker.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import BoardReminder from './BoardReminder.svelte';
	import { findEdition, fromScript, scriptToJson } from '#lib/core/data/index.ts';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import { shareTargetFor } from '#lib/features/scripts/share-codes.ts';
	import ShareControl from '#lib/features/scripts/ShareControl.svelte';
	import HistoryDialog from './HistoryDialog.svelte';
	import NightOrderSheet from './NightOrderSheet.svelte';
	import SeatSheet from './SeatSheet.svelte';
	import SeatToken from './SeatToken.svelte';
	import SetupTray from './SetupTray.svelte';

	interface Props {
		grimoire: Grimoire;
	}

	let { grimoire }: Props = $props();

	const game = $derived(grimoire.game);
	// Once every tile is drawn the bag and selection are closed; seats change here instead.
	const setUp = $derived(setupComplete(game));
	const characters = $derived(grimoire.open.characters);
	const seats = $derived(game.seating.map((id) => game.seats[id]));

	let board = $state<HTMLElement>();
	let width = $state(0);
	let height = $state(0);
	// Measured on the next frame rather than with bind:clientWidth, so resizing the tokens
	// never re-enters the ResizeObserver callback (a "ResizeObserver loop" error).
	$effect(() => {
		if (!board) return;
		let frame = 0;
		const observer = new ResizeObserver(([entry]) => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				width = entry.contentRect.width;
				height = entry.contentRect.height;
			});
		});
		observer.observe(board);
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
		};
	});
	const layout = $derived(grimoire.layout);
	const size = $derived(seatTokenSize(game.seating, layout, { width, height }));
	// Each seat's slot is its token plus one --u (16px, unscaled by text size) either side;
	// keep it all on the board so a narrow phone never scrolls sideways.
	const unit = 16;
	const points = $derived(
		keepInside(
			seatPoints(game.seating, layout, { width, height }),
			{ width, height },
			size / 2 + unit
		)
	);

	// ── Reminder tokens on the board ──
	// Each seat's reminders line up in front of it, towards the middle, as on a real
	// grimoire. Up to three show; past that the third is a "+N" that opens the seat.
	const MAX_SHOWN = 3;
	const chip = $derived(Math.round(Math.max(30, Math.min(48, size * 0.5))));
	function chipPoints(i: number, count: number): SeatPoint[] {
		const distances = Array.from(
			{ length: Math.min(count, MAX_SHOWN) },
			(_, k) => size / 2 + chip / 2 + 6 + k * (chip + 10)
		);
		return towardsMiddle(points[i], { width, height }, distances);
	}

	interface ReminderDrag {
		reminderId: ReminderId;
		from: SeatId;
		/** Where the token is, in % of the board. */
		at: SeatPoint;
		target?: SeatId;
	}
	let reminderDrag = $state<ReminderDrag | undefined>();

	/** The seat under a point (in % of the board), if it is within reach of a token. */
	function seatAt(at: SeatPoint): SeatId | undefined {
		let best: SeatId | undefined;
		let bestDistance = size * 0.75;
		game.seating.forEach((id, i) => {
			const d = Math.hypot(
				((points[i].x - at.x) / 100) * width,
				((points[i].y - at.y) / 100) * height
			);
			if (d < bestDistance) {
				best = id;
				bestDistance = d;
			}
		});
		return best;
	}

	function dragReminder(reminderId: ReminderId, from: SeatId, x: number, y: number, end: boolean) {
		if (!board) return;
		const rect = board.getBoundingClientRect();
		const at = { x: ((x - rect.left) / rect.width) * 100, y: ((y - rect.top) / rect.height) * 100 };
		const target = seatAt(at);
		if (!end) {
			reminderDrag = { reminderId, from, at, target };
			return;
		}
		reminderDrag = undefined;
		// Dropped on another seat: moved (one History entry). Anywhere else: nothing changes.
		if (target && target !== from)
			grimoire.run({ type: 'MoveReminder', reminderId, toSeatId: target });
	}

	// ── Arranging seats ──
	// Seats can be dragged anywhere (people on a couch, a gap by the door) and gaps left
	// between neighbours. Only where seats are drawn changes; the seating order does not.
	let arranging = $state(false);
	const gapAt = $derived(arranging ? gapPoints(game.seating, layout, { width, height }, 0.3) : []);
	function startArranging() {
		arranging = true;
		toast('Arrange seats', 'Drag a seat to move it. Tap + between seats to leave a gap.');
	}

	interface Drag {
		seatId: SeatId;
		pointerId: number;
		/** From the pointer to the seat's centre, so the seat does not jump under a finger. */
		offset: SeatPoint;
		at: SeatPoint;
		moved: boolean;
	}
	let drag = $state<Drag | undefined>();
	/** Pointer movement, in pixels, before a press counts as a drag. */
	const DRAG_SLOP = 6;
	let pressedAt = { x: 0, y: 0 };

	function boardPoint(event: PointerEvent): SeatPoint {
		const rect = board!.getBoundingClientRect();
		return {
			x: ((event.clientX - rect.left) / rect.width) * 100,
			y: ((event.clientY - rect.top) / rect.height) * 100
		};
	}
	function dragStart(event: PointerEvent, seatId: SeatId, at: SeatPoint) {
		if (!arranging || drag || !board) return;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		const p = boardPoint(event);
		pressedAt = { x: event.clientX, y: event.clientY };
		drag = {
			seatId,
			pointerId: event.pointerId,
			offset: { x: at.x - p.x, y: at.y - p.y },
			at,
			moved: false
		};
	}
	function dragMove(event: PointerEvent) {
		if (!drag || event.pointerId !== drag.pointerId) return;
		const moved =
			drag.moved ||
			Math.hypot(event.clientX - pressedAt.x, event.clientY - pressedAt.y) >= DRAG_SLOP;
		const p = boardPoint(event);
		drag = { ...drag, moved, at: { x: p.x + drag.offset.x, y: p.y + drag.offset.y } };
	}
	function dragEnd(event: PointerEvent) {
		if (!drag || event.pointerId !== drag.pointerId) return;
		if (drag.moved) grimoire.setLayout(withPlaced(layout, drag.seatId, drag.at));
		drag = undefined;
	}
	/** Arrow keys move a seat while arranging, for keyboards and switch access. */
	function nudge(event: KeyboardEvent, seatId: SeatId, at: SeatPoint) {
		if (!arranging) return;
		const step = { ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2] }[
			event.key
		];
		if (!step) return;
		event.preventDefault();
		grimoire.setLayout(withPlaced(layout, seatId, { x: at.x + step[0], y: at.y + step[1] }));
	}

	// ── Seat sheet ──
	let sheetOpen = $state(false);
	let selected = $state<SeatId | undefined>();
	function openSeat(seatId: SeatId) {
		selected = seatId;
		sheetOpen = true;
	}
	// A removed (or undone) seat closes its sheet.
	$effect(() => {
		if (selected !== undefined && !game.seats[selected]) sheetOpen = false;
	});

	// ── Travellers ──
	let travellerOpen = $state(false);
	let traveller = $state<CharacterId | undefined>();
	let travellerAlignmentOpen = $state(false);
	function addTraveller(alignment: Alignment | undefined) {
		travellerAlignmentOpen = false;
		if (traveller) grimoire.addTraveller(traveller, alignment);
		traveller = undefined;
	}

	// ── Setup reminders: a tray of suggested tokens in the middle of the board ──
	let traying = $state(false);
	let trayHints = $state<{ seats: SeatId[]; target?: SeatId }>({ seats: [] });
	function startTray() {
		traying = true;
		toast('Setup reminders', 'Drag a token onto a seat, or tap it to see where it fits.');
	}

	let bluffsOpen = $state(false);
	let historyOpen = $state(false);
	let nightOpen = $state(false);

	// ── Share the script (never the game) ──
	let shareOpen = $state(false);
	const shareTarget = $derived.by(() => {
		const data = officialData.current;
		if (!data) return undefined;
		const { script } = fromScript(game.script, data);
		const edition = script.homebrew.length === 0 ? findEdition(script.name)?.id : undefined;
		return () =>
			shareTargetFor(
				{ edition, json: scriptToJson(script), source: { kind: 'paste' } },
				location.origin
			);
	});
	let menuOpen = $state(false);
	function fromMenu(action: () => void) {
		menuOpen = false;
		action();
	}

	// ── Fabled and Loric ──
	let ruleOpen = $state(false);
	let ruleShown = $state<CharacterId | undefined>();
	let ruleShownOpen = $state(false);
	const ruleShownCharacter = $derived(ruleShown ? characters.get(ruleShown) : undefined);
</script>

<div class="grimoire">
	<div class="toolbar" role="toolbar" aria-label="Grimoire">
		{#if arranging}
			<span class="title">Arrange seats</span>
			<div class="shape">
				<Toggle
					label="Circle"
					checked={layout.shape === 'circle'}
					onChange={(circle) => grimoire.setLayout(withShape(layout, circle ? 'circle' : 'oval'))}
				/>
			</div>
			<Button
				variant="quiet"
				disabled={isDefaultLayout(layout)}
				onclick={() => grimoire.setLayout(DEFAULT_SEAT_LAYOUT)}>Reset</Button
			>
			<Button variant="accent" icon="check" onclick={() => (arranging = false)}>Done</Button>
		{:else if traying}
			<span class="title">Setup reminders</span>
			<Button
				variant="accent"
				icon="check"
				onclick={() => {
					traying = false;
					trayHints = { seats: [] };
				}}>Done</Button
			>
		{:else}
			<span class="title">{game.script.meta?.name ?? 'Custom script'}</span>
			<IconButton icon="night" label="Night order" onclick={() => (nightOpen = true)} />
			<IconButton icon="history" label="History" onclick={() => (historyOpen = true)} />
			<IconButton
				icon="players"
				label="Characters"
				disabled={setUp}
				onclick={() => goto(resolve('/grimoire/[gameId]/setup', { gameId: game.gameId }))}
			/>
			<IconButton
				icon="bag"
				label="Bag draw"
				disabled={setUp}
				onclick={() => goto(resolve('/grimoire/[gameId]/draw', { gameId: game.gameId }))}
			/>
			<IconButton icon="menu" label="More" onclick={() => (menuOpen = true)} />
		{/if}
	</div>

	<div class="board" class:arranging bind:this={board}>
		{#each seats as seat, i (seat.seatId)}
			{@const at = drag?.seatId === seat.seatId ? drag.at : points[i]}
			<div
				class="slot"
				class:dragging={drag?.seatId === seat.seatId}
				style:left="{at.x}%"
				style:top="{at.y}%"
				onpointerdown={(event) => dragStart(event, seat.seatId, at)}
				onpointermove={dragMove}
				onpointerup={dragEnd}
				onpointercancel={() => (drag = undefined)}
				onkeydown={(event) => nudge(event, seat.seatId, at)}
				role="presentation"
			>
				<SeatToken
					{seat}
					number={i + 1}
					character={seat.characterId ? characters.get(seat.characterId) : undefined}
					{size}
					orphan={isOrphan(seat, game.script, characters)}
					dropTarget={(reminderDrag !== undefined &&
						reminderDrag.target === seat.seatId &&
						reminderDrag.from !== seat.seatId) ||
						trayHints.target === seat.seatId}
					hint={trayHints.seats.includes(seat.seatId)}
					onTap={() => !arranging && openSeat(seat.seatId)}
				/>
			</div>
		{/each}

		{#each seats as seat, i (seat.seatId)}
			{@const count = seat.reminders.length}
			{#if count > 0}
				{@const at = chipPoints(i, count)}
				{#each seat.reminders.slice(0, MAX_SHOWN) as reminder, k (reminder.reminderId)}
					{@const overflow = k === MAX_SHOWN - 1 && count > MAX_SHOWN ? count - k : undefined}
					{@const dragged = reminderDrag?.reminderId === reminder.reminderId}
					{@const p = dragged ? reminderDrag!.at : at[k]}
					<div class="chip-slot" class:dragging={dragged} style:left="{p.x}%" style:top="{p.y}%">
						<BoardReminder
							label={reminder.label}
							character={characters.get(reminder.characterId)}
							size={chip}
							more={overflow}
							disabled={arranging}
							onTap={() => openSeat(seat.seatId)}
							onDrag={overflow
								? undefined
								: (x, y, end) => dragReminder(reminder.reminderId, seat.seatId, x, y, end)}
							onCancel={() => (reminderDrag = undefined)}
						/>
					</div>
				{/each}
			{/if}
		{/each}

		{#each gapAt as at, i (game.seating[i])}
			{@const seatId = game.seating[i]}
			{@const gap = layout.gaps[seatId] ?? 0}
			<button
				type="button"
				class="gap"
				style:left="{at.x}%"
				style:top="{at.y}%"
				aria-label={`Gap after seat ${i + 1}: ${gap === 0 ? 'None' : gap}`}
				onclick={() => grimoire.setLayout(withGap(layout, seatId, nextGap(layout, seatId)))}
				>{gap === 0 ? '+' : gap}</button
			>
		{/each}

		{#if traying}
			<SetupTray {grimoire} {board} size={chip} {seatAt} onHints={(h) => (trayHints = h)} />
		{/if}

		<!-- Fabled and Loric are rules of the game, not seats: they sit in the middle. -->
		<ul class="rules" class:hidden={traying} aria-label="Fabled and Loric">
			{#each game.ruleCharacters as id (id)}
				{@const character = characters.get(id)}
				{#if character}
					<li>
						<button
							type="button"
							class="rule"
							aria-label={character.name}
							onclick={() => {
								ruleShown = id;
								ruleShownOpen = true;
							}}
						>
							<CharacterToken {character} size={Math.round(size * 0.8)} />
						</button>
					</li>
				{/if}
			{/each}
		</ul>
	</div>
</div>

<!-- Less frequent actions, in an overlay so the toolbar fits a phone. -->
<Dialog bind:open={menuOpen} title="Grimoire">
	<div class="menu">
		<Button variant="quiet" icon="add" onclick={() => fromMenu(() => grimoire.addSeat())}>
			Add seat
		</Button>
		<Button variant="quiet" icon="traveller" onclick={() => fromMenu(() => (travellerOpen = true))}>
			Add Traveller
		</Button>
		<Button variant="quiet" icon="fabled" onclick={() => fromMenu(() => (ruleOpen = true))}>
			Add Fabled or Loric
		</Button>
		<Button variant="quiet" icon="demon" onclick={() => fromMenu(() => (bluffsOpen = true))}>
			Demon bluffs
		</Button>
		<Button variant="quiet" icon="reminder" onclick={() => fromMenu(startTray)}>
			Setup reminders
		</Button>
		<Button variant="quiet" icon="arrange" onclick={() => fromMenu(startArranging)}>
			Arrange seats
		</Button>
		<Button variant="quiet" icon="share" onclick={() => fromMenu(() => (shareOpen = true))}>
			Share script
		</Button>
	</div>
</Dialog>

<SeatSheet bind:open={sheetOpen} {grimoire} seatId={selected} />

<HistoryDialog bind:open={historyOpen} {grimoire} />

<Dialog
	bind:open={shareOpen}
	title="Share script"
	description="Players get the script only, never anything from this game."
>
	<ShareControl
		what="script"
		title={game.script.meta?.name ?? 'Custom script'}
		target={shareTarget}
	/>
</Dialog>

<NightOrderSheet bind:open={nightOpen} {grimoire} />

<BluffsSheet
	bind:open={bluffsOpen}
	{game}
	{characters}
	dispatch={(command) => grimoire.open.run(command)}
/>

<CharacterPicker
	bind:open={travellerOpen}
	title="Add a Traveller"
	{characters}
	script={game.script}
	types={['traveller']}
	alwaysAll
	onPick={(id) => {
		travellerOpen = false;
		traveller = id;
		travellerAlignmentOpen = true;
	}}
/>

<Dialog
	bind:open={travellerAlignmentOpen}
	title="Alignment"
	description="Travellers can be good or evil."
>
	<div class="choices">
		<Button onclick={() => addTraveller('good')}>Good</Button>
		<Button onclick={() => addTraveller('evil')}>Evil</Button>
		<!-- Often chosen later: the night order asks for it first (Trevor, 2026-10-16). -->
		<Button variant="quiet" onclick={() => addTraveller(undefined)}>Decide later</Button>
	</div>
</Dialog>

<CharacterPicker
	bind:open={ruleOpen}
	title="Add Fabled or Loric"
	{characters}
	script={game.script}
	types={['fabled', 'loric']}
	alwaysAll
	onPick={(characterId) => {
		ruleOpen = false;
		grimoire.run({ type: 'AddRuleCharacter', characterId });
	}}
/>

<Dialog bind:open={ruleShownOpen} title={ruleShownCharacter?.name ?? ''}>
	{#if ruleShownCharacter}
		<div class="rule-detail">
			<CharacterToken character={ruleShownCharacter} size={64} />
			<p>{ruleShownCharacter.ability}</p>
		</div>
	{/if}
	{#snippet actions()}
		<Button
			variant="quiet"
			icon="remove"
			onclick={() => {
				ruleShownOpen = false;
				if (ruleShown) grimoire.run({ type: 'RemoveRuleCharacter', characterId: ruleShown });
			}}>Remove from the game</Button
		>
	{/snippet}
</Dialog>

<style>
	.grimoire {
		display: flex;
		flex-direction: column;
		/* Fills the screen under the app header; the footer is below the fold. */
		height: calc(100dvh - var(--tap-target) - 1px - env(safe-area-inset-top));
		min-height: 320px;
	}
	.toolbar {
		/* A fixed height, so swapping in the arranging controls never moves the board. */
		flex: none;
		box-sizing: border-box;
		height: calc(var(--tap-target) + 1px);
		display: flex;
		align-items: center;
		gap: var(--space-1);
		padding: 0 var(--space-2);
		border-bottom: 1px solid var(--border);
	}
	.title {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		font-family: var(--font-heading);
		color: var(--heading);
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.shape {
		flex: none;
	}
	.board {
		position: relative;
		flex: 1;
		min-height: 0;
		margin: var(--space-2);
		/* The board handles its own taps; no double-tap zoom delay. */
		touch-action: manipulation;
	}
	.slot {
		position: absolute;
		translate: -50% calc(-50% + 0.6em);
	}
	/* While arranging, a press drags a seat instead of scrolling or zooming. */
	.arranging {
		touch-action: none;
		outline: 1px dashed var(--border);
		outline-offset: var(--space-1);
		border-radius: var(--radius-md);
	}
	.arranging .slot {
		cursor: grab;
	}
	.slot.dragging {
		z-index: 2;
		cursor: grabbing;
	}
	.chip-slot {
		position: absolute;
		translate: -50% -50%;
		z-index: 1;
	}
	.chip-slot.dragging {
		z-index: 3;
		scale: 1.15;
	}
	.gap {
		position: absolute;
		translate: -50% -50%;
		z-index: 1;
		width: var(--tap-target);
		height: var(--tap-target);
		border: 1px dashed var(--border);
		border-radius: 50%;
		background: var(--surface-raised);
		color: var(--on-surface);
		font: 600 1rem / 1 var(--font-control);
		cursor: pointer;
	}
	.gap:hover {
		background: var(--surface-selected);
	}
	.rules {
		position: absolute;
		left: 50%;
		top: 50%;
		translate: -50% -50%;
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-1);
		max-width: 50%;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.rules.hidden {
		visibility: hidden;
	}
	.rule {
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: none;
		cursor: pointer;
	}
	.menu {
		display: grid;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}
	.choices {
		display: flex;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}
	.rule-detail {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
	}
	.rule-detail p {
		margin: 0;
		font-family: var(--font-ability);
	}
</style>
