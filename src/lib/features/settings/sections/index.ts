import { registerSettingsSection } from '../registry.ts';
import AboutSection from './AboutSection.svelte';
import AssistanceSection from './AssistanceSection.svelte';
import AppearanceSection from './AppearanceSection.svelte';
import IconsSection from './IconsSection.svelte';
import DataSection from './DataSection.svelte';
import DiagnosticsSection from './DiagnosticsSection.svelte';
import RefreshDiagnostics from '#lib/features/errors/RefreshDiagnostics.svelte';
import BoardSection from './BoardSection.svelte';
// Feature-owned sections, registered by their own modules.
import '#lib/features/player/settings-section.ts';

// Built-in sections, grouped by topic in one list (Trevor, 2026-10-17: no audience groups;
// every Storyteller-only setting is in Storyteller settings). Other features register theirs
// the same way from their own modules.
registerSettingsSection({
	id: 'appearance',
	label: { key: 'settings.themeText' },
	icon: 'appearance',
	component: AppearanceSection,
	order: 10
});
registerSettingsSection({
	id: 'icons',
	label: { key: 'settings.icons' },
	icon: 'icons',
	component: IconsSection,
	order: 20
});
registerSettingsSection({
	// Also opened on its own from the board's menu (Trevor, 2026-10-17).
	id: 'board',
	label: { key: 'settings.boardTokens' },
	icon: 'reminder',
	component: BoardSection,
	order: 30
});
registerSettingsSection({
	id: 'assistance',
	label: { key: 'settings.storyteller' },
	icon: 'assistance',
	component: AssistanceSection,
	order: 35
});
registerSettingsSection({
	id: 'data',
	label: { key: 'settings.data' },
	icon: 'data',
	component: DataSection,
	order: 90
});
registerSettingsSection({
	id: 'about',
	label: { key: 'shell.about' },
	icon: 'about',
	component: AboutSection,
	order: 95
});
registerSettingsSection({
	id: 'diagnostics',
	label: { key: 'shell.navDiagnostics' },
	icon: 'diagnostics',
	component: DiagnosticsSection,
	headingAction: RefreshDiagnostics,
	order: 96
});
