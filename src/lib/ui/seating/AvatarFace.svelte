<script lang="ts">
	import { initialsOf, type AvatarId } from '#lib/core/avatars/index.ts';

	/**
	 * A player's avatar (plan R6) as a token face: their initials on the token's own colours
	 * (Trevor, 2026-10-23: "Initials for now"). Sized to the token, so it reads on a small
	 * corner mark and a full seat alike. `picture` (a link) is the player's own picture
	 * (Trevor, 2026-10-27), shown in place of the initials while it loads.
	 */
	let { avatar, name, picture }: { avatar: AvatarId; name: string; picture?: string } = $props();
	let failed = $state<string>();
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
