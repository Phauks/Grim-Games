<script lang="ts">
	import { onMount } from 'svelte';
	import { gameStore } from '#lib/features/game/session.svelte.ts';
	import { PRESETS } from '#lib/features/grimoire/backgrounds.ts';
	import { intl, t } from '#lib/i18n/locale.svelte.ts';
	import { resolveToken } from '#lib/ui/themes/contrast.ts';
	import { getTheme } from '#lib/ui/themes/registry.ts';
	import Chip from '#lib/ui/primitives/Chip.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import {
		changedSettings,
		NAME_MAX,
		profileUse,
		type ProfileValues,
		type SettingsProfile
	} from './profile-values.ts';
	import { settingsProfiles } from './settings-profiles.svelte.ts';

	/**
	 * Settings profiles (plan S18): one divided row per profile with its name, the Default
	 * chip, Duplicate and a red trash. The heading's drop-down picks the one in use; its +
	 * adds one with the app's default settings.
	 *
	 * Each row also shows what tells profiles apart (Trevor, 2026-10-25: players need more
	 * to choose one): a swatch of its background and accent colour, its background, text size
	 * and changed settings, and the saved games it was used for. Both lines are always there,
	 * so nothing moves when the saved games arrive.
	 */
	let deleting = $state<SettingsProfile>();
	let confirmOpen = $state(false);
	const only = $derived(settingsProfiles.list.length === 1);

	let saved = $state<{ gameId: string; savedAt: number }[]>();
	onMount(() => {
		gameStore()
			.list()
			.then(({ games }) => (saved = games))
			// No saved games to read: the games line stays empty.
			.catch(() => {});
	});

	function accent({ preferences }: ProfileValues): string {
		const custom = preferences.colors['--accent'];
		if (custom) return custom;
		const theme = getTheme(preferences.themeId);
		return resolveToken('--accent', { ...theme.palette, ...theme.tokens });
	}

	function backgroundName({ background }: ProfileValues): string {
		if (background.kind === 'preset') return PRESETS[background.id].label;
		if (background.kind === 'script') return t('settings.profileBackgroundScript');
		if (background.kind === 'image') return t('settings.profileBackgroundImage');
		return t('settings.profileBackgroundNone');
	}

	function looks(values: ProfileValues): string {
		return [
			backgroundName(values),
			t('settings.profileTextSize', {
				size: intl.number(values.preferences.textScale, { style: 'percent' })
			}),
			t('settings.profileChanges', { count: changedSettings(values) })
		].join(' · ');
	}

	function used(profile: SettingsProfile): string {
		if (!saved) return '';
		const use = profileUse(profile.id, settingsProfiles.gameProfiles, saved);
		if (use.lastSaved === undefined) return t('settings.profileNoGames');
		return t('settings.profileGames', {
			count: use.games,
			date: intl.date(use.lastSaved, { dateStyle: 'medium' })
		});
	}
</script>

<ul class="profiles">
	{#each settingsProfiles.list as profile (profile.id)}
		<li data-setting data-testid="profile-row">
			<div class="controls">
				<div class="name">
					<TextField
						label={t('settings.profileName')}
						hideLabel
						value={profile.name}
						maxlength={NAME_MAX}
						oninput={(name) => settingsProfiles.rename(profile.id, name)}
					/>
				</div>
				<Chip
					pressed={profile.id === settingsProfiles.defaultId}
					aria-label={t('settings.profileMakeDefault', { name: profile.name })}
					onclick={() => settingsProfiles.makeDefault(profile.id)}
					>{t('settings.profileDefault')}</Chip
				>
				<IconButton
					icon="copy"
					label={t('settings.profileDuplicate', { name: profile.name })}
					onclick={() => void settingsProfiles.duplicate(profile.id)}
				/>
				<!-- The last profile can't go: disabled, not hidden, so nothing moves. -->
				<DeleteButton
					label={t('settings.profileDelete', { name: profile.name })}
					disabled={only}
					onclick={() => {
						deleting = profile;
						confirmOpen = true;
					}}
				/>
			</div>
			<!-- What tells it apart, under its controls so they keep their room on phones. -->
			<div class="about">
				<span
					class="swatch"
					aria-hidden="true"
					style:background={profile.values.background.kind === 'preset'
						? PRESETS[profile.values.background.id].css
						: undefined}
				>
					<span class="accent" style:background={accent(profile.values)}></span>
				</span>
				<div class="lines">
					<p class="detail" data-testid="profile-looks">{looks(profile.values)}</p>
					<p class="detail" data-testid="profile-games">{used(profile)}</p>
				</div>
			</div>
		</li>
	{/each}
</ul>

<ConfirmDialog
	bind:open={confirmOpen}
	title={t('settings.profileDeleteTitle', { name: deleting?.name ?? '' })}
	danger
	onConfirm={() => {
		if (deleting) void settingsProfiles.remove(deleting.id);
		confirmOpen = false;
	}}
>
	<p>{t('settings.profileDeleteText')}</p>
</ConfirmDialog>

<style>
	.profiles {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: grid;
		gap: var(--space-2);
		/* The line between profiles is every setting's line (ui/base.css, S20). */
		padding: var(--space-2) 0;
	}
	.controls,
	.about {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.name,
	.lines {
		flex: 1;
		min-width: 0;
	}
	.swatch {
		position: relative;
		flex: none;
		width: calc(var(--u) * 2.5);
		aspect-ratio: 1;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
	}
	.accent {
		position: absolute;
		right: 12%;
		bottom: 12%;
		width: 36%;
		aspect-ratio: 1;
		border-radius: 50%;
		border: 1px solid var(--border);
	}
	.detail {
		/* One line each, always there: a long line is cut, never wrapped, so nothing moves. */
		min-height: 1lh;
		margin: 0;
		overflow: hidden;
		color: var(--on-surface-muted);
		font-size: 0.85rem;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
</style>
