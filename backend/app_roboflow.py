"""
Hemalyzer Backend API - Roboflow Inference
Blood Cell Analysis using Roboflow hosted model: bloodcell-hema
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from inference_sdk import InferenceHTTPClient
from dotenv import load_dotenv
import cv2
import numpy as np
from PIL import Image
import io
import base64
import os

# Load environment variables from .env file
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# ============================================================
# ROBOFLOW INFERENCE CLIENT SETUP
# ============================================================

# Get API key from environment
API_KEY = os.getenv("API_KEY", "").strip()
if not API_KEY:
    print("⚠️  Warning: API_KEY not found in .env file")

# Initialize Roboflow Inference Client
# Using the hosted API at detect.roboflow.com
CLIENT = InferenceHTTPClient(
    api_url="https://detect.roboflow.com",
    api_key=API_KEY
)

# Your Roboflow model ID (workspace/model format)
# Update this if your full model ID is different
MODEL_ID = "bloodcell-hema/1"  # Adjust version number if needed

# ============================================================
# API ENDPOINTS
# ============================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'model': MODEL_ID,
        'api_configured': bool(API_KEY)
    })


@app.route('/api/analyze', methods=['POST'])
def analyze_image():
    """
    Analyze blood cell image using Roboflow inference
    
    Expects:
        - image: Image file (multipart/form-data)
        - confidence (optional): Confidence threshold (0-1), default 0.25
        - overlap (optional): Overlap threshold for NMS (0-1), default 0.45
    
    Returns:
        - success: Boolean
        - detections: List of detected blood cells
        - summary: Count summary by cell type
        - annotated_image: Base64 encoded image with bounding boxes
    """
    try:
        # Check if image was uploaded
        if 'image' not in request.files:
            return jsonify({'success': False, 'error': 'No image uploaded'}), 400
        
        image_file = request.files['image']
        if image_file.filename == '':
            return jsonify({'success': False, 'error': 'No image selected'}), 400
        
        # Get optional parameters
        confidence = float(request.form.get('conf_threshold', 0.25))
        overlap = float(request.form.get('iou_threshold', 0.45))
        
        # Read image
        image_bytes = image_file.read()
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            return jsonify({'success': False, 'error': 'Invalid image format'}), 400
        
        # Convert to RGB for display
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # Run inference using Roboflow
        print(f"🔍 Running inference on image with confidence={confidence}, overlap={overlap}")
        
        # Convert image to base64 for API
        _, buffer = cv2.imencode('.jpg', image)
        image_base64 = base64.b64encode(buffer).decode('utf-8')
        
        # Run inference
        result = CLIENT.infer(image_base64, model_id=MODEL_ID)
        
        print(f"📦 Roboflow response: {result}")
        
        # Parse predictions
        predictions = result.get('predictions', [])
        
        # Process detections
        detections = []
        summary = {}
        
        # Colors for different cell types (BGR for OpenCV)
        colors = {
            'RBC': (0, 0, 255),      # Red
            'WBC': (255, 0, 0),      # Blue
            'Platelets': (0, 255, 0), # Green
            'Platelet': (0, 255, 0),  # Green (alternate name)
        }
        default_color = (255, 255, 0)  # Yellow for unknown
        
        for idx, pred in enumerate(predictions):
            class_name = pred.get('class', 'Unknown')
            confidence_score = pred.get('confidence', 0)
            
            # Get bounding box (Roboflow uses center format)
            x_center = pred.get('x', 0)
            y_center = pred.get('y', 0)
            width = pred.get('width', 0)
            height = pred.get('height', 0)
            
            # Convert to corner format
            x1 = int(x_center - width / 2)
            y1 = int(y_center - height / 2)
            x2 = int(x_center + width / 2)
            y2 = int(y_center + height / 2)
            
            # Add to detections list
            detections.append({
                'id': idx + 1,
                'class': class_name,
                'confidence': round(confidence_score, 3),
                'bbox': [x1, y1, x2, y2]
            })
            
            # Update summary count
            summary[class_name] = summary.get(class_name, 0) + 1
            
            # Draw bounding box on image
            color = colors.get(class_name, default_color)
            cv2.rectangle(image_rgb, (x1, y1), (x2, y2), color, 2)
            
            # Draw label
            label = f"{class_name}: {confidence_score:.2f}"
            label_size, _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2)
            cv2.rectangle(image_rgb, (x1, y1 - label_size[1] - 10), 
                         (x1 + label_size[0], y1), color, -1)
            cv2.putText(image_rgb, label, (x1, y1 - 5), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2)
        
        # Convert annotated image to base64
        pil_image = Image.fromarray(image_rgb)
        buffer = io.BytesIO()
        pil_image.save(buffer, format='JPEG', quality=90)
        annotated_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        
        print(f"✅ Detection complete: {len(detections)} cells found")
        print(f"📊 Summary: {summary}")
        
        return jsonify({
            'success': True,
            'detections': detections,
            'summary': summary,
            'total_cells': len(detections),
            'annotated_image': f"data:image/jpeg;base64,{annotated_base64}",
            'image_dimensions': {
                'width': image.shape[1],
                'height': image.shape[0]
            }
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/models', methods=['GET'])
def list_models():
    """List available models"""
    return jsonify({
        'current_model': MODEL_ID,
        'available_models': [MODEL_ID]
    })


# ============================================================
# MAIN
# ============================================================

if __name__ == '__main__':
    print("=" * 60)
    print("🩸 Hemalyzer Backend - Roboflow Inference")
    print("=" * 60)
    print(f"📦 Model: {MODEL_ID}")
    print(f"🔑 API Key configured: {'Yes' if API_KEY else 'No'}")
    print("=" * 60)
    
    if not API_KEY:
        print("⚠️  WARNING: No API key found!")
        print("   Please add your Roboflow API key to the .env file:")
        print("   API_KEY=your_api_key_here")
        print("=" * 60)
    
    app.run(host='0.0.0.0', port=5000, debug=True)
