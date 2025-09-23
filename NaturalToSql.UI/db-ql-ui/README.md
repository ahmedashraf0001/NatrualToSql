# NaturalToSQL Desktop Application

## Overview
NaturalToSQL is a modern desktop Electron application that enables users to convert natural language queries into SQL and execute them against a variety of database providers. It features a user-friendly interface, robust profile management, and seamless integration with a .NET Core backend API.

## Features
- **Profile Management:** Create, switch, and delete database profiles with ease
- **Natural Language to SQL:** Convert plain English queries into SQL statements
- **SQL Execution:** Run SQL queries and view results in a professional data grid
- **Query History:** Access and manage previous queries and results
- **Schema Explorer:** Browse database structure (tables, columns, types)
- **Connection Testing:** Validate database connections before use
- **Health Monitoring:** Real-time health checks for API and LLM modes
- **Error Handling:** Clear, actionable feedback for all error scenarios
- **Modern UI:** Built with premium React component libraries for a beautiful, responsive experience

## Technology Stack
- **Frontend:** React (TypeScript), Vite, Tailwind CSS
- **Component Libraries:** SmoothUI, Tailark, Aceternity UI, TweakCN, Magic UI, ReactBits, Shadcn/ui Blocks
- **Backend:** .NET Core API (NaturalToQuery.Api.dll)
- **Desktop Shell:** Electron (main process manages API lifecycle and IPC)
- **State Management:** React hooks (useState, useEffect, useContext)
- **HTTP Client:** Axios or Fetch API
- **Architecture:** Clean Architecture (Application, Core, Infrastructure, Shared Kernel, Presentation)

## Clean Architecture
This project is built using Clean Architecture principles, with clear separation of concerns:
- **Application Layer:** Orchestrates business logic and workflow (Electron main process, backend API logic)
- **Core Layer:** Defines domain models, interfaces, and business rules (shared types, DTOs, enums)
- **Infrastructure Layer:** Handles data access, external services, and API integration (.NET Core API, database providers, LLM integration)
- **Shared Kernel:** Contains shared types, utilities, and contracts (`src/shared/`)
- **Presentation Layer:** React frontend (renderer) for user interaction and UI

## Project Structure
```
src/
├── main/           # Electron main process
├── renderer/       # React frontend
│   ├── components/ # Reusable components
│   ├── pages/      # Page components
│   ├── hooks/      # Custom hooks
│   ├── services/   # API services
│   ├── utils/      # Utility functions
│   └── types/      # TypeScript types
├── shared/         # Shared types/utils
└── assets/         # Static assets
api_publish/        # .NET backend API DLL and config
```

## Main Workflows & UI
- **First Launch:**
  - App checks for existing user profile; if none, setup wizard guides mode selection and API key entry
  - User creates a database profile (auto-detect or manual connection string)
  - User ID and profile are stored for future sessions
- **Main Interface:**
  - Profile management, query editor, SQL preview, results table, query history, schema explorer, error handling, and animated loaders
- **Enhanced Features (Planned):**
  - Favorites, export options, query templates, advanced filtering, multi-tab interface, theme toggle, keyboard shortcuts

## Setup & Usage
### Prerequisites
- Node.js (latest LTS recommended)
- .NET Core Runtime
- Windows OS (for full feature support)

### Setup
1. Clone the repository
2. Install dependencies:
   ```sh
   npm install
   ```
3. Ensure the .NET API DLLs are present in the `api_publish/` directory

### Development
- Start the React UI in development mode:
  ```sh
  npm run dev
  ```
- The Electron main process will auto-start the backend API

### Build
- Build the Electron app (UI + main process):
  ```sh
  npm run build:electron
  ```

### Run
- Launch the packaged Electron app, or run in dev mode as above

## API Endpoints & Integration
- **User Profile:**
  - `POST /api/userinfo` — Create user profile
  - `GET /api/userinfo/{id}` — Retrieve user profile
  - `PUT /api/userinfo/{userId}/aimode` — Update AI mode
- **Profile Management:**
  - `POST /api/setup/profile` — Create database profile (requires UserId)
  - `DELETE /api/setup/profile/{id}` — Remove database profile
- **Setup & Health:**
  - `GET /api/health` — API health check
  - `GET /api/health/localllm` — Local LLM health check
  - `GET /api/setup/providers` — List supported providers
  - `GET /api/setup/servers/{type}` — List servers
  - `GET /api/setup/databases/{type}/{serverName}` — List databases
  - `GET /api/setup/test/{providertype}` — Test connection
- **Query Operations:**
  - `POST /api/query/{profileId}/convert` — Convert natural language to SQL
  - `POST /api/query/{profileId}/execute` — Execute SQL query
  - `GET /api/query/{profileId}/schema` — Get database schema
  - `GET /api/query/profile/{id}` — Get profile with query history

## Security & Best Practices
- All user inputs are validated and SQL outputs sanitized
- API keys are stored securely
- Error boundaries and robust error handling throughout
- Responsive design and accessibility features included
- Electron manages all backend API process lifecycle

## Contributing
Contributions are welcome! Please follow Clean Architecture principles and existing code style guidelines. See `.github/instructions/reactjs.instructions.md` for React best practices.

## License
See `LICENSE.txt` for details.
