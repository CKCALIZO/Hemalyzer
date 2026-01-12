"""
Hemalyzer Backend API
Blood Cell Analysis using Roboflow Inference API + ConvNeXt Classification
Model: bloodcell-hema (detection) + ConvNeXt (classification)
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
import traceback
import torch
import torch.nn as nn
from torchvision import transforms
from torchvision.models import convnext_base, ConvNeXt_Base_Weights

# Load environment variables from .env file
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# ============================================================
# GLOBAL VARIABLES FOR CONVNEXT
# ============================================================
convnext_model = None
wbc_class_names = None
sickle_cell_class_idx = None  # Index of Sickle Cell class for RBC detection
device = None
convnext_transform = None

# Confidence threshold for Sickle Cell detection (95%)
SICKLE_CELL_CONFIDENCE_THRESHOLD = 0.95

# ============================================================
# ROBOFLOW CONFIGURATION
# ============================================================
API_KEY = os.getenv("API_KEY", "").strip()
if not API_KEY:
    print("⚠️  Warning: API_KEY not found in .env file")

# Initialize Roboflow Inference Client
CLIENT = InferenceHTTPClient(
    api_url="https://serverless.roboflow.com",
    api_key=API_KEY
)

# Your Roboflow model ID
MODEL_ID = "bloodcell-hema/5"


# ============================================================
# CONVNEXT MODEL INITIALIZATION
# ============================================================

def load_convnext_model():
    """Load ConvNeXt classification model for WBC and RBC classification"""
    global convnext_model, wbc_class_names, rbc_class_names, device, convnext_transform
    
    try:
        # Model path
        model_path = os.path.join(os.path.dirname(__file__), 'best_leukemia_model.pth')
        
        if not os.path.exists(model_path):
            print(f"⚠️  ConvNeXt model not found at: {model_path}")
            return False
        
        # Load checkpoint
        checkpoint = torch.load(model_path, map_location='cpu', weights_only=False)
        
        # Get number of classes from checkpoint
        if isinstance(checkpoint, dict) and 'num_classes' in checkpoint:
            num_classes = checkpoint['num_classes']
            wbc_class_names = checkpoint.get('class_names', [])
        else:
            # Fallback classes matching training script 'Detailed' mode
            num_classes = 6
            wbc_class_names = [
                'Normal',
                'Acute Lymphoblastic Leukemia',
                'Acute Myeloid Leukemia',
                'Chronic Lymphocytic Leukemia',
                'Chronic Myeloid Leukemia',
                'Sickle Cell'
            ]
        
        # Sickle Cell class index (for RBC classification with high confidence threshold)
        global sickle_cell_class_idx
        sickle_cell_class_idx = None
        for idx, name in enumerate(wbc_class_names):
            if 'sickle' in name.lower():
                sickle_cell_class_idx = idx
                break
        print(f"   Sickle Cell class index: {sickle_cell_class_idx}")
        
        # Initialize model using torchvision's ConvNeXt
        convnext_model = convnext_base(weights=None)
        
        # Modify classifier for the correct number of classes
        in_features = 1024  # ConvNeXt Base has 1024 features
        convnext_model.classifier[2] = nn.Linear(in_features, num_classes)
        
        # Load trained weights
        if isinstance(checkpoint, dict) and 'model_state_dict' in checkpoint:
            convnext_model.load_state_dict(checkpoint['model_state_dict'])
            print(f"✅ ConvNeXt loaded from epoch {checkpoint.get('epoch', 'unknown')}")
        else:
            convnext_model.load_state_dict(checkpoint)
        
        # Move to device and set eval mode
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        convnext_model = convnext_model.to(device)
        convnext_model.eval()
        
        # Define transforms
        convnext_transform = transforms.Compose([
            transforms.Resize((384, 384)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
        
        print(f"✅ ConvNeXt model ready on {device}")
        print(f"   Number of classes: {num_classes}")
        print(f"   WBC Classes: {wbc_class_names}")
        return True
        
    except Exception as e:
        print(f"❌ Error loading ConvNeXt model: {e}")
        traceback.print_exc()
        return False


def classify_cell_crop(cell_crop_pil, cell_type='WBC'):
    """
    Classify a single cell crop using ConvNeXt
    
    Args:
        cell_crop_pil: PIL Image of cell crop
        cell_type: 'WBC' or 'RBC'
        
    Returns:
        dict: {class: str, confidence: float, probabilities: dict, is_sickle_cell: bool}
    """
    if convnext_model is None:
        return None
    
    try:
        # Apply transforms
        cell_tensor = convnext_transform(cell_crop_pil).unsqueeze(0).to(device)
        
        # Get prediction
        with torch.no_grad():
            outputs = convnext_model(cell_tensor)
            probabilities = torch.softmax(outputs, dim=1)
            confidence, predicted_idx = torch.max(probabilities, 1)
        
        predicted_class = wbc_class_names[predicted_idx.item()]
        confidence_score = float(confidence.item())
        
        # Get all class probabilities
        probs_dict = {
            cls_name: float(prob) 
            for cls_name, prob in zip(wbc_class_names, probabilities[0].cpu().numpy())
        }
        
        # For RBC: Check specifically for Sickle Cell with HIGH confidence threshold
        is_sickle_cell = False
        sickle_cell_confidence = 0.0
        
        if cell_type == 'RBC' and sickle_cell_class_idx is not None:
            sickle_cell_confidence = float(probabilities[0][sickle_cell_class_idx].cpu().numpy())
            # Only consider it a Sickle Cell if:
            # 1. The predicted class IS Sickle Cell, AND
            # 2. The confidence is >= 95%
            is_sickle_cell = (
                predicted_idx.item() == sickle_cell_class_idx and 
                sickle_cell_confidence >= SICKLE_CELL_CONFIDENCE_THRESHOLD
            )
        
        return {
            'class': predicted_class,
            'confidence': confidence_score,
            'probabilities': probs_dict,
            'is_sickle_cell': is_sickle_cell,
            'sickle_cell_confidence': sickle_cell_confidence
        }
        
    except Exception as e:
        print(f"Error classifying cell: {e}")
        traceback.print_exc()
        return None


# ============================================================
# INFERENCE FUNCTION
# ============================================================

def process_blood_smear(image_bytes, conf_threshold=0.2, iou_threshold=0.2):
    """
    Process blood smear image using Roboflow inference
    
    DETECTION SETTINGS:
    - conf_threshold: 0.2 (20% confidence)
    - iou_threshold: 0.2 (20% overlap threshold)
    
    Args:
        image_bytes: Raw image bytes
        conf_threshold: Detection confidence threshold (default 0.2 = 20%)
        iou_threshold: IoU threshold for NMS (default 0.2 = 20% overlap)
        
    Returns:
        dict: Analysis results with detections
    """
    try:
        # Convert bytes to numpy array
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            return {'success': False, 'error': 'Invalid image format'}
        
        # Convert to RGB for display
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        original_h, original_w = image.shape[:2]
        
        print(f"\n{'='*60}")
        print(f"🔍 PROCESSING IMAGE WITH ROBOFLOW")
        print(f"{'='*60}")
        print(f"📐 Image size: {original_w} x {original_h}")
        print(f"⚙️  Confidence threshold: {conf_threshold}")
        print(f"⚙️  IoU threshold: {iou_threshold}")
        print(f"📦 Model: {MODEL_ID}")
        
        # Convert image to base64 for Roboflow API
        _, buffer = cv2.imencode('.jpg', image)
        image_base64 = base64.b64encode(buffer).decode('utf-8')
        
        # Run inference using Roboflow
        # Note: confidence and overlap thresholds are applied server-side by Roboflow
        result = CLIENT.infer(image_base64, model_id=MODEL_ID)
        
        print(f"📦 Roboflow response received")
        print(f"🔍 Raw response keys: {result.keys() if isinstance(result, dict) else type(result)}")
        
        # Parse predictions
        predictions = result.get('predictions', [])
        
        print(f"✅ Raw detections: {len(predictions)}")
        
        # Process detections
        detections = {
            'total': 0,
            'cells': [],
            'counts': {
                'RBC': 0,
                'WBC': 0,
                'Platelets': 0
            }
        }
        
        # Save CLEAN image for cropping cells (before any annotations)
        image_rgb_clean = image_rgb.copy()
        
        # Colors for different cell types (RGB format)
        colors = {
            'RBC': (255, 0, 0),        # Red
            'WBC': (0, 255, 0),        # Green
            'Platelets': (255, 255, 0), # Yellow
            'Platelet': (255, 255, 0),  # Yellow (alternate name)
        }
        default_color = (255, 255, 255)  # White for unknown
        
        for idx, pred in enumerate(predictions):
            class_name = pred.get('class', 'Unknown')
            confidence = pred.get('confidence', 0)
            
            print(f"   Detection {idx+1}: {class_name} - confidence: {confidence:.3f}")
            
            # Apply manual confidence filtering if needed
            if confidence < conf_threshold:
                print(f"      Skipped (below threshold {conf_threshold})")
                continue
            
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
            detection = {
                'class': class_name,
                'confidence': round(confidence, 3),
                'bbox': [float(x1), float(y1), float(x2), float(y2)]
            }
            detections['cells'].append(detection)
            detections['total'] += 1
            
            # Update counts (normalize class names)
            cls_normalized = class_name.upper().replace(' ', '').replace('_', '')
            if 'WBC' in cls_normalized or 'WHITEBLOODCELL' in cls_normalized:
                detections['counts']['WBC'] += 1
                detection['cell_type'] = 'WBC'
            elif 'RBC' in cls_normalized or 'REDBLOODCELL' in cls_normalized:
                detections['counts']['RBC'] += 1
                detection['cell_type'] = 'RBC'
            elif 'PLATELET' in cls_normalized:
                detections['counts']['Platelets'] += 1
                detection['cell_type'] = 'Platelet'
            else:
                detection['cell_type'] = 'Unknown'
            
            # Draw bounding box on image
            color = colors.get(class_name, default_color)
            # Convert RGB to BGR for OpenCV
            color_bgr = (color[2], color[1], color[0])
            cv2.rectangle(image_rgb, (x1, y1), (x2, y2), color, 1)  # Thickness = 1 (thinner)
            
            # Draw label with smaller font
            label = f"{class_name}: {confidence:.2f}"
            font_scale = 0.3  # Smaller font (was 0.5)
            thickness = 1  # Thinner text (was 2)
            label_size, _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness)
            cv2.rectangle(image_rgb, (x1, y1 - label_size[1] - 4), 
                         (x1 + label_size[0], y1), color, -1)
            cv2.putText(image_rgb, label, (x1, y1 - 2), 
                       cv2.FONT_HERSHEY_SIMPLEX, font_scale, (0, 0, 0), thickness)
        
        print(f"📊 Final counts: WBC={detections['counts']['WBC']}, "
              f"RBC={detections['counts']['RBC']}, "
              f"Platelets={detections['counts']['Platelets']}")
        print(f"{'='*60}\n")
        
        # ========== STAGE 2: ConvNeXt Classification ==========
        wbc_classifications = []
        rbc_classifications = []
        cropped_cells = []  # Store cropped images for frontend
        
        if convnext_model is not None:
            print(f"\n🧬 Starting ConvNeXt classification...")
            
            wbc_idx = 0
            rbc_idx = 0
            
            for detection in detections['cells']:
                cell_type = detection.get('cell_type', 'Unknown')
                x1, y1, x2, y2 = map(int, detection['bbox'])
                
                # Add padding (15% for better context)
                h, w = image_rgb_clean.shape[:2]
                pad_x = int((x2 - x1) * 0.15)
                pad_y = int((y2 - y1) * 0.15)
                
                x1_padded = max(0, x1 - pad_x)
                y1_padded = max(0, y1 - pad_y)
                x2_padded = min(w, x2 + pad_x)
                y2_padded = min(h, y2 + pad_y)
                
                # Crop cell from CLEAN image (no bounding boxes)
                cell_crop = image_rgb_clean[y1_padded:y2_padded, x1_padded:x2_padded]
                
                if cell_crop.size == 0:
                    continue
                
                # Improve crop quality: resize with high-quality interpolation
                cell_crop_pil = Image.fromarray(cell_crop)
                
                # Resize to a consistent size with high-quality resampling for better classification
                # Use LANCZOS for best quality downsampling
                target_size = 128  # Good size for display and classification
                cell_crop_pil = cell_crop_pil.resize((target_size, target_size), Image.LANCZOS)
                
                # Convert crop to base64 for frontend with higher quality
                crop_buffer = io.BytesIO()
                cell_crop_pil.save(crop_buffer, format='PNG')  # PNG for lossless quality
                crop_base64 = base64.b64encode(crop_buffer.getvalue()).decode('utf-8')
                
                # Classify WBC
                if cell_type == 'WBC':
                    wbc_idx += 1
                    classification = classify_cell_crop(cell_crop_pil, 'WBC')
                    
                    if classification:
                        wbc_class = classification['class']
                        wbc_confidence = classification['confidence']
                        
                        # CRITICAL: Exclude Sickle Cell predictions for WBCs
                        # Sickle Cell is an RBC condition, not WBC
                        # If predicted as Sickle Cell, use the highest non-Sickle Cell class instead
                        if 'sickle' in wbc_class.lower() and sickle_cell_class_idx is not None:
                            print(f"   ⚠️ WBC #{wbc_idx} predicted as Sickle Cell - using next best WBC class")
                            
                            # Get non-Sickle Cell probabilities and RE-NORMALIZE
                            probs = classification['probabilities']
                            non_sickle_probs = {
                                cls_name: prob 
                                for cls_name, prob in probs.items() 
                                if 'sickle' not in cls_name.lower()
                            }
                            
                            # Re-normalize probabilities to sum to 1.0 (100%)
                            total_prob = sum(non_sickle_probs.values())
                            if total_prob > 0:
                                normalized_probs = {
                                    cls_name: prob / total_prob 
                                    for cls_name, prob in non_sickle_probs.items()
                                }
                                
                                # Find highest probability after normalization
                                best_wbc_class = max(normalized_probs.items(), key=lambda x: x[1])
                                wbc_class = best_wbc_class[0]
                                wbc_confidence = best_wbc_class[1]
                                
                                print(f"      → Using {wbc_class} (normalized confidence: {wbc_confidence:.3f})")
                            else:
                                # Fallback to Normal if something goes wrong
                                wbc_class = 'Normal'
                                wbc_confidence = 1.0
                        
                        wbc_result = {
                            'wbc_id': wbc_idx,
                            'bbox': detection['bbox'],
                            'detection_confidence': detection['confidence'],
                            'classification': wbc_class,
                            'classification_confidence': wbc_confidence,
                            'probabilities': classification['probabilities'],
                            'cropped_image': crop_base64
                        }
                        wbc_classifications.append(wbc_result)
                        
                        # Add to cropped cells for display
                        cropped_cells.append({
                            'id': f'WBC_{wbc_idx}',
                            'cell_type': 'WBC',
                            'classification': wbc_class,
                            'confidence': wbc_confidence,
                            'cropped_image': crop_base64,
                            'is_abnormal': wbc_class != 'Normal'
                        })
                
                # Classify RBC - only show if it's a Sickle Cell with HIGH confidence (>=95%)
                elif cell_type == 'RBC':
                    rbc_idx += 1
                    classification = classify_cell_crop(cell_crop_pil, 'RBC')
                    
                    if classification:
                        # Use the is_sickle_cell flag from classification (requires 95% confidence)
                        is_sickle_cell = classification.get('is_sickle_cell', False)
                        sickle_confidence = classification.get('sickle_cell_confidence', 0.0)
                        
                        rbc_result = {
                            'rbc_id': rbc_idx,
                            'bbox': detection['bbox'],
                            'detection_confidence': detection['confidence'],
                            'classification': classification['class'],
                            'classification_confidence': classification['confidence'],
                            'sickle_cell_confidence': sickle_confidence,
                            'probabilities': classification['probabilities'],
                            'cropped_image': crop_base64,
                            'is_sickle_cell': is_sickle_cell
                        }
                        rbc_classifications.append(rbc_result)
                        
                        # Only add to cropped cells display if it's CONFIRMED Sickle Cell (>=95% confidence)
                        if is_sickle_cell:
                            cropped_cells.append({
                                'id': f'RBC_{rbc_idx}',
                                'cell_type': 'RBC',
                                'classification': 'Sickle Cell',
                                'confidence': sickle_confidence,
                                'cropped_image': crop_base64,
                                'is_abnormal': True
                            })
            
            print(f"✅ Classified {len(wbc_classifications)} WBCs")
            print(f"✅ Classified {len(rbc_classifications)} RBCs")
            sickle_count = sum(1 for r in rbc_classifications if r.get('is_sickle_cell', False))
            print(f"   Sickle Cells detected: {sickle_count}")
        else:
            print(f"⚠️  ConvNeXt model not loaded - skipping classification")
        
        # Convert annotated image to base64
        pil_image = Image.fromarray(image_rgb)
        buffer = io.BytesIO()
        pil_image.save(buffer, format='JPEG', quality=90)
        annotated_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        
        # Summary statistics for WBC classifications
        wbc_summary = {}
        for wbc in wbc_classifications:
            cls = wbc['classification']
            wbc_summary[cls] = wbc_summary.get(cls, 0) + 1
        
        # Count abnormal cells for quick summary
        abnormal_wbc_count = sum(1 for w in wbc_classifications if w['classification'] != 'Normal')
        sickle_cell_count = sum(1 for r in rbc_classifications if r.get('is_sickle_cell', False))
        
        return {
            'success': True,
            'stage1_detection': detections,
            'stage2_classification': wbc_classifications,
            'rbc_classifications': rbc_classifications,
            'cropped_cells': cropped_cells,  # For the new CellClassifications page
            'summary': {
                'total_cells': detections['total'],
                'cell_counts': detections['counts'],
                'wbc_classifications': wbc_summary,
                'abnormal_wbc_count': abnormal_wbc_count,
                'sickle_cell_count': sickle_cell_count,
                'color_legend': {
                    'WBC': 'rgb(0, 255, 0)',
                    'RBC': 'rgb(255, 0, 0)',
                    'Platelets': 'rgb(255, 255, 0)'
                }
            },
            'annotated_image': annotated_base64,
            'convnext_loaded': convnext_model is not None
        }
        
    except Exception as e:
        print(f"Error processing image: {e}")
        traceback.print_exc()
        return {
            'success': False,
            'error': str(e)
        }


# ============================================================
# API ENDPOINTS
# ============================================================

@app.route('/', methods=['GET'])
def home():
    """Root endpoint - backend status page"""
    return jsonify({
        'message': 'Hemalyzer Backend API',
        'status': 'running',
        'model': MODEL_ID,
        'endpoints': {
            'health': '/api/health',
            'analyze': '/api/analyze (POST)',
            'model_info': '/api/models/info',
            'test': '/api/test'
        },
        'frontend_url': 'http://localhost:5173/Hemalyzer',
        'note': 'This is the backend API. Access the frontend at the URL above.'
    })


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'model': MODEL_ID,
        'api_configured': bool(API_KEY),
        'convnext_loaded': convnext_model is not None,
        'device': str(device) if device else 'cpu'
    })


@app.route('/api/analyze', methods=['POST'])
def analyze_blood_smear():
    """
    Main endpoint for blood smear analysis
    
    Expected: multipart/form-data with 'image' file
    Optional: conf_threshold, iou_threshold
    
    Returns: JSON with detections
    """
    print("\n" + "="*60)
    print("🚨 ANALYZE REQUEST RECEIVED!")
    print("="*60)
    try:
        # Check if image was uploaded
        if 'image' not in request.files:
            return jsonify({
                'success': False,
                'error': 'No image file provided'
            }), 400
        
        file = request.files['image']
        
        if file.filename == '':
            return jsonify({
                'success': False,
                'error': 'Empty filename'
            }), 400
        
        # Get optional parameters
        conf_threshold = float(request.form.get('conf_threshold', 0.25))
        iou_threshold = float(request.form.get('iou_threshold', 0.45))
        
        # Read image bytes
        image_bytes = file.read()
        
        # Process image
        results = process_blood_smear(image_bytes, conf_threshold, iou_threshold)
        
        return jsonify(results)
        
    except Exception as e:
        print(f"Error in analyze endpoint: {e}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/models/info', methods=['GET'])
def models_info():
    """Get information about the model"""
    return jsonify({
        'model': {
            'id': MODEL_ID,
            'provider': 'Roboflow',
            'api_configured': bool(API_KEY)
        },
        'default_params': {
            'conf_threshold': 0.25,
            'iou_threshold': 0.45
        }
    })


@app.route('/api/test', methods=['GET'])
def test_endpoint():
    """Test endpoint to verify server is running"""
    return jsonify({
        'status': 'ok',
        'message': 'Backend is running!',
        'model': MODEL_ID,
        'timestamp': str(__import__('datetime').datetime.now())
    })


# ============================================================
# MAIN
# ============================================================

if __name__ == '__main__':
    print("\n" + "="*60)
    print("🩸 HEMALYZER BACKEND - Roboflow + ConvNeXt")
    print("="*60)
    print(f"📦 Detection Model: {MODEL_ID}")
    print(f"🔑 API Key configured: {'Yes' if API_KEY else 'No'}")
    print("="*60)
    
    if not API_KEY:
        print("\n⚠️  WARNING: No API key found!")
        print("   Please add your Roboflow API key to the .env file:")
        print("   API_KEY=your_api_key_here")
        print("="*60)
    
    # Load ConvNeXt model for cell classification
    print("\n🧬 Loading ConvNeXt classification model...")
    if load_convnext_model():
        print("✅ ConvNeXt model loaded successfully!")
    else:
        print("⚠️  ConvNeXt model not loaded - classification will be disabled")
    print("="*60)
    
    print("\n🚀 Starting Flask server on http://localhost:5000\n")
    app.run(debug=True, host='0.0.0.0', port=5000)
