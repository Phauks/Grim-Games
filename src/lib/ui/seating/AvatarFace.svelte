<script lang="ts">
	import { avatarCharacter, initialsOf, type AvatarId } from '#lib/core/avatars/index.ts';
	import { iconUrl } from '#lib/features/characters/icon-url.ts';
	import { loadOfficialData, officialData } from '#lib/features/characters/game-data.svelte.ts';

	/**
	 * A player's avatar (plan R6) as a token face: their initials on the token's own colours
	 * (Trevor, 2026-10-23: "Initials for now"). Sized to the token, so it reads on a small
	 * corner mark and a full seat alike. `picture` (a link) is the player's own picture
	 * (Trevor, 2026-10-27), shown in place of the initials while it loads. A character's icon
	 * (2026-10-27) is engraved, in one tone, wherever it stands for a seat, so it never reads as
	 * that player's character; only the player's own Profile shows it in full colour
	 * (Trevor, 2026-10-28).
	 */
	interface Props {
		avatar: AvatarId;
		name: string;
		picture?: string;
		/** Full colour, for the player's own Profile; seats always engrave it. */
		fullColour?: boolean;
	}

	let { avatar, name, picture, fullColour = false }: Props = $props();
	let failed = $state<string>();

	const characterId = $derived(avatarCharacter(avatar));
	$effect(() => {
		if (characterId) void loadOfficialData();
	});
	const character = $derived(characterId ? officialData.current?.byId.get(characterId) : undefined);
	const icon = $derived(character && iconUrl(character));
</script>

<span
	class="avatar-face"
	data-avatar={avatar}
	data-picture={(picture && picture !== failed) || undefined}
	data-testid="avatar-face"
	>{#if picture && picture !== failed}<img
			src={picture}
			alt=""
			draggable="false"
			onerror={() => (failed = picture)}
		/>{:else if icon}<img
			class="icon"
			src={icon}
			alt=""
			draggable="false"
			data-engraved={!fullColour || undefined}
		/>{:else}<svg viewBox="0 0 100 100" aria-hidden="true"
			><text x="50" y="50" font-size="42" text-anchor="middle" dominant-baseline="central"
				>{initialsOf(name)}</text
			></svg
		>{/if}</span
>

<style>
	.avatar-face {
		display: block;
		width: 100%;
		height: 100%;
		border-radius: 50%;
		background: var(--token-face);
		color: var(--on-token);
	}
	img {
		display: block;
		width: 100%;
		height: 100%;
		border-radius: 50%;
		object-fit: cover;
	}
	.icon {
		object-fit: contain;
		padding: 8%;
		box-sizing: border-box;
	}
	/* Engraved: one tone, pressed into the face, never a character token's colours. */
	.icon[data-engraved] {
		filter: grayscale(1) sepia(0.45) contrast(1.15) brightness(0.8);
		opacity: 0.8;
	}
	svg {
		display: block;
		width: 100%;
		height: 100%;
	}
	text {
		fill: currentColor;
		/* The same lettering as the player's name under the token. */
		font-family: var(--font-player);
		font-weight: var(--font-player-weight);
	}
</style>
