<div align="center">

# Hemalyzer

### AI-Powered Hematology Blood Cell Analyzer

<img src="https://img.shields.io/badge/React-19.1-61DAFB?style=for-the-badge&logo=react&logoColor=white" />
<img src="https://img.shields.io/badge/Flask-3.0-000000?style=for-the-badge&logo=flask&logoColor=white" />
<img src="https://img.shields.io/badge/PyTorch-2.1-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white" />
<img src="https://img.shields.io/badge/TailwindCSS-4.1-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" />
<img src="https://img.shields.io/badge/Vite-Latest-646CFF?style=for-the-badge&logo=vite&logoColor=white" />
<img src="https://img.shields.io/badge/Netlify-Deployed-00C7B7?style=for-the-badge&logo=netlify&logoColor=white" />

<br/><br/>

**Hemalyzer** is a web-based hematology analysis system that uses deep learning models to detect and classify blood cells from microscope images. It assists in identifying potential hematological conditions such as **Acute Myeloid Leukemia (AML)**, **Acute Lymphoblastic Leukemia (ALL)**, **Chronic Myeloid Leukemia (CML)**, **Chronic Lymphocytic Leukemia (CLL)**, and **Sickle Cell Disease**.

<br/>

[Live Site](https://ckcalizo.github.io/Hemalyzer/) · [Report Bug](https://github.com/CKCALIZO/Hemalyzer/issues)

</div>

---

## Table of Contents

- [About the Project](#about-the-project)
- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [Deep Learning Models](#deep-learning-models)
- [Features](#features)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Contributors](#contributors)

---

## About the Project

Hemalyzer is a capstone/thesis project designed to aid medical technologists and hematology students in analyzing peripheral blood smear images captured under **100x oil immersion magnification**. The system performs:

- **Automated cell detection** — Identifies and localizes Red Blood Cells (RBCs), White Blood Cells (WBCs), and Platelets using object detection.
- **Cell classification** — Classifies individual WBC and RBC crops into normal or disease subtypes using a fine-tuned ConvNeXt model.
- **Disease interpretation** — Applies clinical hematology thresholds to determine potential disease conditions based on cell differential counts.
- **Statistical analysis** — Calculates confidence intervals, sample adequacy assessments, and estimated cell counts per high-power field (HPF).

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (React)                     │
│   Instructions → Registration → Upload → Analysis        │
│   Reports • Simulation • Cell Classifications • About    │
├─────────────────────────────────────────────────────────┤
│                      REST API                            │
├─────────────────────────────────────────────────────────┤
│                   Backend (Flask)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  YOLO-NAS /   │  │   ConvNeXt   │  │   Disease     │  │
│  │  YOLOv8       │  │  Classifier  │  │  Thresholds   │  │
│  │  (Detection)  │  │  (7-Class)   │  │  & Calculations│ │
│  └──────────────┘  └──────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| **React 19** | UI framework for building interactive components |
| **React Router DOM 7** | Client-side routing and navigation |
| **Tailwind CSS 4** | Utility-first CSS framework for styling |
| **Vite** | Fast build tool and dev server |
| **Lucide React** | Icon library for UI elements |
| **jsPDF + AutoTable** | PDF report generation |
| **Netlify** | Frontend deployment and hosting |

### Backend
| Technology | Purpose |
|---|---|
| **Flask 3.0** | Python web framework for the REST API |
| **Flask-CORS** | Cross-origin resource sharing support |
| **PyTorch 2.1** | Deep learning framework for model inference |
| **TorchVision 0.16** | Pre-trained models and image transforms |
| **OpenCV 4.8** | Image processing and preprocessing |
| **Pillow** | Image manipulation and loading |
| **NumPy** | Numerical computations |
| **Super Gradients** | YOLO-NAS model framework for cell detection |

### Deep Learning & AI
| Model | Role |
|---|---|
| **YOLO-NAS / YOLOv8** | Blood cell detection (RBC, WBC, Platelet localization) |
| **ConvNeXt Base** | 7-class WBC/RBC classification (Normal vs Disease subtypes) |

---

## Deep Learning Models

### Cell Detection — YOLO-NAS / YOLOv8
- Detects and localizes **RBCs**, **WBCs**, and **Platelets** from microscope images
- Outputs bounding boxes with confidence scores
- Trained on custom blood cell datasets captured at 100x magnification

### Cell Classification — ConvNeXt Base (7-Class)
A fine-tuned **ConvNeXt Base** model classifies individual cell crops into:

| Class | Description |
|---|---|
| **Normal WBC** | Healthy white blood cells |
| **AML** | Acute Myeloid Leukemia cells |
| **ALL** | Acute Lymphoblastic Leukemia cells |
| **CML** | Chronic Myeloid Leukemia cells |
| **CLL** | Chronic Lymphocytic Leukemia cells |
| **Sickle Cell** | Abnormal sickle-shaped RBCs |
| **Normal RBC** | Healthy red blood cells |

**Preprocessing Pipeline:**
1. Stain normalization (Optical Density space)
2. CLAHE enhancement in YUV color space
3. Cell detection and centering via Otsu thresholding + contour analysis
4. Black background isolation for consistent classification

---

## Features

- **Image Upload** — Upload microscope blood smear images for analysis
- **Automated Cell Detection** — Detects and counts RBCs, WBCs, and Platelets
- **Disease Classification** — Classifies cells for leukemia subtypes and sickle cell disease
- **Statistical Analysis** — Confidence intervals, sample adequacy, and estimated counts
- **Clinical Thresholds** — Based on standard hematology reference values
- **PDF Report Generation** — Export analysis results as formatted PDF reports
- **Processed Image Thumbnails** — Visual review of detected and classified cells
- **Low Confidence Alerts** — Warns when model predictions are uncertain
- **Simulation Mode** — Live processing demonstration for presentations
- **Patient Registration** — Record patient info linked to analysis sessions
- **Session Storage** — Persist analysis data across page navigation

---

## Getting Started

### Prerequisites
- **Node.js** (v18+)
- **Python** (3.10+)
- **pip**

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
python app.py
```

> **Note:** The backend requires the trained model weights (`convnext.pth` and `best_leukemia_model.pth`) to be present in the `backend/` directory.

---

## Project Structure

```
Hemalyzer/
├── frontend/                  # React + Vite frontend
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   │   ├── homepage/      # Homepage-specific components
│   │   │   ├── FinalResults.jsx
│   │   │   ├── DiseaseInterpretation.jsx
│   │   │   ├── ProcessedImagesThumbnails.jsx
│   │   │   └── ...
│   │   ├── pages/             # Route pages
│   │   │   ├── Homepage.jsx
│   │   │   ├── Reports.jsx
│   │   │   ├── Simulation.jsx
│   │   │   ├── CellClassifications.jsx
│   │   │   ├── About.jsx
│   │   │   └── Instructions.jsx
│   │   ├── context/           # React context (AnalysisContext)
│   │   ├── config/            # API configuration
│   │   ├── utils/             # Utilities (PDF, session, confidence)
│   │   └── styles/            # Global CSS
│   └── package.json
├── backend/                   # Flask API server
│   ├── app.py                 # Main API routes and logic
│   ├── convnext_classifier.py # ConvNeXt model module
│   ├── disease_thresholds.py  # Clinical thresholds
│   ├── calculations.py        # Statistical calculations
│   └── requirements.txt
├── simulation/                # Demo scripts for presentations
├── tests/                     # Model training and testing scripts
├── netlify.toml               # Netlify deployment config
└── README.md
```

---

## Contributors

| Contributor | GitHub |
|---|---|
| **CKCALIZO** | [@CKCALIZO](https://github.com/CKCALIZO) |
| **ExoGenic1**| [@ExoGenic1](https://github.com/Exogenic1) |
| **rairaii11** | [@rairaii11](https://github.com/rairaii11) |

---

<div align="center">

**Built for Hematology**

*Capstone Project — AI-Powered Blood Cell Analysis System*

</div>
