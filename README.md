# 🍌 BananaVision AI

> A no-code visual workbench for Google Gemini's image generation models—giving creators direct access to every lever, slider, reference steering bucket, and resolution dial without writing code.

[![React](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-purple.svg)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-cyan.svg)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

BananaVision AI is a full-featured creative suite for generating, steering, analyzing, and remixing AI imagery. Designed for precision control and high-fidelity texture creation, it combines layered reference photo steering with a 100% pixel-perfect inspection tool.

---

## ✨ Features

- **🔍 100% Full-Resolution Pan & Zoom Inspector**:
  - Full viewport canvas without clipping or letterboxing.
  - Smooth pan-and-drag and mouse wheel zoom (up to 500%).
  - 1:1 pixel native scale inspection mode.
  - Expandable Prompt Drawer with tabs for Clean Prompt, Negative Constraints, and Full Model Input.
  - 1-click high-res image and prompt copying directly to system clipboard.
  - Descriptive, platform-safe image download filenames (`PromptName_timestamp_ID.png`).

- **📥 Multi-Bucket Reference Steering (Up to 6 Images)**:
  - **Style Bucket**: Extracts aesthetic, texture weave, brushwork, lighting, and palette without copying subject matter.
  - **Character Bucket**: Locks face identity, facial features, and character structure.
  - **Layout Bucket**: Preserves composition, spatial depth, camera angle, and framing.
  - **Custom Direction**: Per-image freeform steering prompt for surgical guidance.
  - **4-Tier Influence Strength Slider**: Subtle (25%), Balanced (50% Default), Strong (75%), and Exact (100%).
  - Quick "Send to Bucket" shortcuts directly from any generated image in the gallery.

- **📐 Advanced Framing & Resolution**:
  - Standard aspect ratios: 1:1, 4:3, 3:4, 16:9, 9:16.
  - Dynamic Custom Dimensions with custom Width & Height inputs (up to 4096px+).
  - Scaled resolution options (1K, 2K, 4K) for Pro & Flash models.

- **🤖 Model Comparison & Flexibility**:
  - **Banana Flash** (`gemini-3.1-flash-lite-image`): Instant, watermark-free generation.
  - **Banana Flash 2** (`gemini-3.1-flash-image`): Enhanced quality and multi-reference coherence.
  - **Banana Pro** (`gemini-3-pro-image`): High-fidelity production renders.
  - **All Models (3x Output)**: Generate across all models simultaneously to compare results side-by-side.

- **💾 Persistent Offline Gallery**:
  - Full client-side IndexedDB caching: liked and saved generations persist safely across browser refreshes and sessions.

- **🛡️ Secure Backend Proxy Architecture**:
  - Zero client-side API key exposure.
  - Express server proxies requests to the Gemini API securely.

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ or 20+
- A Google Gemini API key from [Google AI Studio](https://aistudio.google.com/)

### 1. Clone the Repository

```bash
git clone https://github.com/starpause/bananavision.git
cd bananavision
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Open `.env` and add your Gemini API key:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

*(Note: `.env` is listed in `.gitignore` and is never committed to GitHub).*

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Build Tool**: Vite
- **Backend / API Proxy**: Express with `@google/genai` TypeScript SDK
- **Storage**: Browser IndexedDB for persistence
- **Icons**: SVG & Unicode emoji micro-icons

---

## 🔒 Security & Privacy

- API keys are handled strictly server-side through the backend proxy (`server.ts`).
- `.env` and environment variables are strictly ignored in `.gitignore`.
- Reference photos and creations are processed via base64 in-memory streams and local browser IndexedDB storage without telemetry or third-party tracking.

---

## 📄 License

MIT © [starpause](https://github.com/starpause)
