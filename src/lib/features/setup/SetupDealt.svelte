<script lang="ts">
	import type { GameId } from '#lib/core/model/index.ts';
	import { gameModeOf } from '#lib/features/modes/game-mode.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';

	/**
	 * Why a mode that deals no bag (Sushi Buffet, Whale Buffet) has its characters greyed out
	 * here: the players draft or choose their own (Trevor, 2026-10-29: "show why it would be
	 * disabled").
	 */
	let { gameId }: { gameId: GameId } = $props();

	const mode = $derived(gameModeOf(gameId));
</script>

<p class="why" data-testid="setup-dealt">
	{t(mode?.parts.assignment?.kind === 'draft' ? 'setup.dealt.draft' : 'setup.dealt.choose', {
		mode: mode?.name ?? ''
	})}
</p>

<style>
	.why {
		margin: 0 0 var(--space-2);
		color: var(--on-surface-muted);
	}
</style>
