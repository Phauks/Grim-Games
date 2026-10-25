<script lang="ts">
	import { onMount } from 'svelte';
	import {
		FONT_IDS,
		FONT_ROLE_INFO,
		FONT_ROLES,
		FONTS,
		fontsFor,
		fontStack,
		fontVariable,
		fontWeightVariable,
		loadFont,
		type FontId,
		type FontInfo,
		type FontRole
	} from '#lib/ui/fonts/catalogue.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { resolveFonts } from '#lib/ui/preferences.ts';
	import Select from '#lib/ui/primitives/Select.svelte';

	interface Props {
		/**
		 * The roles to list. Character names and Reminder tokens sit with their token
		 * previews in Tokens (Trevor, 2026-10-18); Text lists the rest.
		 */
		roles?: readonly FontRole[];
		testid?: string;
	}

	let { roles = FONT_ROLES, testid = 'font-preview' }: Props = $props();
	const theme = $derived(preferences.theme);
	const fonts = $derived(resolveFonts(preferences.current, theme));
	const id = $props.id();

	// The dropdowns draw every offered font; elsewhere only the chosen ones are fetched.
	onMount(() => FONT_IDS.forEach(loadFont));

	function choose(role: FontRole, font: FontId) {
		const next = { ...preferences.current.fonts, [role]: font };
		// Picking the theme's own font clears the override, so a theme change still applies.
		if (font === theme.fonts[role]) delete next[role];
		preferences.update({ fonts: next });
	}

	const options = (role: FontRole) =>
		fontsFor(role).map((font) => ({ value: font.id, label: font.family, description: font.note }));
	// Short roles set names and titles, so their fonts preview at the weight they will use.
	const weight = (role: FontRole, font: FontInfo) =>
		FONT_ROLE_INFO[role].length === 'short' ? font.displayWeight : 400;
</script>

<!-- One line per role: its name, a sample in the applied font and the font's drop-down, side
     by side to save space; with each sample beside its own choice nothing needs pinning to
     the top (Trevor, 2026-10-18). The sample cuts off with "…", so a font change moves nothing. -->
<div class="fonts" data-setting data-testid={testid}>
	<dl>
		{#each roles as role (role)}
			<div class="line" data-setting data-role={role}>
				<dt id="{id}-{role}">{FONT_ROLE_INFO[role].label}</dt>
				<dd
					class="sample"
					style:font-family="var({fontVariable(role)})"
					style:font-weight={FONT_ROLE_INFO[role].length === 'short'
						? `var(${fontWeightVariable(role)})`
						: undefined}
				>
					{FONT_ROLE_INFO[role].sample}
				</dd>
				<dd class="pick">
					<Select
						label={FONT_ROLE_INFO[role].label}
						labelledBy="{id}-{role}"
						value={fonts[role]}
						options={options(role)}
						onChange={(font) => choose(role, font)}
					>
						{#snippet item(option)}
							{@const font = FONTS[option.value]}
							<span
								class="name"
								style:font-family={fontStack(font.id)}
								style:font-weight={weight(role, font)}>{font.family}</span
							>
							{#if font.note}<small>{font.note}</small>{/if}
						{/snippet}
						{#snippet selected(option)}
							{@const font = FONTS[option.value]}
							<span style:font-family={fontStack(font.id)} style:font-weight={weight(role, font)}
								>{font.family}</span
							>
						{/snippet}
					</Select>
				</dd>
			</div>
		{/each}
	</dl>
</div>

<style>
	/* Each font is a setting like any other: a line between them and under the last
	   (Trevor, 2026-10-24). */
	dl {
		margin: 0;
	}
	.line {
		padding-block: var(--space-2);
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr) minmax(0, 1.3fr);
		align-items: center;
		gap: var(--space-2);
	}
	/* The same name as every other setting (Trevor, 2026-10-24). */
	dt {
		font-family: var(--font-control);
		font-weight: var(--font-control-weight);
		color: var(--heading);
		letter-spacing: 0.03em;
		overflow-wrap: anywhere;
	}
	dd {
		margin: 0;
		min-width: 0;
	}
	.sample {
		/* Reserved height: a taller or wider font never pushes the other lines. */
		height: 1.6em;
		overflow: hidden;
		line-height: 1.6;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.name {
		font-size: 1.05rem;
		line-height: 1.3;
	}
</style>
