<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import { roleGaps, type RoleGap } from '#lib/core/sync/seat-roles.ts';
	import { showCharacters } from './show-characters.ts';
	import { seatName } from '#lib/features/game/seat-label.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import { roomHost } from './host.svelte.ts';
	import { ROLES_SHOWN_MS } from './roles-shown.svelte.ts';
	import { clock, timeLeft } from './time-left.svelte.ts';

	/**
	 * Show players their own characters on their phones (Trevor, 2026-10-26: "Storyteller sees
	 * who has seen their role. Then can turn on and off when ppl can see it"), beside Players'
	 * ✕ (Trevor, 2026-10-31: "put it next to the x button, when clicked the button changes into
	 * the timer which can also be ended very fast"), as the standard button (Trevor, 2026-11-15). A button, not a switch (Trevor,
	 * 2026-10-30): showing them starts a minute that runs out on its own, counted down on the
	 * button itself, and one tap on it hides them again. Who has seen theirs is marked on each
	 * player's row (Trevor, 2026-10-30).
	 */
	let { game }: { game: OpenGame } = $props();

	const host = roomHost();
	const gameId = $derived(game.game.gameId);
	const shown = $derived(host.rolesShown.gameId === gameId);
	const countdown = timeLeft(() => (shown ? host.rolesShown.until : undefined));
	// Before it starts, the minute it will run; then what is left of it.
	const time = $derived(clock(countdown.ms ?? ROLES_SHOWN_MS));

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
	// Players with no phone come to the Storyteller for theirs (Trevor, 2026-11-01: "it should
	// use the normal draw area, not be this new modal"): the same path as Deal's.
	const confirmShow = () => showCharacters(game.game, game.characters);
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
		else confirmShow();
	}
</script>

<!-- The standard button, short so the title beside it never wraps on a phone (Trevor,
     2026-11-15, "B": "Show", then the time left while players can look). Both labels share one
     cell, so it keeps its width as it changes and nothing beside it moves; its name keeps the
     whole words. -->
<Button
	variant="quiet"
	icon={shown ? 'hide' : 'showToPlayer'}
	aria-label={shown ? t('room.roles.hideLeft', { time }) : t('room.roles.show')}
	aria-pressed={shown}
	disabled={!host.code}
	data-testid="roles-show"
	data-shown={shown || undefined}
	onclick={toggle}
	><span class="labels"
		><span class:off={shown}>{t('room.roles.showShort')}</span><span
			class:off={!shown}
			data-testid="roles-time-left">{time}</span
		></span
	></Button
>

<ConfirmDialog bind:open={warn} title={t('room.roles.gapsTitle')} onConfirm={confirmShow}>
	<ul class="gaps" data-testid="roles-gaps">
		{#each warning as gap (gap.key)}
			<li data-testid="roles-gap"><PlayerBadge name={gap.name} /><span>{gap.text}</span></li>
		{/each}
	</ul>
</ConfirmDialog>

<style>
	.labels {
		display: inline-grid;
	}
	.labels > span {
		grid-area: 1 / 1;
		font-variant-numeric: tabular-nums;
	}
	.off {
		visibility: hidden;
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
</style>
