<script lang="ts">
	import { onMount } from 'svelte';
	import {
		defaultAlignment,
		type Alignment,
		type Character,
		type CharacterId,
		type CharacterName,
		type PlayerName
	} from '#lib/core/data/index.ts';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import { fallbackIconUrl, iconUrl } from './icon-url.ts';
	import { iconFallback } from '#lib/ui/token/icon-fallback.ts';
	import CharacterDialog from './CharacterDialog.svelte';
	import { prefetchWikiPage } from './wiki-page.svelte.ts';
	import { loadOfficialData, officialData } from './game-data.svelte.ts';
	import { contextCharacters, shownCharacter } from './character-context.ts';

	interface Props {
		characterId: CharacterId;
		/** The seat's alignment; defaults from the character's type. */
		alignment?: Alignment;
		/**
		 * Shown after the role when the seat has a name: one pill in two halves of the same
		 * height, the character in its colour then the name in the seat pill's, the character's
		 * colour running round the name as its edge (Trevor, 2026-11-02: look 1, "keep the
		 * border ... color of the character").
		 */
		playerName?: PlayerName;
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
		text,
		character: given,
		interactive: tappable = true
	}: Props = $props();
	// Inside this character's own details, its badge would only open them again: it brings
	// those details back into view instead (Trevor, 2026-10-20).
	const shown = shownCharacter();
	const own = $derived(shown?.id() === characterId);
	const interactive = $derived(tappable && !own);
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
	const fallback = $derived(character && fallbackIconUrl(character, alignment));
	const label = $derived(text ?? character?.name ?? characterId);
</script>

{#snippet face()}
	<!-- Fixed-size icon slot so the badge never changes size when data or icons arrive. -->
	<span class="icon"
		>{#if icon}<img
				src={icon}
				alt=""
				width="28"
				height="28"
				referrerpolicy="no-referrer"
				{@attach iconFallback(fallback)}
			/>{/if}</span
	>
	<span class="name">{label}</span>
	{#if playerName}<span class="player"><PlayerBadge name={playerName} /></span>{/if}
{/snippet}

{#if interactive}<button
		type="button"
		class="badge"
		class:paired={!!playerName}
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
	>{:else if tappable && own}<button
		type="button"
		class="badge"
		class:paired={!!playerName}
		data-team={team}
		data-character-id={characterId}
		data-own=""
		onclick={() => shown?.focus()}>{@render face()}</button
	>{:else}<span
		class="badge still"
		class:paired={!!playerName}
		data-team={team}
		data-character-id={characterId}>{@render face()}</span
	>{/if}{#if character && interactive}
	{#if used}<CharacterDialog bind:open {character} {icon} />{/if}
{/if}

<style>
	/*
	 * One design everywhere (Trevor, 2026-10-20: "We should only have one character inline
	 * design"): a pill sized to sit inside a line of text, so it never makes the line taller
	 * (Trevor, 2026-10-16: names sat high and crowded the underlined word above). It grows with
	 * Settings > Tokens' name badge, text and icon sizes, each its own setting (Trevor,
	 * 2026-10-18), and the tap area still reaches 44px.
	 */
	.badge {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 0.25em;
		--badge-h: max(
			calc(1.3em * var(--inline-name-badge, 1)),
			calc(1.1em * var(--inline-name-icon, 1) + 0.2em),
			calc(1.3em * var(--inline-name-text, 1))
		);
		height: var(--badge-h);
		/* Overrides the 44px minimum every button gets; ::before keeps the tap area. */
		min-height: 0;
		max-width: 100%;
		padding: 0 calc(0.5em * var(--inline-name-badge, 1)) 0 calc(0.1em * var(--inline-name-badge, 1));
		border: 0;
		border-radius: var(--radius-full);
		font: inherit;
		font-size: 0.92em;
		font-weight: 600;
		line-height: 1;
		/* Centred on the text's x-height, not sitting on the baseline (which lifts it). */
		vertical-align: middle;
		cursor: pointer;
		background: var(--surface-raised);
		color: var(--on-surface);
		/* The buttons' 1px edge, so a type colour never blends into the surface behind it
		   (Trevor, 2026-10-22; button-edges.e2e.ts). */
		box-shadow: var(--button-ring);
	}
	/* The tap area reaches the 44px minimum without making the line taller. */
	.badge::before {
		content: '';
		position: absolute;
		inset: calc((var(--badge-h) - var(--tap-target)) / 2) 0;
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
		width: calc(1.1em * var(--inline-name-icon, 1));
		height: calc(1.1em * var(--inline-name-icon, 1));
		flex: none;
		border-radius: 50%;
		background: var(--token-face, var(--on-surface));
		overflow: hidden;
	}
	.icon img {
		width: calc(0.95em * var(--inline-name-icon, 1));
		height: calc(0.95em * var(--inline-name-icon, 1));
	}
	/*
	 * The badge has a fixed height in the line, so its name never wraps. In a space narrower
	 * than the name (History's Characters table on a phone) it ends in "…" inside the pill
	 * rather than running past it.
	 */
	.name,
	.player {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.name {
		font-family: var(--font-character);
		font-weight: var(--font-character-weight);
		font-size: calc(1em * var(--inline-name-text, 1));
	}
	/*
	 * With a player: the name is the pill's second half, as tall as the first, inside a thin
	 * edge of the character's colour (the pill's own background, gradient and all), so the
	 * name's edges show on any surface.
	 */
	.badge.paired {
		align-items: stretch;
		gap: 0;
		padding-right: 0.12em;
	}
	.paired .icon {
		align-self: center;
	}
	.paired .name {
		display: inline-flex;
		align-items: center;
		padding: 0 0.4em 0 0.25em;
	}
	.player {
		display: inline-flex;
		margin: 0.12em 0;
	}
	.player :global(.player-badge) {
		display: inline-flex;
		align-items: center;
		height: auto;
		border-radius: 0.2em var(--radius-full) var(--radius-full) 0.2em;
		box-shadow: none;
		font-size: 0.95em;
		line-height: 1;
	}
</style>
