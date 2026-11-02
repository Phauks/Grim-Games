<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import SettingRow from '#lib/ui/settings/SettingRow.svelte';
	import { MAX_TAGLINE } from '#lib/core/profile/index.ts';
	import { playerSettings } from './player-settings.svelte.ts';

	/**
	 * The player's flavour text in their Profile (Trevor, 2026-10-28), edited like their name:
	 * one line in the row, and a pencil that opens a modal with Save. Shown nowhere else yet.
	 */
	let open = $state(false);
	let text = $state('');
	const saved = $derived(playerSettings.current.flavour ?? '');

	$effect(() => {
		if (open) text = saved;
	});

	function save(event: SubmitEvent) {
		event.preventDefault();
		const next = text.trim();
		playerSettings.update({ flavour: next || undefined });
		open = false;
	}
</script>

<SettingRow label={t('player.flavour')}>
	{#snippet control(labelId)}
		<span class="value">
			<span class="text" data-testid="flavour-text">{saved || t('common.none')}</span>
			<IconButton
				icon="edit"
				label={t('player.editFlavour')}
				aria-haspopup="dialog"
				aria-describedby={labelId}
				onclick={() => (open = true)}
			/>
		</span>
	{/snippet}
</SettingRow>

<Dialog bind:open title={t('player.flavour')}>
	<form onsubmit={save}>
		<textarea
			aria-label={t('player.flavour')}
			bind:value={text}
			maxlength={MAX_TAGLINE}
			rows="4"
			enterkeyhint="done"
			onkeydown={(event) => {
				// Enter saves, as in every other modal; the text wraps on its own.
				if (event.key === 'Enter' && !event.shiftKey) {
					event.preventDefault();
					event.currentTarget.form?.requestSubmit();
				}
			}}></textarea>
		<ModalActions
			onCancel={() => (open = false)}
			submit
			disabled={text.trim() === saved}
			confirmLabel={t('common.save')}
		/>
	</form>
</Dialog>

<style>
	form {
		display: grid;
		gap: var(--space-3);
		min-width: 0;
	}
	.value {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-2);
		min-width: 0;
	}
	/* Long text ends in "…" rather than growing the row. */
	.text {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	textarea {
		box-sizing: border-box;
		width: 100%;
		min-width: 0;
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
		color: var(--on-surface);
		font: var(--font-control);
		resize: none;
	}
</style>
