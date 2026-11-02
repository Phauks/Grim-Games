<script lang="ts">
	import type { Command } from '#lib/core/engine/index.ts';
	import type { Game } from '#lib/core/model/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';

	/**
	 * The two Storytellers (a `twoStorytellers` rule character: the Knaves): their names, which
	 * one lies (decided before the first night), and Switch, which swaps them at once. A second
	 * switch is allowed and only noted: the Storyteller decides.
	 */
	interface Props {
		open: boolean;
		game: Game;
		run: (command: Command) => void;
	}

	let { open = $bindable(), game, run }: Props = $props();

	let first = $state('');
	let second = $state('');
	let liar = $state<'0' | '1' | 'none'>('none');
	$effect(() => {
		if (!open) return;
		const pair = game.storytellerPair;
		first = pair?.names?.[0] ?? '';
		second = pair?.names?.[1] ?? '';
		liar = pair?.liar === undefined ? 'none' : pair.liar === 0 ? '0' : '1';
	});

	const name = (value: string, i: number) =>
		value.trim() || t('storytellers.default', { number: i + 1 });

	function save(event: SubmitEvent) {
		event.preventDefault();
		run({
			type: 'SetStorytellers',
			names: [first, second],
			...(liar === 'none' ? {} : { liar: liar === '0' ? (0 as const) : (1 as const) })
		});
		open = false;
	}

	function switchNow() {
		run({ type: 'SwitchStorytellers' });
		open = false;
	}
</script>

<Dialog bind:open title={t('storytellers.title')}>
	<form onsubmit={save}>
		<TextField label={t('storytellers.name', { number: 1 })} bind:value={first} />
		<TextField label={t('storytellers.name', { number: 2 })} bind:value={second} />
		<Select
			label={t('storytellers.liar')}
			value={liar}
			options={[
				{ value: 'none' as const, label: t('storytellers.undecided') },
				{ value: '0' as const, label: name(first, 0) },
				{ value: '1' as const, label: name(second, 1) }
			]}
			onChange={(v) => (liar = v)}
		/>
		<p class="note">
			{game.storytellerPair?.switched ? t('storytellers.switched') : t('storytellers.notSwitched')}
		</p>
		<Button
			variant="quiet"
			icon="swap"
			disabled={game.storytellerPair?.liar === undefined}
			onclick={switchNow}>{t('storytellers.switch')}</Button
		>
		<ModalActions onCancel={() => (open = false)} submit confirmLabel={t('common.save')} />
	</form>
</Dialog>

<style>
	form {
		display: grid;
		gap: var(--space-3);
		min-width: 0;
	}
	.note {
		margin: 0;
		color: var(--on-surface-muted);
		font-size: 0.9rem;
	}
</style>
