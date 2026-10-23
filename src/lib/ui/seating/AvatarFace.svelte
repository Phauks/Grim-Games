<script lang="ts">
	import type { AvatarId } from '#lib/core/avatars/index.ts';
	import IconGlyph from '#lib/ui/icons/IconGlyph.svelte';

	/**
	 * A player's avatar (plan R6) as a token face: the picture on the token's own colours. In
	 * one weight on every device, since everyone at the table sees everyone's avatar.
	 */
	let { avatar }: { avatar: AvatarId } = $props();
</script>

<span class="avatar-face" data-avatar={avatar} data-testid="avatar-face"
	><IconGlyph id="ph:{avatar}-fill" set="ph-fill" /></span
>

<style>
	.avatar-face {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		border-radius: 50%;
		background: var(--token-face);
		color: var(--on-token);
	}
	.avatar-face :global(.icon) {
		width: 58%;
		height: 58%;
	}
</style>
