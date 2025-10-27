"""
Hemalyzer Backend API
Two-Stage Blood Cell Analysis Pipeline:
1. YOLOv8-NAS: Detect all blood cells (RBC, WBC, Platelets)
2. ConvNeXt: Classify each WBC (Normal vs Leukemia types)
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import torch
import torch.nn as nn
from ultralytics import YOLO
import cv2
import numpy as np
from PIL import Image
import io
import base64
import sys
from pathlib import Path
from torchvision import transforms
import traceback

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# ============================================================
# GLOBAL VARIABLES
# ============================================================
yolo_model = None
convnext_model = None
class_names = None
device = None
convnext_transform = None

# ============================================================
# MODEL INITIALIZATION
# ============================================================

def register_nas_modules():
    """Register custom NAS modules for YOLOv8"""
    try:
        # Add testing-grounds/references/michael to path
        references_path = Path(__file__).parent.parent / "testing-grounds" / "references" / "michael"
        if str(references_path) not in sys.path:
            sys.path.insert(0, str(references_path))
        
        from nas_modules import register_nas_modules as register_fn
        success = register_fn()
        
        if success:
            print("✅ NAS modules registered successfully")
            return True
        else:
            print("⚠️ NAS module registration had issues")
            return False
    except Exception as e:
        print(f"❌ Error registering NAS modules: {e}")
        traceback.print_exc()
        return False


def load_convnext_model():
    """Load ConvNeXt leukemia classification model"""
    global convnext_model, class_names, device, convnext_transform
    
    try:
        # Import ConvNeXt architecture
        references_path = Path(__file__).parent.parent / "testing-grounds" / "references" / "michael"
        if str(references_path) not in sys.path:
            sys.path.insert(0, str(references_path))
        
        from convnext_wbc_classifier import convnext_base
        
        # Initialize model
        convnext_model = convnext_base(weights=None)
        
        # Modify classifier for 5 classes
        num_classes = 5
        in_features = 1024
        convnext_model.classifier[2] = nn.Linear(in_features, num_classes)
        
        # Load checkpoint
        model_path = Path(__file__).parent / "models" / "best_leukemia_model.pth"
        checkpoint = torch.load(model_path, map_location='cpu', weights_only=False)
        
        if isinstance(checkpoint, dict) and 'model_state_dict' in checkpoint:
            convnext_model.load_state_dict(checkpoint['model_state_dict'])
            class_names = checkpoint.get('class_names', [
                'Normal',
                'Acute Lymphoblastic Leukemia',
                'Acute Myeloid Leukemia',
                'Chronic Lymphocytic Leukemia',
                'Chronic Myeloid Leukemia'
            ])
            print(f"✅ ConvNeXt loaded from epoch {checkpoint.get('epoch', 'unknown')}")
        else:
            convnext_model.load_state_dict(checkpoint)
            class_names = [
                'Normal',
                'Acute Lymphoblastic Leukemia',
                'Acute Myeloid Leukemia',
                'Chronic Lymphocytic Leukemia',
                'Chronic Myeloid Leukemia'
            ]
        
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
        print(f"   Classes: {class_names}")
        return True
        
    except Exception as e:
        print(f"❌ Error loading ConvNeXt model: {e}")
        traceback.print_exc()
        return False


def load_yolo_model():
    """Load YOLOv8-NAS blood cell detection model"""
    global yolo_model
    
    try:
        model_path = Path(__file__).parent / "models" / "best.pt"
        yolo_model = YOLO(str(model_path))
        
        print("✅ YOLOv8-NAS model loaded successfully")
        print(f"   Classes: {yolo_model.names}")
        return True
        
    except Exception as e:
        print(f"❌ Error loading YOLOv8 model: {e}")
        traceback.print_exc()
        return False


def initialize_models():
    """Initialize all models on startup"""
    print("\n" + "="*70)
    print("🔬 INITIALIZING HEMALYZER BACKEND")
    print("="*70 + "\n")
    
    print("Step 1: Registering NAS modules...")
    if not register_nas_modules():
        print("⚠️ NAS module registration failed - YOLOv8 may not load correctly")
    
    print("\nStep 2: Loading YOLOv8 detection model...")
    if not load_yolo_model():
        return False
    
    print("\nStep 3: Loading ConvNeXt classification model...")
    if not load_convnext_model():
        return False
    
    print("\n" + "="*70)
    print("✅ ALL MODELS LOADED - Backend Ready!")
    print("="*70 + "\n")
    return True


# ============================================================
# INFERENCE FUNCTIONS
# ============================================================

def classify_wbc_crop(wbc_crop_pil):
    """
    Classify a single WBC using ConvNeXt
    
    Args:
        wbc_crop_pil: PIL Image of WBC crop
        
    Returns:
        dict: {class: str, confidence: float, probabilities: dict}
    """
    if convnext_model is None:
        return None
    
    try:
        # Apply transforms
        wbc_tensor = convnext_transform(wbc_crop_pil).unsqueeze(0).to(device)
        
        # Get prediction
        with torch.no_grad():
            outputs = convnext_model(wbc_tensor)
            probabilities = torch.softmax(outputs, dim=1)
            confidence, predicted_idx = torch.max(probabilities, 1)
        
        predicted_class = class_names[predicted_idx.item()]
        confidence_score = float(confidence.item())
        
        # Get all class probabilities
        probs_dict = {
            cls_name: float(prob) 
            for cls_name, prob in zip(class_names, probabilities[0].cpu().numpy())
        }
        
        return {
            'class': predicted_class,
            'confidence': confidence_score,
            'probabilities': probs_dict
        }
        
    except Exception as e:
        print(f"Error classifying WBC: {e}")
        traceback.print_exc()
        return None


def process_blood_smear(image_bytes, conf_threshold=0.25, iou_threshold=0.45):
    """
    Two-stage pipeline: YOLOv8 detection → ConvNeXt classification
    
    Args:
        image_bytes: Raw image bytes
        conf_threshold: Detection confidence threshold
        iou_threshold: IoU threshold for NMS
        
    Returns:
        dict: Analysis results with detections and classifications
    """
    try:
        # Convert bytes to PIL Image
        image = Image.open(io.BytesIO(image_bytes))
        
        # Convert to numpy array for OpenCV
        image_np = np.array(image)
        if len(image_np.shape) == 2:  # Grayscale
            image_np = cv2.cvtColor(image_np, cv2.COLOR_GRAY2RGB)
        elif image_np.shape[2] == 4:  # RGBA
            image_np = cv2.cvtColor(image_np, cv2.COLOR_RGBA2RGB)
        
        # ========== STAGE 1: YOLOv8 Detection ==========
        results = yolo_model.predict(
            source=image_np,
            conf=conf_threshold,
            iou=iou_threshold,
            imgsz=640,
            device='cuda' if torch.cuda.is_available() else 'cpu',
            verbose=False
        )
        
        result = results[0]
        boxes = result.boxes
        
        # Parse detections
        detections = {
            'total': len(boxes),
            'cells': [],
            'counts': {
                'RBC': 0,
                'WBC': 0,
                'Platelets': 0
            }
        }
        
        wbc_boxes = []
        
        # Calculate typical sizes for validation
        all_boxes_sizes = []
        for box in boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            width = x2 - x1
            height = y2 - y1
            area = width * height
            all_boxes_sizes.append(area)
        
        # Get median size to distinguish WBCs (typically larger than RBCs)
        median_area = np.median(all_boxes_sizes) if len(all_boxes_sizes) > 0 else 0
        
        for box in boxes:
            cls_id = int(box.cls[0])
            cls_name = yolo_model.names.get(cls_id, f"Class_{cls_id}")
            confidence = float(box.conf[0])
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            
            # Calculate box size
            width = x2 - x1
            height = y2 - y1
            area = width * height
            
            detection = {
                'class': cls_name,
                'confidence': confidence,
                'bbox': [float(x1), float(y1), float(x2), float(y2)]
            }
            
            detections['cells'].append(detection)
            
            # Count by cell type with size validation
            if cls_name.upper() == 'WBC':
                # WBCs should be larger than median (typically 2-3x larger than RBCs)
                # Only count as WBC if area is at least 1.5x the median
                if area >= median_area * 1.5:
                    detections['counts']['WBC'] += 1
                    wbc_boxes.append((box, detection))
                else:
                    # Likely a misclassified RBC - recount as RBC
                    detections['counts']['RBC'] += 1
                    detection['class'] = 'RBC'  # Correct the class
            elif cls_name.upper() == 'RBC':
                detections['counts']['RBC'] += 1
            elif cls_name.upper() in ['PLATELET', 'PLATELETS']:
                detections['counts']['Platelets'] += 1
        
        # ========== STAGE 2: ConvNeXt WBC Classification ==========
        wbc_classifications = []
        
        if len(wbc_boxes) > 0 and convnext_model is not None:
            for idx, (box, detection) in enumerate(wbc_boxes, 1):
                x1, y1, x2, y2 = map(int, detection['bbox'])
                
                # Add padding (10%)
                h, w = image_np.shape[:2]
                pad_x = int((x2 - x1) * 0.1)
                pad_y = int((y2 - y1) * 0.1)
                
                x1_padded = max(0, x1 - pad_x)
                y1_padded = max(0, y1 - pad_y)
                x2_padded = min(w, x2 + pad_x)
                y2_padded = min(h, y2 + pad_y)
                
                # Crop WBC
                wbc_crop = image_np[y1_padded:y2_padded, x1_padded:x2_padded]
                wbc_crop_pil = Image.fromarray(wbc_crop)
                
                # Classify
                classification = classify_wbc_crop(wbc_crop_pil)
                
                if classification:
                    wbc_classifications.append({
                        'wbc_id': idx,
                        'bbox': detection['bbox'],
                        'detection_confidence': detection['confidence'],
                        'classification': classification['class'],
                        'classification_confidence': classification['confidence'],
                        'probabilities': classification['probabilities']
                    })
        
        # Generate custom annotated image with clean colored boxes
        # image_np is already in RGB format, so we work directly with it
        annotated_img = image_np.copy()
        
        # Define colors for each cell type (RGB format - image_np is RGB)
        colors = {
            'RBC': (255, 100, 100),      # Light Red
            'WBC': (100, 255, 100),      # Light Green (will be overridden by classification)
            'Platelet': (255, 200, 100), # Light Orange
            'Platelets': (255, 200, 100) # Light Orange
        }
        
        # Colors for WBC classifications (RGB format)
        wbc_classification_colors = {
            'Normal': (100, 255, 100),         # Green
            'Acute Lymphocytic Leukemia': (255, 100, 100), # Red
            'Acute Myeloid Leukemia': (255, 100, 100),       # Red
            'Chronic Lymphocytic Leukemia': (255, 100, 100), # Red
            'Chronic Myeloid Leukemia': (255, 100, 100)      # Red
        }
        
        # Create a mapping of WBC bbox to classification color
        wbc_color_map = {}
        for wbc in wbc_classifications:
            bbox_key = tuple(wbc['bbox'])
            classification = wbc['classification']
            wbc_color_map[bbox_key] = wbc_classification_colors.get(classification, (100, 255, 100))
        
        # Convert to BGR for OpenCV drawing operations
        annotated_img_bgr = cv2.cvtColor(annotated_img, cv2.COLOR_RGB2BGR)
        
        # Draw boxes without labels
        for detection in detections['cells']:
            x1, y1, x2, y2 = map(int, detection['bbox'])
            cls_name = detection['class']
            
            # Check if this is a WBC with classification
            bbox_key = tuple(detection['bbox'])
            if cls_name.upper() == 'WBC' and bbox_key in wbc_color_map:
                color_rgb = wbc_color_map[bbox_key]
            else:
                color_rgb = colors.get(cls_name, (255, 255, 255))
            
            # Convert RGB to BGR for OpenCV
            color_bgr = (color_rgb[2], color_rgb[1], color_rgb[0])
            
            # Draw rectangle (box thickness = 2)
            cv2.rectangle(annotated_img_bgr, (x1, y1), (x2, y2), color_bgr, 2)
        
        # Convert back to RGB for frontend
        annotated_img_rgb = cv2.cvtColor(annotated_img_bgr, cv2.COLOR_BGR2RGB)
        
        # Convert to base64 for frontend
        pil_img = Image.fromarray(annotated_img_rgb)
        buffered = io.BytesIO()
        pil_img.save(buffered, format="JPEG")
        img_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
        
        # Summary statistics
        leukemia_summary = {}
        for wbc in wbc_classifications:
            cls = wbc['classification']
            leukemia_summary[cls] = leukemia_summary.get(cls, 0) + 1
        
        return {
            'success': True,
            'stage1_detection': detections,
            'stage2_classification': wbc_classifications,
            'summary': {
                'total_cells': detections['total'],
                'cell_counts': detections['counts'],
                'wbc_classifications': leukemia_summary
            },
            'annotated_image': img_base64
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

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'yolo_loaded': yolo_model is not None,
        'convnext_loaded': convnext_model is not None,
        'device': str(device) if device else 'unknown'
    })


@app.route('/api/analyze', methods=['POST'])
def analyze_blood_smear():
    """
    Main endpoint for blood smear analysis
    
    Expected: multipart/form-data with 'image' file
    Optional: conf_threshold, iou_threshold
    
    Returns: JSON with detections and classifications
    """
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
    """Get information about loaded models"""
    return jsonify({
        'yolo': {
            'loaded': yolo_model is not None,
            'classes': yolo_model.names if yolo_model else None
        },
        'convnext': {
            'loaded': convnext_model is not None,
            'classes': class_names if class_names else None,
            'device': str(device) if device else None
        }
    })


# ============================================================
# MAIN
# ============================================================

if __name__ == '__main__':
    # Initialize models before starting server
    if initialize_models():
        print("\n🚀 Starting Flask server on http://localhost:5000")
        app.run(debug=True, host='0.0.0.0', port=5000)
    else:
        print("\n❌ Failed to initialize models. Server not started.")
        sys.exit(1)
