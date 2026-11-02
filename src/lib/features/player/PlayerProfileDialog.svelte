<script lang="ts">
	import { avatarCharacter, type AvatarId } from '#lib/core/avatars/index.ts';
	import type { PlayerName } from '#lib/core/data/index.ts';
	import { seatFrame, type FrameId } from '#lib/core/frames/index.ts';
	import type { ProfileWords } from '#lib/core/profile/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { loadOfficialData, officialData } from '#lib/features/characters/game-data.svelte.ts';
	import SeatFriendButton from '#lib/features/friends/SeatFriendButton.svelte';
	import type { SeatFriendTarget } from '#lib/features/friends/friends-protocol.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import SeatDisc from '#lib/ui/seating/SeatDisc.svelte';

	/**
	 * A player's profile, opened from their avatar on a grim (Trevor, 2026-10-28): about the
	 * PLAYER, never their character. Their avatar in their laurel beside their tag-line, then a
	 * row for each thing they have, and nothing for what they don't (Trevor, 2026-11-01: "I
	 * don't see any benefit to showing Laurel None"; the laurel shows itself). The board's
	 * Storyteller and the town's phones open the same. In a live room, `friend` names the seat
	 * (or the Storyteller), and Add friend sits beside Close as an icon (plan F2).
	 */
	interface Props {
		open?: boolean;
		name: PlayerName;
		avatar: AvatarId;
		picture?: string;
		frame?: FrameId;
		/** Their tag-line and details, as their phone shared them. */
		words?: ProfileWords;
		friend?: SeatFriendTarget;
	}

	let { open = $bindable(false), name, avatar, picture, frame, words, friend }: Props = $props();

	const token = $derived(avatarCharacter(avatar));
	const character = $derived(token ? officialData.current?.byId.get(token) : undefined);
	$effect(() => {
		if (open && token) void loadOfficialData();
	});

	let roomWidth = $state(0);
	let screenHeight = $state(0);
	const discSize = $derived(Math.max(0, Math.min(roomWidth * 0.4, screenHeight * 0.25)));
</script>

<svelte:window bind:innerHeight={screenHeight} />

<!-- eslint-disable-next-line grim/names-as-badges -- the dialog's plain-text name; shown as a badge (heading) -->
<Dialog bind:open title={name}>
	{#snippet heading()}<PlayerBadge {name} />{/snippet}
	{#snippet headActions()}
		{#if friend}<SeatFriendButton {open} target={friend} iconOnly />{/if}
	{/snippet}
	<div class="profile" data-testid="player-profile">
		<div class="card" bind:clientWidth={roomWidth}>
			<!-- Room for the laurel, drawn past the token's edge. -->
			<div class="disc">
				{#if discSize}<SeatDisc
						size={discSize}
						{name}
						number={1}
						{avatar}
						{picture}
						frame={seatFrame(frame)}
					/>{/if}
			</div>
			{#if words?.tagline}<p class="tagline" data-testid="player-profile-tagline">
					{words.tagline}
				</p>{/if}
		</div>
		<dl class="rows">
			{#if token && character}
				<div class="row" data-testid="player-profile-token">
					<dt>{t('player.characterIcon')}</dt>
					<dd><CharacterBadge characterId={token} {character} /></dd>
				</div>
			{/if}
			{#each words?.details ?? [] as detail, index (index)}
				<div class="row" data-testid="player-profile-detail">
					<dt>{detail.label}</dt>
					<dd>{detail.text}</dd>
				</div>
			{/each}
		</dl>
	</div>
</Dialog>

<style>
	.card {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		padding-block: var(--space-4);
	}
	.disc {
		flex: none;
		padding: var(--space-3);
	}
	.tagline {
		min-width: 0;
		margin: 0;
		color: var(--on-surface-muted);
		font-style: italic;
		overflow-wrap: anywhere;
	}
	.rows {
		margin: 0;
	}
	/* Rows with dividers, as in Settings. */
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		min-height: var(--tap-target);
		border-top: 1px solid var(--border);
	}
	dt {
		flex: none;
		max-width: 50%;
		color: var(--on-surface-muted);
	}
	dd {
		min-width: 0;
		margin: 0;
		text-align: end;
		overflow-wrap: anywhere;
	}
</style>
