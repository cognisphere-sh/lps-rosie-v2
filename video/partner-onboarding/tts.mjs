// Narration: one WAV per beat from narration.json, plus vo.json with durations.
import { KokoroTTS } from 'kokoro-js'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
const VOICE = process.env.VOICE ?? 'af_heart'
const chapters = JSON.parse(readFileSync('narration.json', 'utf8'))
const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'fp32', device: 'cpu' })
const out = {}
for (const c of chapters) for (const b of c.beats) {
  const file = `public/vo/${b.id}.wav`
  if (!existsSync(file) || process.env.FORCE) await (await tts.generate(b.spoken ?? b.text, { voice: VOICE, speed: 0.98 })).save(file)
  out[b.id] = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString())
}
writeFileSync('vo.json', JSON.stringify(out, null, 1))
console.log(Object.values(out).reduce((a, b) => a + b, 0).toFixed(1), 's total')
