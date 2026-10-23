<script lang="ts">
	import type { Game, SeatId } from '#lib/core/model/index.ts';
	import { seatLabel } from '#lib/features/game/seat-label.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';

	/**
	 * Ending a day asks who was executed (Trevor, 2026-10-22: "execution button instead of the
	 * end day button. no execution is a choice when ending each day"). Nothing is chosen until
	 * the Storyteller picks a player or No execution; today's nominees come first. An
	 * execution already logged today is chosen to start with.
	 */
	interface Props {
		open: boolean;
		game: Game;
		/** The player executed, or undefined for no execution; the dialog closes first. */
		onConfirm: (seatId: SeatId | undefined) => void;
	}

	let { open = $bindable(), game, onConfirm }: Props = $props();

	const NONE = 'none';
	let choice = $state<string | undefined>();

	const executed = $derived(
		game.today.entries.findLast((e) => e.kind === 'execution')?.seatId as SeatId | undefined
	);
	$effect(() => {
		if (open) choice = executed;
	});

	const options = $derived.by(() => {
		const nominees: SeatId[] = [];
		for (const e of game.today.entries)
			if (e.kind === 'nomination' && !nominees.includes(e.nominee)) nominees.push(e.nominee);
		const players = game.seating.filter((s) => !nominees.includes(s));
		return [
			{ value: NONE, label: t('day.noExecution') },
			...nominees.map((s) => ({
				value: s,
				label: seatLabel(game, s),
				group: t('day.nominatedToday')
			})),
			...players.map((s) => ({
				value: s,
				label: seatLabel(game, s),
				group: nominees.length > 0 ? t('day.otherPlayers') : undefined
			}))
		];
	});
</script>

<ConfirmDialog
	bind:open
	title={t('day.endDayConfirm')}
	disabled={choice === undefined}
	onConfirm={() => onConfirm(choice === NONE ? undefined : (choice as SeatId | undefined))}
>
	<div class="execution" data-testid="execution">
		<Select
			label={t('day.execution')}
			placeholder={t('day.executionChoose')}
			value={choice}
			{options}
			onChange={(value) => (choice = value)}
		/>
	</div>
</ConfirmDialog>

<style>
	.execution {
		padding-block: var(--space-2);
	}
</style>
