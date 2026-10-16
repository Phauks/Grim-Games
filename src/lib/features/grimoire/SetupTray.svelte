<script lang="ts">
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
	import { pendingTray, trayItems, traySeats, type TrayItem } from './setup-tray.ts';

	/**
	 * Setup reminders on the board (Trevor, 2026-10-16): core's suggested tokens wait in a
	 * tray in the middle of the circle, where the board stays in view. The Storyteller drags
	 * each onto any seat, or taps it to read why and place it on a suggested seat. Nothing is
	 * placed by itself; a suggestion can be dismissed.
	 */
	interface Props {
		grimoire: Grimoire;
		board: HTMLElement | undefined;
		/** Token diameter in px. */
		size: number;
		/** The seat under a point (in % of the board), if any. */
		seatAt: (at: SeatPoint) => SeatId | undefined;
		/** Seats to mark while a token is dragged or open, and the one under the drag. */
		onHints: (hints: { seats: SeatId[]; target?: SeatId }) => void;
	}

	let { grimoire, board, size, seatAt, onHints }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const items = $derived(trayItems(setupReminders(game, characters)));
	const pending = $derived(pendingTray(items, game, grimoire.trayDismissed));
	const names = $derived(characterNames([...characters.values()]));
	// Each copy is its own token, unless "Stack duplicate reminders" is on: then copies of one
	// token show once with a count, and dragging or tapping takes the next copy.
	const shownTray = $derived.by((): { item: TrayItem; count: number }[] => {
		if (!preferences.current.assistance.stackReminders)
			return pending.map((item) => ({ item, count: 1 }));
		const stacks: { base: string; item: TrayItem; count: number }[] = [];
		for (const item of pending) {
			const base = `${item.suggestion.characterId}:${item.suggestion.label}`;
			const stack = stacks.find((s) => s.base === base);
			if (stack) stack.count += 1;
			else stacks.push({ base, item, count: 1 });
		}
		return stacks.map(({ item, count }) => ({ item, count }));
	});

	const seatName = (seatId: SeatId) =>
		game.seats[seatId]?.playerName ?? `Seat ${game.seating.indexOf(seatId) + 1}`;

	function place(item: TrayItem, seatId: SeatId) {
		const { characterId, label } = item.suggestion;
		grimoire.run({ type: 'AddReminder', seatId, reminder: { characterId, label } });
	}

	// ── Drag a token from the tray onto a seat ──
	let drag = $state<{ key: string; at: SeatPoint } | undefined>();
	function dragItem(item: TrayItem, x: number, y: number, end: boolean) {
		if (!board) return;
		const rect = board.getBoundingClientRect();
		const at = { x: ((x - rect.left) / rect.width) * 100, y: ((y - rect.top) / rect.height) * 100 };
		const target = seatAt(at);
		if (!end) {
			drag = { key: item.key, at };
			onHints({ seats: traySeats(item.suggestion), target });
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
	const dragged = $derived(pending.find((i) => i.key === drag?.key));

	// ── Tap: what it is for, and where it fits ──
	let shown = $state<TrayItem | undefined>();
	let shownOpen = $state(false);
	function show(item: TrayItem) {
		shown = item;
		shownOpen = true;
		onHints({ seats: traySeats(item.suggestion) });
	}
	$effect(() => {
		if (!shownOpen && !drag) onHints({ seats: [] });
	});
	function placeShown(seatId: SeatId) {
		if (shown) place(shown, seatId);
		shownOpen = false;
	}
	function dismissShown() {
		if (shown) grimoire.dismissTray(shown.key);
		shownOpen = false;
	}
</script>

<ul class="tray" aria-label="Setup reminders" data-tray>
	{#each shownTray as { item, count } (item.key)}
		<li class:lifted={drag?.key === item.key && count === 1}>
			{#if count > 1}<span class="count" aria-label={`${count} copies`}>×{count}</span>{/if}
			<BoardReminder
				label={item.suggestion.label}
				character={characters.get(item.suggestion.characterId)}
				alignment={placingAlignment(game, item.suggestion.characterId, characters)}
				{size}
				onTap={() => show(item)}
				onDrag={(x, y, end) => dragItem(item, x, y, end)}
				onCancel={cancelDrag}
			/>
		</li>
	{:else}
		<li class="none">None</li>
	{/each}
</ul>

{#if drag && dragged}
	<div class="floating" style:left="{drag.at.x}%" style:top="{drag.at.y}%" aria-hidden="true">
		<BoardReminder
			label={dragged.suggestion.label}
			character={characters.get(dragged.suggestion.characterId)}
			alignment={placingAlignment(game, dragged.suggestion.characterId, characters)}
			{size}
			disabled
			onTap={() => {}}
		/>
	</div>
{/if}

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
	.tray {
		position: absolute;
		left: 50%;
		top: 50%;
		translate: -50% -50%;
		z-index: 2;
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-2);
		max-width: 56%;
		max-height: 56%;
		margin: 0;
		padding: var(--space-2);
		overflow-y: auto;
		overscroll-behavior: contain;
		border: 1px dashed var(--border);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--surface) 85%, transparent);
		list-style: none;
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
