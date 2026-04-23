# Xceleratr

A Windows mouse acceleration and sensitivity utility with a custom curve editor, profile system, and live graph preview.

## Requirements

- Windows 11
- [Node.js 20+](https://nodejs.org)

## Setup

```bash
npm install
npm run dev
```

## Build installer

```bash
npm run dist
```

Output: `release/Xceleratr Setup 1.0.0.exe`

> **Note:** Run as Administrator to apply mouse settings system-wide.

## Features

- **Sensitivity** — 1–20 slider mapped to Windows pointer speed, with per-axis V/H ratio
- **Acceleration curves** — 8 built-in curve types (Linear, Natural, Power, Sigmoid, Bounce, Classic, Jump, Default) plus a fully custom drag-point editor
- **Live graph preview** — real-time curve visualization with V/H ratio overlay
- **Profiles** — 6 save slots with right-click context menu; share profiles via encoded share codes (`XC1:…`)
- **Polling rate calibration** — 125 Hz to 8000 Hz selector for accurate curve timing
- **Enhance Pointer Precision toggle** — Windows EPP on/off
- **Themes** — Light, Dark, High Contrast
- **Start on boot** — registry Run key integration
- **System tray** — minimizes to tray, quit via tray menu
- Settings persist across restarts
