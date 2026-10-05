# Repository Guidelines

## Project Structure & Module Organization

This is a Vite + React + TypeScript application for splitting a monthly electricity bill across any number of meters. Keep the root limited to configuration and high-level documentation.

- `src/domain/` contains pure calculation rules and their unit tests.
- `src/data/` contains API adapters for billed-period records; `server.mjs` owns JSON persistence and edit-window enforcement.
- `src/components/` contains focused UI components.
- `src/App.tsx` composes the user interface; `src/styles.css` holds global styles.

Avoid committing generated output, local caches, dependency directories, or secrets.

## Build, Test, and Development Commands

Run `npm install` once to install dependencies. Use `npm run dev` to start the local Node/Vite server, `npm run build` to type-check and produce `dist/`, `npm start` to serve the production build, `npm run lint` to run ESLint, and `npm test` for the non-interactive Vitest suite.

Run the relevant formatter, linter, and tests before opening a pull request.

## Coding Style & Naming Conventions

Follow TypeScript strict mode and ESLint; do not hand-format around their output. Use 2 spaces and no semicolons. Prefer `calculateBill` for functions, `MeterRow` for React components, and camelCase for variables. Keep financial calculations in `src/domain/`, never in UI components.

Keep modules focused, avoid duplicated calculation logic, and add comments only where intent is not obvious from the code.

## Testing Guidelines

Add a colocated `*.test.ts` file for each domain behavior. Cover normal inputs, boundary cases, invalid input, negative consumption, rounding, and reconciliation between meter consumption and the billed kWh. Run `npm test` before submitting changes.

## Commit & Pull Request Guidelines

Use short, imperative subjects such as `Add meter validation` or `Fix monthly total rounding`. Keep commits scoped to one logical change.

Pull requests should explain the change and its motivation, list validation performed, link any related issue, and include screenshots when UI behavior changes. Flag configuration changes and any assumptions that affect calculations.

## Security & Configuration

Do not commit credentials, tokens, personal data, or environment-specific configuration. Billing records are written by the local Node API to `data/billing-records.json`, which is ignored by Git. Set `RECORD_EDIT_WINDOW_DAYS=14` in `.env` (based on `.env.example`) to control the server-enforced editing window. Do not introduce a remote data store without authentication and explicit security requirements.
