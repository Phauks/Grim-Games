/**
 * Bloodstar Clocktica's published scripts, fetched only while Search shows that source, and
 * kept on the device (cached-list.svelte.ts).
 */
import { CachedList } from './cached-list.svelte.ts';
import { BLOODSTAR_API, readBloodstarList, type BloodstarScript } from './bloodstar-api.ts';

export const bloodstarScripts = new CachedList<BloodstarScript>({
	key: 'grim-games.bloodstar-scripts',
	url: BLOODSTAR_API,
	read: readBloodstarList,
	name: 'Bloodstar scripts',
	emptyIsBroken: true
});
