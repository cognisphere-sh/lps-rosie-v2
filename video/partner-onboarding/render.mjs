// node render.mjs [ch3 ...] [--frames=30,175]
//   Renders each chapter to out/chN.mp4, a poster out/chN.jpg and subtitles out/chN.vtt, and updates
//   out/chapters.json (read by the onboarding page). Default: every chapter in narration.json.
//   --frames: render only those stills to out/stills/chN-<frame>.png (for checking layout).
import {bundle} from '@remotion/bundler';
import {renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import {existsSync, lstatSync, mkdirSync, readFileSync, symlinkSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const frames = args.find((a) => a.startsWith('--frames='))?.slice(9).split(',').map(Number);
const ids = args.filter((a) => !a.startsWith('--'));

// Footage is served from public/ through a symlink (the bundler forwards it).
const link = join(root, 'public/footage');
if (!existsSync(link) && !lstatSync(link, {throwIfNoEntry: false})) symlinkSync('../footage', link);

// Keep in sync with remotion.config.ts (the Node APIs don't read it).
const opts = {chromeMode: 'chrome-for-testing', port: 3399};
const out = join(root, 'out');
mkdirSync(join(out, 'stills'), {recursive: true});

const narration = JSON.parse(readFileSync(join(root, 'narration.json'), 'utf8'));
const targets = ids.length ? ids : narration.map((c) => `ch${c.n}`);
const vo = JSON.parse(readFileSync(join(root, 'vo.json'), 'utf8'));
const text = Object.fromEntries(narration.flatMap((c) => c.beats.map((b) => [b.id, b.text])));
const ts = (s) => new Date(Math.round(s * 1000)).toISOString().slice(11, 23);
// One cue per narration beat: from when its voice-over starts to start + its duration.
const vtt = (data, fps) =>
	'WEBVTT\n\n' + data.vo.map((v) => `${v.id}\n${ts(v.f / fps)} --> ${ts(v.f / fps + vo[v.id])}\n${text[v.id]}\n`).join('\n');

const indexFile = join(out, 'chapters.json');
const index = existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, 'utf8')) : [];

const serveUrl = await bundle({entryPoint: join(root, 'src/index.ts')});
for (const id of targets) {
	// Footage folders may be rewritten while a render runs (a re-record in progress): retry once.
	for (let attempt = 1; ; attempt++) {
		try {
			await renderOne(id);
			break;
		} catch (e) {
			if (attempt >= 2) throw e;
			console.warn(`\n${id} failed (${e.message.split('\n')[0]}); retrying in 30 s`);
			await new Promise((r) => setTimeout(r, 30000));
		}
	}
}

async function renderOne(id) {
	const composition = await selectComposition({serveUrl, id, ...opts});
	if (frames) {
		for (const frame of frames) {
			const output = join(out, 'stills', `${id}-${frame}.png`);
			await renderStill({serveUrl, composition, frame, output, ...opts});
			console.log(output);
		}
		return;
	}
	const mp4 = join(out, `${id}.mp4`);
	await renderMedia({
		serveUrl, composition, ...opts,
		codec: 'h264', crf: 18, audioCodec: 'aac', audioBitrate: '192k',
		imageFormat: 'jpeg', jpegQuality: 92,
		outputLocation: mp4,
		onProgress: ({progress}) => process.stdout.write(`\r${id} ${Math.round(progress * 100)}%`),
	});
	const jpg = join(out, `${id}.jpg`);
	await renderStill({serveUrl, composition, frame: Math.floor(composition.durationInFrames * 0.4), output: jpg, imageFormat: 'jpeg', jpegQuality: 90, ...opts});
	const duration_s = +(composition.durationInFrames / composition.fps).toFixed(2);
	if (composition.props.data) {
		const {n, title} = composition.props.data;
		writeFileSync(join(out, `${id}.vtt`), vtt(composition.props.data, composition.fps));
		const entry = {n, title, duration_s, file: `${id}.mp4`, poster: `${id}.jpg`, vtt: `${id}.vtt`};
		index.splice(0, index.length, ...index.filter((x) => x.n !== n), entry);
		index.sort((a, b) => a.n - b.n);
		writeFileSync(indexFile, JSON.stringify(index, null, 2) + '\n');
	}
	console.log(`\r${mp4}  ${duration_s} s\n${jpg}`);
}
