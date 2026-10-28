/** SPIKE: Carousel characters as ability parts, one file per character. TEMPORARY index: Townsfolk batch 2 only. */
import alchemist from './alchemist.json' with { type: 'json' };
import alsaahir from './alsaahir.json' with { type: 'json' };
import amnesiac from './amnesiac.json' with { type: 'json' };
import atheist from './atheist.json' with { type: 'json' };
import banshee from './banshee.json' with { type: 'json' };
import cannibal from './cannibal.json' with { type: 'json' };
import choirboy from './choirboy.json' with { type: 'json' };
import engineer from './engineer.json' with { type: 'json' };
import farmer from './farmer.json' with { type: 'json' };
import fisherman from './fisherman.json' with { type: 'json' };
import huntsman from './huntsman.json' with { type: 'json' };
import magician from './magician.json' with { type: 'json' };
import nightwatchman from './nightwatchman.json' with { type: 'json' };
import poppygrower from './poppygrower.json' with { type: 'json' };
import princess from './princess.json' with { type: 'json' };

export const CAROUSEL_PARTS: ReadonlyMap<string, unknown> = new Map<string, unknown>([
	['alchemist', alchemist],
	['alsaahir', alsaahir],
	['amnesiac', amnesiac],
	['atheist', atheist],
	['banshee', banshee],
	['cannibal', cannibal],
	['choirboy', choirboy],
	['engineer', engineer],
	['farmer', farmer],
	['fisherman', fisherman],
	['huntsman', huntsman],
	['magician', magician],
	['nightwatchman', nightwatchman],
	['poppygrower', poppygrower],
	['princess', princess]
]);
