# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dynamic Shots is a WhatsApp bulk messaging platform. Users register, get admin-approved, connect WhatsApp instances via Evolution API, and send templated messages to lead lists. The app is in Portuguese (pt-BR) — UI text, error messages, and comments are all in Portuguese.

## Architecture

- **Monorepo** with `backend/` and `frontend/` as independent npm projects (no workspace setup — run commands from each directory separately).
- **Backend**: Express 5 + TypeScript, Prisma ORM, PostgreSQL (Neon serverless), JWT auth. Runs on port 5000 by default.
- **Frontend**: React 19 + TypeScript, Vite, Tailwind CSS v4, React Router v7, Axios. Proxies API calls to `http://localhost:5000`.
- **External dependency**: Evolution API (self-hosted WhatsApp gateway) — instance management and message sending go through it via `EVOLUTION_API_URL` and `EVOLUTION_API_KEY` env vars.

## Common Commands

### Backend (`cd backend`)
```bash
npm run dev          # ts-node-dev with respawn
npm run build        # tsc
npm start            # node dist/server.js
npx prisma migrate dev    # run migrations
npx prisma generate       # regenerate Prisma client
npx prisma studio         # visual DB browser
```

### Frontend (`cd frontend`)
```bash
npm run dev          # vite dev server
npm run build        # tsc -b && vite build
npm run lint         # eslint
npm run preview      # vite preview of production build
```

## Key Design Decisions

- **Admin approval flow**: New users register with `isApproved: false`. An admin must approve them before they can log in. Admin panel is at `/z-admin`.
- **Instance naming**: Instances get a system name (`{userId}-{uuid}`) for Evolution API, plus a user-facing `displayName`.
- **Bulk send is fire-and-forget**: `POST /messages/bulk` returns 202 immediately, then sends messages in background with 30s delay between each. The instance `busy` flag prevents concurrent sends on the same instance.
- **Auth token storage**: Frontend stores JWT and user object in localStorage under `@DynamicShots:token` and `@DynamicShots:user`.
- **Message templating**: Uses `{key}` placeholders in message text, replaced per-lead from CSV column data.

## Data Model (Prisma)

Four models: `User` → `Instance` (1:N), `User` → `Campaign` (1:N), `Campaign` → `Lead` (1:N), `Instance` → `Campaign` (1:N). The `Campaign` and `Lead` models exist in schema but aren't fully wired into controllers yet.

## Backend Environment Variables

`DATABASE_URL`, `DIRECT_URL` (Neon pooled/direct), `JWT_SECRET`, `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `PORT`.
