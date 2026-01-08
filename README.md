# SnipSolve

**Overlay RAG Tool** - A privacy-focused desktop application that allows you to capture screen regions and extract text using OCR.

## Phase 1: The Walking Skeleton ✅

This is the initial implementation that demonstrates the core screen capture and OCR functionality.

### Features

- **Global Shortcut**: Press `Ctrl+Shift+S` (Windows/Linux) or `Cmd+Shift+S` (Mac) to activate the screen capture overlay
- **Visual Selection**: Click and drag to select any region of your screen
- **OCR Processing**: Automatically extracts text from the captured region using Tesseract.js
- **Results Display**: View all captured text in the main window with timestamps and region information

### Tech Stack

- **Frontend**: Electron + React + Vite + TypeScript + Tailwind CSS
- **OCR**: Tesseract.js (runs locally in the Electron main process)
- **Build Tool**: Vite with Electron plugins

## Getting Started

### Installation

1. Install dependencies:
```bash
npm install
```

### Development

Run the app in development mode:
```bash
npm run dev
```

This will:
- Start the Vite dev server
- Build the Electron main process
- Launch the Electron app with hot-reload enabled

### How to Use

1. Launch the application using `npm run dev`
2. The main window will open showing instructions and an empty results panel
3. Press `Ctrl+Shift+S` (or `Cmd+Shift+S` on Mac) to activate the capture overlay
4. A semi-transparent overlay will appear over your entire screen
5. Click and drag to select the region containing text you want to extract
6. Release the mouse to capture the region
7. The overlay will disappear and OCR processing will begin
8. The extracted text will appear in the main window's results panel

**Tips**:
- Press `ESC` while in overlay mode to cancel without capturing
- The selection box shows the dimensions of your selection in real-time
- Each capture includes timestamp and region coordinates

## Project Structure

```
SnipSolve/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── main.ts          # Main entry point, window management, OCR
│   │   └── preload.ts       # Secure IPC bridge
│   └── renderer/            # React frontend
│       ├── components/
│       │   ├── MainWindow.tsx      # Main app window
│       │   └── OverlayCapture.tsx  # Screen capture overlay
│       ├── App.tsx          # Root component with routing
│       ├── main.tsx         # React entry point
│       ├── index.html       # HTML template
│       ├── index.css        # Tailwind CSS imports
│       └── electron.d.ts    # TypeScript definitions
├── dist-electron/           # Built Electron code
├── dist/                    # Built renderer code
├── vite.config.ts          # Vite configuration
├── tailwind.config.js      # Tailwind CSS configuration
├── tsconfig.json           # TypeScript configuration
└── package.json            # Dependencies and scripts
```

## What's Next?

### Phase 2: The Local Brain (Coming Soon)
- Document ingestion (PDF/TXT upload)
- Local vector storage with embeddings
- Semantic search over uploaded documents

### Phase 3: The Hybrid Solver (Coming Soon)
- OpenAI API integration for intelligent answers
- Context-aware prompts combining OCR + retrieved documents
- Solution card UI with source references

## Architecture Notes

This is a **privacy-focused hybrid architecture**:
- All document processing and storage happens **locally**
- OCR runs entirely on your machine
- In Phase 3, only the minimal context needed for answering will be sent to the cloud (never full documents)

## Troubleshooting

**The overlay doesn't appear when I press the shortcut:**
- Make sure the app has focus
- Try clicking on the main window first, then press the shortcut
- On some systems, you may need to grant screen recording permissions

**OCR is not extracting text correctly:**
- Ensure the selected region contains clear, readable text
- Higher contrast text works better
- Tesseract.js works best with English text (more languages coming in future phases)

**The app won't start:**
- Delete `node_modules` and run `npm install` again
- Make sure you're using a recent version of Node.js (18+)
- Check the console for any error messages

## License

MIT
