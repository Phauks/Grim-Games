/** SPIKE (animated backgrounds, not for merge): which scene the board shows, set from devtools. */
export const spike = $state<{ scene?: 'hellfire' | 'beach'; engine: string; still: boolean }>({
	engine: 'css',
	still: false
});
if (typeof window !== 'undefined')
	(window as unknown as Record<string, unknown>).__spikeScene = (
		scene?: 'hellfire' | 'beach',
		engine = 'css',
		still = false
	) => Object.assign(spike, { scene, engine, still });
