# Silver-OPCUA-Toolkit
Open-source industrial OPC UA platform for realtime monitoring and visualization.

## Overview

Silver OPC UA Toolkit is an open-source industrial software platform designed for industrial engineers, automation developers, and system integrators.

The project focuses on providing modern tools for:

- OPC UA connectivity
- Realtime tag monitoring
- Industrial data visualization
- Web-based industrial interfaces
- Future AI-assisted industrial workflows

Built with a modern full-stack architecture using Python and React.

---

## Current Features

### Implemented

- OPC UA Connection Manager
- Tag Browser
- Live Tag Monitoring
- WebSocket-based realtime updates

### In Progress

- Realtime Charts

### Planned

- Historical Data Logging
- Alarm & Events
- MQTT Integration
- Modbus Support
- AI-assisted diagnostics
- Edge deployment tools

---

## Tech Stack

### Backend

- Python
- FastAPI
- asyncua
- WebSockets

### Frontend

- React
- TypeScript
- Vite

### Infrastructure

- Docker

---

## Project Structure

Project structure will evolve during MVP development.

## Quick Start

### Requirements

- Python 3.13+
- Node.js v24.15.0
- npm

---

### Clone Repository

```bash
git clone https://github.com/Armin22-Programmer/Silver-OPCUA-Toolkit.git
cd Silver-OPCUA-Toolkit
---

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
---

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
---

### Optional (Docker)
```bash
docker-compose up --build
---

## Demo
- Real-time OPC UA tag streaming via WebSockets
- Live industrial dashboard updates
- Interactive tag browser (read/write support)
---


