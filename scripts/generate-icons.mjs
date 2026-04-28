// Generates public/icon.ico and public/tray.png from the hexagonal brand SVG.
// Run with: node scripts/generate-icons.mjs
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

// White-on-transparent hexagon. White is the most universally visible choice for
// Windows taskbar/tray which are dark by default; on light taskbars it'll appear
// as a soft outline against the system accent. The stroke is slightly thicker
// than the in-app SVG (2.2 vs 1.6) so it stays crisp at 16-32px sizes.
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <polygon points="12,2 19.5,6.5 19.5,17.5 12,22 4.5,17.5 4.5,6.5"/>
  <path d="M12 7v3.5" stroke-width="2.6"/>
</svg>`

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
const TRAY_SIZE = 32

async function rasterize(size) {
  return sharp(Buffer.from(SVG))
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
}

async function main() {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true })

  // Build .ico from multiple sizes — Windows picks whichever fits the context
  const pngBuffers = []
  for (const size of ICO_SIZES) {
    pngBuffers.push(await rasterize(size))
    console.log(`  generated ${size}×${size} png`)
  }
  const icoBuffer = await pngToIco(pngBuffers)
  const icoPath = path.join(PUBLIC_DIR, 'icon.ico')
  fs.writeFileSync(icoPath, icoBuffer)
  console.log(`✔ wrote ${icoPath} (${icoBuffer.length} bytes, ${ICO_SIZES.length} sizes)`)

  // Tray PNG — single 32×32 (Electron resizes to 16×16 for the tray itself,
  // but having 32 lets HiDPI displays use the higher resolution)
  const trayBuffer = await rasterize(TRAY_SIZE)
  const trayPath = path.join(PUBLIC_DIR, 'tray.png')
  fs.writeFileSync(trayPath, trayBuffer)
  console.log(`✔ wrote ${trayPath} (${trayBuffer.length} bytes, ${TRAY_SIZE}×${TRAY_SIZE})`)

  console.log('\nDone. Next `npm run dist` will use these for the .exe icon, taskbar, tray, and installer.')
}

main().catch(e => { console.error(e); process.exit(1) })
