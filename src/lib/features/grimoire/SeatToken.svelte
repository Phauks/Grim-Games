<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import RimPill from '#lib/ui/seating/RimPill.svelte';
	import SeatNoteMark from '#lib/ui/seating/SeatNoteMark.svelte';
	import { defaultAlignment, type Character } from '#lib/core/data/index.ts';
	import { seatFrame } from '#lib/core/frames/index.ts';
	import type { ReminderId, Seat } from '#lib/core/model/index.ts';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import HeldAbilityPill from './HeldAbilityPill.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import SeatDisc from '#lib/ui/seating/SeatDisc.svelte';
	import AvatarFace from '#lib/ui/seating/AvatarFace.svelte';
	import { swallowNextClick } from '#lib/ui/tap.ts';
	import { boardLooks } from './board-looks.svelte.ts';
	import { roomHost } from '#lib/features/room/host.svelte.ts';
	import type { TrueCharacterMark } from './true-character-marks.ts';

	interface Props {
		seat: Seat;
		/** 1-based place in the seating order. */
		number: number;
		character?: Character;
		/** Token size in px. */
		size: number;
		/** The character is not on the script. */
		orphan: boolean;
		/** Highlighted while a reminder is dragged over it. */
		dropTarget?: boolean;
		/** The seat a dragged reminder is being moved from (Trevor, 2026-10-20): a dashed ring. */
		dragFrom?: boolean;
		/**
		 * While a reminder is picked up, chosen or its night step walked (Trevor, 2026-10-18):
		 * the seat whose character it belongs to (`source`), a seat it may go on (`target`), or
		 * both. A ring, a glow, or the two together, so it never rests on colour alone.
		 */
		role?: 'source' | 'target' | 'both';
		/** Faded while a reminder that doesn't fit this seat is dragged (it can still go here). */
		misfit?: boolean;
		/** Night order numbers for the leaf badges, when that setting is on. */
		nightNumbers?: { first?: number; other?: number };
		/**
		 * `note` when the tap landed on the pen mark (it opens the Notes sheet at this seat),
		 * `nominate` on the nomination marks (it asks who this player nominated), `avatar` on the
		 * player's avatar mark (it opens their profile, Trevor 2026-10-28).
		 */
		onTap: (part?: 'note' | 'nominate' | 'avatar') => void;
		/** A tap on a dead player's badge: marks their ghost vote used, or gives it back. */
		onGhostVote?: () => void;
		/**
		 * Held down (Trevor, 2026-10-19): true once the press has lasted, false when it lets go.
		 * A hold is never a tap, so it opens nothing; the board picks the seat up to move it.
		 * With a hold, the browser must not take the finger for a pan.
		 */
		onHold?: (holding: boolean) => void;
		/**
		 * Today's nominations (Trevor, 2026-10-23), while Track nominations is on: whether this
		 * player has nominated, and was nominated. A mark not yet earned shows greyed, as the
		 * ghost vote shows on the dead. `made` undefined: they may not nominate (the dead), so
		 * only the gavel shows.
		 */
		nominations?: { made?: boolean; received: boolean };
		/**
		 * Dead, but voting this many times on every nomination with no vote token (the Banshee
		 * killed by the Demon): the badge is a plain skull, with no ghost vote to spend.
		 */
		tokenFreeVotes?: number;
		/**
		 * Abilities the player holds without a token (the Boffin's good ability on the Demon,
		 * whose How to Run puts that token by the Demon's): each a small token on the left
		 * rim, faded while it doesn't work (a drunk, poisoned or dead Boffin).
		 */
		heldAbilities?: { character: Character; works: boolean }[];
		/**
		 * Who the player really is, from "Is The …" reminders shown in the pill (Grimbinder's
		 * look, Trevor 2026-10-31): each a small token marked =. A tap on one opens its reminder.
		 */
		trueCharacters?: TrueCharacterMark[];
		onReminder?: (reminderId: ReminderId) => void;
	}

	let {
		seat,
		number,
		character,
		size,
		orphan,
		dropTarget = false,
		dragFrom = false,
		role,
		misfit = false,
		nightNumbers,
		onTap,
		onGhostVote,
		onHold,
		nominations,
		tokenFreeVotes,
		heldAbilities = [],
		trueCharacters = [],
		onReminder
	}: Props = $props();

	// The player's alignment is not the one their character type starts with (a good Minion,
	// an evil Townsfolk): said in the label. The token stays upright and shows it by its icon's
	// colour (Trevor, 2026-10-18: "don't flip token, just change the color").
	const startsAs = $derived(character ? defaultAlignment(character.type) : undefined);
	const shifted = $derived(
		startsAs !== undefined && seat.alignment !== undefined && seat.alignment !== startsAs
	);

	const name = $derived(seat.playerName ?? t('common.seat', { number }));
	/** The seated player's own picture in the room (2026-10-27), in place of their initials. */
	const picture = $derived(seat.avatar ? roomHost().pictureOf(seat.seatId) : undefined);
	// The seat's accessible name, plain text; the board shows the name as its pill.
	const label = $derived(
		[
			// eslint-disable-next-line grim/names-as-badges -- an accessible name, see above
			`Seat ${number}: ${seat.playerName ?? 'no name'}`,
			character?.name ?? 'no character',
			seat.dead
				? tokenFreeVotes !== undefined
					? `dead, ${tokenFreeVotes} vote${tokenFreeVotes === 1 ? '' : 's'} per nomination`
					: seat.ghostVoteUsed
						? 'dead, ghost vote used'
						: 'dead'
				: '',
			// A Traveller has no starting alignment: always say it, or that it is not set yet.
			character?.type === 'traveller'
				? (seat.alignment ?? 'alignment not set')
				: shifted
					? `${seat.alignment}`
					: '',
			seat.notInPlay ? 'not in play' : '',
			orphan ? 'not on the script' : '',
			// eslint-disable-next-line grim/names-as-badges -- an accessible name, see above
			...trueCharacters.map(({ character: truly }) => `is really the ${truly.name}`),
			seat.notes?.length ? 'has a note' : '',
			seat.reminders.length
				? `${seat.reminders.length} reminder${seat.reminders.length === 1 ? '' : 's'}`
				: ''
		]
			.filter(Boolean)
			.join(', ')
	);

	// Taps come from Pointer Events, not `click`: browsers drop the click of a tap that lands
	// just after a swipe (the seat-sheet spike). `click` with detail 0 still covers keyboards.
	let down: { x: number; y: number } | null = null;
	const TAP_SLOP = 10;

	/** How long a press lasts before it is a hold. */
	const HOLD_MS = 500;
	let holdTimer: ReturnType<typeof setTimeout> | undefined;
	let held = false;
	function pointerdown(event: PointerEvent) {
		down = { x: event.clientX, y: event.clientY };
		clearTimeout(holdTimer);
		const token = event.currentTarget as HTMLElement;
		if (onHold)
			holdTimer = setTimeout(() => {
				held = true;
				// Held, the token keeps the pointer, so letting go anywhere ends the hold.
				try {
					token.setPointerCapture(event.pointerId);
				} catch {
					// Already let go.
				}
				onHold(true);
			}, HOLD_MS);
	}
	function pointermove(event: PointerEvent) {
		if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) >= TAP_SLOP)
			clearTimeout(holdTimer);
	}
	/** Ends a hold, if there was one; true when there was. */
	function letGo(): boolean {
		clearTimeout(holdTimer);
		if (!held) return false;
		held = false;
		onHold?.(false);
		return true;
	}
	function pointerup(event: PointerEvent) {
		if (letGo()) {
			swallowNextClick(event.currentTarget);
			down = null;
			return;
		}
		if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) < TAP_SLOP) {
			swallowNextClick(event.currentTarget);
			const target = event.target instanceof Element ? event.target : null;
			// The dead badge is the ghost vote's own switch (Trevor, 2026-10-19).
			if (
				target?.closest('[data-testid="dead-mark"]') &&
				onGhostVote &&
				tokenFreeVotes === undefined
			)
				onGhostVote();
			else if (target?.closest('[data-reminder]') && onReminder)
				onReminder(target.closest('[data-reminder]')!.getAttribute('data-reminder') as ReminderId);
			else
				onTap(
					target?.closest('.mark.note, .note-slot')
						? 'note'
						: target?.closest('.rim-pill[data-edge="top"]')
							? 'nominate'
							: target?.closest('.mark.avatar')
								? 'avatar'
								: undefined
				);
		}
		down = null;
	}
