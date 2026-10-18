<script lang="ts">
	import { iconUrl } from '#lib/features/characters/icon-url.ts';
	import { loadOfficialData, officialData } from '#lib/features/characters/game-data.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';

	/**
	 * The account's profile icon: the chosen character's icon (Trevor, 2026-10-18), or the
	 * usual account icon when none is chosen or the id isn't a known character. It fills the
	 * box its parent gives it.
	 */
	let { icon }: { icon: string | null | undefined } = $props();

	$effect(() => {
		if (icon) void loadOfficialData();
	});

	const character = $derived(icon ? officialData.current?.byId.get(icon) : undefined);
	const src = $derived(character && iconUrl(character));
</script>

<span class="profile-icon" data-testid="profile-icon" data-icon={character ? icon : undefined}>
	{#if src}
		<img {src} alt="" />
	{:else}
		<Icon name="account" />
	{/if}
</span>

<style>
	.profile-icon {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
	}
	img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
</style>
