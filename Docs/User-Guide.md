# Food Tracker User Guide

## Overview

Food Tracker is a multi-user nutrition tracking app.

- Foods are shared across all users.
- Templates are per-user.
- Log entries are per-user.
- There are no passwords or admin roles.
- The active user is selected from the dropdown in the top bar.

## Main Areas

### Today

The default landing page.

- Shows the selected date
- Shows summary cards for calories, protein, and fiber
- Groups entries by meal:
  - Breakfast
  - Lunch
  - Dinner
  - Snack
- Lets you:
  - add a food entry
  - add entries from a template
  - edit an entry
  - delete an entry

### Log

A filterable table of the current user’s entries.

- Filter by date
- Filter by meal
- Search by food name or template name
- Add food entries
- Add entries from a template
- Edit or delete existing entries

### Templates

Manage reusable meal templates for the current user.

- Create a template
- Rename a template
- Add foods to a template
- Remove foods from a template
- Reorder foods in a template
- Save changes explicitly
- Log the template into the current user’s log

### Foods

Manage the shared food catalog.

- Create foods
- Edit foods
- Delete foods if they are not referenced by templates or log entries

### History

Browse historical daily totals and day details for the current user.

- Filter by date range
- View daily totals
- Select a day to inspect meal details
- Add food or add from template for the selected day
- Edit and delete entries from the selected day

## Top Bar

The top bar is always visible.

- `Current User` dropdown switches the active user
- `Quick Add` opens the Add Food Entry dialog

## Common Workflows

### Add a Food Entry

1. Click `Add Food` or `Quick Add`.
2. Choose the date.
3. Choose the meal.
4. Select a food.
5. Enter the amount.
6. Review the nutrition preview.
7. Click `Save` or `Save and Add Another`.

### Add Entries From a Template

1. Click `Add from Template`.
2. Choose the date and meal.
3. Select a template.
4. Enter a multiplier.
5. Review the preview table and totals.
6. Click `Add Entries`.

### Manage Templates

1. Go to `Templates`.
2. Click `New Template` to start a draft.
3. Add foods and default amounts.
4. Reorder rows if needed.
5. Click `Save`.
6. Use `Log this Template` to create entries from it.

### Manage Foods

1. Go to `Foods`.
2. Click `Add Food`.
3. Enter unit quantity, unit type, and nutrition values per unit.
4. Save the food.

## Nutrition Rules

For each log entry:

- `servingsFactor = actualAmount / food.unitQuantity`
- `calories = servingsFactor * food.caloriesPerUnit`
- `protein = servingsFactor * food.proteinPerUnit`
- `fiber = servingsFactor * food.fiberPerUnit`

Historical log entries preserve their own `nutritionSnapshot`, so past values do not change if a food is edited later.

## Launching the App

## Prerequisites

- Node.js installed
- npm installed
- A MongoDB Atlas connection string

## Environment Setup

Create a `.env` file or export environment variables in your shell.

Required variables:

```bash
MONGODB_URI="mongodb+srv://<username>:<password>@<cluster-host>/?retryWrites=true&w=majority"
MONGODB_DB_NAME="food-tracker"
```

`MONGODB_URI` is required.

## First-Time Setup

```bash
npm install
```

Optional: import the sample JSON data into MongoDB:

```bash
npm run seed:import-json
```

## Run in Development

To launch the app locally:

1. Open a terminal in the project folder.
2. Run:

```bash
npm run dev
```

3. Open Chrome.
4. Go to:

```text
http://localhost:5173/
```

This is the correct frontend URL for local development.

The frontend runs on `http://localhost:5173` and talks to the backend API running on `http://localhost:3001`.

You can also use any browser, not only Chrome, but `http://localhost:5173/` is the right address.

## Development Command

```bash
npm run dev
```

This starts:

- the frontend on `http://localhost:5173`
- the backend API on `http://localhost:3001`

## All npm Scripts

### `npm run dev`

Starts both the frontend and backend in watch mode.

- Runs `dev:server` and `dev:client` together
- Use this for normal local development

### `npm run dev:client`

Starts the Vite frontend dev server only.

- Serves the React app
- Usually available at `http://localhost:5173`

### `npm run dev:server`

Starts the Express backend in watch mode using `tsx`.

- Restarts on backend file changes
- Usually available at `http://localhost:3001`

### `npm run seed:import-json`

Imports sample data from `data/db.json` into MongoDB.

- Uses the configured MongoDB connection
- Helpful for local setup and reseeding development data

### `npm run build`

Builds both frontend and backend.

- Runs `build:client`
- Runs `build:server`

### `npm run build:client`

Builds the Vite frontend for production.

### `npm run build:server`

Compiles the TypeScript backend using the server TypeScript config.

### `npm run typecheck`

Runs TypeScript checks for both the frontend and backend without emitting files.

### `npm test`

Runs the automated test suite.

- Includes server/API tests
- Includes shared nutrition tests

## Notes

- Foods are shared by all users.
- Templates belong to the currently selected user.
- Deleting a food is blocked if it is still referenced.
- Deleting a template does not delete past log entries created from it.
