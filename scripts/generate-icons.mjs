// Generates icon.ico and tray.png from the brand mouse SVG.
// Run with: node scripts/generate-icons.mjs   (or `npm run icons`)
//
// IMPORTANT: writes to BOTH public/ AND dist/. public/ is the source of truth
// (Vite copies it into dist/ on `npm run build`), but dist/ is what the running
// Electron main process actually reads at runtime (`__dirname/../dist/tray.png`).
// In dev mode (`npm run dev`) Vite does NOT copy public→dist, so without this
// dual write the tray + .exe icon would silently keep showing whatever was in
// dist/ from a previous build. That bug used to cause every icon change to
// "not stick" until a full `npm run build`.
//
// The .ico contains multiple sizes (16, 24, 32, 48, 64, 128, 256) so Windows
// can pick the right one for: tray, taskbar, alt-tab, file explorer thumbs,
// installer splash, etc.

import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = path.join(__dirname, '..', 'public')
const DIST_DIR   = path.join(__dirname, '..', 'dist')

// White-on-transparent mouse silhouette (coolicons). White is the most
// universally visible choice for Windows taskbar/tray which are dark by
// default; on light taskbars it'll appear as a soft outline against the
// system accent. Stroke is slightly thicker (2.4) than the in-app SVG so
// the body stays readable at 16-32px sizes.
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 10V7M18 9V15C18 18.3137 15.3137 21 12 21C8.68629 21 6 18.3137 6 15V9C6 5.68629 8.68629 3 12 3C15.3137 3 18 5.68629 18 9Z"/>
</svg>`

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
const TRAY_SIZE = 32

async function rasterize(size) {
  return sharp(Buffer.from(SVG))
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
}

function writeBoth(filename, buffer, label) {
  for (const dir of [PUBLIC_DIR, DIST_DIR]) {
    fs.mkdirSync(dir, { recursive: true })
    const p = path.join(dir, filename)
    fs.writeFileSync(p, buffer)
    console.log(`✔ wrote ${p} (${buffer.length} bytes, ${label})`)
  }
}

async function main() {
  // Build .ico from multiple sizes — Windows picks whichever fits the context
  const pngBuffers = []
  for (const size of ICO_SIZES) {
    pngBuffers.push(await rasterize(size))
    console.log(`  generated ${size}×${size} png`)
  }
  const icoBuffer = await pngToIco(pngBuffers)
  writeBoth('icon.ico', icoBuffer, `${ICO_SIZES.length} sizes`)

  // Tray PNG — single 32×32 (Electron resizes to 16×16 for the tray itself,
  // but having 32 lets HiDPI displays use the higher resolution)
  const trayBuffer = await rasterize(TRAY_SIZE)
  writeBoth('tray.png', trayBuffer, `${TRAY_SIZE}×${TRAY_SIZE}`)

  console.log('\nDone. Both public/ and dist/ updated — restart `npm run dev` (or')
  console.log('relaunch the installed app) for the tray + window icon to refresh.')
  console.log('Note: Windows caches taskbar/.exe icons aggressively. If the OLD')
  console.log('icon lingers in Explorer/taskbar after a full reinstall, run:')
  console.log('  ie4uinit.exe -show       (refresh icon cache)')
}

main().catch(e => { console.error(e); process.exit(1) })
