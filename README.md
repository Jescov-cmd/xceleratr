# Xceleratr

A mouse acceleration and sensitivity utility for Windows and macOS with a custom curve editor, profile system, and live graph preview.

## Requirements

- Windows 10/11 or macOS 11+
- [Node.js 20+](https://nodejs.org) (for building from source)

> **No Administrator access required** on Windows — all settings write to HKCU (your user profile only).

## Download

Grab the latest installer from the [Releases](../../releases) page.

- **Windows**: `Xceleratr Setup x.x.x.exe`
- **macOS**: `Xceleratr-x.x.x.dmg`

## Build from source

```bash
npm install
npm run dev       # development
npm run dist      # build installer
```

Output: `release/Xceleratr Setup x.x.x.exe` (Windows) or `release/Xceleratr-x.x.x.dmg` (macOS)

## Features

- **Sensitivity** — 1–20 slider mapped to your OS pointer speed, with per-axis V/H ratio
- **Acceleration curves** — 8 built-in curve types (Linear, Natural, Power, Sigmoid, Bounce, Classic, Jump, Default) plus a fully custom drag-point editor
- **Live graph preview** — real-time curve visualization with V/H ratio overlay
- **Profiles** — 6 save slots with right-click context menu; share profiles via encoded share codes (`XC1:…`)
- **Polling rate calibration** — 125 Hz to 8000 Hz selector for accurate curve timing
- **Enhance Pointer Precision toggle** — Windows EPP on/off (Windows only)
- **Themes** — Light, Dark, High Contrast
- **Start on boot** — auto-launches at login (Windows Run key / macOS LaunchAgent)
- **System tray / menu bar** — minimizes to tray, quit via tray menu

## Platform notes

| Feature | Windows | macOS |
|---|---|---|
| Sensitivity slider | ✓ | ✓ |
| Acceleration curves | ✓ (low-level hook) | — (system preference only) |
| V/H Ratio | ✓ | — |
| Polling rate | ✓ | — |
| EPP toggle | ✓ | — |
| Start on boot | ✓ | ✓ |

macOS sensitivity sets `com.apple.mouse.scaling` — sensitivity 10 matches the macOS System Settings default.
