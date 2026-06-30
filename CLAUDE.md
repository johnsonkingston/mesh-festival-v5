# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev   # start with nodemon (auto-restarts on changes)
npm start     # start without auto-restart
```

Server runs on port 8080. There are no tests and no lint script.

CSS is compiled from SCSS source files in `static/styles/` using an external SCSS compiler (not wired into npm scripts). Edit the `.scss` files; `main.min.css` is what gets served.

## Architecture

Single-file Express backend (`app.js`) that acts as a thin rendering layer: every page request fires multiple async fetches to a Directus CMS REST API and passes the results into Pug templates.

**CMS backend:** `https://env-9468449.appengine.flow.ch` (Directus). No local database. All content (events, pages, navigation, footer, highlights, venues) is fetched on each request — there is no caching layer.

**Image CDN:** `https://env-9468449.appengine.flow.ch/assets/` — referenced in templates as `imgURL`. Directus image transform keys like `?key=icon` and `?key=fullscreen` control resize.

**Routes:**
- `/:language?` → startpage
- `/timetable/:language?/:format?` → full timetable
- `/list/:language?/:format?` → event list view
- `/artists/:language?/` → alphabetical artist list
- `/pages/:pageSlug/:language?` → generic CMS pages
- `/events/:eventSlug/:language?` → single event detail
- All unmatched routes redirect to `/`

## Language System

Two languages: `de` (default) and `en`. The URL suffix `/de` or `/en` selects the language.

`languageObject = [languageCode, languageIndex]` where index is `0` for DE, `1` for EN.

In templates, `languageParameter` (0 or 1) is used to index into `translations[]` arrays returned by the CMS. The server normalises translation order so `translations[0]` is always DE and `translations[1]` is always EN before passing to templates.

The entire server-side data object is also serialised into the HTML as JavaScript globals (in `views/includes/head.pug`) so client-side scripts can access the same data without additional API calls.

## Template Variables

Every Pug template receives: `data`, `navigation`, `footer`, `language`, `highlights`, `events`, `venues`, `format`.

`baseURL` is defined in `views/includes/vars/vars.pug` — toggle between localhost and production URLs by commenting/uncommenting lines in that file. Must be `http://localhost:8080/` for local development.

## Event Data

Events from the CMS have a `Time` array (an event can appear at multiple times). `app.js` expands multi-time events into duplicate entries in the `events` array before passing to templates. Events are sorted by `DateToOrder` (the raw ISO start time string).

Event `Format` field values: `ausstellungen`, `performances`, `screenings`, `konferenz`, `workshops`, `clubnights`, `diskurs`. These are translated to display strings inside the `/events/:eventSlug` route handler.

## Fonts & Styles

Custom fonts `JK-MESH-Sans` and `JK-MESH-Serif` (OTF/WOFF/WOFF2) live in `static/fonts/`. CSS variables for the two brand colours are defined in `main.scss` as `--color1` (yellow-green) and `--color2` (purple).

## Socket.io

A Socket.io server is attached to the same HTTP server for real-time cursor/meeting position sharing across connected clients. Used for a collaborative/multiplayer overlay feature; events: `move` → `moveTo`, `meeting` → `meetingSend`, `disconnecting` → `left`.
