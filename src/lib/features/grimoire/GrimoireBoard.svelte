<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Alignment, CharacterId } from '#lib/core/data/index.ts';
	import type { SeatId } from '#lib/core/model/index.ts';
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
		seatPoints,
		seatTokenSize,
		withGap,
		withPlaced,
		withShape,
		type SeatPoint
	} from '#lib/ui/seating/seat-layout.ts';
	import { isOrphan } from './board.ts';
	import CharacterPicker from './CharacterPicker.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import HistoryDialog from './HistoryDialog.svelte';
	import SeatSheet from './SeatSheet.svelte';
	import SeatToken from './SeatToken.svelte';

	interface Props {
		grimoire: Grimoire;
	}

	let { grimoire }: Props = $props();

	const game = $derived(grimoire.game);
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
	const points = $derived(seatPoints(game.seating, layout, { width, height }));
	const size = $derived(seatTokenSize(game.seating, layout, { width, height }));

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
	function addTraveller(alignment: Alignment) {
		travellerAlignmentOpen = false;
		if (traveller) grimoire.addTraveller(traveller, alignment);
		traveller = undefined;
	}

	let bluffsOpen = $state(false);
	let historyOpen = $state(false);
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
		{:else}
			<span class="title">{game.script.meta?.name ?? 'Custom script'}</span>
			<IconButton icon="history" label="History" onclick={() => (historyOpen = true)} />
			<IconButton
				icon="players"
				label="Characters"
				onclick={() => goto(resolve('/grimoire/[gameId]/setup', { gameId: game.gameId }))}
			/>
			<IconButton
				icon="bag"
				label="Bag draw"
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
					onTap={() => !arranging && openSeat(seat.seatId)}
				/>
			</div>
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

		<!-- Fabled and Loric are rules of the game, not seats: they sit in the middle. -->
		<ul class="rules" aria-label="Fabled and Loric">
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
		<Button variant="quiet" icon="arrange" onclick={() => fromMenu(startArranging)}>
			Arrange seats
		</Button>
	</div>
</Dialog>

<SeatSheet bind:open={sheetOpen} {grimoire} seatId={selected} />

<HistoryDialog bind:open={historyOpen} {grimoire} />

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
	list
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
	</div>
</Dialog>

<CharacterPicker
	bind:open={ruleOpen}
	title="Add Fabled or Loric"
	{characters}
	script={game.script}
	types={['fabled', 'loric']}
	alwaysAll
	list
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
