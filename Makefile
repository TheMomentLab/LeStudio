SHELL := /bin/bash

# `lerobot` is a normal pip dependency of packages/lestudio (version range in
# its pyproject). It resolves to whatever upstream release matches your Python:
# 0.4.x on Python 3.10/3.11, 0.5+ on Python 3.12+. Install torch first if you
# need a specific CUDA/CPU build, e.g.
#   pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

.PHONY: install dev test test-hw build-frontend clean help

## install: Install lerobot-checkup and lestudio (editable); pulls upstream lerobot
install:
	pip install -e packages/lerobot-checkup -e packages/lestudio

## dev: Same as install plus the dev toolchain used by CI (ruff, mypy, pytest helpers)
dev:
	pip install -e packages/lerobot-checkup -e "packages/lestudio[dev]"

## build-frontend: Build the React frontend for both packages (LeStudio + lerobot-checkup)
build-frontend:
	cd packages/lestudio/frontend && npm ci && npm run build && npm run build:checkup

## test: Run unit tests (no hardware required)
test:
	PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python -m pytest -q -m "not smoke_hw" tests

## test-hw: Run hardware smoke tests (requires physical devices)
test-hw:
	LESTUDIO_RUN_HW_SMOKE=1 PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python -m pytest -q -m "smoke_hw" tests/smoke_hw

## clean: Remove build artifacts and caches
clean:
	rm -rf build dist *.egg-info packages/*/src/*.egg-info packages/*/build packages/*/dist
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true

help:
	@grep -E '^##' Makefile | sed 's/## /  /'
