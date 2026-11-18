<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import type { IconSlot } from '#lib/ui/icons/catalogue.ts';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import TokenAppearanceSettings from '#lib/features/characters/TokenAppearanceSettings.svelte';
	import BoardBackgroundRows from './sections/BoardBackgroundRows.svelte';
	import BoardRows from './sections/BoardRows.svelte';
	import PinchZoomRow from './sections/PinchZoomRow.svelte';
	import FontPreview from './sections/FontPreview.svelte';
	import IconsSection from './sections/IconsSection.svelte';
	import ThemeSection from './sections/ThemeSection.svelte';

	/**
	 * The game pane's More > Theme: the settings that change how the board looks, beside the
	 * real board, so it is their preview (Trevor, 2026-11-18: "settings accessible from the game
	 * screen, then they can see the actual changes right away"). Gold bands that open one at a
	 * time, so the list never runs on; each band holds the rows Settings has, from the same
	 * components.
	 */

	/** The icons that mark a seat or a vote on the board. */
	const BOARD_MARKS: readonly IconSlot[] = [
		'alive',
		'dead',
		'ghostVote',
		'poisoned',
		'drunk',
		'protected',
		'night',
		'day',
		'vote',
		'exile',
		'nominator',
		'nominated'
	];

	const tokens = $derived(preferences.current.tokenAppearance);
	const setTokens = (tokenAppearance: typeof tokens) => preferences.update({ tokenAppearance });
</script>

<div class="theme-panel" data-testid="theme-panel">
	{@render band('theme-background', t('settings.theme.background'), background)}
	{@render band('theme-board', t('settings.theme.board'), board)}
	{@render band('theme-character-tokens', t('settings.theme.characterTokens'), characterTokens)}
	{@render band('theme-reminder-tokens', t('settings.theme.reminderTokens'), reminderTokens)}
	{@render band('theme-in-text', t('settings.theme.inText'), inText)}
	{@render band('theme-icons', t('settings.theme.icons'), icons)}
	{@render band('theme-colours', t('settings.theme.colours'), colours)}
</div>

{#snippet band(key: string, title: string, body: Snippet)}
	<Collapsible {title} storageKey={key} group="theme-panel" band="fill" level={3}>
		<div class="rows">{@render body()}</div>
	</Collapsible>
{/snippet}

{#snippet background()}<BoardBackgroundRows />{/snippet}
{#snippet board()}<BoardRows /><PinchZoomRow />{/snippet}
{#snippet characterTokens()}
	<TokenAppearanceSettings
		value={tokens}
		theme={preferences.theme}
		onChange={setTokens}
		part="token"
		previews={false}
	>
		{#snippet playerFont()}<FontPreview roles={['player']} testid="player-font" />{/snippet}
	</TokenAppearanceSettings>
{/snippet}
{#snippet reminderTokens()}
	<TokenAppearanceSettings
		value={tokens}
		theme={preferences.theme}
		onChange={setTokens}
		part="reminder"
		previews={false}
	>
		{#snippet reminderFont()}<FontPreview roles={['reminder']} testid="reminder-font" />{/snippet}
	</TokenAppearanceSettings>
{/snippet}
{#snippet inText()}
	<TokenAppearanceSettings
		value={tokens}
		theme={preferences.theme}
		onChange={setTokens}
		part="inText"
		previews={false}
	>
		{#snippet characterFont()}<FontPreview
				roles={['character']}
				testid="character-font"
			/>{/snippet}
	</TokenAppearanceSettings>
{/snippet}
{#snippet icons()}<IconsSection only={BOARD_MARKS} withSize={false} />{/snippet}
{#snippet colours()}<ThemeSection flat />{/snippet}

<style>
	.theme-panel {
		display: flex;
		flex-direction: column;
	}
	.rows {
		padding-inline: var(--space-1);
	}
</style>
