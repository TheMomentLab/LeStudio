# Getting Started

## Prerequisites

Before using LeStudio, you must have an environment with Hugging Face `lerobot` installed.

We recommend using conda:
```bash
conda create -n lerobot python=3.10
conda activate lerobot
```

Install LeRobot from source (as it provides the necessary dependencies like PyTorch, OpenCV, etc.):
```bash
pip install "lerobot[cameras, motors] @ git+https://github.com/huggingface/lerobot.git"
```

## Installing LeStudio

Once you have your `lerobot` environment active, you can install LeStudio:

```bash
git clone https://github.com/TheMomentLab/lestudio.git
cd lestudio
pip install -e .
```

## Running the App

Start the LeStudio server by running:

```bash
lestudio serve --host 127.0.0.1 --port 8000
```

Open your browser and navigate to [http://127.0.0.1:8000](http://127.0.0.1:8000). You will be greeted by the LeStudio dashboard!
