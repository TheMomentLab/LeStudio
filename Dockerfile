# ---------------------------------------------------------
# Stage 1: Build Frontend (Vite)
# ---------------------------------------------------------
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend

# Copy frontend source
COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build
# The build output is placed in /app/src/lestudio/static (as per vite.config.ts)

# ---------------------------------------------------------
# Stage 2: Build Python Backend
# ---------------------------------------------------------
FROM python:3.10-slim

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

# Copy python dependencies
# In a real environment, you might install 'lerobot' from source or pip first
RUN pip install "lerobot[cameras, motors] @ git+https://github.com/huggingface/lerobot.git"

# Copy LeStudio source
COPY . .

# Copy built frontend assets from stage 1
COPY --from=frontend-builder /app/src/lestudio/static /app/src/lestudio/static

# Install LeStudio
RUN pip install -e .

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
