# ConvNeXt Server Setup Guide

Run the ConvNeXt classification model on your PC and make it accessible to your deployed Render backend via ngrok.

## Prerequisites

- Python 3.8 or higher
- Windows/Mac/Linux PC
- Internet connection
- GPU recommended (but CPU works too)

## Installation Steps

### 1. Install Python Dependencies

```bash
pip install -r convnext_server_requirements.txt
```

### 2. Download and Install ngrok

1. Go to https://ngrok.com/download
2. Download ngrok for your OS
3. Extract the executable

### 3. Sign up for ngrok

1. Create free account at https://dashboard.ngrok.com/signup
2. Get your authtoken from https://dashboard.ngrok.com/get-started/your-authtoken
3. Configure ngrok:
   ```bash
   ngrok config add-authtoken YOUR_TOKEN_HERE
   ```

### 4. Verify Model File

Make sure you have the trained model file:
```
Hemalyzer/
└── backend/
    └── best_leukemia_model.pth
```

## Running the Server

### Terminal 1: Start ConvNeXt Server

```bash
cd "C:\Users\C2SDK\Desktop\Hemalyzer Deploy\Hemalyzer"
python convnext_server.py
```

You should see:
```
============================================================
ConvNeXt Classification Server
============================================================

Loading ConvNeXt model...
✓ Model loaded successfully on cuda:0
...
Server Configuration:
  - Port: 5001
  - Device: cuda:0
  - API Key: hemalyzer-colab-2024
...
```

### Terminal 2: Start ngrok Tunnel

```bash
ngrok http 5001
```

You'll see output like:
```
Session Status                online
Account                       your@email.com
Forwarding                    https://abc123.ngrok-free.app -> http://localhost:5001
```

**Copy the HTTPS URL** (e.g., `https://abc123.ngrok-free.app`)

### 5. Update Render Environment Variable

1. Go to https://dashboard.render.com
2. Select your `hemalyzer` service
3. Go to **Environment** tab
4. Find or add `COLAB_MODEL_URL`
5. Set value to your ngrok URL: `https://abc123.ngrok-free.app`
6. Click **Save Changes**
7. Render will automatically redeploy

## Testing

Once deployed, test the connection:

```bash
# Test health endpoint
curl https://abc123.ngrok-free.app/health
```

You should get:
```json
{
  "status": "healthy",
  "model_loaded": true,
  "device": "cuda:0",
  "mode": "local_pc"
}
```

## Troubleshooting

### Server won't start
- Check if port 5001 is already in use
- Verify model file exists at `backend/best_leukemia_model.pth`
- Check Python version: `python --version` (should be 3.8+)

### ngrok connection issues
- Verify authtoken is configured: `ngrok config check`
- Check internet connection
- Free tier has 40 connections/minute limit

### Render can't connect
- Make sure both server and ngrok are running
- Verify ngrok URL is correct in Render environment variables
- Check ngrok dashboard for connection logs

### Out of memory on your PC
- Close other applications
- Reduce batch_size in `convnext_server.py` (line 211)
- Use CPU instead of GPU if GPU memory is limited

## Performance Tips

### If you have a GPU:
- Model will automatically use GPU
- Batch size of 16 is optimal for most GPUs
- Expect ~5-10 images/second

### If using CPU only:
- Reduce batch size to 8 in `convnext_server.py`
- Expect ~1-2 images/second
- Still faster than Render's free tier!

## Keeping Server Running 24/7

### Windows:
1. Disable sleep mode:
   - Settings → System → Power & Sleep → Never
2. Consider using Task Scheduler to auto-start on boot

### Using Windows Task Scheduler:
1. Open Task Scheduler
2. Create Basic Task
3. Trigger: At startup
4. Action: Start program
5. Program: `python`
6. Arguments: `C:\path\to\convnext_server.py`
7. Check "Run whether user is logged on or not"

### Auto-restart ngrok:
Create `start_ngrok.bat`:
```batch
@echo off
:loop
ngrok http 5001
timeout /t 10
goto loop
```

## Security Notes

- The server uses API key authentication (default: `hemalyzer-colab-2024`)
- ngrok URLs are secure (HTTPS) but public
- Consider changing API_KEY environment variable for production
- Free ngrok URLs change on restart (consider paid plan for static URLs)

## Advantages vs Colab

✅ No 12-hour disconnect  
✅ Uses your full GPU/RAM  
✅ No session limits  
✅ Faster response times  
✅ Complete control  
✅ Free (except electricity)  

## Monitoring

Check server logs in Terminal 1 to see:
- Classification requests
- Processing times
- Any errors

Monitor ngrok connections:
- Visit ngrok dashboard: https://dashboard.ngrok.com
- View real-time traffic and requests

## Stopping the Server

1. In Terminal 1 (server): Press `Ctrl+C`
2. In Terminal 2 (ngrok): Press `Ctrl+C`

## Cost Comparison

| Option | Cost | RAM | Uptime |
|--------|------|-----|--------|
| Your PC + ngrok | Free | Unlimited | 24/7 (if you want) |
| Colab Free | Free | 12GB | ~12 hours |
| Colab Pro | $10/mo | 25GB | 24 hours |
| Render 2GB | $25/mo | 2GB | 24/7 |

**Your PC is the most cost-effective solution!**
