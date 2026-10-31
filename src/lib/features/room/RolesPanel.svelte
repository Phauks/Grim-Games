<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import { roleGaps, type RoleGap } from '#lib/core/sync/seat-roles.ts';
	import { seatName } from '#lib/features/game/seat-label.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import { roomHost } from './host.svelte.ts';
	import VoteTimeLeft from './VoteTimeLeft.svelte';

	/**
	 * Players' own characters on their phones (Trevor, 2026-10-26: "Storyteller sees who has
	 * seen their role. Then can turn on and off when ppl can see it"). A button, not a switch
	 * (Trevor, 2026-10-30), since showing them starts a minute that runs out on its own. Who has
	 * seen theirs is marked on each player's row above (combined, Trevor 2026-10-30).
	 */
	let { game }: { game: OpenGame } = $props();

	const host = roomHost();
	const gameId = $derived(game.game.gameId);
	const shown = $derived(host.rolesShown.gameId === gameId);

	// Who won't see a character, said before showing them (Trevor, 2026-10-31: "should show
	// some information if not all seats are filled, or not all players have assigned
	// characters"). A warning: Confirm shows them anyway.
	const GAP_TEXT = {
		'no-character': 'room.roles.noCharacter',
		withheld: 'room.roles.withheld',
		'no-alignment': 'room.roles.noAlignment',
		'no-phone': 'room.roles.noPhone'
	} as const satisfies Record<RoleGap, string>;
	let warning = $state<{ key: string; name: string; text: string }[]>([]);
	let warn = $state(false);
	function gapsNow() {
		const phones = new Set(host.members.flatMap((m) => (m.seatId ? [m.seatId] : [])));
		return [
			...roleGaps(game.game, game.characters, phones).map(({ seatId, gaps }) => ({
				key: seatId,
				name: seatName(game.game, seatId),
				text: gaps.map((gap) => t(GAP_TEXT[gap])).join(' · ')
			})),
			...host.unseatedInGame.flatMap((m) =>
				m.name ? [{ key: m.memberId, name: m.name, text: t('room.noSeat') }] : []
			)
		];
	}
	function toggle() {
		if (shown) return host.showRoles(gameId, false);
		warning = gapsNow();
		if (warning.length) warn = true;
		else host.showRoles(gameId, true);
	}
</script>

<section class="roles" aria-labelledby="roles-label" data-testid="roles-panel">
	<h2 id="roles-label">{t('room.roles.heading')}</h2>
	<Button
		icon={shown ? 'hide' : 'showToPlayer'}
		variant={shown ? 'quiet' : 'solid'}
		disabled={!host.code}
		data-testid="roles-show"
		onclick={toggle}>{shown ? t('room.roles.hide') : t('room.roles.show')}</Button
	>
	<!-- How much longer players can see theirs (Trevor, 2026-10-29); the line is kept while
	     they can't, so nothing below moves. -->
	<div class="time-left">
		<VoteTimeLeft
			endsAt={shown ? host.rolesShown.until : undefined}
			text={(time) => t('room.roles.timeLeft', { time })}
			endedText=""
			testid="roles-time-left"
		/>
	</div>
</section>

<ConfirmDialog
	bind:open={warn}
	title={t('room.roles.gapsTitle')}
	onConfirm={() => host.showRoles(gameId, true)}
>
	<ul class="gaps" data-testid="roles-gaps">
		{#each warning as gap (gap.key)}
			<li data-testid="roles-gap"><PlayerBadge name={gap.name} /><span>{gap.text}</span></li>
		{/each}
	</ul>
</ConfirmDialog>

<style>
	.roles {
		display: grid;
		gap: var(--space-2);
		align-content: start;
		justify-items: start;
		min-width: 0;
	}
	.gaps {
		display: grid;
		margin: 0 0 var(--space-2);
		padding: 0;
		list-style: none;
	}
	.gaps li {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		justify-content: space-between;
		min-width: 0;
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--border);
	}
	.gaps li:last-child {
		border-bottom: none;
	}
	.gaps span {
		flex: none;
		color: var(--on-surface-muted);
	}
	h2 {
		margin: 0;
		font-size: 1.1rem;
	}
	.time-left {
		min-height: 1.5em;
	}
	.time-left :global([data-testid='roles-time-left']) {
		margin: 0;
		line-height: 1.5;
	}
</style>