</script>

{#snippet face()}
	{#if character}
		<CharacterToken
			{character}
			alignment={seat.alignment}
			{size}
			showName={preferences.current.tokenAppearance.boardNames}
			{nightNumbers}
		/>
	{/if}
{/snippet}

{#snippet marks()}
	<!-- Corner marks sit in fixed places, so one appearing never moves anything (Trevor,
	     2026-10-28: nominations top left, the orphan warning top middle, the avatar top right). -->
	{#if orphan}<span class="mark orphan" data-testid="orphan-mark" title="Not on the script"
			><Icon name="warning" /></span
		>{/if}
	<!-- The player's own avatar (plan R6), upper right, where a player's grim cycles it with
	     their guesses, while a character covers the face. A tap opens the player's profile
	     (Trevor, 2026-10-28). -->
	{#if character && seat.avatar}<span class="mark avatar" data-testid="avatar-mark"
			><AvatarFace avatar={seat.avatar} {name} {picture} /></span
		>{/if}
	<!-- Today's nominations: two marks side by side in one pill over the top-left rim, each
	     greyed until it happens (Trevor, 2026-10-23), clear of the first-night number on the
	     left leaf (Trevor, 2026-10-24). A tap asks who this player nominated. -->
	{#if nominations}<RimPill side="left" testid="nomination-marks"
			>{#if nominations.made !== undefined}<span
					class="slot"
					data-testid="nominator-mark"
					data-on={nominations.made || undefined}
					title={nominations.made ? 'Has nominated today' : 'Has not nominated today'}
					><Icon name="nominator" /></span
				>{/if}<span
				class="slot"
				data-testid="nominated-mark"
				data-on={nominations.received || undefined}
				title={nominations.received ? 'Was nominated today' : 'Not nominated today'}
				><Icon name="nominated" /></span
			></RimPill
		>{/if}
	<!-- Abilities held without a token, with the notes mark (HeldAbilityPill); the Storyteller's
	     notes alone keep their own mark, lower right (never shown to players). -->
	{#if heldAbilities.length || trueCharacters.length}<HeldAbilityPill
			abilities={heldAbilities}
			truths={trueCharacters.map(({ reminder, character: truly }) => ({
				character: truly,
				reminderId: reminder.reminderId
			}))}
			notes={!!seat.notes?.length}
		/>{:else if seat.notes?.length}<SeatNoteMark />{/if}
{/snippet}

<button
	type="button"
	class="seat"
	data-dead={seat.dead || undefined}
	data-drop={dropTarget || undefined}
	data-from={dragFrom || undefined}
	data-role={role}
	data-misfit={misfit || undefined}
	data-testid="seat"
	data-hold-moves={onHold ? '' : undefined}
	aria-label={label}
	style:--size="{size}px"
	onpointerdown={pointerdown}
	onpointermove={pointermove}
	onpointerup={pointerup}
	onpointercancel={() => {
		letGo();
		down = null;
	}}
	oncontextmenu={(event) => onHold && event.preventDefault()}
	onclick={(event) => event.detail === 0 && onTap()}
>
	<SeatDisc
		{size}
		dead={seat.dead}
		notInPlay={seat.notInPlay ? t('common.notInPlay') : undefined}
		{name}
		{number}
		face={character ? face : undefined}
		{marks}
		vote={seat.dead && tokenFreeVotes === undefined
			? seat.ghostVoteUsed
				? 'used'
				: 'unused'
			: undefined}
		usedVote={boardLooks.current.usedGhostVote}
		frame={seatFrame(seat.frame)}
		avatar={seat.avatar}
		{picture}
	/>
</button>

<style>
	/* Holding it lights its reminders: no callout or text selection under the finger. */
	.seat {
		-webkit-touch-callout: none;
		user-select: none;
	}
	.seat[data-role] :global(.disc) {
		border-radius: 50%;
	}
	.seat[data-role='source'] :global(.disc),
	.seat[data-role='both'] :global(.disc) {
		outline: calc(0.15 * var(--u)) solid var(--accent);
		outline-offset: calc(0.25 * var(--u));
	}
	.seat[data-role='target'] :global(.disc),
	.seat[data-role='both'] :global(.disc) {
		box-shadow:
			0 0 0 calc(0.2 * var(--u)) var(--focus-glow),
			0 0 var(--u) calc(0.4 * var(--u)) var(--focus);
	}
	/* Both: the glow sits outside the ring. */
	.seat[data-role='both'] :global(.disc) {
		box-shadow:
			0 0 0 calc(0.6 * var(--u)) var(--focus-glow),
			0 0 var(--u) calc(0.8 * var(--u)) var(--focus);
	}
	.seat[data-misfit] :global(.disc) {
		opacity: 0.4;
	}
	/* Where the dragged reminder came from, unlike every other seat (Trevor, 2026-10-20). */
	.seat[data-from] :global(.disc) {
		outline: calc(0.15 * var(--u)) dashed var(--on-surface);
		outline-offset: calc(0.25 * var(--u));
		border-radius: 50%;
	}
	.seat[data-drop] :global(.disc) {
		outline: 3px solid var(--focus);
		outline-offset: 4px;
		border-radius: 50%;
	}
	.seat {
		position: relative;
		display: grid;
		justify-items: center;
		padding: 0;
		border: 0;
		background: none;
		color: var(--on-surface);
		cursor: pointer;
		touch-action: manipulation;
	}
	/* The browser must not take a held finger for a pan, or the drag would be cancelled. */
	.seat[data-hold-moves] {
		touch-action: none;
	}
	.mark {
		--mark: max(1.125 * var(--u), calc(var(--size) * 0.3));
		position: absolute;
		display: grid;
		place-items: center;
		width: var(--mark);
		height: var(--mark);
		border-radius: 50%;
		box-shadow: var(--shadow);
		--icon-size: calc(var(--mark) * 0.65);
	}
	/* The skull badge takes a full-size tap of its own, for the ghost vote; the avatar mark
	   one for the player's profile. */
	.avatar::after,
	.seat :global([data-testid='dead-mark'])::after {
		content: '';
		position: absolute;
		inset: 50% auto auto 50%;
		width: var(--tap-target);
		height: var(--tap-target);
		translate: -50% -50%;
	}
	/* Top middle, in the gap between the nomination pill (ends 36% across) and the avatar
	   (starts at 104% less its width), a little above the rim. */
	.orphan {
		left: calc(70% - var(--mark));
		top: -14%;
		background: var(--accent);
		color: var(--on-accent);
	}
	/* Upper right. */
	.avatar {
		right: -4%;
		top: -4%;
	}
	/* The nomination marks, in their pill over the top-left rim (RimPill). */
	.slot {
		display: grid;
		place-items: center;
		width: var(--slot);
		height: var(--slot);
		border-radius: 50%;
		color: var(--on-surface-muted);
		opacity: 0.5;
		--icon-size: calc(var(--slot) * 0.7);
	}
	/* One neutral fill for both: the icon tells them apart, and red or blue would read as an
	   alignment (the accent is red in some themes). */
	.slot[data-on] {
		background: var(--on-surface);
		color: var(--surface);
		opacity: 1;
	}
</style>
