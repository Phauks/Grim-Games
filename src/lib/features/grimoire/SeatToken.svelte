<script lang="ts">
	import { defaultAlignment, type Character } from '#lib/core/data/index.ts';
	import type { Seat } from '#lib/core/model/index.ts';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';

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
		onTap: () => void;
	}

	let { seat, number, character, size, orphan, dropTarget = false, onTap }: Props = $props();

	// As in the physical grimoire, a token is upside down when the player's alignment is not
	// the one their character type starts with (a good Minion, an evil Townsfolk).
	const startsAs = $derived(character ? defaultAlignment(character.type) : undefined);
	const shifted = $derived(
		startsAs !== undefined && seat.alignment !== undefined && seat.alignment !== startsAs
	);

	const name = $derived(seat.playerName ?? `Seat ${number}`);
	const label = $derived(
		[
			`Seat ${number}: ${seat.playerName ?? 'no name'}`,
			character?.name ?? 'no character',
			seat.dead ? (seat.ghostVoteUsed ? 'dead, ghost vote used' : 'dead, has ghost vote') : '',
			// A Traveller has no starting alignment: always say it, or that it is not set yet.
			character?.type === 'traveller'
				? (seat.alignment ?? 'alignment not set')
				: shifted
					? `${seat.alignment}`
					: '',
			orphan ? 'not on the script' : '',
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

	function pointerup(event: PointerEvent) {
		if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) < TAP_SLOP) onTap();
		down = null;
	}
</script>

<button
	type="button"
	class="seat"
	data-dead={seat.dead || undefined}
	data-drop={dropTarget || undefined}
	data-testid="seat"
	aria-label={label}
	style:--size="{size}px"
	onpointerdown={(event) => (down = { x: event.clientX, y: event.clientY })}
	onpointerup={pointerup}
	onpointercancel={() => (down = null)}
	onclick={(event) => event.detail === 0 && onTap()}
>
	<span class="disc">
		<span class="face" class:flipped={shifted}>
			{#if character}
				<CharacterToken {character} alignment={seat.alignment} {size} />
			{:else}
				<span class="empty">{number}</span>
			{/if}
		</span>
		{#if seat.dead}<span class="shroud"><Icon name="dead" /></span>{/if}
		<!-- Corner marks sit in fixed places, so one appearing never moves anything. -->
		{#if seat.dead && !seat.ghostVoteUsed}
			<span class="mark ghost" title="Ghost vote"><Icon name="ghostVote" /></span>
		{/if}
		{#if orphan}<span class="mark orphan" title="Not on the script"><Icon name="warning" /></span
			>{/if}
	</span>
	<span class="name">{name}</span>
</button>

<style>
	.seat[data-drop] .disc {
		outline: 3px solid var(--focus);
		outline-offset: 4px;
		border-radius: 50%;
	}
	.seat {
		display: grid;
		justify-items: center;
		gap: 2px;
		width: calc(var(--size) + 2 * var(--u));
		padding: 0;
		border: 0;
		background: none;
		color: var(--on-surface);
		cursor: pointer;
		touch-action: manipulation;
	}
	.disc {
		position: relative;
		width: var(--size);
		height: var(--size);
	}
	.face {
		display: block;
		width: 100%;
		height: 100%;
		border-radius: 50%;
		box-shadow: var(--shadow);
		transition: rotate var(--duration-normal) var(--ease-out);
	}
	.face.flipped {
		rotate: 180deg;
	}
	.empty {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		border-radius: 50%;
		border: 2px dashed var(--border);
		background: var(--surface-raised);
		color: var(--on-surface-muted);
		font: var(--seat-font);
	}
	.seat[data-dead] .face {
		filter: grayscale(1) brightness(0.65);
	}
	/* The shroud: a dark cap over the top of the token, as on a physical grimoire. */
	.shroud {
		position: absolute;
		inset: 0;
		display: grid;
		justify-items: center;
		align-content: start;
		padding-top: 6%;
		border-radius: 50%;
		background: linear-gradient(to bottom, rgb(0 0 0 / 0.85) 40%, transparent 40%);
		color: var(--on-surface);
		--icon-size: calc(var(--size) * 0.26);
	}
	.mark {
		position: absolute;
		display: grid;
		place-items: center;
		width: max(18px, calc(var(--size) * 0.3));
		height: max(18px, calc(var(--size) * 0.3));
		border-radius: 50%;
		box-shadow: var(--shadow);
		--icon-size: calc(max(18px, calc(var(--size) * 0.3)) * 0.65);
	}
	.ghost {
		left: -4%;
		bottom: -4%;
		background: var(--surface-raised);
		color: var(--on-surface);
	}
	.orphan {
		left: -4%;
		top: -4%;
		background: var(--accent);
		color: var(--on-accent);
	}
	.name {
		max-width: 100%;
		overflow: hidden;
		font-family: var(--font-player);
		font-size: 0.9rem;
		line-height: 1.2;
		white-space: nowrap;
		text-overflow: ellipsis;
		text-shadow: 0 1px 2px rgb(0 0 0 / 0.8);
	}
</style>
