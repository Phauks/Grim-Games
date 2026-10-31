<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { PlayerName } from '#lib/core/data/index.ts';
	import { roomImagePath } from '#lib/core/sync/room-images.ts';
	import SeatAvatarButton from '#lib/features/player/SeatAvatarButton.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import { roomHost } from './host.svelte.ts';

	/**
	 * The phones removed from the room this game (plan J37; Trevor, 2026-10-29: "only good for
	 * that game, but the kick can be revoked"). Unblock (Trevor, 2026-10-31) only lets one try to
	 * join again: it comes back as a new phone, with no seat, and asks to sit like anyone else.
	 * Hidden until someone is blocked (Trevor, 2026-10-31: "hide removed from room unless someone
	 * is in there"). It sits last on the Players screen, so it shifts nothing above it.
	 */
	const host = roomHost();
	const name = (n?: string) => (n ?? t('room.scriptVote.unnamed')) as PlayerName;
</script>

{#if host.removed.length > 0}
	<section aria-labelledby="removed-label" data-testid="room-removed">
		<h2 id="removed-label">{t('room.players.removed')}</h2>
		<ul class="list" aria-labelledby="removed-label">
			{#each host.removed as member (member.memberId)}
				<li class="member" data-testid="room-removed-player">
					<SeatAvatarButton
						name={name(member.name)}
						avatar={member.avatar ?? 'initials'}
						picture={member.picture && host.code
							? roomImagePath(host.code, member.picture)
							: undefined}
						frame={member.frame}
					/>
					<span class="who"><PlayerBadge name={name(member.name)} /></span>
					<Button
						variant="quiet"
						onclick={() => host.send({ type: 'let-back-in', memberId: member.memberId })}
						>{t('room.players.unblock')}</Button
					>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	section {
		display: grid;
		gap: var(--space-2);
		align-content: start;
		min-width: 0;
	}
	h2 {
		margin: 0;
		font-size: 1.1rem;
	}
	.list {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* Rows with dividers, as the players above. */
	.member {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
		border-bottom: 1px solid var(--border);
	}
	.who {
		flex: 1;
		min-width: 0;
	}
</style>
