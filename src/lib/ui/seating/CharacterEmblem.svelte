<script lang="ts">
	import { avatarCharacter, type AvatarId } from '#lib/core/avatars/index.ts';
	import { iconUrl } from '#lib/features/characters/icon-url.ts';
	import { loadOfficialData, officialData } from '#lib/features/characters/game-data.svelte.ts';

	/**
	 * The character a player picked to represent them (Trevor, 2026-10-28: "representative
	 * character token"), as a small token on the top of their laurel. Its parent places it
	 * outside the laurel's moving layer, so it stays put while the laurel turns or pulses.
	 * Engraved, in one tone, wherever it stands for a seat, so it never reads as that player's
	 * character; only the player's own Profile shows it in full colour (Trevor, 2026-10-28).
	 * Draws nothing for an avatar with no character.
	 */
	interface Props {
		avatar: AvatarId | undefined;
		/** Full colour, for the player's own Profile; seats always engrave it. */
		fullColour?: boolean;
	}

	let { avatar, fullColour = false }: Props = $props();

	const characterId = $derived(avatarCharacter(avatar));
	$effect(() => {
		if (characterId) void loadOfficialData();
	});
	const character = $derived(characterId ? officialData.current?.byId.get(characterId) : undefined);
	const icon = $derived(character && iconUrl(character));
</script>

{#if icon}<span
		class="emblem"
		data-testid="character-emblem"
		data-character={characterId}
		data-engraved={!fullColour || undefined}><img src={icon} alt="" draggable="false" /></span
	>{/if}

<style>
	/* A small token centred on the top of the laurel, a quarter of it above. */
	.emblem {
		position: absolute;
		top: 0;
		left: 50%;
		width: 30%;
		aspect-ratio: 1;
		translate: -50% -25%;
		box-sizing: border-box;
		border-radius: 50%;
		background: var(--token-face);
		box-shadow: var(--shadow);
		pointer-events: none;
	}
	img {
		display: block;
		width: 100%;
		height: 100%;
		padding: 10%;
		box-sizing: border-box;
		object-fit: contain;
	}
	/* Engraved: one tone, pressed into the token, never a character token's colours. */
	.emblem[data-engraved] img {
		filter: grayscale(1) sepia(0.45) contrast(1.15) brightness(0.8);
		opacity: 0.85;
	}
</style>
