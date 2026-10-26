import { registerSettingsSection } from '#lib/features/settings/registry.ts';
import { preferences } from '#lib/ui/preferences.svelte.ts';
import { DEFAULT_PREFERENCES } from '#lib/ui/preferences.ts';
import SoundSection from './SoundSection.svelte';

// Every sound's settings in one section (plan U1, settings registry: features add their own).
// The timer's and Back to town's sounds and vibration belong to the settings profile; the volume to the device.
registerSettingsSection({
	id: 'sound',
	label: { key: 'settings.sectionSound' },
	icon: 'sound',
	component: SoundSection,
	reset: () =>
		preferences.update({
			soundVolume: DEFAULT_PREFERENCES.soundVolume,
			timerSound: DEFAULT_PREFERENCES.timerSound,
			timerVibrate: DEFAULT_PREFERENCES.timerVibrate,
			callSound: DEFAULT_PREFERENCES.callSound
		}),
	profile: true,
	order: 36
});
