<script lang="ts">
	import { resolve } from '$app/paths';
	import type { GameId } from '#lib/core/model/index.ts';
	import { backToNewGame } from '#lib/features/modes/new-game-draft.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import SetupNav from './SetupNav.svelte';

	/**
	 * Character selection's bar. Back is New game while nothing has happened yet (Trevor,
	 * 2026-10-23), else the board. A mode that deals no bag (Sushi Buffet, Whale Buffet) goes on
	 * to its draft or choice instead of Build bag (Trevor, 2026-10-29: "still show the same
	 * screen").
	 */
	interface Props {
		gameId: GameId;
		backStep: 'new' | 'board';
		players: number;
		/** The next step's label for a mode that deals no bag; Build bag otherwise. */
		deal?: string;
		disabled: boolean;
		sameBag: boolean;
		onNext: () => void;
		onBoard: () => void;
	}

	let { gameId, backStep, players, deal, disabled, sameBag, onNext, onBoard }: Props = $props();
</script>

<SetupNav
	backHref={backStep === 'board' ? resolve('/grimoire/[gameId]', { gameId }) : undefined}
	onBack={backStep === 'board' ? undefined : () => void backToNewGame(gameId, players)}
	backLabel={backStep === 'board' ? t('setup.grimoire') : t('setup.newGame')}
>
	{#snippet next()}
		<span class="next">
			<!-- The board without a bag, for a Storyteller who hands tokens out on it; always
			     here, so the bar never changes. -->
			{#if backStep !== 'board'}<IconButton
					icon="grimoire"
					label={t('setup.grimoire')}
					disabled={deal !== undefined}
					onclick={onBoard}
					data-testid="setup-to-board"
				/>{/if}
			<Button
				variant="accent"
				icon={deal ? 'forward' : 'bag'}
				{disabled}
				onclick={onNext}
				data-testid="setup-next"
				>{deal ?? (sameBag ? t('setup.continueDraw') : t('setup.buildBag'))}</Button
			>
		</span>
	{/snippet}
</SetupNav>

<style>
	.next {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
</style>
