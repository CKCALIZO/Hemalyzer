# 🩸 Hemalyzer Deployment Guide

## Architecture Overview

This deployment architecture allows you to run Hemalyzer for free demonstrations:

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   NETLIFY       │      │   RENDER        │      │  GOOGLE COLAB   │
│   (Frontend)    │ ───► │   (Backend)     │ ───► │   (Model)       │
│                 │      │                 │      │                 │
│  - React App    │      │  - Flask API    │      │  - ConvNeXt     │
│  - Static Host  │      │  - YOLO Detect  │      │  - GPU Runtime  │
│  - Free Tier    │      │  - Proxy to AI  │      │  - ngrok Tunnel │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

**Benefits:**
- ✅ No hosting costs
- ✅ No payment method required
- ✅ GPU acceleration for the model (Colab)
- ✅ Sufficient for demonstrations

**Limitations:**
- ⚠️ Colab sessions timeout after ~12 hours of inactivity
- ⚠️ ngrok URL changes each session
- ⚠️ Not suitable for production

---

## 1️⃣ Google Colab Setup (Model Server)

### Step 1: Upload Your Model
1. Go to [Google Drive](https://drive.google.com)
2. Create a folder: `Hemalyzer`
3. Upload `best_leukemia_model.pth` to this folder

### Step 2: Get ngrok Auth Token
1. Go to [ngrok.com](https://ngrok.com) and create a free account
2. Navigate to: Dashboard > Your Authtoken
3. Copy your auth token

### Step 3: Run the Colab Notebook
1. Upload `colab/hemalyzer_colab_model_server.ipynb` to Google Colab
2. Or open directly: File > Open Notebook > Upload
3. **Important:** Change runtime to GPU
   - Runtime > Change runtime type > T4 GPU
4. Update the configuration cells:
   - Set `MODEL_PATH` to your Google Drive path
   - Set `NGROK_AUTH_TOKEN` to your ngrok token
   - Optionally change `API_KEY` for security
5. Run all cells in order
6. Copy the ngrok URL displayed (e.g., `https://abc123.ngrok-free.app`)

### Step 4: Keep Colab Running
- Run the "Keep Notebook Alive" cell to prevent timeout
- Keep the browser tab open during your demo
- The notebook will print the URL periodically

---

## 2️⃣ Render Setup (Backend)

### Step 1: Create a New Web Service
1. Go to [Render](https://render.com) and sign up (free)
2. Click "New" > "Web Service"
3. Connect your GitHub repository or use "Public Git Repository"

### Step 2: Configure the Service
```
Name: hemalyzer-backend
Region: Choose closest to you
Branch: main
Root Directory: backend
Runtime: Python 3
Build Command: pip install -r requirements-render.txt
Start Command: gunicorn app:app --bind 0.0.0.0:$PORT
Instance Type: Free
```

### Step 3: Set Environment Variables
Go to "Environment" tab and add:

| Key | Value |
|-----|-------|
| `COLAB_MODEL_URL` | Your ngrok URL (e.g., `https://abc123.ngrok-free.app`) |
| `COLAB_API_KEY` | `hemalyzer-colab-2024` (or your custom key) |
| `FLASK_ENV` | `production` |
| `ROBOFLOW_API_KEY` | Your Roboflow API key (for YOLO detection) |

### Step 4: Deploy
1. Click "Create Web Service"
2. Wait for the build and deploy to complete
3. Copy your Render URL (e.g., `https://hemalyzer-backend.onrender.com`)

### Updating the Colab URL
When you restart Colab (new ngrok URL):
1. Go to your Render dashboard
2. Click on your service
3. Go to "Environment"
4. Update `COLAB_MODEL_URL` with the new ngrok URL
5. The service will automatically redeploy

---

## 3️⃣ Netlify Setup (Frontend)

### Step 1: Create a New Site
1. Go to [Netlify](https://netlify.com) and sign up (free)
2. Click "Add new site" > "Import an existing project"
3. Connect your GitHub repository

### Step 2: Configure Build Settings
```
Base directory: frontend
Build command: npm run build
Publish directory: frontend/dist
```

### Step 3: Set Environment Variables
Go to "Site settings" > "Environment variables" and add:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | Your Render URL (e.g., `https://hemalyzer-backend.onrender.com`) |

### Step 4: Deploy
1. Click "Deploy site"
2. Wait for the build to complete
3. Your site is live at `https://your-site-name.netlify.app`

---

## 🔄 Workflow for Demonstrations

### Before Each Demo:
1. **Start Colab:**
   - Open the Colab notebook
   - Run all cells
   - Copy the new ngrok URL

2. **Update Render:**
   - Go to Render dashboard
   - Update `COLAB_MODEL_URL` environment variable
   - Wait for redeploy (~1-2 minutes)

3. **Test:**
   - Visit your Netlify URL
   - Upload a test image
   - Verify analysis works

### During the Demo:
- Keep the Colab tab open (don't close it!)
- The "Keep Alive" cell prevents timeout

### Quick Health Check:
```bash
# Check if Colab server is running
curl https://YOUR-NGROK-URL.ngrok-free.app/health

# Check if Render backend is working
curl https://your-app.onrender.com/health

# Or check classifier info
curl https://your-app.onrender.com/classifier_info
```

---

## 📁 File Structure

```
Hemalyzer/
├── colab/
│   └── hemalyzer_colab_model_server.ipynb  # Colab notebook
├── backend/
│   ├── app.py                    # Main Flask app
│   ├── colab_client.py           # Client for Colab API
│   ├── convnext_classifier.py    # Modified to support Colab mode
│   ├── requirements.txt          # Full requirements (local dev)
│   ├── requirements-render.txt   # Lightweight requirements (Render)
│   └── .env.example              # Environment variables template
├── frontend/
│   ├── src/
│   │   └── context/
│   │       └── AnalysisContext.jsx  # Uses VITE_API_URL
│   ├── .env.example              # Environment variables template
│   └── package.json
└── DEPLOYMENT.md                 # This file
```

---

## 🔧 Troubleshooting

### "Connection failed - check if Colab notebook is running"
- Ensure the Colab notebook is running
- Check if ngrok URL is correct in Render environment
- Verify the Colab "Keep Alive" cell is running

### "Unauthorized - check API key"
- Ensure `COLAB_API_KEY` in Render matches `API_KEY` in Colab notebook

### "Model not loaded" in health check
- Check Colab notebook for model loading errors
- Verify `MODEL_PATH` in Colab points to correct file

### Render cold start (slow first request)
- Free Render instances spin down after 15 minutes of inactivity
- First request after inactivity takes 30-60 seconds
- Keep the service warm by pinging it periodically

### CORS errors in browser
- Ensure your Netlify URL is allowed in the backend
- Check browser console for specific CORS error messages

---

## 🚀 Alternative: Local Development

For local development without Colab:

1. **Backend:**
   ```bash
   cd backend
   pip install -r requirements.txt
   # Don't set COLAB_MODEL_URL - model loads locally
   python app.py
   ```

2. **Frontend:**
   ```bash
   cd frontend
   npm install
   # Create .env with VITE_API_URL=http://localhost:5000
   npm run dev
   ```

---

## 📞 Support

If you encounter issues:
1. Check the Colab notebook output for errors
2. Check Render logs (Dashboard > Logs)
3. Check browser console for frontend errors
4. Verify all environment variables are set correctly
