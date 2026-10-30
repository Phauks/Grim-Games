<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
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
</script>

<section class="roles" aria-labelledby="roles-label" data-testid="roles-panel">
	<h2 id="roles-label">{t('room.roles.heading')}</h2>
	<Button
		icon={shown ? 'hide' : 'showToPlayer'}
		variant={shown ? 'quiet' : 'solid'}
		disabled={!host.code}
		data-testid="roles-show"
		onclick={() => host.showRoles(gameId, !shown)}
		>{shown ? t('room.roles.hide') : t('room.roles.show')}</Button
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

<style>
	.roles {
		display: grid;
		gap: var(--space-2);
		align-content: start;
		justify-items: start;
		min-width: 0;
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
