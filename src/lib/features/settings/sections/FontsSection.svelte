<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { onMount } from 'svelte';
	import {
		FONT_IDS,
		FONT_ROLE_INFO,
		FONT_ROLES,
		fontVariable,
		fontWeightVariable,
		loadFont,
		type FontId,
		type FontRole
	} from '#lib/ui/fonts/catalogue.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { resolveFonts } from '#lib/ui/preferences.ts';
	import FontPicker from '../FontPicker.svelte';

	const theme = $derived(preferences.theme);
	const fonts = $derived(resolveFonts(preferences.current, theme));

	// The dropdowns draw every offered font; elsewhere only the chosen ones are fetched.
	onMount(() => FONT_IDS.forEach(loadFont));

	function choose(role: FontRole, font: FontId) {
		const next = { ...preferences.current.fonts, [role]: font };
		// Picking the theme's own font clears the override, so a theme change still applies.
		if (font === theme.fonts[role]) delete next[role];
		preferences.update({ fonts: next });
	}
</script>

{#each FONT_ROLES as role (role)}
	<FontPicker
		{role}
		value={fonts[role]}
		defaultValue={theme.fonts[role]}
		onChange={(font) => choose(role, font)}
	/>
{/each}

<!-- One line per role in the applied font. Each line has a fixed height, so nothing moves. -->
<section class="preview" aria-labelledby="font-preview-title">
	<h3 id="font-preview-title">{t('settings.fontPreview')}</h3>
	<dl>
		{#each FONT_ROLES as role (role)}
			<div class="line" data-role={role}>
				<dt>{FONT_ROLE_INFO[role].label}</dt>
				<dd
					style:font-family="var({fontVariable(role)})"
					style:font-weight={FONT_ROLE_INFO[role].length === 'short'
						? `var(${fontWeightVariable(role)})`
						: undefined}
				>
					{FONT_ROLE_INFO[role].sample}
				</dd>
			</div>
		{/each}
	</dl>
</section>

<style>
	.preview {
		margin-top: var(--space-6);
	}
	h3 {
		margin: 0 0 var(--space-2);
		font-size: 1rem;
	}
	dl {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding: var(--space-3);
		border: var(--card-border);
		border-radius: var(--card-radius);
		background: var(--card-background);
	}
	.line {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
		align-items: center;
		gap: var(--space-2);
	}
	dt {
		font-family: var(--font-control);
		font-size: 0.75rem;
		color: var(--on-surface-muted);
		overflow-wrap: anywhere;
	}
	dd {
		/* Reserved height: a taller or wider font never pushes the other lines. */
		height: 1.6em;
		margin: 0;
		overflow: hidden;
		line-height: 1.6;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
</style>
