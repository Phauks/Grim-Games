/** SPIKE: Carousel as ability parts, one file per character. */
import acrobat from './acrobat.json' with { type: 'json' };
import alchemist from './alchemist.json' with { type: 'json' };
import alhadikhia from './alhadikhia.json' with { type: 'json' };
import alsaahir from './alsaahir.json' with { type: 'json' };
import amnesiac from './amnesiac.json' with { type: 'json' };
import atheist from './atheist.json' with { type: 'json' };
import balloonist from './balloonist.json' with { type: 'json' };
import banshee from './banshee.json' with { type: 'json' };
import boffin from './boffin.json' with { type: 'json' };
import boomdandy from './boomdandy.json' with { type: 'json' };
import bountyhunter from './bountyhunter.json' with { type: 'json' };
import cacklejack from './cacklejack.json' with { type: 'json' };
import cannibal from './cannibal.json' with { type: 'json' };
import choirboy from './choirboy.json' with { type: 'json' };
import cultleader from './cultleader.json' with { type: 'json' };
import damsel from './damsel.json' with { type: 'json' };
import engineer from './engineer.json' with { type: 'json' };
import farmer from './farmer.json' with { type: 'json' };
import fearmonger from './fearmonger.json' with { type: 'json' };
import fisherman from './fisherman.json' with { type: 'json' };
import gangster from './gangster.json' with { type: 'json' };
import general from './general.json' with { type: 'json' };
import gnome from './gnome.json' with { type: 'json' };
import goblin from './goblin.json' with { type: 'json' };
import golem from './golem.json' with { type: 'json' };
import harpy from './harpy.json' with { type: 'json' };
import hatter from './hatter.json' with { type: 'json' };
import heretic from './heretic.json' with { type: 'json' };
import hermit from './hermit.json' with { type: 'json' };
import highpriestess from './highpriestess.json' with { type: 'json' };
import huntsman from './huntsman.json' with { type: 'json' };
import kazali from './kazali.json' with { type: 'json' };
import king from './king.json' with { type: 'json' };
import knight from './knight.json' with { type: 'json' };
import legion from './legion.json' with { type: 'json' };
import leviathan from './leviathan.json' with { type: 'json' };
import lilmonsta from './lilmonsta.json' with { type: 'json' };
import lleech from './lleech.json' with { type: 'json' };
import lordoftyphon from './lordoftyphon.json' with { type: 'json' };
import lycanthrope from './lycanthrope.json' with { type: 'json' };
import magician from './magician.json' with { type: 'json' };
import marionette from './marionette.json' with { type: 'json' };
import mezepheles from './mezepheles.json' with { type: 'json' };
import nightwatchman from './nightwatchman.json' with { type: 'json' };
import noble from './noble.json' with { type: 'json' };
import ogre from './ogre.json' with { type: 'json' };
import ojo from './ojo.json' with { type: 'json' };
import organgrinder from './organgrinder.json' with { type: 'json' };
import pixie from './pixie.json' with { type: 'json' };
import plaguedoctor from './plaguedoctor.json' with { type: 'json' };
import politician from './politician.json' with { type: 'json' };
import poppygrower from './poppygrower.json' with { type: 'json' };
import preacher from './preacher.json' with { type: 'json' };
import princess from './princess.json' with { type: 'json' };
import psychopath from './psychopath.json' with { type: 'json' };
import puzzlemaster from './puzzlemaster.json' with { type: 'json' };
import riot from './riot.json' with { type: 'json' };
import shugenja from './shugenja.json' with { type: 'json' };
import snitch from './snitch.json' with { type: 'json' };
import steward from './steward.json' with { type: 'json' };
import summoner from './summoner.json' with { type: 'json' };
import villageidiot from './villageidiot.json' with { type: 'json' };
import vizier from './vizier.json' with { type: 'json' };
import widow from './widow.json' with { type: 'json' };
import wizard from './wizard.json' with { type: 'json' };
import wraith from './wraith.json' with { type: 'json' };
import xaan from './xaan.json' with { type: 'json' };
import yaggababble from './yaggababble.json' with { type: 'json' };
import zealot from './zealot.json' with { type: 'json' };

export const CAROUSEL_PARTS: ReadonlyMap<string, unknown> = new Map<string, unknown>([
	['acrobat', acrobat],
	['alchemist', alchemist],
	['alhadikhia', alhadikhia],
	['alsaahir', alsaahir],
	['amnesiac', amnesiac],
	['atheist', atheist],
	['balloonist', balloonist],
	['banshee', banshee],
	['boffin', boffin],
	['boomdandy', boomdandy],
	['bountyhunter', bountyhunter],
	['cacklejack', cacklejack],
	['cannibal', cannibal],
	['choirboy', choirboy],
	['cultleader', cultleader],
	['damsel', damsel],
	['engineer', engineer],
	['farmer', farmer],
	['fearmonger', fearmonger],
	['fisherman', fisherman],
	['gangster', gangster],
	['general', general],
	['gnome', gnome],
	['goblin', goblin],
	['golem', golem],
	['harpy', harpy],
	['hatter', hatter],
	['heretic', heretic],
	['hermit', hermit],
	['highpriestess', highpriestess],
	['huntsman', huntsman],
	['kazali', kazali],
	['king', king],
	['knight', knight],
	['legion', legion],
	['leviathan', leviathan],
	['lilmonsta', lilmonsta],
	['lleech', lleech],
	['lordoftyphon', lordoftyphon],
	['lycanthrope', lycanthrope],
	['magician', magician],
	['marionette', marionette],
	['mezepheles', mezepheles],
	['nightwatchman', nightwatchman],
	['noble', noble],
	['ogre', ogre],
	['ojo', ojo],
	['organgrinder', organgrinder],
	['pixie', pixie],
	['plaguedoctor', plaguedoctor],
	['politician', politician],
	['poppygrower', poppygrower],
	['preacher', preacher],
	['princess', princess],
	['psychopath', psychopath],
	['puzzlemaster', puzzlemaster],
	['riot', riot],
	['shugenja', shugenja],
	['snitch', snitch],
	['steward', steward],
	['summoner', summoner],
	['villageidiot', villageidiot],
	['vizier', vizier],
	['widow', widow],
	['wizard', wizard],
	['wraith', wraith],
	['xaan', xaan],
	['yaggababble', yaggababble],
	['zealot', zealot]
]);
