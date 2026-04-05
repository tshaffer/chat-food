# Food Tracker

Minimal full-stack TypeScript app for tracking shared foods and per-user nutrition logs.

## Stack

- React + TypeScript + Vite
- Express + TypeScript
- JSON-file persistence in `data/db.json`

## Scripts

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run typecheck`

The frontend runs on `http://localhost:5173` and proxies `/api` to the Express server on `http://localhost:3001`.
