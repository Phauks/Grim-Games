<script lang="ts">
	import {
		FONT_ROLE_INFO,
		FONT_ROLES,
		fontVariable,
		fontWeightVariable
	} from '#lib/ui/fonts/catalogue.ts';
	import SettingPreview from '#lib/ui/settings/SettingPreview.svelte';
</script>

<!-- One line per role in the applied font. Each line has a fixed height, so nothing moves. -->
<SettingPreview testid="font-preview">
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
</SettingPreview>

<style>
	dl {
		display: grid;
		gap: var(--space-1);
		margin: 0;
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
