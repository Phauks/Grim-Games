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
	import { isOrphan, seatPosition, tokenSize } from './board.ts';
	import CharacterPicker from './CharacterPicker.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
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
	const size = $derived(tokenSize(width, height, seats.length));

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
		<span class="title">{game.script.meta?.name ?? 'Custom script'}</span>
		<IconButton
			icon="undo"
			label="Undo"
			disabled={!grimoire.open.canUndo}
			onclick={() => grimoire.open.undo()}
		/>
		<IconButton
			icon="redo"
			label="Redo"
			disabled={!grimoire.open.canRedo}
			onclick={() => grimoire.open.redo()}
		/>
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
	</div>

	<div class="board" bind:this={board}>
		{#each seats as seat, i (seat.seatId)}
			{@const at = seatPosition(i, seats.length)}
			<div class="slot" style:left="{at.x}%" style:top="{at.y}%">
				<SeatToken
					{seat}
					number={i + 1}
					character={seat.characterId ? characters.get(seat.characterId) : undefined}
					{size}
					upsideDown={grimoire.isFlipped(seat.seatId)}
					orphan={isOrphan(seat, game.script, characters)}
					onTap={() => openSeat(seat.seatId)}
				/>
			</div>
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
	</div>
</Dialog>

<SeatSheet bind:open={sheetOpen} {grimoire} seatId={selected} />

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
	.slot {
		position: absolute;
		translate: -50% calc(-50% + 0.6em);
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
