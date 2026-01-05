"""
Hemalyzer Backend API
Two-Stage Blood Cell Analysis Pipeline:
1. YOLO-NAS: Detect all blood cells (RBC, WBC, Platelets) - Using Super Gradients
2. ConvNeXt: Classify each WBC (Normal vs Leukemia types)

OPTIMIZED FOR MAXIMUM DETECTION (Compatible with train_yolonas_blood_cells_optimized.py):
- Confidence threshold: 0.01 (detect everything)
- IoU/Overlap threshold: 0.2 (20% - minimal NMS suppression)
- Image size: 1280px (matches training)
- Model: YOLO-NAS-L (best for small objects)
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import torch
import torch.nn as nn
import cv2
import numpy as np
from PIL import Image
import io
import base64
import sys
from pathlib import Path
from torchvision import transforms
import traceback

# Super Gradients for YOLO-NAS
from super_gradients.training import models
from super_gradients.training.models.detection_models.pp_yolo_e import PPYoloEPostPredictionCallback

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# ============================================================
# GLOBAL VARIABLES
# ============================================================
from typing import Optional, List, Any, Callable

yolonas_model: Optional[Any] = None
convnext_model: Optional[nn.Module] = None
leukemia_class_names: Optional[List[str]] = None
blood_cell_class_names: List[str] = ['Platelets', 'RBC', 'WBC']  # Must match training order in data.yaml
device: Optional[torch.device] = None
convnext_transform: Optional[Callable] = None

# ============================================================
# YOLO-NAS INFERENCE PARAMETERS 
# Matching train_yolonas_blood_cells_optimized.py for full compatibility
# ============================================================
YOLONAS_CONFIG = {
    'model_size': 'l',           # YOLO-NAS-L for best small object detection
    'img_size': 1280,            # High resolution for small cells (matches training)
    'conf_threshold': 0.01,      # Very low - detect everything (user requested)
    'iou_threshold': 0.2,        # 20% overlap threshold (user requested)
    'max_predictions': 800,      # Matches training script valid_metrics_list
    'nms_top_k': 1500,           # Matches training script PPYoloEPostPredictionCallback
    'num_classes': 3,            # Platelets, RBC, WBC
}

# ============================================================
# MODEL INITIALIZATION
# ============================================================

def load_convnext_model():
    """Load ConvNeXt leukemia classification model"""
    global convnext_model, leukemia_class_names, device, convnext_transform
    
    try:
        # Try to import ConvNeXt architecture (optional dependency)
        convnext_base_fn = None
        try:
            references_path = Path(__file__).parent.parent / "testing-grounds" / "references" / "michael"
            if str(references_path) not in sys.path:
                sys.path.insert(0, str(references_path))
            from convnext_wbc_classifier import convnext_base  # type: ignore
            convnext_base_fn = convnext_base
        except ImportError:
            print("⚠️  convnext_wbc_classifier module not found")
            print("   WBC classification will be disabled")
            return False
        
        if convnext_base_fn is None:
            return False
        
        # Load checkpoint first to determine number of classes
        model_path = Path(__file__).parent / "models" / "best_leukemia_model (2).pth"
        
        if not model_path.exists():
            print(f"⚠️  ConvNeXt model not found at {model_path}")
            print("   WBC classification will be skipped")
            return False
            
        checkpoint = torch.load(model_path, map_location='cpu', weights_only=False)
        
        # Get number of classes from checkpoint
        num_classes: int
        if isinstance(checkpoint, dict) and 'num_classes' in checkpoint:
            num_classes = checkpoint['num_classes']
            leukemia_class_names = checkpoint.get('class_names', [])
        else:
            # Fallback to 5 classes if not in checkpoint
            num_classes = 5
            leukemia_class_names = [
                'Normal',
                'Acute Lymphoblastic Leukemia',
                'Acute Myeloid Leukemia',
                'Chronic Lymphocytic Leukemia',
                'Chronic Myeloid Leukemia'
            ]
        
        # Initialize model using the imported function
        model = convnext_base_fn(weights=None)
        
        # Modify classifier for the correct number of classes
        in_features = 1024  # ConvNeXt Base has 1024 features
        model.classifier[2] = nn.Linear(in_features, num_classes)
        
        # Load trained weights
        if isinstance(checkpoint, dict) and 'model_state_dict' in checkpoint:
            model.load_state_dict(checkpoint['model_state_dict'])
            print(f"✅ ConvNeXt loaded from epoch {checkpoint.get('epoch', 'unknown')}")
            if 'val_acc' in checkpoint:
                print(f"   Validation Accuracy: {checkpoint['val_acc']:.2f}%")
        else:
            model.load_state_dict(checkpoint)
        
        # Move to device and set eval mode
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        model = model.to(device)
        model.eval()
        
        # Store in global
        convnext_model = model
        
        # Define transforms (must match training transforms)
        convnext_transform = transforms.Compose([
            transforms.Resize((384, 384)),  # Match training config
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
        
        print(f"✅ ConvNeXt model ready on {device}")
        print(f"   Number of classes: {num_classes}")
        if leukemia_class_names:
            class_display = leukemia_class_names[:5] if len(leukemia_class_names) > 5 else leukemia_class_names
            print(f"   Classes: {class_display}{'...' if len(leukemia_class_names) > 5 else ''}")
        return True
        
    except Exception as e:
        print(f"❌ Error loading ConvNeXt model: {e}")
        traceback.print_exc()
        return False


def load_yolonas_model(model_path_arg=None):
    """
    Load YOLO-NAS blood cell detection model trained with Super Gradients
    
    Compatible with models trained using train_yolonas_blood_cells_optimized.py
    Expected checkpoint format: .pth file from Super Gradients training
    """
    global yolonas_model, device
    
    try:
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        
        # Default model path - look for YOLO-NAS checkpoint
        model_path = model_path_arg
        if model_path is None:
            models_dir = Path(__file__).parent / "models"
            
            # Try different possible model names (in order of preference)
            # These match the output from train_yolonas_blood_cells_optimized.py
            possible_names = [
                "ckpt_best.pth",                           # Standard Super Gradients best checkpoint
                "yolonas_l_optimized_1280_ckpt_best.pth", # Full training script name
                "yolonas_best.pth",                        # Custom naming
                "blood_cell_yolonas.pth",                  # Alternative naming
            ]
            
            for name in possible_names:
                candidate = models_dir / name
                if candidate.exists():
                    model_path = candidate
                    break
            
            if model_path is None:
                print(f"❌ No YOLO-NAS model found in {models_dir}")
                print(f"   Expected one of: {possible_names}")
                print(f"\n   After training with train_yolonas_blood_cells_optimized.py,")
                print(f"   copy your checkpoint to: {models_dir / 'ckpt_best.pth'}")
                print(f"\n   Training output location:")
                print(f"   runs/blood_cell_detection/yolonas_l_optimized_1280/ckpt_best.pth")
                return False
        
        model_path = Path(model_path)
        if not model_path.exists():
            print(f"❌ Model file not found: {model_path}")
            return False
        
        print(f"   Loading YOLO-NAS model: {model_path.name}")
        print(f"   Model architecture: YOLO-NAS-{YOLONAS_CONFIG['model_size'].upper()}")
        print(f"   Training image size: {YOLONAS_CONFIG['img_size']}px")
        
        # Load YOLO-NAS model using Super Gradients
        # Architecture must match what was used in training script
        model = models.get(
            f"yolo_nas_{YOLONAS_CONFIG['model_size']}",
            num_classes=YOLONAS_CONFIG['num_classes'],
            checkpoint_path=str(model_path)
        )
        
        # Move to device and set to eval mode
        model = model.to(device)
        model.eval()
        
        # Store in global
        yolonas_model = model
        
        print(f"✅ YOLO-NAS-{YOLONAS_CONFIG['model_size'].upper()} model loaded successfully")
        print(f"   Device: {device}")
        print(f"   Classes: {blood_cell_class_names}")
        print(f"   Inference config: conf={YOLONAS_CONFIG['conf_threshold']}, iou={YOLONAS_CONFIG['iou_threshold']}")
        return True
        
    except Exception as e:
        print(f"❌ Error loading YOLO-NAS model: {e}")
        traceback.print_exc()
        return False


def initialize_models():
    """Initialize all models on startup"""
    print("\n" + "="*70)
    print("🔬 INITIALIZING HEMALYZER BACKEND")
    print("   YOLO-NAS Edition (Super Gradients)")
    print("="*70 + "\n")
    
    print("📋 Configuration (matching train_yolonas_blood_cells_optimized.py):")
    print(f"   • Model: YOLO-NAS-{YOLONAS_CONFIG['model_size'].upper()}")
    print(f"   • Image Size: {YOLONAS_CONFIG['img_size']}px (high resolution for small cells)")
    print(f"   • Confidence Threshold: {YOLONAS_CONFIG['conf_threshold']} (detect everything)")
    print(f"   • IoU/Overlap Threshold: {YOLONAS_CONFIG['iou_threshold']} (20% - minimal suppression)")
    print(f"   • Max Predictions: {YOLONAS_CONFIG['max_predictions']}")
    print(f"   • NMS Top-K: {YOLONAS_CONFIG['nms_top_k']}")
    print()
    
    print("Step 1: Loading YOLO-NAS detection model...")
    yolonas_loaded = load_yolonas_model()
    if not yolonas_loaded:
        print("\n⚠️  YOLO-NAS model not loaded - detection will not work")
        print("   Please place your trained model in backend/models/ckpt_best.pth")
    
    print("\nStep 2: Loading ConvNeXt classification model...")
    convnext_loaded = load_convnext_model()
    if not convnext_loaded:
        print("   ConvNeXt not loaded - WBC classification will be disabled")
    
    print("\n" + "="*70)
    print("✅ BACKEND INITIALIZATION COMPLETE")
    print("-"*70)
    if yolonas_model is not None:
        print(f"   ✓ YOLO-NAS-{YOLONAS_CONFIG['model_size'].upper()}: Ready")
    else:
        print("   ✗ YOLO-NAS: NOT LOADED")
        print("     → Add your trained model to backend/models/ckpt_best.pth")
    if convnext_model is not None:
        print("   ✓ ConvNeXt: Ready")
    else:
        print("   ✗ ConvNeXt: NOT LOADED (WBC classification disabled)")
    print("="*70 + "\n")
    
    return True  # Always return True to allow server to start


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
    # Check all required components are loaded
    if convnext_model is None or convnext_transform is None or leukemia_class_names is None:
        return None
    
    try:
        # Apply transforms
        wbc_tensor = convnext_transform(wbc_crop_pil).unsqueeze(0).to(device)
        
        # Get prediction
        with torch.no_grad():
            outputs = convnext_model(wbc_tensor)
            probabilities = torch.softmax(outputs, dim=1)
            confidence, predicted_idx = torch.max(probabilities, 1)
        
        predicted_idx_val: int = int(predicted_idx.item())
        if predicted_idx_val >= len(leukemia_class_names):
            return None
            
        predicted_class: str = leukemia_class_names[predicted_idx_val]
        confidence_score: float = float(confidence.item())
        
        # Get all class probabilities
        probs_dict = {
            str(cls_name): float(prob) 
            for cls_name, prob in zip(leukemia_class_names, probabilities[0].cpu().numpy())
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


def process_blood_smear(image_bytes, conf_threshold=None, iou_threshold=None):
    """
    Two-stage pipeline: YOLO-NAS detection → ConvNeXt classification
    
    OPTIMIZED FOR MAXIMUM BLOOD CELL DETECTION:
    - conf_threshold: 0.01 (detect everything, confidence disregarded)
    - iou_threshold: 0.2 (20% overlap threshold - minimal NMS suppression)
    
    Parameters match train_yolonas_blood_cells_optimized.py for full compatibility
    
    Args:
        image_bytes: Raw image bytes
        conf_threshold: Detection confidence threshold (default 0.01)
        iou_threshold: IoU threshold for NMS (default 0.2 = 20%)
        
    Returns:
        dict: Analysis results with detections and classifications
    """
    # Use config defaults if not specified
    if conf_threshold is None:
        conf_threshold = YOLONAS_CONFIG['conf_threshold']
    if iou_threshold is None:
        iou_threshold = YOLONAS_CONFIG['iou_threshold']
    
    try:
        if yolonas_model is None:
            return {
                'success': False,
                'error': 'YOLO-NAS model not loaded. Please add your trained model to backend/models/ckpt_best.pth'
            }
        
        # Convert bytes to PIL Image
        image = Image.open(io.BytesIO(image_bytes))
        original_size = image.size
        
        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Convert to numpy array for processing
        image_np = np.array(image)
        
        # Debug: Print processing parameters
        print(f"\n{'='*70}")
        print(f"🔍 PROCESSING IMAGE WITH YOLO-NAS-{YOLONAS_CONFIG['model_size'].upper()}")
        print(f"{'='*70}")
        print(f"📐 Original image size: {original_size} (W x H)")
        print(f"📐 Array shape: {image_np.shape}")
        print(f"⚙️  Confidence threshold: {conf_threshold} (detecting everything)")
        print(f"⚙️  IoU/Overlap threshold: {iou_threshold} (20% - minimal suppression)")
        print(f"⚙️  Max predictions: {YOLONAS_CONFIG['max_predictions']}")
        
        # ========== STAGE 1: YOLO-NAS Detection ==========
        # Using Super Gradients prediction
        # Parameters match training script for optimal compatibility
        
        with torch.no_grad():
            # YOLO-NAS predict method from Super Gradients
            # Internally handles preprocessing to match training
            predictions = yolonas_model.predict(
                image,                    # Can accept PIL Image directly
                conf=conf_threshold,      # 0.01 - detect everything
                iou=iou_threshold,        # 0.2 - 20% overlap threshold
            )
        
        # Extract prediction results
        # Super Gradients returns ImageDetectionPrediction object
        pred = predictions[0] if isinstance(predictions, list) else predictions
        
        # Get bboxes, confidence scores, and class labels
        if hasattr(pred, 'prediction'):
            # Newer Super Gradients format
            bboxes = pred.prediction.bboxes_xyxy  # [N, 4] array
            confidences = pred.prediction.confidence  # [N] array
            class_ids = pred.prediction.labels.astype(int)  # [N] array
        else:
            # Handle different prediction formats
            bboxes = pred.bboxes_xyxy if hasattr(pred, 'bboxes_xyxy') else np.array([])
            confidences = pred.confidence if hasattr(pred, 'confidence') else np.array([])
            class_ids = pred.labels.astype(int) if hasattr(pred, 'labels') else np.array([])
        
        num_detections = len(bboxes) if len(bboxes) > 0 else 0
        
        print(f"\n✅ YOLO-NAS detected {num_detections} cells")
        
        # Parse detections
        detections = {
            'total': num_detections,
            'cells': [],
            'counts': {
                'RBC': 0,
                'WBC': 0,
                'Platelets': 0
            }
        }
        
        wbc_boxes = []
        
        if num_detections > 0:
            # Count by class and gather statistics
            class_counts = {}
            all_confidences = []
            class_sizes = {'WBC': [], 'RBC': [], 'Platelets': []}
            
            for i in range(num_detections):
                bbox = bboxes[i]
                conf = float(confidences[i])
                cls_id = int(class_ids[i])
                cls_name = blood_cell_class_names[cls_id] if cls_id < len(blood_cell_class_names) else f"Class_{cls_id}"
                
                class_counts[cls_name] = class_counts.get(cls_name, 0) + 1
                all_confidences.append(conf)
                
                x1, y1, x2, y2 = bbox.tolist()
                width = x2 - x1
                height = y2 - y1
                area = width * height
                
                # Track sizes by class
                if cls_name in class_sizes:
                    class_sizes[cls_name].append(area)
                
                detection = {
                    'class': cls_name,
                    'confidence': conf,
                    'bbox': [float(x1), float(y1), float(x2), float(y2)]
                }
                
                detections['cells'].append(detection)
                
                # Count by cell type and collect WBCs for classification
                if cls_name == 'Platelets':
                    detections['counts']['Platelets'] += 1
                elif cls_name == 'WBC':
                    # Size-based validation for WBC
                    # WBCs are typically 2-3x larger than RBCs
                    if area > 600:
                        detections['counts']['WBC'] += 1
                        wbc_boxes.append(detection)
                    else:
                        # Small "WBC" is likely misclassified RBC
                        detections['counts']['RBC'] += 1
                        detection['class'] = 'RBC'
                        print(f"   ⚠️ Reclassified small WBC as RBC: area={area:.0f}")
                elif cls_name == 'RBC':
                    detections['counts']['RBC'] += 1
                else:
                    detections['counts']['RBC'] += 1  # Default to RBC
            
            # Print statistics
            print(f"\n📊 Detection breakdown:")
            for cls, count in class_counts.items():
                print(f"   - {cls}: {count}")
            
            # Size statistics
            print(f"\n📏 Size statistics:")
            for cell_type, areas in class_sizes.items():
                if len(areas) > 0:
                    print(f"   {cell_type}: {len(areas)} cells, area range: {min(areas):.1f} - {max(areas):.1f}")
            
            conf_array = np.array(all_confidences)
            print(f"\n📈 Confidence stats:")
            print(f"   - Min: {conf_array.min():.3f}")
            print(f"   - Max: {conf_array.max():.3f}")
            print(f"   - Mean: {conf_array.mean():.3f}")
            print(f"   - Median: {np.median(conf_array):.3f}")
            
        print(f"\n📋 Final counts: WBC={detections['counts']['WBC']}, RBC={detections['counts']['RBC']}, Platelets={detections['counts']['Platelets']}")
        print(f"{'='*70}\n")
        
        # ========== STAGE 2: ConvNeXt WBC Classification ==========
        wbc_classifications = []
        
        if len(wbc_boxes) > 0 and convnext_model is not None:
            print(f"🧬 Classifying {len(wbc_boxes)} WBCs with ConvNeXt...")
            
            for idx, detection in enumerate(wbc_boxes, 1):
                x1, y1, x2, y2 = map(int, detection['bbox'])
                
                # Add padding (10%) for better classification
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
            
            print(f"✅ Classified {len(wbc_classifications)} WBCs")
            if len(wbc_classifications) > 0:
                classifications = [w['classification'] for w in wbc_classifications]
                print(f"   Results: {classifications[:5]}{'...' if len(classifications) > 5 else ''}")
        elif len(wbc_boxes) == 0:
            print(f"ℹ️  No WBCs detected for classification")
        else:
            print(f"⚠️  ConvNeXt not loaded - skipping WBC classification")
        
        # ========== Generate Annotated Image ==========
        annotated_img = image_np.copy()
        annotated_img_bgr = cv2.cvtColor(annotated_img, cv2.COLOR_RGB2BGR)
        
        # Color scheme (BGR for OpenCV)
        colors = {
            'RBC': (0, 0, 255),         # Red
            'WBC': (0, 255, 0),         # Green
            'Platelets': (0, 255, 255)  # Yellow
        }
        
        for detection in detections['cells']:
            x1, y1, x2, y2 = map(int, detection['bbox'])
            cls_name = detection['class']
            color = colors.get(cls_name, (255, 255, 255))
            cv2.rectangle(annotated_img_bgr, (x1, y1), (x2, y2), color, 2)
        
        # Convert back to RGB and encode as base64
        annotated_img_rgb = cv2.cvtColor(annotated_img_bgr, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(annotated_img_rgb)
        buffered = io.BytesIO()
        pil_img.save(buffered, format="JPEG", quality=95)
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
                    'WBC': 'rgb(0, 255, 0)',       # Green
                    'RBC': 'rgb(255, 0, 0)',       # Red
                    'Platelets': 'rgb(255, 255, 0)'  # Yellow
                }
            },
            'annotated_image': img_base64,
            'inference_params': {
                'model': f"YOLO-NAS-{YOLONAS_CONFIG['model_size'].upper()}",
                'conf_threshold': conf_threshold,
                'iou_threshold': iou_threshold,
                'img_size': YOLONAS_CONFIG['img_size']
            }
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
        'yolonas_loaded': yolonas_model is not None,
        'convnext_loaded': convnext_model is not None,
        'device': str(device) if device else 'unknown',
        'model_config': YOLONAS_CONFIG
    })


@app.route('/api/analyze', methods=['POST'])
def analyze_blood_smear():
    """
    Main endpoint for blood smear analysis
    
    Expected: multipart/form-data with 'image' file
    Optional: conf_threshold (default 0.01), iou_threshold (default 0.2)
    
    Returns: JSON with detections and classifications
    """
    try:
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
        
        # Get parameters (defaults optimized for maximum detection)
        conf_threshold = float(request.form.get('conf_threshold', YOLONAS_CONFIG['conf_threshold']))
        iou_threshold = float(request.form.get('iou_threshold', YOLONAS_CONFIG['iou_threshold']))
        
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
    """Get information about loaded models and configuration"""
    return jsonify({
        'yolonas': {
            'loaded': yolonas_model is not None,
            'model_type': f"YOLO-NAS-{YOLONAS_CONFIG['model_size'].upper()}",
            'classes': blood_cell_class_names,
            'framework': 'Super Gradients',
            'training_script': 'train_yolonas_blood_cells_optimized.py'
        },
        'convnext': {
            'loaded': convnext_model is not None,
            'classes': leukemia_class_names if leukemia_class_names else None,
            'device': str(device) if device else None
        },
        'inference_params': {
            'conf_threshold': YOLONAS_CONFIG['conf_threshold'],
            'iou_threshold': YOLONAS_CONFIG['iou_threshold'],
            'img_size': YOLONAS_CONFIG['img_size'],
            'max_predictions': YOLONAS_CONFIG['max_predictions'],
            'nms_top_k': YOLONAS_CONFIG['nms_top_k']
        }
    })


@app.route('/api/test-detection', methods=['POST'])
def test_detection():
    """
    Test endpoint for comparing detection at different thresholds
    
    Expected: multipart/form-data with 'image' file
    
    Returns: Detection counts at different confidence thresholds
    """
    try:
        if 'image' not in request.files:
            return jsonify({'success': False, 'error': 'No image file provided'}), 400
        
        if yolonas_model is None:
            return jsonify({'success': False, 'error': 'YOLO-NAS model not loaded'}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'Empty filename'}), 400
        
        image_bytes = file.read()
        image = Image.open(io.BytesIO(image_bytes))
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Test with multiple confidence thresholds
        test_thresholds = [0.01, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3]
        results_summary = []
        
        for conf in test_thresholds:
            with torch.no_grad():
                predictions = yolonas_model.predict(
                    image,
                    conf=conf,
                    iou=YOLONAS_CONFIG['iou_threshold'],  # 20% overlap
                )
            
            pred = predictions[0] if isinstance(predictions, list) else predictions
            
            if hasattr(pred, 'prediction'):
                num_boxes = len(pred.prediction.bboxes_xyxy)
                class_ids = pred.prediction.labels.astype(int)
            else:
                num_boxes = 0
                class_ids = np.array([])
            
            class_counts = {}
            for cls_id in class_ids:
                cls_name = blood_cell_class_names[cls_id] if cls_id < len(blood_cell_class_names) else f"Class_{cls_id}"
                class_counts[cls_name] = class_counts.get(cls_name, 0) + 1
            
            results_summary.append({
                'conf_threshold': conf,
                'total_detections': num_boxes,
                'class_counts': class_counts
            })
        
        return jsonify({
            'success': True,
            'image_size': f"{image.size[0]}x{image.size[1]}",
            'iou_threshold': YOLONAS_CONFIG['iou_threshold'],
            'results': results_summary,
            'recommendation': 'conf=0.01 with iou=0.2 recommended for maximum detection'
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
    initialize_models()
    
    print("\n🚀 Starting Flask server on http://localhost:5000")
    print("="*50)
    print("API Endpoints:")
    print("  POST /api/analyze       - Analyze blood smear image")
    print("  GET  /api/health        - Health check")
    print("  GET  /api/models/info   - Model information")
    print("  POST /api/test-detection - Test different thresholds")
    print("="*50)
    print()
    
    app.run(debug=True, host='0.0.0.0', port=5000)
