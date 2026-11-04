<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import LabPanel from './LabPanel.svelte';
	import type { LabSession } from './lab-session.svelte.ts';

	/**
	 * The Character Lab on a phone or tablet (plan M45): a bar pinned to the bottom of the
	 * Characters page with the jinx partner's arrows and Load game, which goes to the game; Lab
	 * opens every control. Always there, disabled while nothing can load, so nothing moves.
	 */
	interface Props {
		session: LabSession;
	}

	let { session }: Props = $props();
	let open = $state(false);
</script>

<nav class="lab-dock pinned-bottom" aria-label={t('lab.title')}>
	<div class="bar">
		<Button onclick={() => (open = true)}>{t('lab.open')}</Button>
		<div class="steps">
			<IconButton
				icon="back"
				label={t('lab.previous')}
				disabled={session.loading || session.at === 0}
				onclick={() => session.show(session.at - 1)}
			/>
			<span class="count" data-testid="lab-position"
				>{session.opponents.length
					? t('lab.position', { at: session.at + 1, total: session.opponents.length })
					: t('common.none')}</span
			>
			<IconButton
				icon="forward"
				label={t('lab.next')}
				disabled={session.loading || session.at >= session.opponents.length - 1}
				onclick={() => session.show(session.at + 1)}
			/>
		</div>
		<Button
			variant="accent"
			disabled={session.loading || !session.data}
			onclick={() => void session.load(session.at, true)}
			>{session.loading ? t('lab.loading') : t('lab.load')}</Button
		>
	</div>
</nav>

<Dialog bind:open title={t('lab.title')} size="full">
	<LabPanel {session} titled={false} />
</Dialog>

<style>
	/* Pinned to the screen's bottom edge, as SetupNav; its room is kept below the page. */
	.lab-dock {
		position: fixed;
		right: 0;
		bottom: 0;
		left: 0;
		z-index: var(--z-raised);
		border-top: var(--pinned-border) solid var(--border);
		background: var(--page-background, var(--surface));
	}
	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		max-width: var(--page-max);
		margin: 0 auto;
		padding: var(--space-2) var(--page-gutter) calc(var(--space-2) + env(safe-area-inset-bottom));
	}
	.steps {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		min-width: 0;
	}
	.count {
		min-width: 4.5em;
		text-align: center;
		color: var(--on-surface-muted);
		font-size: 0.85rem;
		font-variant-numeric: tabular-nums;
	}
</style>
