<script lang="ts">
	import { extraTotal } from '#lib/core/modes/index.ts';
	import { gameModeOf } from '#lib/features/modes/game-mode.ts';
	import OffScriptExtras from '#lib/features/modes/OffScriptExtras.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';
	import type { SetupGamePort } from './game-port.ts';

	/**
	 * Character selection's hidden characters from off the script, while a rule adds them (+1,
	 * A Script of Infinite Possibilities): picked here beside the bag, no longer a step of their
	 * own (Trevor, 2026-10-29). `onincomplete` holds Build bag back while too few or too many
	 * are picked (Trevor, 2026-10-30: "disabled until special rules completed").
	 */
	let { port, onincomplete }: { port: SetupGamePort; onincomplete: (off: boolean) => void } =
		$props();

	const gameId = $derived(port.game?.gameId);
	const mode = $derived(gameId !== undefined ? gameModeOf(gameId) : undefined);
	const hides = $derived(mode?.parts.pool?.kind === 'script-plus-hidden');
	let count = $state(0);

	$effect(() => {
		const total = mode && hides ? extraTotal(mode) : undefined;
		onincomplete(total !== undefined && (count < total.min || count > total.max));
	});
</script>

{#if hides && port.game}
	<section class="off-script" data-testid="setup-off-script">
		<Collapsible title={t('modes.extras.box')} level={3} storageKey="setup:off-script">
			{#snippet aside()}<CountBadge {count} />{/snippet}
			<OffScriptExtras {port} onchange={(n) => (count = n)} />
		</Collapsible>
	</section>
{/if}

<style>
	.off-script {
		padding: var(--space-1) var(--space-3) var(--space-3);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
	}
</style>
