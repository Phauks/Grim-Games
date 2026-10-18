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
	import { prefetchWikiPage } from './wiki-page.svelte.ts';
	import { loadOfficialData, officialData } from './game-data.svelte.ts';
	import { contextCharacters } from './character-context.ts';

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
		/**
		 * The character itself (homebrew from a loaded script); otherwise looked up by id, in
		 * the game's characters when a parent gave them (`provideCharacters`), then TPI's.
		 */
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

	const gameCharacters = contextCharacters();
	const character = $derived(
		given ?? gameCharacters?.()?.get(characterId) ?? officialData.current?.byId.get(characterId)
	);
	// A Traveller with no alignment yet is half good, half evil, like its token (blue on the
	// left, red on the right, as in TPI's Traveller icons). Once set, it takes that colour.
	const team = $derived(
		alignment ??
			(character
				? (defaultAlignment(character.type) ??
					(character.type === 'traveller' ||
					character.type === 'fabled' ||
					character.type === 'loric'
						? character.type
						: 'neutral'))
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
		onpointerenter={() => character && prefetchWikiPage(character)}
		onpointerdown={() => character && prefetchWikiPage(character)}
		onfocus={() => character && prefetchWikiPage(character)}
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
	/* Fabled and Loric in their own colours, like the other types (Trevor, 2026-10-18). */
	.badge[data-team='fabled'] {
		background: var(--fabled);
		color: var(--on-fabled);
	}
	.badge[data-team='loric'] {
		background: var(--loric);
		color: var(--on-loric);
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
	/*
	 * An inline badge has a fixed height in the line, so its name never wraps. In a cell
	 * narrower than the name (History's Characters table on a phone) it ends in "…" inside
	 * the pill rather than running past it over the next column.
	 */
	.badge.inline .name,
	.badge.inline .player {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.badge.inline {
		position: relative;
		gap: 0.25em;
		min-height: 0;
		/*
		 * Fits inside the line box (Trevor, 2026-10-16: names sat high and crowded the
		 * underlined word above), so it never makes the line taller; grows with Settings >
		 * Tokens' Name badge size, and when a larger name or icon needs it. Name text, icon and
		 * badge sizes are each their own setting (Trevor, 2026-10-18).
		 */
		--badge-h: max(
			calc(1.3em * var(--inline-name-badge, 1)),
			calc(1.1em * var(--inline-name-icon, 1) + 0.2em),
			calc(1.3em * var(--inline-name-text, 1))
		);
		height: var(--badge-h);
		padding: 0 calc(0.5em * var(--inline-name-badge, 1)) 0 calc(0.1em * var(--inline-name-badge, 1));
		font-size: 0.92em;
		line-height: 1;
		/* Centred on the text's x-height, not sitting on the baseline (which lifts it). */
		vertical-align: middle;
	}
	/* The tap area reaches the 44px minimum without making the line taller. */
	.badge.inline::before {
		content: '';
		position: absolute;
		inset: calc((var(--badge-h) - var(--tap-target)) / 2) 0;
	}
	.badge.inline .name {
		font-size: calc(1em * var(--inline-name-text, 1));
	}
	.badge.inline .icon {
		width: calc(1.1em * var(--inline-name-icon, 1));
		height: calc(1.1em * var(--inline-name-icon, 1));
	}
	.badge.inline .icon img {
		width: calc(0.95em * var(--inline-name-icon, 1));
		height: calc(0.95em * var(--inline-name-icon, 1));
	}
	.player {
		font-family: var(--font-player);
		font-weight: 400;
		opacity: 0.9;
	}
</style>
