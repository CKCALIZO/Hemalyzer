"""
Hemalyzer Backend API
Two-Stage Blood Cell Analysis Pipeline:
1. YOLOv8: Detect all blood cells (RBC, WBC, Platelets)
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
        
        # Load checkpoint first to determine number of classes
        model_path = Path(__file__).parent / "models" / "best_leukemia_model (2).pth"
        checkpoint = torch.load(model_path, map_location='cpu', weights_only=False)
        
        # Get number of classes from checkpoint
        if isinstance(checkpoint, dict) and 'num_classes' in checkpoint:
            num_classes = checkpoint['num_classes']
            class_names = checkpoint.get('class_names', [])
        else:
            # Fallback to 5 classes if not in checkpoint
            num_classes = 5
            class_names = [
                'Normal',
                'Acute Lymphoblastic Leukemia',
                'Acute Myeloid Leukemia',
                'Chronic Lymphocytic Leukemia',
                'Chronic Myeloid Leukemia'
            ]
        
        # Initialize model
        convnext_model = convnext_base(weights=None)
        
        # Modify classifier for the correct number of classes
        in_features = 1024  # ConvNeXt Base has 1024 features
        convnext_model.classifier[2] = nn.Linear(in_features, num_classes)
        
        # Load trained weights
        if isinstance(checkpoint, dict) and 'model_state_dict' in checkpoint:
            convnext_model.load_state_dict(checkpoint['model_state_dict'])
            print(f"✅ ConvNeXt loaded from epoch {checkpoint.get('epoch', 'unknown')}")
            if 'val_acc' in checkpoint:
                print(f"   Validation Accuracy: {checkpoint['val_acc']:.2f}%")
        else:
            convnext_model.load_state_dict(checkpoint)
        
        # Move to device and set eval mode
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        convnext_model = convnext_model.to(device)
        convnext_model.eval()
        
        # Define transforms (must match training transforms)
        convnext_transform = transforms.Compose([
            transforms.Resize((384, 384)),  # Match training config
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
        
        print(f"✅ ConvNeXt model ready on {device}")
        print(f"   Number of classes: {num_classes}")
        print(f"   Classes: {class_names[:5]}..." if len(class_names) > 5 else f"   Classes: {class_names}")
        return True
        
    except Exception as e:
        print(f"❌ Error loading ConvNeXt model: {e}")
        traceback.print_exc()
        return False


def load_yolo_model(model_name="best (2).pt"):
    """Load YOLOv8 blood cell detection model"""
    global yolo_model
    
    try:
        model_path = Path(__file__).parent / "models" / model_name
        
        # Check if model file exists
        if not model_path.exists():
            print(f"❌ Model file not found: {model_path}")
            return False
        
        print(f"   Loading model: {model_name}")
        yolo_model = YOLO(str(model_path))
        
        print("✅ YOLOv8 model loaded successfully")
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
    
    print("Step 1: Loading YOLOv8 detection model...")
    # Try to load the primary model first, with fallback
    if not load_yolo_model("best (2).pt"):
        print("\n⚠️  Failed to load 'best (2).pt', trying 'best.pt'...")
        if not load_yolo_model("best.pt"):
            print("\n❌ Could not load any YOLO model")
            return False
        else:
            print("✅ Successfully loaded fallback model 'best.pt'")
    
    print("\nStep 2: Loading ConvNeXt classification model...")
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


def process_blood_smear(image_bytes, conf_threshold=0.01, iou_threshold=0.2):
    """
    Two-stage pipeline: YOLOv8 detection → ConvNeXt classification
    
    Args:
        image_bytes: Raw image bytes
        conf_threshold: Detection confidence threshold (FORCED to 0.01 for maximum detection)
        iou_threshold: IoU threshold for NMS (FORCED to 0.2 for less suppression)
        
    Returns:
        dict: Analysis results with detections and classifications
    """
    # Increase confidence threshold to filter out misclassifications
    conf_threshold = 0.15  # Higher threshold to reduce false positives
    iou_threshold = 0.3    # Standard IoU for NMS
    
    try:
        # Convert bytes to PIL Image
        image = Image.open(io.BytesIO(image_bytes))
        original_size = image.size
        
        # Convert to numpy array for OpenCV
        image_np = np.array(image)
        if len(image_np.shape) == 2:  # Grayscale
            image_np = cv2.cvtColor(image_np, cv2.COLOR_GRAY2RGB)
        elif image_np.shape[2] == 4:  # RGBA
            image_np = cv2.cvtColor(image_np, cv2.COLOR_RGBA2RGB)
        
        # Debug: Print processing parameters
        print(f"\n{'='*70}")
        print(f"🔍 PROCESSING IMAGE")
        print(f"{'='*70}")
        print(f"📐 Original image size: {original_size} (W x H)")
        print(f"📐 Array shape: {image_np.shape}")
        print(f"⚙️  Confidence threshold: {conf_threshold}")
        print(f"⚙️  IoU threshold: {iou_threshold}")
        print(f"⚙️  Image size for inference: 640")
        print(f"⚙️  Max detections: 2000")
        print(f"⚙️  Agnostic NMS: True")
        
        # ========== STAGE 1: YOLOv8 Detection ==========
        # Using aggressive parameters to maximize detection
        results = yolo_model.predict(
            source=image_np,
            conf=conf_threshold,
            iou=iou_threshold,
            imgsz=640,
            max_det=2000,  # Further increased to capture more cells
            agnostic_nms=True,  # Enable class-agnostic NMS (don't suppress across classes)
            device='cuda' if torch.cuda.is_available() else 'cpu',
            verbose=True  # Enable to see YOLO's internal processing
        )
        
        result = results[0]
        boxes = result.boxes
        
        # CRITICAL DEBUG: Check what YOLO actually detected BEFORE any filtering
        print(f"\n🔍 RAW YOLO OUTPUT ANALYSIS:")
        print(f"   - Results object type: {type(result)}")
        print(f"   - Total boxes returned: {len(boxes)}")
        if hasattr(result, 'orig_shape'):
            print(f"   - Original shape: {result.orig_shape}")
        if hasattr(result, 'boxes') and hasattr(result.boxes, 'data'):
            print(f"   - Boxes data shape: {result.boxes.data.shape}")
            print(f"   - Box data sample (first 3): {result.boxes.data[:3] if len(result.boxes.data) > 0 else 'None'}")
        
        # Debug: Print unique class names detected with counts and confidence stats
        if len(boxes) > 0:
            class_counts = {}
            all_confidences = []
            for box in boxes:
                cls_name = yolo_model.names.get(int(box.cls[0]))
                class_counts[cls_name] = class_counts.get(cls_name, 0) + 1
                all_confidences.append(float(box.conf[0]))
            
            print(f"\n✅ Detected {len(boxes)} total cells:")
            for cls, count in class_counts.items():
                print(f"   - {cls}: {count}")
            
            # Confidence statistics
            conf_array = np.array(all_confidences)
            print(f"📈 Confidence stats:")
            print(f"   - Min: {conf_array.min():.3f}")
            print(f"   - Max: {conf_array.max():.3f}")
            print(f"   - Mean: {conf_array.mean():.3f}")
            print(f"   - Median: {np.median(conf_array):.3f}")
            print(f"{'='*70}\n")
        else:
            print(f"⚠️  WARNING: No cells detected!")
            print(f"   This could mean:")
            print(f"   1. Confidence threshold ({conf_threshold}) is too high")
            print(f"   2. Image quality or format issues")
            print(f"   3. Model expects different image preprocessing")
            print(f"{'='*70}\n")
        
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
        
        # Calculate sizes just for debugging/statistics
        all_boxes_sizes = []
        class_sizes = {'WBC': [], 'RBC': [], 'Platelets': []}
        
        for box in boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            width = x2 - x1
            height = y2 - y1
            area = width * height
            all_boxes_sizes.append(area)
            
            # Track sizes by YOLO's classification (for statistics only)
            cls_id = int(box.cls[0])
            cls_name = yolo_model.names.get(cls_id, f"Class_{cls_id}")
            cls_name_normalized = cls_name.upper().replace(' ', '').replace('_', '')
            
            if 'WBC' in cls_name_normalized or 'WHITEBLOODCELL' in cls_name_normalized:
                class_sizes['WBC'].append(area)
            elif 'RBC' in cls_name_normalized or 'REDBLOODCELL' in cls_name_normalized:
                class_sizes['RBC'].append(area)
            elif 'PLATELET' in cls_name_normalized:
                class_sizes['Platelets'].append(area)
        
        # Print size statistics (informational only, not used for filtering)
        if len(all_boxes_sizes) > 0:
            print(f"\n📊 Size Statistics (informational):")
            print(f"   Total cells: {len(all_boxes_sizes)}")
            for cell_type, areas in class_sizes.items():
                if len(areas) > 0:
                    print(f"   {cell_type}: {len(areas)} cells, area range: {min(areas):.1f} - {max(areas):.1f}")
        
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
            
            # Classification with WBC validation
            cls_name_normalized = cls_name.upper().replace(' ', '').replace('_', '')
            
            # Log each detection for debugging
            cell_type = 'Unknown'
            if 'PLATELET' in cls_name_normalized:
                detections['counts']['Platelets'] += 1
                cell_type = 'Platelet'
            elif 'WBC' in cls_name_normalized or 'WHITEBLOODCELL' in cls_name_normalized:
                # WBC VALIDATION: Must be large enough AND confident enough
                # WBCs are typically 2-3x larger than RBCs (area > 800 is reasonable)
                # Also require higher confidence (> 0.25) to avoid false positives
                if area > 800 and confidence > 0.25:
                    detections['counts']['WBC'] += 1
                    wbc_boxes.append((box, detection))
                    cell_type = 'WBC (validated)'
                else:
                    # Likely a misclassified RBC - reclassify as RBC
                    detections['counts']['RBC'] += 1
                    cell_type = f'RBC (was WBC, area={area:.0f}, conf={confidence:.3f})'
                    # Update the detection class for correct coloring
                    detection['class'] = 'RBC'
                    print(f"   ⚠️ Rejected WBC (too small or low confidence): area={area:.0f}, conf={confidence:.3f}")
            elif 'RBC' in cls_name_normalized or 'REDBLOODCELL' in cls_name_normalized:
                detections['counts']['RBC'] += 1
                cell_type = 'RBC'
            else:
                detections['counts']['RBC'] += 1  # Default to RBC
                cell_type = 'RBC (default)'
            
            # Debug: Print each detection with details
            print(f"   📍 {cell_type}: conf={confidence:.3f}, area={area:.1f}, bbox=({x1:.0f},{y1:.0f},{x2:.0f},{y2:.0f})")
        
        # Debug: Print categorized counts
        print(f"\n📋 Final counts: WBC={detections['counts']['WBC']}, RBC={detections['counts']['RBC']}, Platelets={detections['counts']['Platelets']}")
        
        # ========== STAGE 2: ConvNeXt WBC Classification ==========
        wbc_classifications = []
        
        if len(wbc_boxes) > 0 and convnext_model is not None:
            print(f"\n🧬 Starting ConvNeXt classification for {len(wbc_boxes)} WBCs...")
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
            
            print(f"✅ Classified {len(wbc_classifications)} WBCs using ConvNeXt")
            if len(wbc_classifications) > 0:
                print(f"   Classifications: {[w['classification'] for w in wbc_classifications[:5]]}{'...' if len(wbc_classifications) > 5 else ''}")
        elif len(wbc_boxes) == 0:
            print(f"⚠️  No WBCs detected - skipping ConvNeXt classification")
        else:
            print(f"⚠️  ConvNeXt model not loaded - skipping WBC classification")
        
        # Generate custom annotated image with BOLD, DISTINCT colored boxes
        # image_np is already in RGB format, so we work directly with it
        annotated_img = image_np.copy()
        
        # Define BOLD, DISTINCT colors - SIMPLE 3-COLOR SCHEME
        # ALL WBCs get the same color regardless of classification
        colors = {
            'RBC': (255, 0, 0),         # PURE RED
            'WBC': (0, 255, 0),         # PURE GREEN (all WBCs)
            'Platelet': (255, 255, 0),  # BRIGHT YELLOW
            'Platelets': (255, 255, 0)  # BRIGHT YELLOW
        }
        
        # Convert to BGR for OpenCV drawing operations
        annotated_img_bgr = cv2.cvtColor(annotated_img, cv2.COLOR_RGB2BGR)
        
        # Function to get color based on cell type
        def get_cell_color(cls_name):
            """Get color for a cell based on its class name (normalized matching)"""
            cls_normalized = cls_name.upper().replace(' ', '').replace('_', '')
            
            # Check for WBC
            if 'WBC' in cls_normalized or 'WHITEBLOODCELL' in cls_normalized:
                return (0, 255, 0)  # Pure Green
            # Check for RBC
            elif 'RBC' in cls_normalized or 'REDBLOODCELL' in cls_normalized:
                return (255, 0, 0)  # Pure Red
            # Check for Platelet
            elif 'PLATELET' in cls_normalized:
                return (255, 255, 0)  # Bright Yellow
            # Default white
            else:
                return (255, 255, 255)  # White
        
        # Draw boxes without labels - ALL cells colored by type only
        for detection in detections['cells']:
            x1, y1, x2, y2 = map(int, detection['bbox'])
            cls_name = detection['class']
            
            # Use simple cell type color (WBC, RBC, or Platelet)
            color_rgb = get_cell_color(cls_name)
            
            # Convert RGB to BGR for OpenCV
            color_bgr = (color_rgb[2], color_rgb[1], color_rgb[0])
            
            # Draw rectangle with thinner boxes (thickness = 2)
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
                'wbc_classifications': leukemia_summary,
                'color_legend': {
                    'WBC': 'rgb(0, 255, 0)',      # Pure Green (all WBCs)
                    'RBC': 'rgb(255, 0, 0)',      # Pure Red
                    'Platelets': 'rgb(255, 255, 0)' # Bright Yellow
                }
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
        
        # Get optional parameters (using lower conf_threshold to match Roboflow defaults)
        conf_threshold = float(request.form.get('conf_threshold', 0.1))
        iou_threshold = float(request.form.get('iou_threshold', 0.3))  # Lower IoU for less NMS suppression
        
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
        },
        'default_params': {
            'conf_threshold': 0.1,
            'iou_threshold': 0.3,
            'max_det': 2000,
            'imgsz': 640,
            'agnostic_nms': True
        }
    })


@app.route('/api/test-detection', methods=['POST'])
def test_detection():
    """
    Test endpoint for diagnosing detection issues with multiple confidence levels
    
    Expected: multipart/form-data with 'image' file
    
    Returns: Detection counts at different confidence thresholds
    """
    try:
        if 'image' not in request.files:
            return jsonify({'success': False, 'error': 'No image file provided'}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'Empty filename'}), 400
        
        image_bytes = file.read()
        image = Image.open(io.BytesIO(image_bytes))
        image_np = np.array(image)
        
        if len(image_np.shape) == 2:
            image_np = cv2.cvtColor(image_np, cv2.COLOR_GRAY2RGB)
        elif image_np.shape[2] == 4:
            image_np = cv2.cvtColor(image_np, cv2.COLOR_RGBA2RGB)
        
        # Test with multiple confidence thresholds
        test_thresholds = [0.01, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3]
        results_summary = []
        
        for conf in test_thresholds:
            results = yolo_model.predict(
                source=image_np,
                conf=conf,
                iou=0.3,  # Lower IoU for less suppression
                imgsz=640,
                max_det=2000,
                agnostic_nms=True,
                device='cuda' if torch.cuda.is_available() else 'cpu',
                verbose=False
            )
            
            boxes = results[0].boxes
            class_counts = {}
            for box in boxes:
                cls_name = yolo_model.names.get(int(box.cls[0]))
                class_counts[cls_name] = class_counts.get(cls_name, 0) + 1
            
            results_summary.append({
                'conf_threshold': conf,
                'total_detections': len(boxes),
                'class_counts': class_counts
            })
        
        return jsonify({
            'success': True,
            'image_size': f"{image.size[0]}x{image.size[1]}",
            'results': results_summary,
            'recommendation': 'Use the conf_threshold that gives you the most balanced results'
        })
        
    except Exception as e:
        print(f"Error in test-detection endpoint: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


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
