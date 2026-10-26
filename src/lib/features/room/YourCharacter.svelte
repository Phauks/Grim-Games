<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { defaultAlignment } from '#lib/core/data/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import HoldToSee from '#lib/ui/primitives/HoldToSee.svelte';
	import { noLongPress } from '#lib/ui/no-long-press.ts';
	import type { RoomPlayer } from './player.svelte.ts';
	import { roomScript } from './room-script.svelte.ts';

	/**
	 * The player's own character on their phone (Trevor, 2026-10-26: "Storyteller tells people
	 * they can see it on their screen. It becomes a hold to see."). The button shows only while
	 * the Storyteller lets players see theirs; it shares the "You" row's height, so nothing
	 * below moves. The first hold tells the Storyteller it was seen.
	 */
	let { player }: { player: RoomPlayer } = $props();

	const role = $derived(player.view?.role);
	const character = $derived.by(() => {
		const id = role?.characterId;
		if (!id) return undefined;
		return (
			roomScript(player.code)?.characters.find((c) => c.id === id) ??
			officialData.current?.characters.find((c) => c.id === id)
		);
	});
	/** Only an alignment: "You are Evil" (a Traveller with no character to draw). */
	const alignmentOnly = $derived(!!role && !role.characterId);
	const alignment = $derived(
		role?.alignment ?? (character ? defaultAlignment(character.type) : undefined)
	);

	let open = $state(false);
	let held = $state(false);
	let told = '';
	$effect(() => {
		if (!open) held = false;
	});
	// The role is taken back: its sheet closes with it.
	$effect(() => {
		if (!role) open = false;
	});
	function onhold(on: boolean) {
		const key = JSON.stringify(role);
		if (!on || told === key) return;
		told = key;
		player.roleSeen();
	}
</script>

{#if role}
	<Button aria-haspopup="dialog" data-testid="your-character" onclick={() => (open = true)}
		>{t('room.role.open')}</Button
	>
{/if}

<Dialog bind:open title={t('room.role.open')}>
	<div class="role" data-testid="role-card" {@attach noLongPress}>
		<HoldToSee label={t('setup.reveal.hold')} testid="role-hold" bind:held {onhold}>
			{#if character}
				<CharacterToken {character} size={160} />
			{:else}
				<span class="alignment-face" data-alignment={alignment}
					>{alignment === 'evil' ? t('room.role.evil') : t('room.role.good')}</span
				>
			{/if}
		</HoldToSee>
		<!-- The name and ability keep their space while hidden, so seeing them moves nothing. -->
		<p class="name" data-testid="role-name">
			{#if held && character}<CharacterBadge
					characterId={character.id}
					{character}
					{alignment}
					interactive={false}
				/>{/if}
		</p>
		<p class="ability">{held && character ? character.ability : ''}</p>
		<!-- An alignment the player is told (a Traveller's, or one the Storyteller chose). -->
		<p class="told" data-testid="role-alignment">
			{held && role?.alignment && !alignmentOnly
				? role.alignment === 'evil'
					? t('room.role.evil')
					: t('room.role.good')
				: ''}
		</p>
	</div>
</Dialog>

<style>
	.role {
		display: grid;
		justify-items: center;
		gap: var(--space-2);
		text-align: center;
		-webkit-user-select: none;
		user-select: none;
		-webkit-touch-callout: none;
	}
	.alignment-face {
		display: grid;
		place-items: center;
		box-sizing: border-box;
		width: calc(10 * var(--u));
		height: calc(10 * var(--u));
		padding: var(--space-3);
		border-radius: 50%;
		background: var(--good);
		color: var(--on-good);
		font-family: var(--font-heading);
		font-size: 1.3rem;
	}
	.alignment-face[data-alignment='evil'] {
		background: var(--evil);
		color: var(--on-evil);
	}
	.name {
		display: grid;
		place-items: center;
		min-height: var(--tap-target);
		margin: 0;
		font-size: 1.3rem;
	}
	.told {
		min-height: 1.4em;
		margin: 0;
		font-weight: 600;
	}
	.ability {
		min-height: 2.6em;
		max-width: 28rem;
		margin: 0;
		font-family: var(--font-ability);
	}
</style>
