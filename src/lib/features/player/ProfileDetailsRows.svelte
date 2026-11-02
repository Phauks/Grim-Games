<script lang="ts">
	import {
		DETAIL_SUGGESTIONS,
		MAX_DETAILS,
		MAX_DETAIL_LABEL,
		MAX_DETAIL_TEXT,
		parseDetails,
		type ProfileDetail
	} from '#lib/core/profile/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import SettingRow from '#lib/ui/settings/SettingRow.svelte';
	import { playerSettings } from './player-settings.svelte.ts';

	/**
	 * Details a player adds to their profile (Trevor, 2026-11-01: "Favorite Script", "Favorite
	 * Character Type", etc., "give people the opportunity to spruce up their profile, but also
	 * don't require it"). One row each, edited like the name with a pencil; the list ends in
	 * "+ New detail", so a player with none sees only that.
	 */
	const CUSTOM = 'custom';

	const details = $derived(playerSettings.current.details ?? []);
	let open = $state(false);
	/** The detail being edited, by its place; undefined for a new one. */
	let editing = $state<number>();
	let preset = $state<string>(DETAIL_SUGGESTIONS[0]);
	let label = $state('');
	let text = $state('');

	const presetOptions = [
		...DETAIL_SUGGESTIONS.map((s) => ({ value: s as string, label: s })),
		{ value: CUSTOM, label: t('player.details.custom') }
	];
	const finalLabel = $derived(preset === CUSTOM ? label.trim() : preset);
	const ready = $derived(finalLabel !== '' && text.trim() !== '');

	function begin(index?: number) {
		editing = index;
		const detail = index === undefined ? undefined : details[index];
		const known = detail && (DETAIL_SUGGESTIONS as readonly string[]).includes(detail.label);
		preset = detail ? (known ? detail.label : CUSTOM) : DETAIL_SUGGESTIONS[0];
		label = detail && !known ? detail.label : '';
		text = detail?.text ?? '';
		open = true;
	}

	function save(next: ProfileDetail[]) {
		playerSettings.update({ details: parseDetails(next) });
		open = false;
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!ready) return;
		const detail = { label: finalLabel, text: text.trim() };
		save(
			editing === undefined
				? [...details, detail]
				: details.map((d, i) => (i === editing ? detail : d))
		);
	}
</script>

{#each details as detail, index (index)}
	<SettingRow label={detail.label}>
		{#snippet control(labelId)}
			<span class="value">
				<span class="text" data-testid="profile-detail-text">{detail.text}</span>
				<IconButton
					icon="edit"
					label={t('player.details.edit', { label: detail.label })}
					aria-haspopup="dialog"
					aria-describedby={labelId}
					onclick={() => begin(index)}
				/>
			</span>
		{/snippet}
	</SettingRow>
{/each}
<!-- Kept in place, disabled, once the profile holds as many as it can, so nothing moves. -->
<button
	type="button"
	class="new"
	data-testid="profile-detail-new"
	disabled={details.length >= MAX_DETAILS}
	aria-haspopup="dialog"
	onclick={() => begin()}>+ {t('player.details.new')}</button
>

<Dialog
	bind:open
	title={editing === undefined ? t('player.details.new') : t('player.details.editTitle')}
>
	<form onsubmit={submit} data-testid="profile-detail-form">
		<Select
			label={t('player.details.preset')}
			value={preset}
			options={presetOptions}
			onChange={(value) => (preset = value)}
		/>
		<!-- Filled in from the suggestion, and typed only for Custom: shown either way, so the
		     dialog never changes size. -->
		{#if preset === CUSTOM}
			<TextField
				label={t('player.details.label')}
				bind:value={label}
				maxlength={MAX_DETAIL_LABEL}
				enterkeyhint="next"
			/>
		{:else}
			<TextField label={t('player.details.label')} value={preset} disabled />
		{/if}
		<TextField
			label={t('player.details.text')}
			bind:value={text}
			maxlength={MAX_DETAIL_TEXT}
			enterkeyhint="done"
		/>
		<ModalActions
			onCancel={() => (open = false)}
			submit
			disabled={!ready}
			confirmLabel={t('common.save')}
		>
			{#snippet start()}
				{#if editing !== undefined}
					<DeleteButton
						label={t('player.details.delete')}
						onclick={() => save(details.filter((_, i) => i !== editing))}
					/>
				{/if}
			{/snippet}
		</ModalActions>
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
	.text {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	/* "+ New detail": a dashed edge and no fill, a space to fill, as "+ New note" is. */
	.new {
		width: 100%;
		min-height: var(--tap-target);
		border: 1px dashed var(--border);
		border-radius: var(--card-radius);
		background: transparent;
		color: var(--on-surface-muted);
		font: inherit;
		cursor: pointer;
	}
	.new:disabled {
		cursor: default;
		opacity: 0.5;
	}
</style>
