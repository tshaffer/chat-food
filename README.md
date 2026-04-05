# Food Tracker

Minimal full-stack TypeScript app for tracking shared foods and per-user nutrition logs.

## Stack

- React + TypeScript + Vite
- Express + TypeScript
- MongoDB + Mongoose

## Scripts

- `npm install`
- copy `.env.example` to `.env` if you want to customize local Mongo settings
- `npm run dev`
- `npm run build`
- `npm run typecheck`
- `npm test`
- `npm run seed:import-json`

Default local Mongo settings are:

- `MONGODB_URI=mongodb://127.0.0.1:27017`
- `MONGODB_DB_NAME=food-tracker`

Use `npm run seed:import-json` to import the sample data from `data/db.json` into MongoDB for development.

The frontend runs on `http://localhost:5173` and proxies `/api` to the Express server on `http://localhost:3001`.
