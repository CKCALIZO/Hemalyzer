"""
ConvNeXt Classification Server
Runs ConvNeXt model on local PC and exposes API for remote classification

This server replaces Google Colab for classification workloads.
Exposes the same API endpoints as the Colab notebook for compatibility.

Usage:
1. Install dependencies: pip install flask flask-cors torch torchvision pillow opencv-python
2. Run server: python convnext_server.py
3. In separate terminal, run ngrok: ngrok http 5001
4. Copy ngrok URL and set as COLAB_MODEL_URL environment variable on Render

Requirements:
- Python 3.8+
- GPU recommended but not required
- Model file: backend/best_leukemia_model.pth
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import io
import base64
import traceback
import sys
import os

# Add backend directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

# Import ConvNeXt classifier
from convnext_classifier import classifier, load_convnext_model

app = Flask(__name__)
CORS(app)

# API Key for security (optional but recommended)
API_KEY = os.environ.get('API_KEY', 'hemalyzer-colab-2024')

def verify_api_key():
    """Verify API key from request headers"""
    provided_key = request.headers.get('X-API-Key', '')
    if provided_key != API_KEY:
        return False
    return True

@app.route('/', methods=['GET', 'HEAD'])
def root():
    """Root endpoint"""
    return jsonify({
        'status': 'ok',
        'service': 'ConvNeXt Classification Server',
        'version': '1.0'
    })

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint - matches Colab API"""
    try:
        return jsonify({
            'status': 'healthy',
            'model_loaded': classifier.is_loaded(),
            'device': str(classifier.device) if classifier.is_loaded() else 'unknown',
            'mode': 'local_pc'
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500

@app.route('/model_info', methods=['GET'])
def model_info():
    """Get model information - matches Colab API"""
    try:
        if not classifier.is_loaded():
            return jsonify({
                'error': 'Model not loaded'
            }), 503
        
        return jsonify({
            'model_loaded': True,
            'device': str(classifier.device),
            'classes': list(classifier.class_mapping.keys()) if hasattr(classifier, 'class_mapping') else [],
            'mode': 'local_pc'
        })
    except Exception as e:
        return jsonify({
            'error': str(e)
        }), 500

@app.route('/classify', methods=['POST'])
def classify_single():
    """Classify a single cell image - matches Colab API"""
    
    # Verify API key
    if not verify_api_key():
        return jsonify({'error': 'Invalid API key'}), 401
    
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        
        image_b64 = data.get('image')
        cell_type = data.get('cell_type', 'WBC')
        
        if not image_b64:
            return jsonify({'error': 'No image provided'}), 400
        
        # Decode base64 image
        try:
            img_bytes = base64.b64decode(image_b64)
            img_pil = Image.open(io.BytesIO(img_bytes)).convert('RGB')
        except Exception as e:
            return jsonify({'error': f'Failed to decode image: {str(e)}'}), 400
        
        # Classify
        if not classifier.is_loaded():
            return jsonify({'error': 'Model not loaded'}), 503
        
        result = classifier.classify(img_pil, cell_type)
        
        if not result:
            return jsonify({'error': 'Classification failed'}), 500
        
        return jsonify({
            'success': True,
            'result': result
        })
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500

@app.route('/classify_batch', methods=['POST'])
def classify_batch():
    """Classify a batch of cell images - matches Colab API"""
    
    # Verify API key
    if not verify_api_key():
        return jsonify({'error': 'Invalid API key'}), 401
    
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        
        images_b64 = data.get('images', [])
        cell_types = data.get('cell_types', [])
        
        if not images_b64:
            return jsonify({'error': 'No images provided'}), 400
        
        # Default cell types to WBC if not provided
        if not cell_types:
            cell_types = ['WBC'] * len(images_b64)
        
        # Ensure cell_types matches images length
        if len(cell_types) != len(images_b64):
            cell_types = cell_types * len(images_b64)
            cell_types = cell_types[:len(images_b64)]
        
        print(f"[ConvNeXt Server] Processing batch of {len(images_b64)} images...")
        
        # Decode images
        images_pil = []
        for i, img_b64 in enumerate(images_b64):
            try:
                img_bytes = base64.b64decode(img_b64)
                img_pil = Image.open(io.BytesIO(img_bytes)).convert('RGB')
                images_pil.append(img_pil)
            except Exception as e:
                print(f"[ConvNeXt Server] Failed to decode image {i}: {e}")
                images_pil.append(None)
        
        # Filter out None images
        valid_indices = [i for i, img in enumerate(images_pil) if img is not None]
        valid_images = [images_pil[i] for i in valid_indices]
        valid_cell_types = [cell_types[i] for i in valid_indices]
        
        if not valid_images:
            return jsonify({'error': 'No valid images to classify'}), 400
        
        # Classify batch
        if not classifier.is_loaded():
            return jsonify({'error': 'Model not loaded'}), 503
        
        results = classifier.classify_batch(
            valid_images,
            valid_cell_types,
            batch_size=16  # Adjust based on your GPU memory
        )
        
        # Reconstruct results array with None for failed images
        full_results = []
        result_idx = 0
        for i in range(len(images_b64)):
            if i in valid_indices:
                full_results.append(results[result_idx])
                result_idx += 1
            else:
                full_results.append({
                    'classification': 'error',
                    'confidence': 0.0,
                    'error': 'Failed to decode image'
                })
        
        print(f"[ConvNeXt Server] Batch classification complete: {len(full_results)} results")
        
        return jsonify({
            'success': True,
            'results': full_results
        })
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500

if __name__ == '__main__':
    print("=" * 60)
    print("ConvNeXt Classification Server")
    print("=" * 60)
    print()
    
    # Load model on startup
    print("Loading ConvNeXt model...")
    # Use absolute path to avoid path issues
    base_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(base_dir, 'backend', 'best_leukemia_model.pth')
    
    if not os.path.exists(model_path):
        print(f"ERROR: Model file not found at {model_path}")
        print("Please ensure best_leukemia_model.pth is in the backend/ directory")
        sys.exit(1)
    
    try:
        load_convnext_model(
            model_path=model_path,
            use_mixed_precision=True  # Enable for faster inference
        )
        print(f"✓ Model loaded successfully on {classifier.device}")
    except Exception as e:
        print(f"ERROR: Failed to load model: {e}")
        traceback.print_exc()
        sys.exit(1)
    
    print()
    print("Server Configuration:")
    print(f"  - Port: 5001")
    print(f"  - Device: {classifier.device}")
    print(f"  - API Key: {API_KEY}")
    print()
    print("Next steps:")
    print("  1. Keep this server running")
    print("  2. In a new terminal, run: ngrok http 5001")
    print("  3. Copy the ngrok URL (e.g., https://abc123.ngrok-free.app)")
    print("  4. Set COLAB_MODEL_URL on Render to that URL")
    print()
    print("=" * 60)
    print()
    
    # Run Flask server
    # Note: Set debug=False for production, use_reloader=False to prevent model reloading
    app.run(
        host='0.0.0.0',
        port=5001,
        debug=False,
        use_reloader=False,
        threaded=True
    )
