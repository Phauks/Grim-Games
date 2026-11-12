/** SPIKE: the Fabled as ability parts, one file per character. Rule characters: no player has them. */
import angel from './angel.json' with { type: 'json' };
import buddhist from './buddhist.json' with { type: 'json' };
import deusexfiasco from './deusexfiasco.json' with { type: 'json' };
import djinn from './djinn.json' with { type: 'json' };
import doomsayer from './doomsayer.json' with { type: 'json' };
import duchess from './duchess.json' with { type: 'json' };
import ferryman from './ferryman.json' with { type: 'json' };
import fibbin from './fibbin.json' with { type: 'json' };
import fiddler from './fiddler.json' with { type: 'json' };
import hellslibrarian from './hellslibrarian.json' with { type: 'json' };
import revolutionary from './revolutionary.json' with { type: 'json' };
import sentinel from './sentinel.json' with { type: 'json' };
import spiritofivory from './spiritofivory.json' with { type: 'json' };
import toymaker from './toymaker.json' with { type: 'json' };

export const FABLED_PARTS: ReadonlyMap<string, unknown> = new Map<string, unknown>([
	['angel', angel],
	['buddhist', buddhist],
	['deusexfiasco', deusexfiasco],
	['djinn', djinn],
	['doomsayer', doomsayer],
	['duchess', duchess],
	['ferryman', ferryman],
	['fibbin', fibbin],
	['fiddler', fiddler],
	['hellslibrarian', hellslibrarian],
	['revolutionary', revolutionary],
	['sentinel', sentinel],
	['spiritofivory', spiritofivory],
	['toymaker', toymaker]
]);
