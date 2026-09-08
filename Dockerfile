# ---------------------------------------------------------
# Stage 1: Build Frontend (Vite)
# ---------------------------------------------------------
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend

# Copy frontend source
COPY packages/lestudio/frontend/package*.json ./
RUN npm ci

COPY packages/lestudio/frontend/ ./
RUN npm run build && npm run build:checkup
# Outputs: /app/src/lestudio/static (LeStudio) and /app/lerobot-checkup/src/lerobot_checkup/static (checkup)

# ---------------------------------------------------------
# Stage 2: Build Python Backend
# ---------------------------------------------------------
FROM python:3.12-slim

# Install system dependencies required for OpenCV, pyav, and building some python packages
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsm6 \
    libxext6 \
    libgl1-mesa-glx \
    udev \
    git \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Upgrade pip
RUN python -m pip install --upgrade pip

# Create unprivileged user (optional but good practice)
# Note: For robotics with /dev/video* access, this user MUST be in 'video', 'dialout', 'tty' groups.
RUN groupadd -r lerobot_group && useradd -m -r -g lerobot_group lerobot_user \
    && usermod -a -G video lerobot_user \
    && usermod -a -G dialout lerobot_user \
    && usermod -a -G tty lerobot_user

# Copy dependency metadata for pip install cache
COPY packages/lerobot-checkup packages/lerobot-checkup
COPY packages/lestudio/pyproject.toml packages/lestudio/README.md packages/lestudio/
COPY packages/lestudio/src/lestudio/__init__.py packages/lestudio/src/lestudio/__init__.py

# Install the heavy dependency first (cached layer). Upstream release from PyPI;
# the motor extras pull the Feetech / Dynamixel SDKs.
RUN pip install "lerobot[feetech,dynamixel]>=0.6.1,<0.7"

# Copy full LeStudio source
COPY . .

# Copy built frontend assets from stage 1
COPY --from=frontend-builder /app/src/lestudio/static /app/packages/lestudio/src/lestudio/static
COPY --from=frontend-builder /app/lerobot-checkup/src/lerobot_checkup/static /app/packages/lerobot-checkup/src/lerobot_checkup/static

# Install LeStudio
RUN pip install -e packages/lerobot-checkup -e packages/lestudio

# Give the non-root user ownership
RUN chown -R lerobot_user:lerobot_group /app

USER lerobot_user

# Expose default port
EXPOSE 7860

# --- DOCKER RUN INSTRUCTIONS ---
# To run this container successfully with hardware access, you MUST mount /dev and run privileged:
# docker run --rm -it \
#   --privileged \
#   -v /dev:/dev \
#   -v /var/run/udev:/var/run/udev:ro \
#   -p 7860:7860 \
#   lestudio
# -------------------------------

ENTRYPOINT ["lestudio", "serve", "--host", "0.0.0.0", "--port", "7860"]
