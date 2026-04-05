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

MongoDB Atlas configuration:

- `MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-host>/?retryWrites=true&w=majority`
- `MONGODB_DB_NAME=food-tracker`

`MONGODB_URI` is required. The backend uses Mongoose to connect directly to MongoDB Atlas.

Use `npm run seed:import-json` to import the sample data from `data/db.json` into your configured Atlas database.

The frontend runs on `http://localhost:5173` and proxies `/api` to the Express server on `http://localhost:3001`.
