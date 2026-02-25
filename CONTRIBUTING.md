# Contributing to LeStudio

Welcome! LeStudio is a web-based GUI workbench built around [Hugging Face LeRobot](https://github.com/huggingface/lerobot).
By contributing, you are helping the robotics and open-source ML community.

We enforce a few strong architectural and tooling constraints to keep the system robust and simple. Please read these guidelines before you start.

## Development Setup

The backend is built in **Python 3.10+ (FastAPI)** and the frontend is **React 19 + TypeScript (Vite + Zustand)**.

### 1. Python Environment

It is highly recommended to use `conda` or `mamba`. The LeStudio environment requires LeRobot to be installed.

```bash
git clone https://github.com/TheMomentLab/lestudio.git
cd lestudio

# Create and activate environment
conda create -n lerobot python=3.10 -y
conda activate lerobot

# Install LeStudio in editable mode (also installs FastAPI dependencies)
pip install -e .
```

If you don't have LeRobot installed, you must install it or clone it:
```bash
pip install lerobot
```

### 2. Running in Development Mode

You need two terminal windows.

**Backend Terminal:**
```bash
conda activate lerobot
# Port 8000 is used by default in the Vite dev server proxy
lestudio serve --port 8000 --no-browser
```

**Frontend Terminal:**
```bash
cd frontend
npm ci
npm run dev
```
Open your browser at `http://localhost:5173`. The Vite server will proxy API and WebSocket requests (`/api/*` and `/ws/*`) to `localhost:8000`.

## Architecture & Constraints (CRITICAL)

### The "4-File Boundary" Rule

LeStudio acts as an orchestrator for LeRobot CLI scripts. To support future multi-robot plugin systems and avoid deep coupling, **you must never import `lerobot.*` anywhere in the backend** EXCEPT in these four files:

1. `src/lestudio/teleop_bridge.py`
2. `src/lestudio/record_bridge.py`
3. `src/lestudio/camera_patch.py`
4. `src/lestudio/device_registry.py`

If you are adding a new feature that requires a LeRobot script, build the arguments in `src/lestudio/command_builders.py` and run it as a subprocess using `ProcessManager`.

### Frontend State Management

- Use **Zustand** (`store/index.ts`) for all shared/global state (WebSocket readiness, config, process status).
- Avoid per-tab duplication of state. Use Custom Hooks (`useConfig`, `useProcess`, `useWebSocket`) for API interactions.
- All configuration keys are typed via `LeStudioConfig` in `frontend/src/lib/types.ts`. Update this type when adding new parameters.

## Pull Request Flow

1. Fork the repo.
2. Create a branch: `git checkout -b feature/my-cool-feature`
3. Implement your changes.
4. Run checks:
   - Backend: `pytest tests/ -v` (Must pass all tests!)
   - Frontend: `npm run lint` and `npm run build` inside `frontend/`
5. Push and open a PR.

**Note:** If you are modifying the backend (`src/lestudio/`), please make sure to add a test in `tests/` if you add new command builders or parsing logic.

## Reporting Issues

If you find a bug regarding hardware permissions or missing cameras, please check the [Troubleshooting Guide](docs/troubleshooting.md) first. 

When opening a bug report, always include the Output of the **Global Console** drawer.

# Contributing to LeStudio

Welcome to LeStudio! We appreciate your interest in contributing. By participating in this project, you help build the easiest and most powerful Web-based GUI for Hugging Face LeRobot.

## Getting Started

### Prerequisites
- Python 3.10 or higher
- Node.js 20 or higher
- `conda` (Miniconda/Anaconda) is highly recommended for managing environments.

### Local Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/TheMomentLab/lestudio.git
   cd lestudio
   ```

2. **Set up the Python environment:**
   ```bash
   conda create -n lerobot python=3.10
   conda activate lerobot
   pip install -e ".[dev]"
   ```

3. **Set up the Frontend environment:**
   ```bash
   cd frontend
   npm install
   ```

4. **Run the Development Servers:**
   - Terminal 1 (Frontend):
     ```bash
     cd frontend
     npm run dev
     ```
   - Terminal 2 (Backend):
     ```bash
     lestudio --reload
     ```

## Code Standards

### Backend (Python)
- We use `ruff` for linting and formatting.
- Run formatting before committing:
  ```bash
  ruff format src/
  ruff check src/ --fix
  ```
- Make sure all unit tests pass:
  ```bash
  pytest
  ```

### Frontend (React/TypeScript)
- We use React 19, TypeScript, Vite, and Zustand for state management.
- We do not use Tailwind or CSS-in-JS. We use plain CSS with variables.
- Run the linter and tests:
  ```bash
  cd frontend
  npm run lint
  npm run test
  ```

## Architecture Constraints (CRITICAL)

- **Do NOT import `lerobot.*` anywhere outside of these 4 adapter files:**
  1. `src/lestudio/teleop_bridge.py`
  2. `src/lestudio/record_bridge.py`
  3. `src/lestudio/camera_patch.py`
  4. `src/lestudio/device_registry.py`
- All other files (like `server.py` or `process_manager.py`) must remain completely decoupled from the LeRobot library implementation details. This ensures future compatibility with multiple robot frameworks.

## Pull Request Process

1. Fork the repository and create your branch from `main`.
2. Ensure your code follows the style guidelines (use `ruff` and `eslint`).
3. Add or update tests as appropriate.
4. Ensure the test suite passes (`pytest` and `npm test`).
5. Create a descriptive Pull Request using our template.

We look forward to your contributions!
