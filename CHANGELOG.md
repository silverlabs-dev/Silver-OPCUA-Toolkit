# Changelog

All notable changes to Silver OPC UA Toolkit will be documented in this file.

This project follows semantic versioning principles where possible.

Pre-release versions may contain breaking changes during active alpha development.

---

## [v0.3.0-alpha] - 2026-05-29

### Added

#### Frontend
- Persistent watchlist via `localStorage` (`silver_opcua_watchlist`)
- CSV export dialog with time-window slider and per-tag columns
- Alarm and threshold visualization:
  - Warning High / Warning Low per tag
  - Critical High / Critical Low per tag
  - Threshold lines on trend chart (dashed reference lines)
  - Card color states: normal / warning / critical
  - Threshold settings persisted to `localStorage` (`silver_opcua_thresholds`)
- System Status panel in sidebar with real-time indicators:
  - Backend API availability
  - WebSocket connection state
  - OPC UA connection state
  - Stream running / paused / stopped
  - Active watchlist tag count
- Auto-restart stream when watchlist changes during active monitoring
- Stream settings persisted to `localStorage` (`silver_opcua_stream_settings`)
- UI Refinement Pass:
  - Sidebar navigation replacing top navbar
  - Improved visual hierarchy and surface depth
  - Refined card, badge, and table styling
  - Industrial SaaS aesthetic (Cognite / Grafana inspired)
  - Cleaner typography scale and spacing
  - Polished Tag Browser tree and details panel
  - Dark tooltip style for charts
  - Smoother hover and transition states

#### Simulator
- Realistic 5-mode industrial signal simulation:
  - `normal` — Gaussian noise around setpoint
  - `alarm` — values exceeding thresholds
  - `step` — sudden setpoint changes
  - `frozen` — stuck/bad-quality signal
  - `recovering` — gradual return to normal

---

### Fixed
- Watchlist tags removed correctly when parent connection is deleted
- Stream correctly stops when all watchlist tags are cleared
- WebSocket status accurately reflects live connection state

---

### Changed
- Navigation migrated from horizontal top bar to vertical sidebar
- System Status footer replaced static text with live runtime indicators
- Monitoring cards now reflect alarm state via border and background color

---

## [v0.2.0-alpha] - 2026-05-24

### Added

#### Backend
- Structured logging and lifecycle observability
- Text log format for development and JSON format for production
- Centralized configuration via `Settings` class (`pydantic-settings`)
- Connection state machine with:
  - `last_connected_at`
  - `last_error`
  - `retry_count`
- OPC UA lifecycle cleanup via `_force_cleanup()`
- WebSocket ping/pong loop for dead connection detection every 5 seconds
- WebSocket handshake timeout (10 seconds)
- Configurable monitoring interval via `update_rate_ms`
- `disconnect_all()` for clean application shutdown
- `DB_PATH` environment variable for configurable SQLite location
- Docker healthcheck for simulator readiness

#### Frontend
- Watchlist-based monitoring workflow
- Watchlist state persistence across page navigation (React Context)
- Redesigned Tag Browser with:
  - recursive tree explorer
  - details panel
  - real-time search
  - expandable node hierarchy
- Per-node loading indicators during tree expansion
- Tag details panel:
  - Name
  - Node ID
  - Node Class
  - Current Value
- Clean OPC UA node ID formatting (`ns=X;i=Y`)
- Boolean tag visualization in charts (`ON/OFF`)
- Chart pause / resume support
- Configurable monitoring windows:
  - 30s
  - 1m
  - 2m
  - 5m
  - 10m
- Configurable update intervals:
  - 100ms
  - 500ms
  - 1s
  - 5s
  - 10s
- Real elapsed time labels on chart X-axis
- Watchlist counter badge in navigation
- Color-matched monitoring cards and chart series
- Inline connection error feedback
- Loading indicators for connect/disconnect actions
- Empty states with industrial-style UX guidance
- Active navigation tab indicator
- Improved visual hierarchy:
  - layered surfaces
  - shadows
  - styled scrollbars

#### Infrastructure
- Multi-stage Docker frontend build (`Node 20 Alpine + nginx`)
- Backend Docker container (`Python 3.12-slim + uv`)
- `docker-compose.yml` with:
  - simulator
  - backend
  - frontend
- nginx reverse proxy for:
  - `/api/`
  - `/ws/`
- SPA fallback routing
- Docker networking fixes for OPC UA simulator
- Automatic development/production URL switching

---

### Fixed

- Memory leak during OPC UA connection failures
- WebSocket streams continuing after OPC UA disconnect
- Stale `is_connected()` state handling
- Reconnect safety for duplicate connection IDs
- Docker startup race condition between backend and simulator
- OPC UA node ID parsing edge cases
- Resolved ESLint issues across frontend codebase
- Resolved Ruff warnings across backend codebase

---

### Changed

- Backend startup flow migrated from direct `uvicorn` CLI usage to `run.py`
- SQLAlchemy boolean comparison updated to `.is_(True)` best practice
- Monitoring workflow migrated from connection-centric to watchlist-centric
- Tag Browser upgraded from hardcoded tree to fully recursive navigation
- Charts now use real elapsed timestamps instead of sequential counters

---

## [v0.1.0-alpha] - 2026-05-21

### Added
- OPC UA Connection Manager
- Connection persistence with auto-reconnect on startup
- Recursive OPC UA Tag Browser
- Live monitoring via WebSockets
- Realtime multi-tag charting
- Industrial OPC UA simulator
- FastAPI backend
- Async SQLAlchemy integration
- React + TypeScript frontend
- SQLite-based persistence layer

---

## Release Notes

### v0.2.0-alpha

This release focuses on:

- Stability hardening
- Realtime monitoring reliability
- Industrial UX improvements
- Dockerized deployment
- Scalable OPC UA navigation

This is the first public alpha release intended for early feedback and industrial workflow validation.

---

## Roadmap

### v0.3.0-alpha ✅ Released 2026-05-29
- Persistent watchlist (`localStorage`)
- CSV export for chart data
- Alarm / threshold visualization
- System Status panel
- UI Refinement Pass
- Realistic 5-mode industrial simulator

### v0.4.0-alpha
- OPC UA security foundations
- Authentication (`Anonymous` / `Username + Password`)
- Certificate handling groundwork
- Security mode selection:
  - `None`
  - `Sign`
  - `SignAndEncrypt`

### v0.5.0-beta
- Stable architecture milestone
- Multi-connection monitoring
- Production deployment documentation
- Performance validation