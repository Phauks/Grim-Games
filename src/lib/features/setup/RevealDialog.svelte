<script lang="ts">
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Alignment, Character, PlayerName } from '#lib/core/data/index.ts';
	import CharacterRow from '#lib/features/characters/CharacterRow.svelte';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { gameSettings } from '#lib/features/game-settings/game-settings.svelte.ts';
	import { untrack } from 'svelte';
	import { reelsMove, spinReel } from './reel.ts';
	import PlayerNameInput from './PlayerNameInput.svelte';
	import HoldToSee from '#lib/ui/primitives/HoldToSee.svelte';
	import { noLongPress } from '#lib/ui/no-long-press.ts';

	interface Props {
		open: boolean;
		/** The tile's label on the draw screen: its number or letter. */
		number: string;
		/** What the player sees: never the grimoire character (the Drunk sees a Townsfolk). */
		shows: Character;
		/**
		 * The grimoire character is a Traveller: the Storyteller may set its alignment now or
		 * leave it as None and set it on the first night (Trevor, 2026-10-16).
		 */
		needsAlignment: boolean;
		/** "Seat 3", the seat the draw goes to. */
		seatLabel: string;
		/** The name already on the seat, to start the name field with. */
		playerName: PlayerName;
		/** Names already on other seats, left out of the names to pick from. */
		taken?: readonly string[];
		/**
		 * One token for two games (Two games at once, Trevor 2026-10-18): the other game's
		 * character, shown beside `shows`, with a label for each game.
		 */
		pair?: { shows: Character; labels: [string, string] };
		/**
		 * The locked pass-the-phone draw (Trevor, 2026-10-19): the token shows only while a
		 * finger, mouse button or Space is held on it, so a neighbour can't glance at it.
		 */
		holdToReveal?: boolean;
		/**
		 * The slot machine reveal (Trevor, 2026-10-22, a Bag draw setting): the token first
		 * spins through these characters, then stops on the player's. Purely visual.
		 */
		reel?: readonly Character[];
		/**
		 * Closing the reveal once the character was seen confirms it (Trevor, 2026-10-22: no
		 * "held" after a player has seen their character, so nobody else can take it back).
		 */
		confirmOnClose?: boolean;
		onConfirm: (details: { playerName: string; alignment?: Alignment }) => void;
	}

	let {
		open = $bindable(),
		number,
		shows,
		needsAlignment,
		seatLabel,
		playerName,
		taken = [],
		pair,
		holdToReveal = false,
		reel = [],
		confirmOnClose = false,
		onConfirm
	}: Props = $props();
	const faces = $derived(
		pair
			? [
					{ label: pair.labels[0], character: shows },
					{ label: pair.labels[1], character: pair.shows }
				]
			: [{ label: '', character: shows }]
	);

	let name = $state('');
	let alignment = $state<Alignment | ''>('');
	/** False while the player still has to type their name to see the token. */
	let revealed = $state(true);
	/** Hold to reveal: held now, and seen at least once (Confirm waits for that). */
	let held = $state(false);
	let seen = $state(false);
	$effect(() => {
		if (open) {
			name = playerName;
			alignment = '';
			revealed = !gameSettings.current.requireName || playerName.trim() !== '';
			held = false;
			seen = false;
		}
	});
	/** The reel's character while it spins; undefined once it has stopped on the player's. */
	let spinning = $state<Character>();
	let spun = false;
	let cancelReel = () => {};
	function stopReel() {
		cancelReel();
		spinning = undefined;
	}
	function spin() {
		spun = true;
		if (reel.length < 2 || pair || !reelsMove()) return;
		cancelReel = spinReel(reel, (character) => (spinning = character), stopReel);
	}
	const shown = $derived(revealed && (!holdToReveal || held));
	$effect(() => {
		if (!open) {
			spun = false;
			stopReel();
		} else if (shown && !spun && reel.length > 0) untrack(spin);
	});
	/** The character itself shows once the reel has stopped. */
	const visible = $derived(shown && !spinning);
	/** The character has been seen in this reveal (not just the spinning reel). */
	let shownOnce = false;
	$effect(() => {
		if (!open) return;
		if (visible) shownOnce = true;
	});
	const canConfirm = $derived(revealed && (!holdToReveal || seen) && !spinning);

	/** Set once this reveal is confirmed, so closing it doesn't confirm it again. */
	let confirmed = false;
	function confirm() {
		confirmed = true;
		onConfirm({ playerName: name, ...(alignment !== '' ? { alignment } : {}) });
	}
	// Closed with X, Escape or a tap outside: confirmed if the character was seen.
	let wasOpen = false;
	$effect(() => {
		if (open) {
			wasOpen = true;
			confirmed = false;
			if (!untrack(() => visible)) shownOnce = false;
		} else if (wasOpen) {
			wasOpen = false;
			if (confirmOnClose && !confirmed && shownOnce) confirm();
		}
	});

	// On a computer, Enter (outside a field or button) does the main action: Reveal, then Confirm.
	function onWindowKey(event: KeyboardEvent) {
		if (!open || event.key !== 'Enter' || event.repeat || event.defaultPrevented) return;
		const target = event.target as HTMLElement | null;
		if (target?.closest('input, textarea, select, button, a, [role="radio"]')) return;
		event.preventDefault();
		if (canConfirm) confirm();
		else if (revealed) return;
		else if (name.trim() !== '') revealed = true;
	}
