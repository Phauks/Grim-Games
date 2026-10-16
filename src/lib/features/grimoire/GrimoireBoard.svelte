<script lang="ts">
	import type { Night, NightStep } from '#lib/core/rules/index.ts';
	import GuidedStep from './GuidedStep.svelte';
	import NightStrip from './NightStrip.svelte';
	import { boardNightSteps, stepHolders } from './night-steps.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { backgroundFor, type BackgroundChoice } from './backgrounds.ts';
	import BackgroundDialog from './BackgroundDialog.svelte';
	import { openAccount, openSettings } from '#lib/features/shell/shell.ts';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Alignment, CharacterId } from '#lib/core/data/index.ts';
	import {
		scriptCharacterIds,
		trueCharacter,
		type ReminderId,
		type SeatId
	} from '#lib/core/model/index.ts';
	import InfoTokensSheet from '#lib/features/info-tokens/InfoTokensSheet.svelte';
	import { setupComplete, setupReminders } from '#lib/core/rules/index.ts';
	import BluffsSheet from '#lib/features/bluffs/BluffsSheet.svelte';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import {
		followSeating,
		isDefaultLayout,
		isRotation,
		keepInside,
		seatPoints,
		seatTokenSize,
		spreadEvenly,
		towardsMiddle,
		withPlaced,
		withoutPlaced,
		type SeatPoint
	} from '#lib/ui/seating/seat-layout.ts';
	import { placeNames, type Box } from './name-placement.ts';
	import { isOrphan, placingAlignment, recommendedTravellers } from './board.ts';
	import CharacterPicker from './CharacterPicker.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import BoardReminder from './BoardReminder.svelte';
	import { findEdition, fromScript, scriptToJson } from '#lib/core/data/index.ts';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import { shareTargetFor } from '#lib/features/scripts/share-codes.ts';
	import SharePanel from '#lib/features/scripts/SharePanel.svelte';
	import HistoryDialog from './HistoryDialog.svelte';
	import NightOrderSheet from './NightOrderSheet.svelte';
	import SeatSheet from './SeatSheet.svelte';
	import SeatToken from './SeatToken.svelte';
	import ReminderBank from './ReminderBank.svelte';
	import { pendingTray, trayItems, type BankView } from './setup-tray.ts';
	import ReminderMoveConfirm from './ReminderMoveConfirm.svelte';

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
	// The token size setting is applied here, within the spacing, so seats never overlap; the
	// tokens on the ring then draw at exactly this size (SeatToken resets --token-scale).
	const tokenScale = $derived(preferences.current.tokenAppearance.tokenScale);
	const reminderScale = $derived(preferences.current.tokenAppearance.reminderScale);
	const size = $derived(seatTokenSize(game.seating, layout, { width, height }, tokenScale));
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
	const chip = $derived(Math.round(Math.max(30, Math.min(48, size * 0.5)) * reminderScale));
	function chipPoints(i: number, count: number): SeatPoint[] {
		const distances = Array.from(
			{ length: Math.min(count, MAX_SHOWN) },
			(_, k) => size / 2 + chip / 2 + 6 + k * (chip + 10)
		);
		return towardsMiddle(shown[i], { width, height }, distances);
	}

	// ── Player names: placed where nothing covers them (outside first) ──
	let rootFont = $state(16);
	$effect(() => {
		void preferences.current;
		rootFont = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
	});
	const namePlaces = $derived.by(() => {
		if (width <= 0 || height <= 0) return [];
		const px = (p: SeatPoint) => ({ x: (p.x / 100) * width, y: (p.y / 100) * height });
		const lineHeight = Math.ceil(rootFont * 0.9 * 1.2);
		const widths = seats.map((seat, i) => {
			const name = seat.playerName ?? `Seat ${i + 1}`;
			return Math.min(size + 2 * unit, name.length * rootFont * 0.9 * 0.55 + 6);
		});
		const obstacles: Box[] = seats.flatMap((seat, i) =>
			chipPoints(i, seat.reminders.length).map((p) => ({ ...px(p), w: chip, h: chip }))
		);
		return placeNames({
			seats: shown.map(px),
			size,
			widths,
			height: lineHeight,
			obstacles,
			board: { width, height }
		});
	});

	interface ReminderDrag {
		reminderId: ReminderId;
		from: SeatId;
		/** Where the token is, in % of the board. */
		at: SeatPoint;
		target?: SeatId;
	}
	let reminderDrag = $state<ReminderDrag | undefined>();
	/**
	 * Where a dragged reminder came from (Trevor, 2026-10-16): its character, the seats that
	 * hold that character (marked on the board) and the seat it is on now.
	 */
	const dragOrigin = $derived.by(() => {
		if (!reminderDrag) return undefined;
		const id = reminderDrag.reminderId;
		const reminder = game.seats[reminderDrag.from]?.reminders.find((r) => r.reminderId === id);
		if (!reminder) return undefined;
		const holders = game.seating.filter(
			(s) =>
				game.seats[s].characterId === reminder.characterId ||
				trueCharacter(game, s, characters) === reminder.characterId
		);
		const name = (s: SeatId) =>
			game.seats[s].playerName
				? `Seat ${game.seating.indexOf(s) + 1} · ${game.seats[s].playerName}`
				: `Seat ${game.seating.indexOf(s) + 1}`;
		const character = characters.get(reminder.characterId)?.name ?? reminder.characterId;
		return {
			holders,
			text:
				`${reminder.label}, from ${character}` +
				(holders.length > 0 ? ` (${holders.map(name).join(', ')})` : '') +
				` · on ${name(reminderDrag.from)}`
		};
	});

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

	let moveConfirm = $state<ReturnType<typeof ReminderMoveConfirm>>();
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
		// Dropped back on the setup reminders tray: it waits there again (History has it).
		const tray = board.querySelector('[data-tray]')?.getBoundingClientRect();
		if (tray && x >= tray.left && x <= tray.right && y >= tray.top && y <= tray.bottom) {
			grimoire.run({ type: 'RemoveReminder', reminderId });
			return;
		}
		// Dropped on another seat: moved (one History entry). Anywhere else: nothing changes.
		if (target && target !== from) moveConfirm?.request(reminderId, target);
	}

	// ── Arranging seats ──
	// Seats can be dragged anywhere (people on a couch, a gap by the door) and gaps left
	// between neighbours. Only where seats are drawn changes; the seating order does not.
	let arranging = $state(false);
	function startArranging() {
		arranging = true;
		toast(
			'Arrange seats',
			'Drag a seat anywhere to space the table, or onto another seat to change the seating order.'
		);
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
	/** Where seats are drawn now: a dragged seat follows the finger, with its reminders. */
	const shown = $derived(
		drag ? points.map((p, i) => (game.seating[i] === drag!.seatId ? drag!.at : p)) : points
	);

	// Rotating moves the players, not the places: a hand-placed spot or a gap stays where it
	// is and whoever now sits there takes it. Also after History restores a rotation.
	let lastSeating: readonly SeatId[] = [];
	$effect(() => {
		const seating = game.seating;
		if (isRotation(lastSeating, seating) && !isDefaultLayout(grimoire.layout))
			grimoire.setLayout(followSeating(grimoire.layout, lastSeating, seating));
		lastSeating = seating;
	});
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
	/** The other seat a dragged seat is over, if any: dropping there changes the order. */
	const reorderTarget = $derived.by(() => {
		if (!drag?.moved) return undefined;
		const dragged = drag.seatId;
		let best: SeatId | undefined;
		let bestDistance = size * 0.6;
		game.seating.forEach((id, i) => {
			if (id === dragged) return;
			const d = Math.hypot(
				((points[i].x - drag!.at.x) / 100) * width,
				((points[i].y - drag!.at.y) / 100) * height
			);
			if (d < bestDistance) {
				best = id;
				bestDistance = d;
			}
		});
		return best;
	});
	function dragEnd(event: PointerEvent) {
		if (!drag || event.pointerId !== drag.pointerId) return;
		const target = reorderTarget;
		if (target) {
			// Onto another seat: the player takes that place in the seating order (one History
			// entry), and follows the ring rather than a hand-placed spot.
			const position = game.seating.indexOf(target);
			if (grimoire.run({ type: 'MoveSeat', seatId: drag.seatId, position }))
				grimoire.setLayout(withoutPlaced(layout, drag.seatId));
		} else if (drag.moved) grimoire.setLayout(withPlaced(layout, drag.seatId, drag.at));
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
		const id = traveller;
		traveller = undefined;
		if (id) startPlacing((position) => grimoire.addTraveller(id, alignment, position));
	}

	// ── Placing a new seat: the Storyteller taps where it goes (Trevor, 2026-10-16) ──
	let placing = $state<((position: number) => void) | undefined>();
	function startPlacing(add: (position: number) => void) {
		placing = add;
		toast('Add a seat', 'Tap between two players to put the new seat there.');
	}
	/** One spot between each pair of neighbours; the one after the last seat wraps round. */
	const placeSpots = $derived(
		placing
			? shown.map((p, i) => {
					const next = shown[(i + 1) % shown.length];
					const name = (k: number) => game.seats[game.seating[k]].playerName ?? `Seat ${k + 1}`;
					return {
						position: i + 1,
						at: { x: (p.x + next.x) / 2, y: (p.y + next.y) / 2 },
						label: `Place between ${name(i)} and ${name((i + 1) % shown.length)}`
					};
				})
			: []
	);
	function placeAt(position: number) {
		const add = placing;
		placing = undefined;
		add?.(position);
	}

	// ── Setup reminders: a tray of suggested tokens in the middle of the board ──
	// ── The reminder bank under the board (Trevor, 2026-10-16): setup suggestions until
	// they are all placed or dismissed (or the first day starts), then every reminder left.
	// The Storyteller can switch at any time.
	let trayHints = $state<{ seats: SeatId[]; target?: SeatId }>({ seats: [] });
	const setupPending = $derived(
		pendingTray(trayItems(setupReminders(game, characters)), game, grimoire.trayDismissed).length
	);
	let bankChosen = $state<BankView | undefined>();
	const bankView = $derived<BankView>(
		bankChosen ?? (setupPending > 0 && game.pastDays.length === 0 ? 'setup' : 'all')
	);
	function startTray() {
		bankChosen = 'setup';
	}

	/** Characters and Bag draw show in the middle until the game is set up, then go. */
	const showSetup = $derived(
		!setUp &&
			!arranging &&
			!placing &&
			game.seating.some((id) => game.seats[id].characterId === undefined)
	);
	let bluffsOpen = $state(false);
	let historyOpen = $state(false);
	let nightOpen = $state(false);
	// ── Assisted night order (Trevor, 2026-10-16) ──
	let guided = $state<{ step: NightStep; night: Night } | undefined>();
	let guideOpen = $state(false);
	/** Walking through the night under the board: which night and which step. */
	let walk = $state<{ night: Night; index: number } | undefined>();
	const walkSteps = $derived.by(() => {
		const data = officialData.current;
		return walk && data ? boardNightSteps(game, characters, walk.night, data) : [];
	});
	const walkStep = $derived(walk ? walkSteps[walk.index] : undefined);
	/** Who wakes for the current walk-through step, marked on the board. */
	const walkHolders = $derived(walkStep ? stepHolders(game, walkStep, characters) : []);

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
	// ── Info tokens: the cards shown to players, one tap from the toolbar ──
	let infoOpen = $state(false);
	const infoCharacters = $derived(
		scriptCharacterIds(game.script).flatMap((id) => characters.get(id) ?? [])
	);
	const infoPlayers = $derived(
		game.seating.map((id, i) => ({ id, label: game.seats[id].playerName ?? `Seat ${i + 1}` }))
	);
	let exitOpen = $state(false);

	// ── Background: an image of the Storyteller's own, kept on this device ──
	let backgroundOpen = $state(false);
	let background = $state<BackgroundChoice>({ kind: 'none' });
	let backgroundRead = $state(0);
	$effect(() => {
		void backgroundRead;
		const gameId = game.gameId;
		backgroundFor(gameId)
			.then((choice) => {
				if (game.gameId === gameId) background = choice;
			})
			.catch(() => (background = { kind: 'none' }));
	});
	/** The script's own background, only when it is a web link. */
	const scriptBackground = $derived(
		/^https:\/\//.test(game.script.meta?.background ?? '')
			? game.script.meta?.background
			: undefined
	);
	let backgroundUrl = $state<string | undefined>();
	$effect(() => {
		if (background.kind === 'image') {
			const url = URL.createObjectURL(background.image);
			backgroundUrl = url;
			return () => URL.revokeObjectURL(url);
		}
		backgroundUrl = background.kind === 'script' ? scriptBackground : undefined;
	});
	const showTitle = $derived(
		preferences.current.assistance.scriptTitle && !game.script.meta?.hideTitle
	);
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
			<span class="title arranging-title">Arrange seats</span>
			<span class="spacer"></span>
			<IconButton
				icon="undo"
				label="Rotate players anticlockwise"
				onclick={() => grimoire.run({ type: 'RotateSeats', direction: 'anticlockwise' })}
			/>
			<IconButton
				icon="redo"
				label="Rotate players clockwise"
				onclick={() => grimoire.run({ type: 'RotateSeats', direction: 'clockwise' })}
			/>
			<Button
				variant="quiet"
				disabled={Object.keys(layout.placed).length === 0 && Object.keys(layout.gaps).length === 0}
				onclick={() => grimoire.setLayout(spreadEvenly(layout))}>Spread evenly</Button
			>
			<Button variant="accent" icon="check" onclick={() => (arranging = false)}>Done</Button>
		{:else if placing}
			<span class="title">Add a seat</span>
			<Button variant="quiet" icon="close" onclick={() => (placing = undefined)}>Cancel</Button>
		{:else}
			<!-- Icons on phones; with their words on wider screens, where there is room. -->
			<span class="spacer"></span>
			<Button
				variant="quiet"
				icon="night"
				aria-label="Night order"
				onclick={() => (nightOpen = true)}><span class="tool-label">Night order</span></Button
			>
			<Button
				variant="quiet"
				icon="day"
				aria-label="Day"
				onclick={() => goto(resolve('/grimoire/[gameId]/day', { gameId: game.gameId }))}
				><span class="tool-label">Day</span></Button
			>
			<Button variant="quiet" icon="info" aria-label="Info tokens" onclick={() => (infoOpen = true)}
				><span class="tool-label">Info tokens</span></Button
			>
			<Button variant="quiet" icon="arrange" aria-label="Arrange seats" onclick={startArranging}
				><span class="tool-label">Arrange seats</span></Button
			>
			<Button variant="quiet" icon="menu" aria-label="More" onclick={() => (menuOpen = true)}
				><span class="tool-label">More</span></Button
			>
		{/if}
	</div>

	<div
		class="board"
		class:arranging
		class:walking={walk !== undefined}
		style:--tray-h="{chip + 30}px"
		style:--strip-h={walk ? '7.5rem' : undefined}
		bind:this={board}
	>
		{#if backgroundUrl}
			<div
				class="backdrop"
				data-testid="board-background"
				style:background-image={`url("${backgroundUrl}")`}
			></div>
		{/if}
		<!-- The script's name and author sit behind the circle, so the toolbar keeps its room. -->
		{#if showTitle}
			<p class="watermark" class:on-image={backgroundUrl !== undefined} aria-hidden="true">
				<span class="script-name">{game.script.meta?.name ?? 'Custom script'}</span>
				{#if game.script.meta?.author}<span class="author">by {game.script.meta.author}</span>{/if}
			</p>
		{/if}
		{#each seats as seat, i (seat.seatId)}
			{@const at = shown[i]}
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
					dropTarget={reorderTarget === seat.seatId ||
						(reminderDrag !== undefined &&
							reminderDrag.target === seat.seatId &&
							reminderDrag.from !== seat.seatId) ||
						trayHints.target === seat.seatId}
					hint={trayHints.seats.includes(seat.seatId) ||
						walkHolders.includes(seat.seatId) ||
						(dragOrigin?.holders.includes(seat.seatId) ?? false)}
					namePlace={namePlaces[i] ?? 'below'}
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
							alignment={placingAlignment(game, reminder.characterId, characters)}
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

		{#each placeSpots as spot (spot.position)}
			<button
				type="button"
				class="place-spot"
				style:left="{spot.at.x}%"
				style:top="{spot.at.y}%"
				aria-label={spot.label}
				onclick={() => placeAt(spot.position)}><Icon name="add" /></button
			>
		{/each}
		{#if reminderDrag && dragOrigin}
			<p class="origin" role="status">{dragOrigin.text}</p>
		{/if}
		{#if walk}
			<NightStrip
				{grimoire}
				steps={walkSteps}
				night={walk.night}
				index={walk.index}
				onIndex={(index) => walk && (walk = { ...walk, index })}
				onOpen={(step) => {
					if (!walk) return;
					guided = { step, night: walk.night };
					guideOpen = true;
				}}
				onClose={() => (walk = undefined)}
			/>
		{/if}
		<ReminderBank
			{grimoire}
			{board}
			size={chip}
			view={bankView}
			onView={(v) => (bankChosen = v)}
			focus={walkStep?.character?.id}
			{seatAt}
			onHints={(h) => (trayHints = h)}
		/>

		<div class="centre">
			<!-- Until the game is set up: choosing characters and the bag, then out of the way. -->
			{#if showSetup}
				<div class="setup">
					<Button
						icon="players"
						onclick={() => goto(resolve('/grimoire/[gameId]/setup', { gameId: game.gameId }))}
						>Characters</Button
					>
					<Button
						icon="bag"
						onclick={() => goto(resolve('/grimoire/[gameId]/draw', { gameId: game.gameId }))}
						>Bag draw</Button
					>
				</div>
			{/if}
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
</div>

<!-- Less frequent actions, in an overlay so the toolbar fits a phone. -->
<Dialog bind:open={menuOpen} title="Grimoire">
	<div class="menu">
		<Button variant="quiet" icon="history" onclick={() => fromMenu(() => (historyOpen = true))}>
			History
		</Button>
		<Button
			variant="quiet"
			icon="add"
			onclick={() => fromMenu(() => startPlacing((position) => grimoire.addSeat(position)))}
		>
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
		<Button variant="quiet" icon="share" onclick={() => fromMenu(() => (shareOpen = true))}>
			Share script
		</Button>
		<Button
			variant="quiet"
			icon="players"
			onclick={() =>
				fromMenu(() => goto(resolve('/grimoire/[gameId]/room', { gameId: game.gameId })))}
		>
			Players' phones
		</Button>
		<Button
			variant="quiet"
			icon="appearance"
			onclick={() => fromMenu(() => (backgroundOpen = true))}
		>
			Background
		</Button>
		<!-- The site header is hidden in a game so nobody leaves by accident (Trevor, 2026-10-16). -->
		<Button variant="quiet" icon="settings" onclick={() => fromMenu(() => openSettings())}>
			Settings
		</Button>
		<Button variant="quiet" icon="account" onclick={() => fromMenu(() => void openAccount())}>
			Account
		</Button>
		<Button variant="quiet" icon="back" onclick={() => fromMenu(() => (exitOpen = true))}>
			Exit game
		</Button>
	</div>
</Dialog>

<ReminderMoveConfirm bind:this={moveConfirm} {grimoire} />

<InfoTokensSheet bind:open={infoOpen} characters={infoCharacters} players={infoPlayers} />

<BackgroundDialog
	bind:open={backgroundOpen}
	gameId={game.gameId}
	scriptImage={scriptBackground}
	current={background}
	onChange={() => (backgroundRead += 1)}
/>

<Dialog bind:open={exitOpen} title="Exit game?" role="alertdialog">
	<dl class="change">
		<dt>Now</dt>
		<dd>In the grimoire for {game.script.meta?.name ?? 'this game'}</dd>
		<dt>Becomes</dt>
		<dd>The home page. The game stays saved and opens again from there.</dd>
	</dl>
	{#snippet actions()}
		<Button variant="quiet" onclick={() => (exitOpen = false)}>Cancel</Button>
		<Button variant="accent" icon="back" onclick={() => goto(resolve('/'))}>Exit game</Button>
	{/snippet}
</Dialog>

<SeatSheet bind:open={sheetOpen} {grimoire} seatId={selected} />

<HistoryDialog bind:open={historyOpen} {grimoire} />

<Dialog
	bind:open={shareOpen}
	title="Share script"
	description="Players get the script only, never anything from this game."
>
	{#if shareTarget}
		<SharePanel
			title={game.script.meta?.name ?? 'Custom script'}
			target={shareTarget}
			ondelete={() => (shareOpen = false)}
		/>
	{/if}
</Dialog>

<NightOrderSheet
	bind:open={nightOpen}
	{grimoire}
	onGuide={(step, night) => {
		guided = { step, night };
		guideOpen = true;
	}}
	onWalk={(night) => {
		walk = { night, index: 0 };
	}}
/>

<GuidedStep
	bind:open={guideOpen}
	{grimoire}
	step={guided?.step}
	night={guided?.night ?? 'first'}
	onInfoTokens={() => (infoOpen = true)}
/>

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
	recommended={recommendedTravellers(game.script, characters)}
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
		/* Fills the screen: a game hides the app header and footer (route data). */
		height: calc(100dvh - env(safe-area-inset-top));
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
	.board {
		position: relative;
		flex: 1;
		min-height: 0;
		margin: var(--space-2);
		/* The board handles its own taps; no double-tap zoom delay. */
		touch-action: manipulation;
	}
	/* Room under the board for the docked reminder bank, and the walk-through strip. */
	.board {
		margin-bottom: calc(var(--tray-h) + 2 * var(--space-2));
	}
	.board.walking {
		margin-bottom: calc(var(--strip-h) + var(--tray-h) + 3 * var(--space-2));
	}
	.slot {
		position: absolute;
		translate: -50% -50%;
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
	.place-spot {
		position: absolute;
		z-index: 3;
		display: grid;
		place-items: center;
		width: var(--tap-target);
		height: var(--tap-target);
		translate: -50% -50%;
		border: 2px dashed var(--accent);
		border-radius: 50%;
		background: var(--surface-raised);
		color: var(--accent);
		cursor: pointer;
	}
	.place-spot:hover {
		background: var(--surface-selected);
	}
	/* Over the top of the board while a reminder is dragged: where it came from. */
	.origin {
		position: absolute;
		top: var(--space-1);
		left: 50%;
		z-index: 4;
		max-width: calc(100% - 2 * var(--space-2));
		margin: 0;
		padding: var(--space-1) var(--space-2);
		translate: -50% 0;
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: var(--on-surface);
		font-size: 0.85rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		pointer-events: none;
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
	.centre {
		position: absolute;
		left: 50%;
		top: 50%;
		translate: -50% -50%;
		display: grid;
		justify-items: center;
		gap: var(--space-2);
		max-width: 50%;
	}
	.setup {
		display: grid;
		gap: var(--space-2);
	}
	/* Dimmed so seats and reminders stay clear over any image. */
	.backdrop {
		position: absolute;
		inset: 0;
		background: center / cover no-repeat;
		filter: brightness(0.45) saturate(0.85);
		pointer-events: none;
	}
	.watermark {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		margin: 0;
		padding: 0 15%;
		font-family: var(--font-heading);
		line-height: 1.1;
		text-align: center;
		color: var(--heading);
		opacity: 0.12;
		pointer-events: none;
		user-select: none;
	}
	.script-name {
		font-size: clamp(1.5rem, 7vmin, 4rem);
	}
	.author {
		font-size: clamp(0.9rem, 3vmin, 1.5rem);
	}
	/* Over an image: a soft scrim and an outline keep the words readable. */
	.watermark.on-image {
		opacity: 0.5;
		background: radial-gradient(ellipse 45% 22% at center, rgb(0 0 0 / 0.55), transparent 100%);
		text-shadow:
			0 0 2px var(--backdrop),
			0 0 6px var(--backdrop);
	}
	.spacer {
		flex: 1;
	}
	.change {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-1) var(--space-3);
		margin: 0;
	}
	.change dt {
		color: var(--on-surface-muted);
		font-size: 0.85rem;
	}
	.change dd {
		margin: 0;
	}
	/* On a phone the arranging controls need the whole bar. */
	@media (max-width: 479.98px) {
		.arranging-title {
			display: none;
		}
	}
	/* Phones show the toolbar's icons only; wider screens add the words. */
	.toolbar :global(.tool-label) {
		display: none;
	}
	@media (max-width: 719.98px) {
		.toolbar :global(.button:has(.tool-label)) {
			min-width: var(--tap-target);
			padding: 0;
			gap: 0;
		}
	}
	@media (min-width: 720px) {
		.toolbar :global(.tool-label) {
			display: inline;
		}
	}
	.rules {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.rule {
		/* Sized from the seats, which already follow the token size setting. */
		--token-scale: 1;
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
