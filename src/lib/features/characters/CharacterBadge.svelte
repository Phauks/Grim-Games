<script lang="ts">
	import { onMount } from 'svelte';
	import {
		defaultAlignment,
		type Alignment,
		type Character,
		type CharacterId,
		type CharacterName
	} from '#lib/core/data/index.ts';
	import { iconUrl } from './icon-url.ts';
	import CharacterDialog from './CharacterDialog.svelte';
	import { loadOfficialData, officialData } from './game-data.svelte.ts';

	interface Props {
		characterId: CharacterId;
		/** The seat's alignment; defaults from the character's type. */
		alignment?: Alignment;
		/** Shown after the role when the seat has a player name. */
		playerName?: string;
		/** Sized to sit inside a line of text; the tap area still reaches 44px. */
		inline?: boolean;
		/** The words as written ("Village Idiots"); defaults to the character's name. */
		text?: CharacterName;
		/** The character itself (homebrew from a loaded script); otherwise looked up by id. */
		character?: Character;
		/**
		 * False inside another button (a seat to choose, a claim to change): the badge is
		 * drawn the same but is not a button of its own, so tapping it taps the parent.
		 */
		interactive?: boolean;
	}

	let {
		characterId,
		alignment,
		playerName,
		inline = false,
		text,
		character: given,
		interactive = true
	}: Props = $props();
	let open = $state(false);
	// The dialog is only created on first tap: pages like /reference show hundreds of badges.
	let used = $state(false);

	onMount(() => void loadOfficialData());

	const character = $derived(given ?? officialData.current?.byId.get(characterId));
	// A Traveller with no alignment yet is half good, half evil, like its token (blue on the
	// left, red on the right, as in TPI's Traveller icons). Once set, it takes that colour.
	const team = $derived(
		alignment ??
			(character
				? (defaultAlignment(character.type) ??
					(character.type === 'traveller' ? 'traveller' : 'neutral'))
				: 'neutral')
	);
	const icon = $derived(character && iconUrl(character, alignment));
	const label = $derived(text ?? character?.name ?? characterId);
</script>

{#snippet face()}
	<!-- Fixed-size icon slot so the badge never changes size when data or icons arrive. -->
	<span class="icon"
		>{#if icon}<img src={icon} alt="" width="28" height="28" />{/if}</span
	>
	<span class="name">{label}</span>
	{#if playerName}<span class="player">· {playerName}</span>{/if}
{/snippet}

{#if interactive}<button
		type="button"
		class="badge"
		class:inline
		data-team={team}
		data-character-id={characterId}
		aria-haspopup="dialog"
		onclick={() => {
			used = true;
			open = true;
		}}>{@render face()}</button
	>{:else}<span class="badge still" class:inline data-team={team} data-character-id={characterId}
		>{@render face()}</span
	>{/if}{#if character && interactive}
	{#if used}<CharacterDialog bind:open {character} {icon} />{/if}
{/if}

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1, calc(0.25 * var(--u)));
		min-height: var(--tap-target);
		padding: 0 var(--space-3, calc(0.75 * var(--u))) 0 var(--space-1, calc(0.25 * var(--u)));
		border: 0;
		border-radius: var(--radius-full);
		font: inherit;
		font-weight: 600;
		max-width: 100%;
		vertical-align: middle;
		cursor: pointer;
		background: var(--surface-raised);
		color: var(--on-surface);
	}
	.badge.still {
		cursor: inherit;
	}
	.badge[data-team='good'] {
		background: var(--good);
		color: var(--on-good);
	}
	.badge[data-team='evil'] {
		background: var(--evil);
		color: var(--on-evil);
	}
	/* --on-good reads on both halves (badge-colours.test.ts). */
	.badge[data-team='traveller'] {
		background: linear-gradient(to right, var(--good) 50%, var(--evil) 50%);
		color: var(--on-good);
	}
	.icon {
		display: inline-grid;
		place-items: center;
		/* Character icons follow the Character icon size setting (--character-icon-scale); tokens do not. */
		width: calc(2 * var(--u) * var(--character-icon-scale, 1));
		height: calc(2 * var(--u) * var(--character-icon-scale, 1));
		flex: none;
		border-radius: 50%;
		background: var(--token-face, var(--on-surface));
		overflow: hidden;
	}
	.icon img {
		width: calc(1.75 * var(--u) * var(--character-icon-scale, 1));
		height: calc(1.75 * var(--u) * var(--character-icon-scale, 1));
	}
	.name {
		/* Only when the badge alone is wider than its line (tiny screen, largest text). */
		min-width: 0;
		overflow-wrap: anywhere;
		font-family: var(--font-character);
		font-weight: var(--font-character-weight);
	}
	/* An inline badge has a fixed height in the line, so its name never wraps. */
	.badge.inline .name {
		white-space: nowrap;
	}
	.badge.inline {
		position: relative;
		gap: 0.25em;
		min-height: 0;
		/* Fits the line; grows only when a larger Icon size needs it. */
		--badge-h: max(1.45em, calc(1.25em * var(--character-icon-scale, 1) + 0.2em));
		height: var(--badge-h);
		padding: 0 0.5em 0 0.1em;
		font-size: 0.92em;
		line-height: 1;
		vertical-align: baseline;
	}
	/* The tap area reaches the 44px minimum without making the line taller. */
	.badge.inline::before {
		content: '';
		position: absolute;
		inset: calc((var(--badge-h) - var(--tap-target)) / 2) 0;
	}
	.badge.inline .icon {
		width: calc(1.25em * var(--character-icon-scale, 1));
		height: calc(1.25em * var(--character-icon-scale, 1));
	}
	.badge.inline .icon img {
		width: calc(1.1em * var(--character-icon-scale, 1));
		height: calc(1.1em * var(--character-icon-scale, 1));
	}
	.player {
		font-family: var(--font-player);
		font-weight: 400;
		opacity: 0.9;
	}
</style>