</script>

<svelte:window onkeydown={onWindowKey} />

<!--
	The player's own reveal. A drawn tile is never put back (Trevor, 2026-10-15): closing the
	reveal before the character was seen keeps it in the player's hand (the draw is saved);
	with confirmOnClose, closing it after confirms it (Trevor, 2026-10-22).
-->
<Dialog bind:open title={t('setup.draw.tile', { number })} size="full">
	<div class="reveal" data-testid="reveal">
		<!-- The seat and the name share the top row; the token gets the middle (Trevor, 2026-11-02).
		     Confirm stays a separate tap from Enter in the name. -->
		<div class="top">
			<span class="seat">{seatLabel}</span>
			<PlayerNameInput bind:value={name} {taken} hideLabel />
		</div>
		<!-- Hidden until a name is entered when that's required; the space stays reserved. -->
		<!-- No long-press anywhere on the faces, held or not: Chrome's long press on the token's
		     image or the ability's text buzzes too (Trevor, 2026-10-25: "let's just remove it"). -->
		<div class="faces" class:pair={!!pair} {@attach noLongPress}>
			{#each faces as face, i (i)}
				<div class="face" data-testid="reveal-face">
					{#if face.label}<p class="town">{face.label}</p>{/if}
					{#if holdToReveal && revealed}
						<HoldToSee
							label={t('setup.reveal.hold')}
							testid="reveal-hold"
							bind:held
							onhold={(on) => on && (seen = true)}
						>
							<CharacterToken character={spinning ?? face.character} size={pair ? 140 : 240} />
						</HoldToSee>
					{:else}
						<div class="token" data-testid="reveal-token" data-spinning={spinning ? '' : undefined}>
							{#if revealed}<CharacterToken
									character={spinning ?? face.character}
									size={pair ? 140 : 240}
								/>{:else}<span class="hidden-token" data-testid="reveal-locked"
									>{t('setup.reveal.locked')}</span
								>{/if}
						</div>
					{/if}
					<!-- The character as Character selection shows it: the shared row (Trevor,
					     2026-10-31); its place stays reserved while the token is locked. -->
					<div class="row" data-testid="reveal-name">
						{#if visible}<CharacterRow character={face.character} info />{/if}
					</div>
				</div>
			{/each}
		</div>
		<!-- A Traveller's alignment, under its row. Only a Traveller's reveal has it, and that never
		     changes while the reveal is open, so the token stays centred everywhere else. -->
		{#if needsAlignment}
			<div class="alignment">
				<Select
					label={t('setup.reveal.alignment')}
					value={alignment === '' ? 'none' : alignment}
					options={[
						{ value: 'none', label: t('common.none') },
						{ value: 'good', label: t('setup.reveal.good') },
						{ value: 'evil', label: t('setup.reveal.evil') }
					]}
					onChange={(v) => (alignment = v === 'none' ? '' : (v as Alignment))}
				/>
			</div>
		{/if}
	</div>
	{#snippet actions()}
		{#if revealed}
			<ModalActions onConfirm={confirm} disabled={!canConfirm} />
		{:else}
			<Button variant="accent" disabled={name.trim() === ''} onclick={() => (revealed = true)}
				>{t('setup.reveal.reveal')}</Button
			>
		{/if}
	{/snippet}
</Dialog>

<style>
	/* Seat and name at the top, the token in the middle, its row below with room around it. */
	.reveal {
		display: flex;
		flex: 1;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
		overflow-y: auto;
		text-align: center;
	}
	.top {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: var(--space-3);
		width: min(100%, 28rem);
	}
	.faces {
		display: grid;
		flex: 1;
		align-content: center;
		-webkit-user-select: none;
		user-select: none;
		-webkit-touch-callout: none;
		gap: var(--space-4);
		justify-items: center;
		width: 100%;
	}
	.faces.pair {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		align-items: start;
	}
	.face {
		display: grid;
		justify-items: center;
		gap: var(--space-4);
		min-width: 0;
		width: 100%;
	}
	.town {
		margin: 0;
		font-weight: 600;
	}
	.seat {
		color: var(--on-surface-muted);
		white-space: nowrap;
	}
	/*
	 * The token keeps one size (Character token size is for the board only, Trevor 2026-10-19).
	 * The locked face is the same size, so revealing moves nothing.
	 */
	.token {
		display: grid;
		place-items: center;
		min-width: calc(15 * var(--u));
		min-height: calc(15 * var(--u));
	}
	.pair .token {
		min-width: calc(9 * var(--u));
		min-height: calc(9 * var(--u));
	}
	.hidden-token {
		display: grid;
		place-items: center;
		width: calc(15 * var(--u));
		height: calc(15 * var(--u));
		padding: var(--space-3);
		box-sizing: border-box;
		border-radius: 50%;
		background: var(--token-face);
		color: var(--on-token);
		box-shadow: inset 0 0 0 3px var(--token-rim);
		font-size: 0.9rem;
	}
	.pair .hidden-token {
		width: calc(9 * var(--u));
		height: calc(9 * var(--u));
	}
	/*
	 * The row's height is reserved while the token is locked: the ring is as tall as the name
	 * and two lines of ability (CharacterRow's --character-ring).
	 */
	.row {
		width: min(100%, 28rem);
		min-height: 4.4em;
		font-size: 1.1rem;
		text-align: start;
	}
	.alignment {
		width: min(100%, 20rem);
	}
</style>
