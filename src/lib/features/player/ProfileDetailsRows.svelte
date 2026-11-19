<script lang="ts">
	import NoneState from '#lib/ui/primitives/NoneState.svelte';
	import {
		DETAIL_SUGGESTIONS,
		MAX_DETAILS,
		MAX_DETAIL_LABEL,
		MAX_DETAIL_TEXT,
		parseDetails,
		type ProfileDetail
	} from '#lib/core/profile/index.ts';
	import { avatarCharacter, characterAvatar } from '#lib/core/avatars/index.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import CharacterPicker from '#lib/features/characters/CharacterPicker.svelte';
	import { loadOfficialData, officialData } from '#lib/features/characters/game-data.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
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
	 * "+ New detail", so a player with none sees only that. The character that represents them
	 * (Trevor, 2026-10-28: "representative character token") is one of these too, picked from
	 * the official characters instead of typed (Trevor, 2026-11-16: "remove character token,
	 * integrate any functionality in profile with add detail").
	 */
	const CUSTOM = 'custom';
	const TOKEN = 'token';

	const details = $derived(playerSettings.current.details ?? []);
	const chosen = $derived(avatarCharacter(playerSettings.current.avatar));
	const character = $derived(chosen ? officialData.current?.byId.get(chosen) : undefined);
	let open = $state(false);
	/** The detail being edited, by its place, or the character token; undefined for a new one. */
	let editing = $state<number | typeof TOKEN>();
	let preset = $state<string>(DETAIL_SUGGESTIONS[0]);
	let label = $state('');
	let text = $state('');
	/** The character token picked in the dialog, until Save. */
	let pick = $state<string>();
	let picking = $state(false);
	let query = $state('');

	$effect(() => {
		if (chosen || open) void loadOfficialData();
	});

	/** A typed detail can be added while there is room; the token, while there is none. */
	const presetOptions = $derived([
		...(editing === TOKEN || (editing === undefined && details.length >= MAX_DETAILS)
			? []
			: [
					...DETAIL_SUGGESTIONS.map((s) => ({ value: s as string, label: s })),
					{ value: CUSTOM, label: t('player.details.custom') }
				]),
		...(editing === TOKEN || (editing === undefined && !chosen)
			? [{ value: TOKEN, label: t('player.characterIcon') }]
			: [])
	]);
	const finalLabel = $derived(preset === CUSTOM ? label.trim() : preset);
	const ready = $derived(
		preset === TOKEN ? pick !== undefined : finalLabel !== '' && text.trim() !== ''
	);
	const pickedCharacter = $derived(pick ? officialData.current?.byId.get(pick) : undefined);

	function begin(index?: number | typeof TOKEN) {
		editing = index;
		const detail = typeof index === 'number' ? details[index] : undefined;
		const known = detail && (DETAIL_SUGGESTIONS as readonly string[]).includes(detail.label);
		preset =
			index === TOKEN
				? TOKEN
				: detail
					? known
						? detail.label
						: CUSTOM
					: details.length >= MAX_DETAILS
						? TOKEN
						: DETAIL_SUGGESTIONS[0];
		label = detail && !known ? detail.label : '';
		text = detail?.text ?? '';
		pick = chosen;
		open = true;
	}

	function setToken(id: string | undefined) {
		playerSettings.update({ avatar: id ? characterAvatar(id) : 'initials' });
		open = false;
	}

	function save(next: ProfileDetail[]) {
		playerSettings.update({ details: parseDetails(next) });
		open = false;
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!ready) return;
		if (preset === TOKEN) return setToken(pick);
		const detail = { label: finalLabel, text: text.trim() };
		save(
			typeof editing !== 'number'
				? [...details, detail]
				: details.map((d, i) => (i === editing ? detail : d))
		);
	}
</script>

{#if chosen}
	<SettingRow label={t('player.characterIcon')}>
		{#snippet control(labelId)}
			<span class="value">
				<span class="text" data-testid="character-icon"
					>{#if character}<CharacterPiece
							template="badge"
							characterId={chosen}
							{character}
						/>{/if}</span
				>
				<IconButton
					icon="edit"
					label={t('player.editCharacterIcon')}
					aria-haspopup="dialog"
					aria-describedby={labelId}
					onclick={() => begin(TOKEN)}
				/>
			</span>
		{/snippet}
	</SettingRow>
{/if}
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
	disabled={details.length >= MAX_DETAILS && chosen !== undefined}
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
		{#if preset === TOKEN}
			<!-- The character, picked from the official ones in place of typed text. -->
			<div class="pick">
				<span class="text" data-testid="character-icon-pick"
					>{#if pick && pickedCharacter}<CharacterPiece
							template="badge"
							characterId={pick}
							character={pickedCharacter}
						/>{:else}<NoneState inline />{/if}</span
				>
				<Button
					icon="edit"
					aria-haspopup="dialog"
					onclick={() => {
						query = '';
						picking = true;
					}}>{t('player.details.pickCharacter')}</Button
				>
			</div>
		{:else}
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
		{/if}
		<ModalActions
			onCancel={() => (open = false)}
			submit
			disabled={!ready}
			confirmLabel={t('common.save')}
		>
			{#snippet start()}
				{#if editing === TOKEN}
					<DeleteButton label={t('player.details.delete')} onclick={() => setToken(undefined)} />
				{:else if editing !== undefined}
					<DeleteButton
						label={t('player.details.delete')}
						onclick={() => save(details.filter((_, i) => i !== editing))}
					/>
				{/if}
			{/snippet}
		</ModalActions>
	</form>
</Dialog>

<Dialog bind:open={picking} title={t('player.characterIcon')} size="full">
	<div class="list">
		{#if officialData.current}
			<CharacterPicker
				characters={officialData.current.characters}
				selected={pick ? [pick] : []}
				bind:query
				collapsibleKey="avatar-character"
				onSelect={(id) => {
					pick = id;
					picking = false;
				}}
				onNone={() => {
					pick = undefined;
					picking = false;
				}}
			/>
		{:else}
			<p>{t('account.loading')}</p>
		{/if}
	</div>
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
	.pick {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		min-height: var(--tap-target);
	}
	.list {
		display: flex;
		flex-direction: column;
		min-height: 0;
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
