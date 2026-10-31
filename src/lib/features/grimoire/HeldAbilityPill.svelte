<script lang="ts">
	import type { Character } from '#lib/core/data/index.ts';
	import { iconUrl } from '#lib/features/characters/icon-url.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import RimPill from '#lib/ui/seating/RimPill.svelte';

	/**
	 * Abilities a seat holds without their tokens (the Boffin's good character), Grimbinder's
	 * way: small tokens in a pill over the seat's bottom-right rim, sharing it with the notes
	 * mark (Trevor, 2026-10-30: not the left side), mirroring the nominations top left. On the
	 * board's seats (SeatToken) and the Board settings preview. Placed in SeatDisc's `marks`.
	 *
	 * The pill also shows who the player really is, from an "Is The …" reminder (Trevor,
	 * 2026-10-31, small token Option A). The two never look alike: a held ability has a blue +
	 * ("also holds"), the true character a red = ("is really").
	 */
	interface Props {
		abilities: { character: Character; works: boolean }[];
		/** Who the player really is, each from its reminder (tapping it opens the reminder). */
		truths?: { character: Character; reminderId?: string }[];
		/** The seat has notes: their pen goes in the pill too, and opens them. */
		notes?: boolean;
	}

	let { abilities, truths = [], notes = false }: Props = $props();
</script>

<RimPill side="right" edge="bottom" testid="held-pill"
	>{#each abilities as { character: as, works } (as.id)}<span
			class="held"
			data-testid="held-ability"
			data-off={works ? undefined : ''}
			title={works ? `Holds the ${as.name} ability` : `Holds the ${as.name} ability (not now)`}
			><img src={iconUrl(as)} alt="" /><span class="kind holds" aria-hidden="true">+</span></span
		>{/each}{#each truths as { character: truly, reminderId }, k (reminderId ?? k)}<span
			class="held"
			data-testid="true-character"
			data-reminder={reminderId}
			title={`Is really the ${truly.name}`}
			><img src={iconUrl(truly)} alt="" /><span class="kind is" aria-hidden="true">=</span></span
		>{/each}{#if notes}<span class="note-slot" data-testid="note-mark" title="Note"
			><Icon name="notes" /></span
		>{/if}</RimPill
>

<style>
	/* A held ability: the face of a token, like the reminders. */
	.held,
	.note-slot {
		position: relative;
		display: grid;
		place-items: center;
		width: var(--slot);
		height: var(--slot);
		border-radius: 50%;
		--icon-size: calc(var(--slot) * 0.65);
	}
	.held {
		background: var(--reminder-face);
	}
	/* Which kind: a blue + for an ability also held, a red = for who they really are, on the
	   token's lower right, so the two never rest on colour alone. Team colours are fixed. */
	.kind {
		position: absolute;
		right: -15%;
		bottom: -15%;
		display: grid;
		place-items: center;
		width: 55%;
		height: 55%;
		border-radius: 50%;
		font-size: calc(var(--slot) * 0.45);
		font-weight: 700;
		line-height: 1;
	}
	.kind.holds {
		background: var(--good);
		color: var(--on-good);
	}
	.kind.is {
		background: var(--evil);
		color: var(--on-evil);
	}
	/* A tap target bigger than the mark, as the lone notes mark has. */
	.note-slot::after {
		content: '';
		position: absolute;
		inset: calc(-0.875 * var(--u));
		border-radius: 50%;
	}
	.held img {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		object-fit: contain;
	}
	/* Not now: faded and struck through, so it never rests on colour alone. */
	.held[data-off] img {
		opacity: 0.4;
	}
	.held[data-off]::before {
		content: '';
		position: absolute;
		width: 100%;
		height: calc(0.15 * var(--u));
		background: var(--on-surface);
		rotate: -45deg;
	}
</style>
