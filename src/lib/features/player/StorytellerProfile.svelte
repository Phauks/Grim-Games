<script lang="ts">
	import { parseAvatarId } from '#lib/core/avatars/index.ts';
	import type { PlayerName } from '#lib/core/data/index.ts';
	import { parseFrameId } from '#lib/core/frames/index.ts';
	import { parseProfileWords } from '#lib/core/profile/index.ts';
	import type { PublicStoryteller } from '#lib/core/sync/public-projection.ts';
	import { isImageHash, roomImagePath } from '#lib/core/sync/room-images.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import PlayerProfileDialog from './PlayerProfileDialog.svelte';

	/**
	 * The Storyteller's profile in a live room, as a player's opens (Trevor, 2026-10-30): the
	 * look their board sends (with their tag-line and details), with Add friend. Game info's Storyteller row and the byline's
	 * Storyteller name open this same one (Trevor, 2026-10-31).
	 */
	interface Props {
		open?: boolean;
		name?: string;
		look?: PublicStoryteller;
		roomCode: string;
	}

	let { open = $bindable(false), name, look, roomCode }: Props = $props();
	const picture = $derived(
		isImageHash(look?.picture) ? roomImagePath(roomCode, look.picture) : undefined
	);
</script>

<PlayerProfileDialog
	bind:open
	name={(name?.trim() || t('modes.storytellerName')) as PlayerName}
	avatar={parseAvatarId(look?.avatar) ?? 'initials'}
	frame={parseFrameId(look?.frame)}
	words={parseProfileWords(look ?? {})}
	{picture}
	friend={{ code: roomCode, storyteller: true }}
/>
