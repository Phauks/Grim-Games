<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { defaultAlignment, type Character, type PlayerName } from '#lib/core/data/index.ts';
	import type { SeatRole } from '#lib/core/sync/seat-roles.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import FairPlayNotice from '#lib/features/show/FairPlayNotice.svelte';
	import HoldToSee from '#lib/ui/primitives/HoldToSee.svelte';
	import { noLongPress } from '#lib/ui/no-long-press.ts';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';

	/**
	 * One player's character, held to see (Trevor, 2026-10-26: "It becomes a hold to see"): on
	 * their phone, in the Storyteller's player view, and on the Storyteller's device for a player
	 * with no phone who comes to see theirs (Trevor, 2026-10-31).
	 */
	interface Props {
		open?: boolean;
		role?: SeatRole;
		/** The game's script characters, before the official ones. */
		characters?: readonly Character[];
		/** The player it is shown to, as the title, on a device that isn't theirs. */
		name?: PlayerName;
		/** The first hold of a role, to tell the Storyteller. */
		onSeen?: () => void;
	}

	let { open = $bindable(false), role, characters, name, onSeen }: Props = $props();

	const character = $derived.by(() => {
		const id = role?.characterId;
		if (!id) return undefined;
		return (
			characters?.find((c) => c.id === id) ??
			officialData.current?.characters.find((c) => c.id === id)
		);
	});
	/** Only an alignment: "You are Evil" (a Traveller with no character to draw). */
	const alignmentOnly = $derived(!!role && !role.characterId);
	const alignment = $derived(
		role?.alignment ?? (character ? defaultAlignment(character.type) : undefined)
	);

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
		onSeen?.();
	}
</script>

<!-- eslint-disable-next-line grim/names-as-badges -- the dialog's plain-text name; shown as a badge (heading) -->
<Dialog bind:open title={name ?? t('room.role.open')}>
	{#snippet heading()}{#if name}<PlayerBadge {name} />{:else}{t('room.role.open')}{/if}{/snippet}
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
		<!-- The name, ability and alignment are laid out while hidden, so seeing them moves
		     nothing (Trevor, 2026-10-28: "there is reflow when revealing character"). -->
		<p class="name" class:secret={!held} aria-hidden={!held} data-testid="role-name">
			{#if character}<CharacterBadge
					characterId={character.id}
					{character}
					{alignment}
					interactive={false}
				/>{/if}
		</p>
		<p class="ability" class:secret={!held} aria-hidden={!held} data-testid="role-ability">
			{character?.ability ?? ''}
		</p>
		<!-- An alignment the player is told (a Traveller's, or one the Storyteller chose). -->
		<p class="told" class:secret={!held} aria-hidden={!held} data-testid="role-alignment">
			{role?.alignment && !alignmentOnly
				? role.alignment === 'evil'
					? t('room.role.evil')
					: t('room.role.good')
				: ''}
		</p>
		<!-- Before and while the character shows (Trevor, 2026-10-27). -->
		<FairPlayNotice kind="secret" />
	</div>
</Dialog>

<style>
	.secret {
		visibility: hidden;
	}
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
