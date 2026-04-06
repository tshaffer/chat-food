# Food Tracker Architecture and Design

## Purpose

Food Tracker is a full-stack TypeScript application for tracking foods, templates, and daily nutrition logs across multiple users.

The design goal is straightforward maintainability:

- React frontend
- Express backend
- MongoDB persistence through Mongoose
- shared TypeScript domain types
- simple page-level state instead of heavy client-side infrastructure

## High-Level Architecture

The application is split into three main layers.

### Frontend

Location:

- `src/`

Responsibilities:

- routing
- page rendering
- dialog/form interaction
- calling the backend API
- enriching log entries with food details for display

Key files:

- [`src/App.tsx`](/Users/tedshaffer/Documents/Projects/chatFood/src/App.tsx)
- [`src/components/AppShell.tsx`](/Users/tedshaffer/Documents/Projects/chatFood/src/components/AppShell.tsx)
- [`src/lib/api.ts`](/Users/tedshaffer/Documents/Projects/chatFood/src/lib/api.ts)
- [`src/lib/logEntries.ts`](/Users/tedshaffer/Documents/Projects/chatFood/src/lib/logEntries.ts)

### Shared Domain Layer

Location:

- `shared/`

Responsibilities:

- shared entity types
- shared nutrition calculations

Key files:

- [`shared/types.ts`](/Users/tedshaffer/Documents/Projects/chatFood/shared/types.ts)
- [`shared/nutrition.ts`](/Users/tedshaffer/Documents/Projects/chatFood/shared/nutrition.ts)

This keeps the frontend and backend aligned on the same core model.

### Backend

Location:

- `server/`

Responsibilities:

- HTTP API
- validation
- persistence
- seeding/import support

Key files:

- [`server/index.ts`](/Users/tedshaffer/Documents/Projects/chatFood/server/index.ts)
- [`server/store.ts`](/Users/tedshaffer/Documents/Projects/chatFood/server/store.ts)
- [`server/models.ts`](/Users/tedshaffer/Documents/Projects/chatFood/server/models.ts)
- [`server/import-json.ts`](/Users/tedshaffer/Documents/Projects/chatFood/server/import-json.ts)

## Frontend Design

## Routing

The app uses React Router with stable top-level routes:

- `/today`
- `/log`
- `/templates`
- `/foods`
- `/history`

The root route redirects to `/today`.

## App Shell

The shell provides:

- top bar
- current user selector
- quick add entry point
- left navigation sidebar

This structure keeps navigation stable while pages own their own data fetching and local UI state.

## Data Loading Pattern

The frontend uses a lightweight fetch pattern:

- page mounts or dependency changes
- page calls the API client in `src/lib/api.ts`
- page stores results in local component state
- derived UI data is computed with helpers and `useMemo`

There is no Redux or global normalized store. That keeps the app simple for the current scope.

## Dialog Pattern

Dialogs are implemented as reusable components with page-owned open/close state.

Examples:

- `LogEntryFormDialog`
- `AddFromTemplateDialog`
- `FoodFormDialog`
- confirmation dialogs

This keeps form logic close to the pages that need refresh behavior.

## Nutrition Calculation Design

Nutrition math lives in shared helpers, not scattered across UI components.

Core rule:

- serving factor is based on `actualAmount / unitQuantity`

The frontend enriches log entries for presentation in [`src/lib/logEntries.ts`](/Users/tedshaffer/Documents/Projects/chatFood/src/lib/logEntries.ts).

Historical entries prefer `nutritionSnapshot` over recomputation.

## Backend Design

## API Layer

[`server/index.ts`](/Users/tedshaffer/Documents/Projects/chatFood/server/index.ts) owns:

- Express app creation
- route definitions
- request validation
- response shaping
- error handling

The backend intentionally preserves stable route contracts for the React client.

## Persistence Layer

[`server/store.ts`](/Users/tedshaffer/Documents/Projects/chatFood/server/store.ts) is the persistence abstraction.

Normal runtime now uses collection-level Mongoose operations instead of loading and rewriting the full database for each request.

Examples of repository responsibilities:

- list users
- find a food by id
- count food references
- insert or update templates with template items
- list log entries by user and date filters
- insert entries created from templates

The store still exposes compatibility helpers for JSON import/testing, but runtime routes use targeted Mongoose operations.

## Mongoose Models

[`server/models.ts`](/Users/tedshaffer/Documents/Projects/chatFood/server/models.ts) defines separate collections for:

- `users`
- `foods`
- `templates`
- `templateItems`
- `logEntries`

Design choices:

- application-level string `id` fields are preserved
- Mongoose timestamps are used where appropriate
- indexes are added for commonly queried fields
- templates and template items stay separate to match the existing app model and API behavior

## Domain Model

### User

- unique username
- no password
- no admin role

### Food

Shared across all users.

Contains:

- display name
- unit definition
- nutrition per unit

### Template

Owned by a specific user.

Contains:

- name
- ordered template items

### TemplateItem

Separate collection for ordered rows within a template.

Contains:

- template reference by app-level id
- line number
- food id
- default amount

### LogEntry

Owned by a specific user.

Contains:

- date
- meal
- food reference
- actual amount
- optional template linkage
- `templateNameSnapshot`
- `nutritionSnapshot`

## Historical Nutrition Behavior

Historical nutrition is snapshotted at log-entry creation and update time.

Why:

- nutrition tracking apps need stable historical records
- editing a shared food later should not rewrite past intake totals
- template-created entries also keep historical nutrition values

The authoritative historical fields are:

- `nutritionSnapshot`
- `templateNameSnapshot`

## Validation and Behavior Guarantees

The backend enforces:

- unique usernames
- unique food names
- valid `YYYY-MM-DD` dates
- valid meal values
- positive amounts for log entries and template items
- existing food references for templates and log entries
- template ownership checks for from-template insertion

Delete protections:

- foods cannot be deleted if referenced by template items or log entries
- deleting a template does not delete historical log entries

## Seeding and Import

Sample data can be imported from JSON for development through:

- [`server/import-json.ts`](/Users/tedshaffer/Documents/Projects/chatFood/server/import-json.ts)

This keeps a convenient bootstrap path without making JSON the live persistence layer.

## Configuration

The backend uses environment variables for MongoDB connection setup.

Expected variables:

- `MONGODB_URI`
- `MONGODB_DB_NAME`

The intended deployment target is MongoDB Atlas, and Mongoose connects using those values at startup.

## Testing Strategy

Tests cover:

- shared nutrition calculations
- template logging behavior
- food delete protection
- template save/update normalization

Server tests use isolated Mongo-backed test setup rather than the application’s development database.

## Design Tradeoffs

Current tradeoffs are intentional:

- simple page-local state over a larger frontend state system
- explicit save behavior for template editing instead of autosave
- separate template item collection for stable ordering and clear ownership
- compatibility import helpers retained for development seeding

This keeps the app practical today while leaving room for later improvements such as richer repository methods, deployment hardening, or expanded analytics/reporting.
