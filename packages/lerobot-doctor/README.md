# lerobot-doctor

Hardware setup and diagnostics for [Hugging Face LeRobot](https://github.com/huggingface/lerobot).

*Working name.* This package is the hardware layer extracted from the LeStudio
workbench: device discovery, udev port mapping with stable symlinks, the
motor-ID setup wizard bridge, the live motor monitor bridge, and calibration
file validation. Today it is a library that LeStudio imports; the standalone
web UI and `lerobot-doctor` CLI ship with the first release.

See `docs_public/direction.md` at the repository root for the plan.
