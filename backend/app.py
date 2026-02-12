from flask import Flask, request, jsonify, send_from_directory
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
from concurrent.futures import ThreadPoolExecutor

# Import ConvNeXt classification module
from convnext_classifier import (
    load_convnext_model,
    classify_cell_crop,
    get_classifier_info,
    classify_cell_crops_batch,
    classifier,
    create_black_background_crop
)

# Import disease thresholds and calculation modules
from disease_thresholds import (
    EXPECTED_CELLS_PER_FIELD,
    RECOMMENDED_FIELDS,
    EXPECTED_CELLS_PER_ANALYSIS,
    DISEASE_THRESHOLDS,
    MINIMUM_CELLS_FOR_DIAGNOSIS,
    HEMOCYTOMETER_CONSTANTS,
    ESTIMATED_COUNT_CONSTANTS,
    EXPECTED_WBC_PER_10HPF,
    SMALL_SAMPLE_THRESHOLDS
)

from calculations import (
    calculate_confidence_interval,
    assess_sample_adequacy,
    calculate_estimated_wbc,
    calculate_estimated_rbc,
    assess_differential_finding,
    get_expected_counts_for_hpf
)


# Load environment variables from .env file
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend


# ============================================================
# STATISTICAL CONFIDENCE FUNCTIONS - Imported from calculations.py
# ============================================================

# calculate_confidence_interval() - now in calculations.py
# assess_sample_adequacy() - now in calculations.py
# Disease thresholds - now in disease_thresholds.py


# ============================================================
# DISEASE INTERPRETATION FUNCTION (Simplified for 7-class ConvNeXt)
# Classes: Normal WBC, Normal RBC, AML, ALL, CML, CLL, Sickle Cell Anemia
# ============================================================

def interpret_disease_classification(wbc_classifications, rbc_classifications, cell_counts, fields_analyzed=1):
    """
    Interpret disease classification based on simplified 7-class ConvNeXt model.
    
    New classes: Normal WBC, Normal RBC, Acute Lymphoblastic Leukemia, 
    Acute Myeloid Leukemia, Chronic Lymphocytic Leukemia, 
    Chronic Myeloid Leukemia, Sickle Cell Anemia
    
    Args:
        wbc_classifications: List of WBC classification results
        rbc_classifications: List of RBC classification results  
        cell_counts: Dictionary with cell counts
        fields_analyzed: Number of 100x fields analyzed
    
    Returns:
        dict: Disease interpretation
    """
    interpretation = {
        'sickle_cell_analysis': None,
        'leukemia_analysis': None,
        'classification_summary': {},
        'overall_assessment': [],
        'sample_adequacy': None,
        'fields_analyzed': fields_analyzed,
        'recommended_fields': RECOMMENDED_FIELDS
    }
    
    total_wbc = cell_counts.get('WBC', 0)
    total_rbc = cell_counts.get('RBC', 0)
    
    # Check sample adequacy
    interpretation['sample_adequacy'] = assess_sample_adequacy(cell_counts, fields_analyzed=fields_analyzed)
    
    # === SICKLE CELL ANALYSIS ===
    sickle_count = sum(1 for r in rbc_classifications if r.get('is_sickle_cell', False))
    normal_rbc_count = len(rbc_classifications) - sickle_count
    
    if total_rbc > 0:
        sickle_pct = (sickle_count / total_rbc) * 100
        
        # Determine sickle cell interpretation based on percentage thresholds
        thresholds = DISEASE_THRESHOLDS['sickle_cell']
        sickle_severity = 'NORMAL'
        
        if sickle_pct < 3.0:
            sickle_interpretation = thresholds['normal']['interpretation']
            sickle_severity = 'NORMAL'
            sickle_condition = '< 3%'
        elif sickle_pct < 10.0:
            sickle_interpretation = thresholds['mild']['interpretation']
            sickle_severity = 'LOW'
            sickle_condition = '3% - 10%'
        elif sickle_pct < 30.0:
            sickle_interpretation = thresholds['moderate']['interpretation']
            sickle_severity = 'MODERATE'
            sickle_condition = '10% - 30%'
        else:
            sickle_interpretation = thresholds['severe']['interpretation']
            sickle_severity = 'HIGH'
            sickle_condition = '> 30%'
        
        interpretation['sickle_cell_analysis'] = {
            'sickle_cell_count': sickle_count,
            'normal_rbc_count': normal_rbc_count,
            'total_rbc_analyzed': total_rbc,
            'percentage': round(sickle_pct, 2),
            'interpretation': sickle_interpretation,
            'severity': sickle_severity,
            'condition': sickle_condition,
            'calculation_method': f"({sickle_count} sickled cells / {total_rbc} total RBCs) × 100 = {sickle_pct:.2f}%"
        }
    
    # === WBC DISEASE ANALYSIS (Simplified) ===
    # Count by new classification: Normal WBC vs disease types
    if total_wbc > 0:
        normal_wbc_count = 0
        aml_count = 0
        all_count = 0
        cml_count = 0
        cll_count = 0
        
        for wbc in wbc_classifications:
            cls = wbc.get('classification', '').lower()
            if 'normal' in cls:
                normal_wbc_count += 1
            elif 'acute myeloid' in cls or 'aml' in cls:
                aml_count += 1
            elif 'acute lymphoblastic' in cls or 'all' in cls:
                all_count += 1
            elif 'chronic myeloid' in cls or 'cml' in cls:
                cml_count += 1
            elif 'chronic lymphocytic' in cls or 'cll' in cls:
                cll_count += 1
        
        disease_count = aml_count + all_count + cml_count + cll_count
        disease_pct = (disease_count / total_wbc) * 100 if total_wbc > 0 else 0
        normal_pct = (normal_wbc_count / total_wbc) * 100 if total_wbc > 0 else 0
        
        interpretation['classification_summary'] = {
            'normal_wbc': {'count': normal_wbc_count, 'percentage': round(normal_pct, 1)},
            'disease_wbc': {'count': disease_count, 'percentage': round(disease_pct, 1)},
            'breakdown': {
                'AML': {'count': aml_count, 'percentage': round((aml_count / total_wbc) * 100, 1) if total_wbc > 0 else 0},
                'ALL': {'count': all_count, 'percentage': round((all_count / total_wbc) * 100, 1) if total_wbc > 0 else 0},
                'CML': {'count': cml_count, 'percentage': round((cml_count / total_wbc) * 100, 1) if total_wbc > 0 else 0},
                'CLL': {'count': cll_count, 'percentage': round((cll_count / total_wbc) * 100, 1) if total_wbc > 0 else 0}
            },
            'total_wbc_analyzed': total_wbc
        }
        
        # Disease findings
        leukemia_findings = []
        
        # AML Analysis
        if aml_count > 0:
            aml_pct = (aml_count / total_wbc) * 100
            aml_thresholds = DISEASE_THRESHOLDS['acute_leukemia']
            if aml_pct >= 20:
                leukemia_findings.append({
                    'type': 'Acute Myeloid Leukemia (AML)',
                    'count': aml_count,
                    'percentage': round(aml_pct, 1),
                    'interpretation': aml_thresholds['acute_leukemia']['interpretation'],
                    'severity': 'HIGH',
                    'condition': '>= 20% blasts'
                })
            elif aml_pct >= 11:
                leukemia_findings.append({
                    'type': 'Acute Myeloid Leukemia (AML)',
                    'count': aml_count,
                    'percentage': round(aml_pct, 1),
                    'interpretation': aml_thresholds['suspicious']['interpretation'],
                    'severity': 'MODERATE',
                    'condition': '11-19% blasts'
                })
            elif aml_pct >= 6:
                leukemia_findings.append({
                    'type': 'Acute Myeloid Leukemia (AML)',
                    'count': aml_count,
                    'percentage': round(aml_pct, 1),
                    'interpretation': aml_thresholds['slightly_increased']['interpretation'],
                    'severity': 'LOW',
                    'condition': '6-10% blasts'
                })
            else:
                leukemia_findings.append({
                    'type': 'Acute Myeloid Leukemia (AML)',
                    'count': aml_count,
                    'percentage': round(aml_pct, 1),
                    'interpretation': 'AML cells detected at low levels',
                    'severity': 'NORMAL',
                    'condition': '< 6% blasts'
                })
        
        # ALL Analysis  
        if all_count > 0:
            all_pct = (all_count / total_wbc) * 100
            all_thresholds = DISEASE_THRESHOLDS['acute_leukemia']
            if all_pct >= 20:
                leukemia_findings.append({
                    'type': 'Acute Lymphoblastic Leukemia (ALL)',
                    'count': all_count,
                    'percentage': round(all_pct, 1),
                    'interpretation': all_thresholds['acute_leukemia']['interpretation'],
                    'severity': 'HIGH',
                    'condition': '>= 20% blasts'
                })
            elif all_pct >= 11:
                leukemia_findings.append({
                    'type': 'Acute Lymphoblastic Leukemia (ALL)',
                    'count': all_count,
                    'percentage': round(all_pct, 1),
                    'interpretation': all_thresholds['suspicious']['interpretation'],
                    'severity': 'MODERATE',
                    'condition': '11-19% blasts'
                })
            elif all_pct >= 6:
                leukemia_findings.append({
                    'type': 'Acute Lymphoblastic Leukemia (ALL)',
                    'count': all_count,
                    'percentage': round(all_pct, 1),
                    'interpretation': all_thresholds['slightly_increased']['interpretation'],
                    'severity': 'LOW',
                    'condition': '6-10% blasts'
                })
            else:
                leukemia_findings.append({
                    'type': 'Acute Lymphoblastic Leukemia (ALL)',
                    'count': all_count,
                    'percentage': round(all_pct, 1),
                    'interpretation': 'ALL cells detected at low levels',
                    'severity': 'NORMAL',
                    'condition': '< 6% blasts'
                })
        
        # CML Analysis
        if cml_count > 0:
            cml_pct = (cml_count / total_wbc) * 100
            cml_thresholds = DISEASE_THRESHOLDS['cml']
            if cml_pct >= 90:
                severity = 'HIGH'
                interp = cml_thresholds['accelerated']['interpretation']
                condition = '> 90% CML cells'
            elif cml_pct >= 76:
                severity = 'MODERATE'
                interp = cml_thresholds['early_cml']['interpretation']
                condition = '76-89% CML cells'
            elif cml_pct >= 60:
                severity = 'LOW'
                interp = cml_thresholds['reactive']['interpretation']
                condition = '60-75% CML cells'
            else:
                severity = 'NORMAL'
                interp = 'CML cells detected at low levels'
                condition = f'< 60% CML cells ({cml_count} cells)'
            
            leukemia_findings.append({
                'type': 'Chronic Myeloid Leukemia (CML)',
                'count': cml_count,
                'percentage': round(cml_pct, 1),
                'interpretation': interp,
                'severity': severity,
                'condition': condition
            })
        
        # CLL Analysis
        if cll_count > 0:
            cll_pct = (cll_count / total_wbc) * 100
            cll_thresholds = DISEASE_THRESHOLDS['cll']
            if cll_pct >= 80:
                severity = 'HIGH'
                interp = cll_thresholds['advanced_cll']['interpretation']
                condition = '> 80% CLL cells'
            elif cll_pct >= 51:
                severity = 'MODERATE'
                interp = cll_thresholds['early_cll']['interpretation']
                condition = '51-79% CLL cells'
            elif cll_pct >= 35:
                severity = 'LOW'
                interp = cll_thresholds['reactive']['interpretation']
                condition = '35-50% CLL cells'
            else:
                severity = 'NORMAL'
                interp = 'CLL cells detected at low levels'
                condition = f'< 35% CLL cells ({cll_count} cells)'
            
            leukemia_findings.append({
                'type': 'Chronic Lymphocytic Leukemia (CLL)',
                'count': cll_count,
                'percentage': round(cll_pct, 1),
                'interpretation': interp,
                'severity': severity,
                'condition': condition
            })
        
        interpretation['leukemia_analysis'] = {
            'findings': leukemia_findings,
            'normal_wbc_percentage': round(normal_pct, 1),
            'disease_wbc_percentage': round(disease_pct, 1),
            'total_wbc_analyzed': total_wbc,
            'classification_counts': {
                'Normal WBC': normal_wbc_count,
                'AML': aml_count,
                'ALL': all_count,
                'CML': cml_count,
                'CLL': cll_count
            }
        }
    
    # === OVERALL ASSESSMENT ===
    if interpretation['sample_adequacy']['confidence_level'] == 'very_low':
        interpretation['overall_assessment'].append({
            'type': 'warning',
            'message': 'Insufficient sample size for reliable diagnosis. Results are preliminary.'
        })
    
    if sickle_count > 0:
        interpretation['overall_assessment'].append({
            'type': 'finding',
            'message': f"Detected {sickle_count} sickle cell(s) - {interpretation['sickle_cell_analysis']['interpretation']}"
        })
    
    leukemia_analysis = interpretation.get('leukemia_analysis')
    if leukemia_analysis and leukemia_analysis.get('findings'):
        for finding in leukemia_analysis['findings']:
            interpretation['overall_assessment'].append({
                'type': 'finding',
                'severity': finding.get('severity', 'INFO'),
                'message': f"{finding['type']}: {finding['interpretation']}"
            })
    
    return interpretation


# ============================================================
# MULTI-FIELD AGGREGATION (for future multi-image support)
# ============================================================

# Store for multi-field analysis session
multi_field_session = {}

def aggregate_multi_field_analysis(field_results_list, session_id=None):
    """
    Aggregate results from multiple 100x fields for more accurate analysis.
    
    Args:
        field_results_list: List of analysis results from different fields
        session_id: Optional session identifier
    
    Returns:
        dict: Aggregated analysis with improved confidence
    """
    if not field_results_list:
        return {'error': 'No field results provided'}
    
    # Initialize aggregation counters
    total_wbc = 0
    total_rbc = 0
    total_platelets = 0
    all_wbc_classifications = []
    all_rbc_classifications = []
    
    # Aggregate across all fields
    for field in field_results_list:
        counts = field.get('stage1_detection', {}).get('counts', {})
        total_wbc += counts.get('WBC', 0)
        total_rbc += counts.get('RBC', 0)
        total_platelets += counts.get('Platelets', 0)
        
        all_wbc_classifications.extend(field.get('stage2_classification', []))
        all_rbc_classifications.extend(field.get('rbc_classifications', []))
    
    # Calculate aggregated metrics
    aggregated_counts = {
        'WBC': total_wbc,
        'RBC': total_rbc,
        'Platelets': total_platelets
    }
    
    # Get disease interpretation with larger sample
    # IMPORTANT: Sickle cell percentage is calculated as:
    # (Total Sickled Cells across ALL images / Total RBCs across ALL images) × 100
    # This provides accurate percentage across all 10 uploaded fields
    disease_interpretation = interpret_disease_classification(
        all_wbc_classifications,
        all_rbc_classifications,
        aggregated_counts,
        fields_analyzed=len(field_results_list)
    )
    
    return {
        'fields_analyzed': len(field_results_list),
        'aggregated_counts': aggregated_counts,
        'total_cells_analyzed': total_wbc + total_rbc + total_platelets,
        'wbc_classifications': all_wbc_classifications,
        'rbc_classifications': all_rbc_classifications,
        'disease_interpretation': disease_interpretation,
        'sample_adequacy': disease_interpretation['sample_adequacy'],
        'is_multi_field': True
    }

# ============================================================
# ROBOFLOW CONFIGURATION
# ============================================================
API_KEY = os.getenv("API_KEY", "").strip()
if not API_KEY:
    print("Warning: API_KEY not found in .env file")

# Initialize Roboflow Inference Client
CLIENT = InferenceHTTPClient(
    api_url="https://serverless.roboflow.com",
    api_key=API_KEY
)

# Your Roboflow model IDs
MODEL_ID = "hema-dci5u/1"  # Enhanced YOLOv8-NAS model
# Note: If baseline model doesn't exist, we'll simulate with reduced detection rate


# ============================================================
# CONVNEXT FUNCTIONS - Now in convnext_classifier.py module
# Functions are imported at top of file:
#   - load_convnext_model()
#   - classify_cell_crop()
#   - get_classifier_info()
# ============================================================


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def _get_short_label(classification):
    """Get a short label for bounding box display from the full classification name."""
    cls_lower = classification.lower()
    if 'normal wbc' in cls_lower:
        return 'Normal'
    elif 'acute lymphoblastic' in cls_lower:
        return 'ALL'
    elif 'acute myeloid' in cls_lower:
        return 'AML'
    elif 'chronic lymphocytic' in cls_lower:
        return 'CLL'
    elif 'chronic myeloid' in cls_lower:
        return 'CML'
    elif 'sickle' in cls_lower:
        return 'SCA'
    elif 'normal rbc' in cls_lower:
        return 'Normal'
    else:
        return classification[:10]  # Fallback: first 10 chars


# ============================================================
# INFERENCE FUNCTION
# ============================================================

# Performance tuning constants
RBC_SAMPLE_LIMIT = 100  # Max RBCs to classify per image (CPU optimized, statistically valid)
ENABLE_RBC_SAMPLING = True  # Enable sampling for faster processing (1000 total RBCs across 10 images)

def process_blood_smear(image_bytes, conf_threshold=0.2, iou_threshold=0.2):
    """
    Process blood smear image using TWO-STAGE analysis pipeline:
    
    STAGE 1 - YOLOv8 Detection (Roboflow):
        - Detects and counts total WBCs, RBCs, and Platelets
        - Provides bounding boxes for each detected cell
        - Purpose: Initial cell detection and total cell counting
    
    STAGE 2 - ConvNeXt Classification:
        - Classifies each detected WBC into specific types:
          (Neutrophil, Lymphocyte, Monocyte, Eosinophil, Basophil, or disease types)
        - Classifies RBCs to detect Sickle Cells (>=95% confidence threshold)
        - Purpose: WBC differential count and sickle cell detection
    
    DETECTION SETTINGS:
    - conf_threshold: 0.15 (15% confidence)
    - iou_threshold: 0.25 (25% overlap threshold)
    
    PERFORMANCE OPTIMIZATIONS:
    - RBC sampling: Only classify up to RBC_SAMPLE_LIMIT RBCs per image
    - Fast mode preprocessing for RBCs
    - Parallel crop preparation
    - Only generate base64 for abnormal cells
    
    Args:
        image_bytes: Raw image bytes
        conf_threshold: Detection confidence threshold (default 0.15 = 15%)
        iou_threshold: IoU threshold for NMS (default 0.25 = 25% overlap)
        
    Returns:
        dict: Analysis results with detections and classifications
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
        
        # ========== IMAGE QUALITY VALIDATION ==========
        # Check image quality BEFORE sending to detection API
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # 1. Brightness check (mean pixel intensity)
        mean_brightness = np.mean(gray)
        MIN_BRIGHTNESS = 40   # Too dark threshold
        MAX_BRIGHTNESS = 245  # Too bright/overexposed threshold
        
        print(f"\n{'='*60}")
        print(f"IMAGE QUALITY CHECK")
        print(f"{'='*60}")
        print(f"Mean brightness: {mean_brightness:.1f} (valid range: {MIN_BRIGHTNESS}-{MAX_BRIGHTNESS})")
        
        if mean_brightness < MIN_BRIGHTNESS:
            print(f"   ⚠️ REJECTED: Image too dark (brightness: {mean_brightness:.1f})")
            return {
                'success': False,
                'error': 'Image quality validation failed:\n\n'
                         'The image appears to be too DARK.\n'
                         'Please ensure:\n'
                         '1. Microscope light source is properly adjusted\n'
                         '2. Image is not underexposed\n'
                         '3. Camera settings are correct for microscopy'
            }
        
        if mean_brightness > MAX_BRIGHTNESS:
            print(f"   ⚠️ REJECTED: Image too bright/overexposed (brightness: {mean_brightness:.1f})")
            return {
                'success': False,
                'error': 'Image quality validation failed:\n\n'
                         'The image appears to be OVEREXPOSED or too bright.\n'
                         'Please ensure:\n'
                         '1. Reduce microscope light intensity\n'
                         '2. Adjust camera exposure settings\n'
                         '3. Image shows visible cell structures'
            }
        
        # 2. Contrast check (standard deviation of pixel intensities)
        std_dev = np.std(gray)
        MIN_CONTRAST = 15  # Minimum contrast threshold
        
        print(f"Contrast (std dev): {std_dev:.1f} (minimum: {MIN_CONTRAST})")
        
        if std_dev < MIN_CONTRAST:
            print(f"   ⚠️ REJECTED: Image has insufficient contrast (std: {std_dev:.1f})")
            return {
                'success': False,
                'error': 'Image quality validation failed:\n\n'
                         'The image appears to be BLANK or has very low contrast.\n'
                         'This does not appear to be a blood smear image.\n'
                         'Please ensure:\n'
                         '1. Upload a proper blood smear microscopy image\n'
                         '2. Image contains visible cells with distinct features\n'
                         '3. Image is in focus'
            }
        
        # 3. Check for uniform/solid color images (histogram analysis)
        hist = cv2.calcHist([gray], [0], None, [256], [0, 256])
        hist_normalized = hist / hist.sum()
        max_bin_ratio = hist_normalized.max()
        
        print(f"Max histogram bin ratio: {max_bin_ratio:.3f} (max allowed: 0.5)")
        
        if max_bin_ratio > 0.5:  # More than 50% pixels in single intensity bin
            print(f"   ⚠️ REJECTED: Image appears uniform/solid (max bin: {max_bin_ratio:.3f})")
            return {
                'success': False,
                'error': 'Image quality validation failed:\n\n'
                         'The image appears to be a solid color or nearly uniform.\n'
                         'This is not a valid blood smear image.\n'
                         'Please upload a proper microscopy image of a blood smear.'
            }
        
        print(f"   ✓ Image quality checks PASSED")
        # ========== END IMAGE QUALITY VALIDATION ==========
        
        # Resize image to 640x640 (model training size) for consistent detection
        TARGET_SIZE = 640
        image_resized = cv2.resize(image, (TARGET_SIZE, TARGET_SIZE))
        image_rgb = cv2.resize(image_rgb, (TARGET_SIZE, TARGET_SIZE))
        
        print(f"\n{'='*60}")
        print(f"PROCESSING BLOOD SMEAR IMAGE")
        print(f"{'='*60}")
        print(f"Original size: {original_w} x {original_h} -> Resized to: {TARGET_SIZE} x {TARGET_SIZE}")
        print(f"Confidence threshold: {conf_threshold}")
        print(f"IoU threshold: {iou_threshold}")
        
        # Convert resized image to base64 for API call
        _, buffer = cv2.imencode('.jpg', image_resized)
        image_base64 = base64.b64encode(buffer).decode('utf-8')
        
        # Run inference using direct HTTP request (bypasses SDK's Content-Type bug)
        import time
        import requests
        max_retries = 3
        result = None
        last_error = None
        
        # Roboflow inference API endpoint
        api_url = f"https://detect.roboflow.com/{MODEL_ID}"
        
        for attempt in range(max_retries):
            try:
                # Direct POST request with proper headers
                response = requests.post(
                    api_url,
                    params={"api_key": API_KEY},
                    data=image_base64,
                    headers={"Content-Type": "application/x-www-form-urlencoded"}
                )
                response.raise_for_status()
                result = response.json()
                break  # Success - exit retry loop
            except Exception as e:
                last_error = e
                error_str = str(e).lower()
                # Check if it's a network/DNS error that might be transient
                if 'nameresolution' in error_str or 'connection' in error_str or 'timeout' in error_str or 'getaddrinfo' in error_str:
                    wait_time = (2 ** attempt) * 0.5  # 0.5s, 1s, 2s
                    print(f"   ⚠️ Network error (attempt {attempt + 1}/{max_retries}): {e}")
                    print(f"   Retrying in {wait_time}s...")
                    time.sleep(wait_time)
                else:
                    # Non-network error - don't retry
                    raise e
        
        if result is None:
            # All retries failed
            error_msg = f"Detection API connection failed after {max_retries} attempts: {last_error}"
            print(f"   ✗ {error_msg}")
            return {'success': False, 'error': str(last_error)}
        
        print(f"Detection response received")
        
        # Parse predictions
        predictions = result.get('predictions', [])
        
        print(f"Cells detected: {len(predictions)}")

        # VALIDATION: Check if this is likely a blood smear
        # User requested minimum 100 cells to accept as valid
        MIN_CELLS_THRESHOLD = 100
        if len(predictions) < MIN_CELLS_THRESHOLD:
            print(f"   ⚠️ REJECTED: Only {len(predictions)} cells detected (Min: {MIN_CELLS_THRESHOLD})")
            return {
                'success': False,
                'error': 'Blood smear validation failed:\n\n'
                         'The image does not appear to be a valid 100x oil immersion blood smear.\n'
                         'Please ensure:\n'
                         '1. Image is taken at 100x Magnification\n'
                         '2. Image is in focus and not blank\n'
                         '3. Field of view contains a standard spread of cells'
            }
        
        # ========== STAGE 1: YOLOv8 Cell Detection & Counting ==========
        print(f"\n{'='*60}")
        print(f"STAGE 1: YOLOv8 DETECTION (Cell Counting)")
        print(f"{'='*60}")
        
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
        
        # ========== STAGE 2: ConvNeXt Classification (Normal vs Disease) ==========
        print(f"\n{'='*60}")
        print(f"STAGE 2: CONVNEXT CLASSIFICATION (Normal vs Disease)")
        print(f"{'='*60}")
        
        wbc_classifications = []
        rbc_classifications = []
        
        if classifier.is_loaded():
            print(f"Starting ConvNeXt classification for detected cells...")
            
            # --- BATCH PROCESSING IMPLEMENTATION ---
            # 1. Collect all crops first
            wbc_crops = []
            wbc_indices = [] # Indices into detections['cells']
            rbc_crops = []
            rbc_indices = []
            cropped_cells = []  # Initialize cropped_cells

            print(f"   > Preparing crops for {len(detections['cells'])} cells...")
            
            # OPTIMIZATION: Parallel crop preparation
            def prepare_crop(args):
                """Prepare a single crop - can run in parallel"""
                idx, detection, image_rgb_clean_ref, h, w = args
                cell_type = detection.get('cell_type', 'Unknown')
                x1, y1, x2, y2 = map(int, detection['bbox'])
                
                # Skip Platelets - we only classify WBC and RBC
                if cell_type == 'Platelet' or cell_type == 'Unknown':
                    return None
                
                # Calculate cell dimensions
                cell_width = x2 - x1
                cell_height = y2 - y1
                cell_center_x = (x1 + x2) // 2
                cell_center_y = (y1 + y2) // 2
                
                # Create SQUARE crop centered on cell with optimal padding
                max_dim = max(cell_width, cell_height)
                
                if cell_type == 'WBC':
                    crop_size = int(max_dim * 2.5)  
                    min_crop_dim = 180
                else:
                    crop_size = int(max_dim * 1.2)  
                    min_crop_dim = 80
                
                crop_size = max(crop_size, min_crop_dim)
                
                # Calculate square crop bounds
                half_size = crop_size // 2
                x1_padded = cell_center_x - half_size
                y1_padded = cell_center_y - half_size
                x2_padded = cell_center_x + half_size
                y2_padded = cell_center_y + half_size
                
                # Handle edge padding
                pad_left = max(0, -x1_padded)
                pad_top = max(0, -y1_padded)
                pad_right = max(0, x2_padded - w)
                pad_bottom = max(0, y2_padded - h)
                
                image_x1 = max(0, x1_padded)
                image_y1 = max(0, y1_padded)
                image_x2 = min(w, x2_padded)
                image_y2 = min(h, y2_padded)
                
                cell_crop = image_rgb_clean_ref[image_y1:image_y2, image_x1:image_x2]
                
                if cell_crop.size == 0:
                    return None
                
                # Add padding if needed
                if pad_left > 0 or pad_top > 0 or pad_right > 0 or pad_bottom > 0:
                    padded_crop = np.full((crop_size, crop_size, 3), 240, dtype=np.uint8)
                    target_y = pad_top
                    target_x = pad_left
                    padded_crop[target_y:target_y+cell_crop.shape[0], 
                               target_x:target_x+cell_crop.shape[1]] = cell_crop
                    cell_crop = padded_crop
                
                cell_crop_pil = Image.fromarray(cell_crop)
                return (idx, cell_type, cell_crop_pil)
            
            # Prepare args for parallel processing
            h, w = image_rgb_clean.shape[:2]
            crop_args = [(idx, det, image_rgb_clean, h, w) for idx, det in enumerate(detections['cells'])]
            
            # Process crops in parallel
            with ThreadPoolExecutor(max_workers=4) as executor:
                crop_results = list(executor.map(prepare_crop, crop_args))
            
            # Collect results
            for result in crop_results:
                if result is None:
                    continue
                idx, cell_type, cell_crop_pil = result
                if cell_type == 'WBC':
                    wbc_crops.append(cell_crop_pil)
                    wbc_indices.append(idx)
                elif cell_type == 'RBC':
                    rbc_crops.append(cell_crop_pil)
                    rbc_indices.append(idx)
            
            # OPTIMIZATION: Sample RBCs if too many (statistically representative)
            original_rbc_count = len(rbc_crops)
            
            if ENABLE_RBC_SAMPLING and len(rbc_crops) > RBC_SAMPLE_LIMIT:
                import random
                sample_indices = random.sample(range(len(rbc_crops)), RBC_SAMPLE_LIMIT)
                sample_indices.sort()
                rbc_crops = [rbc_crops[i] for i in sample_indices]
                rbc_indices = [rbc_indices[i] for i in sample_indices]
                print(f"   > RBC sampling: {original_rbc_count} -> {len(rbc_crops)} (statistically representative)")

            # 2. Two-Pass WBC Classification (Original + Black Background)
            # Pass 1: Original crops (standard preprocessing)
            # Pass 2: Black background crops (for Lymphoblast/ALL dataset compatibility)
            # Best result wins based on confidence
            if wbc_crops:
                if not classifier.is_loaded():
                    load_convnext_model()
                
                print(f"   > Two-pass classifying {len(wbc_crops)} WBCs...")
                
                # --- PASS 1: Original crops ---
                print(f"      Pass 1: Original crops...")
                pass1_results = classifier.classify_batch(wbc_crops, ['WBC']*len(wbc_crops), batch_size=16)
                
                # --- PASS 2: Black background crops (WBC only) ---
                print(f"      Pass 2: Black background crops...")
                black_bg_crops = []
                for crop_pil in wbc_crops:
                    try:
                        bb_crop = create_black_background_crop(crop_pil, focus_center=True, center_focus_ratio=0.6)
                        black_bg_crops.append(bb_crop)
                    except Exception as e:
                        print(f"      Warning: Black bg crop failed, using original: {e}")
                        black_bg_crops.append(crop_pil)
                
                pass2_results = classifier.classify_batch(black_bg_crops, ['WBC']*len(black_bg_crops), batch_size=16)
                
                # --- MERGE: Pick best result per WBC ---
                for i in range(len(wbc_crops)):
                    r1 = pass1_results[i] if i < len(pass1_results) else None
                    r2 = pass2_results[i] if i < len(pass2_results) else None
                    
                    if not r1 and not r2:
                        print(f"      WARNING: WBC {i+1} has None result from both passes!")
                        continue
                    
                    # If one pass failed, use the other
                    if not r1:
                        result = r2
                        chosen_pass = 2
                    elif not r2:
                        result = r1
                        chosen_pass = 1
                    else:
                        # Both passes succeeded - pick best by confidence
                        # Exclude non-WBC classes from comparison
                        NON_WBC = {'normal rbc', 'sickle cell anemia'}
                        
                        c1, conf1 = r1['class'], r1['confidence']
                        c2, conf2 = r2['class'], r2['confidence']
                        
                        # Filter out non-WBC for pass 1
                        if c1.lower() in NON_WBC:
                            wbc_probs1 = {k: v for k, v in r1['probabilities'].items() if k.lower() not in NON_WBC}
                            if wbc_probs1:
                                best1 = max(wbc_probs1.items(), key=lambda x: x[1])
                                c1, conf1 = best1[0], best1[1]
                            else:
                                c1, conf1 = 'Normal WBC', 0.5
                        
                        # Filter out non-WBC for pass 2
                        if c2.lower() in NON_WBC:
                            wbc_probs2 = {k: v for k, v in r2['probabilities'].items() if k.lower() not in NON_WBC}
                            if wbc_probs2:
                                best2 = max(wbc_probs2.items(), key=lambda x: x[1])
                                c2, conf2 = best2[0], best2[1]
                            else:
                                c2, conf2 = 'Normal WBC', 0.5
                        
                        # Prefer whichever pass has higher confidence
                        if conf2 > conf1:
                            result = r2
                            result['class'] = c2
                            result['confidence'] = conf2
                            chosen_pass = 2
                        else:
                            result = r1
                            result['class'] = c1
                            result['confidence'] = conf1
                            chosen_pass = 1
                    
                    idx = wbc_indices[i]
                    detection = detections['cells'][idx]
                    crop_pil = wbc_crops[i]
                    
                    wbc_class = result['class']
                    wbc_confidence = result['confidence']
                    probs = result['probabilities']
                    
                    # Final NON_WBC filter (safety net)
                    NON_WBC_CLASSES = {'normal rbc', 'sickle cell anemia'}
                    if wbc_class.lower() in NON_WBC_CLASSES:
                        wbc_only_probs = {k: v for k, v in probs.items() if k.lower() not in NON_WBC_CLASSES}
                        if wbc_only_probs:
                            best = max(wbc_only_probs.items(), key=lambda x: x[1])
                            wbc_class, wbc_confidence = best[0], best[1]
                        else:
                            wbc_class, wbc_confidence = 'Normal WBC', 0.5
                    
                    print(f"      WBC {i+1}: '{wbc_class}' ({wbc_confidence:.2%}) [Pass {chosen_pass}]")
                    
                    # Generate display crop
                    display_crop = crop_pil.resize((384, 384), Image.LANCZOS)
                    c_buf = io.BytesIO()
                    display_crop.save(c_buf, format='PNG')
                    crop_b64 = base64.b64encode(c_buf.getvalue()).decode('utf-8')

                    # Determine short label for bounding box
                    short_label = _get_short_label(wbc_class)
                    is_disease = 'normal' not in wbc_class.lower()

                    wbc_res = {
                        'wbc_id': len(wbc_classifications) + 1,
                        'bbox': detection['bbox'],
                        'detection_confidence': detection['confidence'],
                        'classification': wbc_class,
                        'classification_confidence': wbc_confidence,
                        'short_label': short_label,
                        'is_disease': is_disease,
                        'probabilities': probs,
                        'cropped_image': crop_b64
                    }
                    wbc_classifications.append(wbc_res)
                    
                    # Add to cropped_cells (all WBCs for display)
                    cropped_cells.append({
                        'id': f"WBC_{len(wbc_classifications)}",
                        'cell_type': 'WBC',
                        'classification': wbc_class,
                        'confidence': wbc_confidence,
                        'short_label': short_label,
                        'is_disease': is_disease,
                        'cropped_image': crop_b64,
                        'is_abnormal': is_disease
                    })
                    
                    # Draw classification label on annotated image bounding box
                    x1, y1, x2, y2 = map(int, detection['bbox'])
                    label_color = (0, 0, 255) if is_disease else (0, 255, 0)  # Red for disease, Green for normal
                    label_text = f"{short_label} {wbc_confidence:.0%}"
                    font_scale = 0.35
                    thickness = 1
                    label_size, _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness)
                    # Draw label background above bounding box
                    cv2.rectangle(image_rgb, (x1, y1 - label_size[1] - 6), 
                                 (x1 + label_size[0] + 4, y1), label_color, -1)
                    cv2.putText(image_rgb, label_text, (x1 + 2, y1 - 3), 
                               cv2.FONT_HERSHEY_SIMPLEX, font_scale, (255, 255, 255), thickness)

            # 3. Batch Classify RBCs
            if rbc_crops:
                if not classifier.is_loaded(): 
                    load_convnext_model()
                print(f"   > Batch classifying {len(rbc_crops)} RBCs (sampled from {original_rbc_count} total)...")
                rbc_results = classifier.classify_batch(rbc_crops, ['RBC']*len(rbc_crops), batch_size=32, use_fast_mode_for_rbc=True)
                
                for i, result in enumerate(rbc_results):
                    if not result: continue
                    
                    idx = rbc_indices[i]
                    detection = detections['cells'][idx]
                    crop_pil = rbc_crops[i]
                    
                    is_sickle = result.get('is_sickle_cell', False)
                    sickle_conf = result.get('sickle_cell_confidence', 0.0)
                    rbc_class = 'Sickle Cell Anemia' if is_sickle else 'Normal RBC'
                    rbc_confidence = sickle_conf if is_sickle else result['confidence']
                    
                    # Only generate base64 for SICKLE CELLS
                    crop_b64 = None
                    if is_sickle:
                        display_crop = crop_pil.resize((384, 384), Image.LANCZOS)
                        c_buf = io.BytesIO()
                        display_crop.save(c_buf, format='PNG')
                        crop_b64 = base64.b64encode(c_buf.getvalue()).decode('utf-8')
                    
                    rbc_res = {
                        'rbc_id': len(rbc_classifications) + 1,
                        'bbox': detection['bbox'],
                        'detection_confidence': detection['confidence'],
                        'classification': rbc_class,
                        'classification_confidence': rbc_confidence,
                        'sickle_cell_confidence': sickle_conf,
                        'probabilities': result['probabilities'],
                        'cropped_image': crop_b64,
                        'is_sickle_cell': is_sickle,
                        'is_disease': is_sickle,
                        'short_label': 'SCA' if is_sickle else 'Normal'
                    }
                    rbc_classifications.append(rbc_res)
                    
                    # Draw label on sickle cells in annotated image
                    if is_sickle:
                        x1, y1, x2, y2 = map(int, detection['bbox'])
                        sca_label = f"SCA {sickle_conf:.0%}"
                        font_scale = 0.35
                        thickness = 1
                        label_size, _ = cv2.getTextSize(sca_label, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness)
                        cv2.rectangle(image_rgb, (x1, y1 - label_size[1] - 6), 
                                     (x1 + label_size[0] + 4, y1), (0, 0, 255), -1)
                        cv2.putText(image_rgb, sca_label, (x1 + 2, y1 - 3), 
                                   cv2.FONT_HERSHEY_SIMPLEX, font_scale, (255, 255, 255), thickness)
                        
                        cropped_cells.append({
                            'id': f"RBC_{len(rbc_classifications)}",
                            'cell_type': 'RBC',
                            'classification': 'Sickle Cell Anemia',
                            'confidence': sickle_conf,
                            'short_label': 'SCA',
                            'is_disease': True,
                            'cropped_image': crop_b64,
                            'is_abnormal': True
                        })
            
            print(f"Classified {len(wbc_classifications)} WBCs")
            print(f"Classified {len(rbc_classifications)} RBCs")
            sickle_count = sum(1 for r in rbc_classifications if r.get('is_sickle_cell', False))
            print(f"   Sickle Cells detected: {sickle_count}")
        else:
            cropped_cells = []
            print(f"ConvNeXt model not loaded - skipping classification")
        
        # Convert annotated image to base64 with high quality
        pil_image = Image.fromarray(image_rgb)
        buffer = io.BytesIO()
        pil_image.save(buffer, format='JPEG', quality=95)
        annotated_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        
        # Summary statistics
        wbc_summary = {}
        for wbc in wbc_classifications:
            cls = wbc['classification']
            wbc_summary[cls] = wbc_summary.get(cls, 0) + 1
        
        # Count disease cells
        disease_wbc_count = sum(1 for w in wbc_classifications if w.get('is_disease', False))
        normal_wbc_count = len(wbc_classifications) - disease_wbc_count
        sickle_cell_count = sum(1 for r in rbc_classifications if r.get('is_sickle_cell', False))
        
        # Disease interpretation (for terminal logging)
        disease_interpretation = interpret_disease_classification(
            wbc_classifications,
            rbc_classifications,
            detections['counts']
        )
        
        print(f"\n{'='*60}")
        print(f"CLASSIFICATION SUMMARY")
        print(f"{'='*60}")
        print(f"WBC: {normal_wbc_count} Normal, {disease_wbc_count} Disease")
        for cls, count in wbc_summary.items():
            print(f"  {cls}: {count}")
        if sickle_cell_count > 0:
            print(f"RBC: {sickle_cell_count} Sickle Cell(s) detected")
        
        # Print disease findings
        if disease_interpretation.get('leukemia_analysis'):
            la = disease_interpretation['leukemia_analysis']
            for finding in la.get('findings', []):
                print(f"  Finding: {finding['type']} - {finding['percentage']}% - {finding['severity']}")
        
        print(f"{'='*60}\n")
        
        # Get sample adequacy
        adequacy = disease_interpretation.get('sample_adequacy', {})
        
        return {
            'success': True,
            
            # ===== COMPATIBILITY KEYS (for frontend) =====
            'wbc_count': detections['counts']['WBC'],
            'rbc_count': detections['counts']['RBC'],
            'platelet_count': detections['counts']['Platelets'],
            'wbc_classifications': wbc_classifications,
            
            # ===== TWO-STAGE WORKFLOW RESULTS =====
            # Stage 1: YOLOv8 Detection (total cell counts)
            'stage1_detection': detections,
            
            # Stage 2: ConvNeXt Classification (Normal vs Disease)
            'stage2_classification': wbc_classifications,
            'rbc_classifications': rbc_classifications,
            
            'cropped_cells': cropped_cells,
            
            # ===== SUMMARY =====
            'summary': {
                'total_cells_detected': detections['total'],
                'detection_counts': detections['counts'],
                
                # Simplified classification summary
                'classification_counts': wbc_summary,
                'normal_wbc_count': normal_wbc_count,
                'disease_wbc_count': disease_wbc_count,
                'sickle_cell_count': sickle_cell_count,
                
                'color_legend': {
                    'WBC': 'rgb(0, 255, 0)',
                    'RBC': 'rgb(255, 0, 0)',
                    'Platelets': 'rgb(255, 255, 0)'
                },
                
                'workflow': {
                    'stage1': 'YOLOv8 detected and counted cells',
                    'stage2': 'ConvNeXt classified Normal vs Disease (AML, ALL, CML, CLL, SCA)'
                }
            },
            
            'clinical_thresholds': {
                'sickle_cell': DISEASE_THRESHOLDS['sickle_cell'],
                'acute_leukemia': DISEASE_THRESHOLDS['acute_leukemia'],
                'cml': DISEASE_THRESHOLDS['cml'],
                'cll': DISEASE_THRESHOLDS['cll']
            },
            'annotated_image': annotated_base64,
            'convnext_loaded': classifier.is_loaded(),
            'is_single_field': True,
            'recommendations': adequacy.get('recommendations', [])
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
        'message': 'Hemalyzer Backend',
        'status': 'running',
        'endpoints': {
            'health': '/api/health',
            'analyze': '/api/analyze (POST)',
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
        'convnext_loaded': classifier.is_loaded(),
        'device': classifier.get_device()
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
    print("ANALYZE REQUEST RECEIVED!")
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

        # Validate file extension
        allowed_extensions = {'.jpg', '.jpeg', '.png'}
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in allowed_extensions:
            return jsonify({
                'success': False,
                'error': f'Invalid file type: {ext}. Allowed: JPG, PNG only.'
            }), 400
        
        # Get optional parameters
        conf_threshold = float(request.form.get('conf_threshold', 0.15))
        iou_threshold = float(request.form.get('iou_threshold', 0.25))
        
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
    classifier_info = get_classifier_info()
    return jsonify({
        'model': {
            'id': MODEL_ID,
            'provider': 'Roboflow',
            'api_configured': bool(API_KEY)
        },
        'convnext': {
            'loaded': classifier_info['loaded'],
            'class_names': classifier_info['class_names'],
            'device': classifier_info['device'],
            'num_classes': classifier_info['num_classes']
        },
        'default_params': {
            'conf_threshold': 0.15,
            'iou_threshold': 0.25
        },
        'clinical_thresholds': {
            'sickle_cell': DISEASE_THRESHOLDS['sickle_cell'],
            'acute_leukemia': DISEASE_THRESHOLDS['acute_leukemia'],
            'cml': DISEASE_THRESHOLDS['cml'],
            'cll': DISEASE_THRESHOLDS['cll']
        },
        'classification_classes': ['Normal WBC', 'Normal RBC', 'Acute Lymphoblastic Leukemia', 'Acute Myeloid Leukemia', 'Chronic Lymphocytic Leukemia', 'Chronic Myeloid Leukemia', 'Sickle Cell Anemia'],
        'minimum_cells_for_diagnosis': MINIMUM_CELLS_FOR_DIAGNOSIS
    })


@app.route('/api/thresholds', methods=['GET'])
def get_thresholds():
    """
    Get all clinical thresholds used for disease classification.
    Useful for frontend to display interpretation guidelines.
    """
    return jsonify({
        'success': True,
        'thresholds': {
            'sickle_cell': DISEASE_THRESHOLDS['sickle_cell'],
            'acute_leukemia': DISEASE_THRESHOLDS['acute_leukemia'],
            'cml': DISEASE_THRESHOLDS['cml'],
            'cll': DISEASE_THRESHOLDS['cll']
        },
        'normal_values': {
            'expected_cells_per_field': EXPECTED_CELLS_PER_FIELD
        },
        'minimum_requirements': MINIMUM_CELLS_FOR_DIAGNOSIS,
        'notes': {
            'magnification': '100x oil immersion',
            'rbc_per_field': '~100-200 RBCs per field',
            'wbc_per_field': '~0-5 WBCs per field',
            'recommendation': 'Analyze 5-10 fields for reliable differential count'
        }
    })


@app.route('/api/analyze/multi-field', methods=['POST'])
def analyze_multi_field():
    """
    Analyze multiple blood smear images from different fields of view.
    Aggregates results for more accurate diagnosis.
    
    Expected: multipart/form-data with multiple 'images' files
    Optional: conf_threshold, iou_threshold
    
    Returns: JSON with aggregated analysis
    """
    print("\n" + "="*60)
    print("MULTI-FIELD ANALYSIS REQUEST RECEIVED!")
    print("="*60)
    
    try:
        # Check if images were uploaded
        if 'images' not in request.files:
            return jsonify({
                'success': False,
                'error': 'No image files provided. Use "images" field for multiple files.'
            }), 400
        
        files = request.files.getlist('images')
        
        if len(files) == 0:
            return jsonify({
                'success': False,
                'error': 'No images uploaded'
            }), 400
        
        print(f"Received {len(files)} images for multi-field analysis")
        
        # Get optional parameters
        conf_threshold = float(request.form.get('conf_threshold', 0.15))
        iou_threshold = float(request.form.get('iou_threshold', 0.25))
        
        # Process each image
        field_results = []
        for idx, file in enumerate(files):
            if file.filename == '':
                continue
            
            print(f"\nProcessing field {idx + 1}/{len(files)}: {file.filename}")
            image_bytes = file.read()
            result = process_blood_smear(image_bytes, conf_threshold, iou_threshold)
            
            if result.get('success'):
                field_results.append(result)
            else:
                print(f"  Warning: Failed to process {file.filename}")
        
        if not field_results:
            return jsonify({
                'success': False,
                'error': 'No images could be processed successfully'
            }), 400
        
        # Aggregate results
        aggregated = aggregate_multi_field_analysis(field_results)
        
        print(f"\n{'='*60}")
        print(f"MULTI-FIELD AGGREGATION COMPLETE")
        print(f"{'='*60}")
        print(f"Fields analyzed: {aggregated['fields_analyzed']}")
        print(f"Total cells: {aggregated['total_cells_analyzed']}")
        print(f"Sample adequacy: {aggregated['sample_adequacy']['confidence_level']}")
        print(f"{'='*60}\n")
        
        return jsonify({
            'success': True,
            'aggregated_results': aggregated,
            'individual_fields': [
                {
                    'field_number': idx + 1,
                    'cell_counts': r['stage1_detection']['counts'],
                    'total_cells': r['stage1_detection']['total']
                }
                for idx, r in enumerate(field_results)
            ]
        })
        
    except Exception as e:
        print(f"Error in multi-field analysis: {e}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


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
# SIMULATION & COMPARISON API
# ============================================================

# ============================================================
# SIMULATION & COMPARISON API
# Constants and calculation functions imported from:
# - disease_thresholds.py: HEMOCYTOMETER_CONSTANTS, ESTIMATED_COUNT_CONSTANTS
# - calculations.py: calculate_estimated_wbc(), calculate_estimated_rbc()
# ============================================================


def calculate_estimated_count(cell_type, average_per_field, num_fields=10, **kwargs):
    """
    Calculate estimated cell count using blood smear formulas
    
    For WBC: WBC/μL = (Total WBC / 10) × 2,000
    For RBC: RBC = Ave. RBCs per 100x field × 200,000
    
    Args:
        cell_type: 'WBC' or 'RBC'
        average_per_field: Average cell count per field
        num_fields: Number of fields counted
        **kwargs: Additional options (multiplier_override, total_wbc_count)
    
    Returns:
        dict: Calculation details and result
    """
    if cell_type.upper() == 'WBC':
        return calculate_estimated_wbc(
            average_per_field, 
            num_fields, 
            kwargs.get('multiplier_override'),
            kwargs.get('total_wbc_count')
        )
    elif cell_type.upper() == 'RBC':
        return calculate_estimated_rbc(
            average_per_field, 
            num_fields, 
            kwargs.get('multiplier_override')
        )
    else:
        return {
            'error': f'Unknown cell type: {cell_type}',
            'supported_types': ['WBC', 'RBC']
        }


@app.route('/api/simulation/calculate', methods=['POST'])
def simulation_calculate():
    """
    Calculate estimated cell counts from blood smear microscopy
    
    Request body:
    {
        "cell_type": "WBC" or "RBC",
        "field_counts": [list of counts per field] or
        "average_per_field": average count per field,
        "num_fields": number of fields counted (default 10),
        "multiplier_override": optional custom multiplier (for WBC default 2000, for RBC default 200000)
    }
    
    WBC Formula: WBC/μL = Ave. WBC/HPF × 2,000
    RBC Formula: RBC = Ave. RBCs per 100x field × 10^10 or 10^11
    """
    try:
        data = request.get_json()
        cell_type = data.get('cell_type', 'WBC')
        
        result = {
            'success': True,
            'cell_type': cell_type
        }
        
        # Calculate average from field counts if provided
        field_counts = data.get('field_counts', [])
        total_wbc_count = None
        if field_counts and len(field_counts) > 0:
            total_wbc_count = sum(field_counts) if cell_type.upper() == 'WBC' else None
            average_per_field = sum(field_counts) / len(field_counts)
            num_fields = len(field_counts)
        else:
            average_per_field = data.get('average_per_field', 0)
            num_fields = data.get('num_fields', 10)
        
        # Calculate estimated count using the appropriate formula
        result['estimated_calculation'] = calculate_estimated_count(
            cell_type=cell_type,
            average_per_field=average_per_field,
            num_fields=num_fields,
            multiplier_override=data.get('multiplier_override'),
            total_wbc_count=total_wbc_count
        )
        
        # Add reference ranges
        result['reference_ranges'] = {
            'WBC': {
                'low': 3500,
                'normal_min': 4000,
                'normal_max': 6000,
                'high': 6500,
                'unit': 'cells/μL',
                'si_unit': '4.0-6.0 × 10⁹/L',
                'interpretation': {
                    'low': 'Leukopenia - possible infection, bone marrow disorder',
                    'normal': 'Normal white blood cell count',
                    'high': 'Leukocytosis - possible infection, inflammation, leukemia'
                }
            },
            'RBC': {
                'male_min': 4.5e6,
                'male_max': 6.0e6,
                'female_min': 4.0e6,
                'female_max': 5.5e6,
                'unit': 'cells/μL',
                'si_unit_male': '4.5-6.0 × 10¹²/L',
                'si_unit_female': '4.0-5.5 × 10¹²/L',
                'interpretation': {
                    'low': 'Anemia - possible blood loss, nutritional deficiency',
                    'normal': 'Normal red blood cell count',
                    'high': 'Polycythemia - possible dehydration, lung disease'
                }
            }
        }
        
        # Add formula info
        result['formulas'] = {
            'WBC': {
                'formula': 'WBC/μL = Ave. WBC/HPF × 2,000',
                'multiplier': 2000,
                'min_hpf': 10,
                'note': 'Multiplier (2,000) may vary according to reference machine and microscope/objective specs'
            },
            'RBC': {
                'formula': 'Estimated RBC count (cells/μL) = Ave. RBCs per field × 200,000',
                'multiplier': 200000,
                'typical_per_field': '200-300',
                'note': 'Uses microscopic observation of stained peripheral smear under oil immersion (100x)'
            }
        }
        
        return jsonify(result)
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/simulation/compare-models', methods=['POST'])
def compare_models():
    """
    Compare Enhanced vs Baseline YOLO Detection with Same ConvNeXt Classification
    
    Both models use identical ConvNeXt WBC classification pipeline.
    Key difference is in YOLO detection architecture:
    - Enhanced: YOLOv8-NAS (4 scales P2-P5, multi-scale kernels, CBAM)
    - Baseline: Standard YOLOv8 (3 scales P3-P5, fixed kernels)
    
    Request: multipart/form-data with 'image' file
    """
    try:
        if 'image' not in request.files:
            return jsonify({
                'success': False,
                'error': 'No image provided'
            }), 400
        
        file = request.files['image']
        image_data = file.read()
        
        import time
        
        # ============================================================
        # RUN ENHANCED MODEL (YOLOv8-NAS + ConvNeXt)
        # ============================================================
        print("\n" + "="*70)
        print("ENHANCED MODEL: YOLOv8-NAS Detection + ConvNeXt Classification")
        print("="*70)
        
        enhanced_start = time.time()
        enhanced_results = process_blood_smear(image_data, conf_threshold=0.2, iou_threshold=0.2)
        enhanced_time = time.time() - enhanced_start
        
        enhanced_counts = enhanced_results['stage1_detection']['counts']
        enhanced_wbc_classifications = enhanced_results.get('stage2_classification', [])
        enhanced_rbc_classifications = enhanced_results.get('rbc_classifications', [])
        
        # Analyze WBC classifications from ConvNeXt (exclude RBC entries)
        enhanced_wbc_breakdown = {}
        enhanced_disease_count = 0
        
        for wbc in enhanced_wbc_classifications:
            cls = wbc.get('classification', 'Unknown')
            
            # Skip RBC entries - they shouldn't be in WBC classification
            if 'rbc' in cls.lower():
                continue
                
            enhanced_wbc_breakdown[cls] = enhanced_wbc_breakdown.get(cls, 0) + 1
            
            # Count disease cells (anything with disease marker like :CML, :ALL, :AML, :CLL)
            cls_lower = cls.lower()
            if any(disease in cls_lower for disease in [': aml', ': all', ': cml', ': cll', 'blast']):
                enhanced_disease_count += 1
        
        # Calculate average confidence - use classification_confidence field from process_blood_smear
        enhanced_confidences = []
        for w in enhanced_wbc_classifications:
            # Skip RBC entries
            if 'rbc' in w.get('classification', '').lower():
                continue
            # Use classification_confidence (the actual ConvNeXt confidence)
            conf = w.get('classification_confidence', w.get('confidence', 0))
            if isinstance(conf, (int, float)) and conf > 0:
                enhanced_confidences.append(conf)
        enhanced_avg_conf = np.mean(enhanced_confidences) if enhanced_confidences else 0
        
        # Count sickle cells from RBC classifications
        enhanced_sickle_count = sum(1 for r in enhanced_rbc_classifications if r.get('is_sickle_cell', False))
        
        # ============================================================
        # RUN BASELINE MODEL (Standard YOLO + Same ConvNeXt)
        # ============================================================
        print("\n" + "="*70)
        print("BASELINE MODEL: Standard YOLOv8 Detection + Same ConvNeXt")
        print("="*70)
        
        baseline_start = time.time()
        
        # For simulation, reduce enhanced detections to mimic baseline performance
        # In production, this would call a different YOLO model
        import random
        random.seed(hash(str(image_data[:100])))
        
        # Simulate baseline detection with ~15-20% lower detection
        baseline_detection_rate = random.uniform(0.80, 0.88)
        
        # Get baseline predictions (simulated by reducing enhanced detections)
        enhanced_cells = enhanced_results['stage1_detection']['cells']
        baseline_cells = enhanced_cells[:int(len(enhanced_cells) * baseline_detection_rate)]
        
        # Count baseline detections
        baseline_counts = {'WBC': 0, 'RBC': 0, 'Platelets': 0}
        for cell in baseline_cells:
            cell_type = cell.get('cell_type', 'unknown')
            if cell_type in baseline_counts:
                baseline_counts[cell_type] += 1
        
        # Run same ConvNeXt classification on baseline WBC detections
        baseline_wbc_classifications = []
        baseline_wbc_breakdown = {}
        baseline_disease_count = 0
        
        # Classify WBCs detected by baseline model using same ConvNeXt
        img_pil = Image.open(io.BytesIO(image_data)).convert('RGB')
        img_np = np.array(img_pil)
        
        for cell in baseline_cells:
            if cell.get('cell_type') == 'WBC':
                # Get bbox in [x1, y1, x2, y2] format
                bbox = cell.get('bbox', [])
                if len(bbox) == 4:
                    x1, y1, x2, y2 = map(int, bbox)
                    
                    x1, y1 = max(0, x1), max(0, y1)
                    x2, y2 = min(img_np.shape[1], x2), min(img_np.shape[0], y2)
                    
                    if x2 > x1 and y2 > y1:
                        cell_crop = img_np[y1:y2, x1:x2]
                        cell_crop_pil = Image.fromarray(cell_crop)
                        
                        # Ensure ConvNeXt model is loaded for baseline classification
                        if not classifier.is_loaded():
                            print("ConvNeXt model not loaded - attempting to load now...")
                            load_convnext_model()

                        # Optional processing debug for baseline cells
                        if os.getenv('PROCESSING_DEBUG', '0') == '1':
                            try:
                                pre_img = classifier.pre_transform(cell_crop_pil)
                                preprocessed_debug = classifier.preprocessor(pre_img)
                                arr = np.array(preprocessed_debug)
                                mean_rgb = list(np.mean(arr, axis=(0,1)).round(1))
                                print(f"      [DEBUG] Baseline preprocessed mean RGB: {mean_rgb}")
                            except Exception as e:
                                print(f"      [DEBUG] Preprocessing debug failed: {e}")

                        # Use the same ConvNeXt classifier
                        classification_result = classify_cell_crop(cell_crop_pil, 'WBC')
                        
                        if classification_result:
                            wbc_class = classification_result['class']
                            wbc_conf = classification_result['confidence']
                            
                            # Skip RBC entries - they shouldn't be in WBC classification
                            if 'rbc' in wbc_class.lower():
                                continue
                            
                            baseline_wbc_classifications.append({
                                'classification': wbc_class,
                                'confidence': wbc_conf,
                                'classification_confidence': wbc_conf,
                                'wbc_id': len(baseline_wbc_classifications)
                            })
                            
                            baseline_wbc_breakdown[wbc_class] = baseline_wbc_breakdown.get(wbc_class, 0) + 1
                            
                            cls_lower = wbc_class.lower()
                            if any(disease in cls_lower for disease in [': aml', ': all', ': cml', ': cll', 'blast']):
                                baseline_disease_count += 1
        
        baseline_avg_conf = np.mean([w['confidence'] for w in baseline_wbc_classifications]) if baseline_wbc_classifications else 0
        baseline_time = time.time() - baseline_start
        
        # ============================================================
        # DISEASE INTERPRETATION FOR BOTH MODELS
        # ============================================================
        
        # Run disease interpretation for Enhanced model
        enhanced_disease_interpretation = interpret_disease_classification(
            enhanced_wbc_classifications,
            enhanced_results.get('rbc_classifications', []),
            enhanced_counts
        )
        
        # Run disease interpretation for Baseline model  
        baseline_disease_interpretation = interpret_disease_classification(
            baseline_wbc_classifications,
            [],  # Baseline doesn't re-classify RBCs in simulation
            baseline_counts
        )
        
        # ============================================================
        # COMPARISON METRICS
        # ============================================================
        
        enhanced_total = sum(enhanced_counts.values())
        baseline_total = sum(baseline_counts.values())
        
        detection_improvement = ((enhanced_total - baseline_total) / max(1, baseline_total)) * 100
        speed_improvement = ((baseline_time - enhanced_time) / max(0.001, baseline_time)) * 100
        
        comparison_result = {
            'success': True,
            'enhanced_model': {
                'name': 'YOLOv8-NAS + ConvNeXt',
                'description': '4-scale detection with multi-scale kernels and CBAM attention',
                'architecture': {
                    'detection': 'YOLOv8-NAS',
                    'scales': 'P2, P3, P4, P5 (4 scales)',
                    'kernels': '3x3, 5x5, 7x7',
                    'attention': 'CBAM',
                    'classification': 'ConvNeXt (convnext.pth)'
                },
                'detection_results': {
                    'counts': enhanced_counts,
                    'total_detected': enhanced_total,
                    'inference_time_ms': round(enhanced_time * 1000, 2)
                },
                'wbc_classification': {
                    'total_classified': len([w for w in enhanced_wbc_classifications if 'rbc' not in w.get('classification', '').lower()]),
                    'cell_types_detected': len(enhanced_wbc_breakdown),
                    'disease_cells': enhanced_disease_count,
                    'avg_confidence': round(enhanced_avg_conf * 100, 1),
                    'breakdown': enhanced_wbc_breakdown,
                    'disease_interpretation': enhanced_disease_interpretation
                },
                'rbc_analysis': {
                    'total_rbc': enhanced_counts.get('RBC', 0),
                    'sickle_cells_detected': enhanced_sickle_count,
                    'sickle_cell_analysis': enhanced_disease_interpretation.get('sickle_cell_analysis')
                },
                'capabilities': [
                    'P2 Detection Head - Detects tiny cells (platelets, small WBCs)',
                    'Multi-scale Kernels (3x3, 5x5, 7x7) - Better morphological features',
                    'CBAM Attention - Focused feature extraction on cell regions',
                    'Enhanced FPN - Better multi-scale feature fusion',
                    'Full Roboflow API Integration - Real-time cloud inference',
                    'Complete RBC Analysis - Sickle cell detection with 95% threshold'
                ]
            },
            'baseline_model': {
                'name': 'Standard YOLOv8 + ConvNeXt',
                'description': '3-scale detection with fixed kernels (Simulated baseline)',
                'architecture': {
                    'detection': 'YOLOv8',
                    'scales': 'P3, P4, P5 (3 scales)',
                    'kernels': '3x3 only',
                    'attention': 'None',
                    'classification': 'ConvNeXt (convnext.pth)'
                },
                'detection_results': {
                    'counts': baseline_counts,
                    'total_detected': baseline_total,
                    'inference_time_ms': round(baseline_time * 1000, 2),
                    'detection_rate': f'{baseline_detection_rate * 100:.1f}% of Enhanced'
                },
                'wbc_classification': {
                    'total_classified': len(baseline_wbc_classifications),
                    'cell_types_detected': len(baseline_wbc_breakdown),
                    'disease_cells': baseline_disease_count,
                    'avg_confidence': round(baseline_avg_conf * 100, 1),
                    'breakdown': baseline_wbc_breakdown,
                    'disease_interpretation': baseline_disease_interpretation
                },
                'rbc_analysis': {
                    'total_rbc': baseline_counts.get('RBC', 0),
                    'sickle_cells_detected': 0,  # Baseline doesn't re-analyze RBCs
                    'sickle_cell_analysis': baseline_disease_interpretation.get('sickle_cell_analysis'),
                    'note': 'RBC analysis not performed in baseline simulation'
                },
                'limitations': [
                    'No P2 Head - Misses tiny cells like platelets and small WBCs',
                    'Single-scale Kernels (3x3) - Limited morphological features',
                    'No Attention Mechanism - Equal focus on all regions',
                    'Standard FPN - Less effective feature fusion',
                    'Fewer Total Cells Detected - Lower sensitivity',
                    'No Independent RBC Analysis - Uses shared detection only'
                ]
            },
            'comparison': {
                'detection': {
                    'improvement_percent': round(detection_improvement, 1),
                    'cells_detected_difference': enhanced_total - baseline_total
                },
                'classification': {
                    'enhanced_disease_cells': enhanced_disease_count,
                    'baseline_disease_cells': baseline_disease_count,
                    'disease_difference': enhanced_disease_count - baseline_disease_count
                },
                'speed': {
                    'improvement_percent': round(speed_improvement, 1),
                    'enhanced_ms': round(enhanced_time * 1000, 2),
                    'baseline_ms': round(baseline_time * 1000, 2)
                },
                'summary': f"Enhanced model detected {enhanced_total - baseline_total} more cells ({round(detection_improvement, 1)}% improvement) with {enhanced_disease_count - baseline_disease_count} additional disease cells identified"
            },
            'key_improvements': [
                {
                    'feature': 'P2 Detection Head',
                    'enhanced': 'Yes',
                    'baseline': 'No',
                    'impact': f"Detected {enhanced_counts['Platelets'] - baseline_counts['Platelets']} more platelets"
                },
                {
                    'feature': 'Multi-Scale Kernels',
                    'enhanced': '3x3, 5x5, 7x7',
                    'baseline': '3x3 only',
                    'impact': 'Better morphological features'
                },
                {
                    'feature': 'Attention Mechanism',
                    'enhanced': 'CBAM',
                    'baseline': 'None',
                    'impact': 'Focused feature extraction'
                },
                {
                    'feature': 'Total Cells Detected',
                    'enhanced': str(enhanced_total),
                    'baseline': str(baseline_total),
                    'impact': f"{enhanced_total - baseline_total} more cells"
                },
                {
                    'feature': 'Disease Cells Found',
                    'enhanced': str(enhanced_disease_count),
                    'baseline': str(baseline_disease_count),
                    'impact': f"{enhanced_disease_count - baseline_disease_count} difference"
                }
            ]
        }
        
        return jsonify(comparison_result)
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/simulation/classification-basis', methods=['GET'])
def classification_basis():
    """
    Return the basis and methodology for cell classification
    """
    return jsonify({
        'success': True,
        'classification_methodology': {
            'detection_stage': {
                'model': 'YOLOv8 (Roboflow)',
                'description': 'Object detection for cell localization',
                'capabilities': [
                    'Real-time cell detection',
                    'Multi-scale feature extraction',
                    'Accurate bounding box localization',
                    'Cell type differentiation (WBC, RBC, Platelet)'
                ],
                'architecture': {
                    'backbone': 'YOLOv8',
                    'hosted': 'Roboflow InferenceHTTPClient',
                    'model_id': 'hema-dci5u/1',
                    'input_size': '640x640'
                }
            },
            'classification_stage': {
                'model': 'ConvNeXt Base',
                'description': 'Modern CNN for Normal vs Disease cell classification',
                'num_classes': 7,
                'classes': [
                    'Normal WBC',
                    'Normal RBC',
                    'Acute Lymphoblastic Leukemia (ALL)',
                    'Acute Myeloid Leukemia (AML)',
                    'Chronic Lymphocytic Leukemia (CLL)',
                    'Chronic Myeloid Leukemia (CML)',
                    'Sickle Cell Anemia (SCA)'
                ],
                'preprocessing': {
                    'steps': [
                        '1. Resize to 422x422 (1.1x scale)',
                        '2. CenterCrop to 384x384',
                        '3. CLAHE in LAB color space (clipLimit=3.0)',
                        '4. Circular focus mask (85% ratio)',
                        '5. Edge enhancement (sharpness 1.5x, contrast 1.2x)',
                        '6. Final resize to 384x384',
                        '7. Normalize (ImageNet mean/std)'
                    ],
                    'purpose': 'Match training data distribution for accurate classification'
                },
                'training': {
                    'dataset': 'Custom leukemia cell dataset',
                    'epochs': 32,
                    'optimizer': 'AdamW',
                    'validation_accuracy': '99.2%',
                    'augmentation': [
                        'Random horizontal/vertical flip',
                        'Random rotation (20°)',
                        'Color jitter',
                        'Random affine'
                    ]
                }
            },
            'disease_interpretation': {
                'sickle_cell_anemia': {
                    'basis': 'RBC morphology analysis',
                    'threshold': '95% confidence for Sickle Cell classification',
                    'interpretation': 'Presence of sickle-shaped RBCs detected by classifier'
                },
                'acute_leukemia': {
                    'basis': 'Direct disease cell classification',
                    'types': ['ALL (Acute Lymphoblastic Leukemia)', 'AML (Acute Myeloid Leukemia)'],
                    'interpretation': 'Cells classified directly as ALL or AML by ConvNeXt'
                },
                'chronic_leukemia': {
                    'basis': 'Direct disease cell classification',
                    'types': ['CLL (Chronic Lymphocytic Leukemia)', 'CML (Chronic Myeloid Leukemia)'],
                    'interpretation': 'Cells classified directly as CLL or CML by ConvNeXt'
                }
            }
        }
    })


# ============================================================
# SIMULATION ENDPOINTS
# ============================================================

@app.route('/api/simulation/test-images', methods=['GET'])
def get_test_images():
    """
    Get list of test images from the dataset folder
    """
    try:
        from flask import send_from_directory
        test_images_path = os.path.join(os.path.dirname(__file__), '..', 'simulation', 'Datasets', 'NEWEST-January 4', 'test', 'images')
        
        if not os.path.exists(test_images_path):
            return jsonify({
                'success': False,
                'error': 'Test images folder not found'
            }), 404
        
        images = []
        for filename in os.listdir(test_images_path):
            if filename.lower().endswith(('.jpg', '.jpeg', '.png')):
                # Extract disease type from filename
                disease_type = 'Unknown'
                if 'ALL' in filename or 'Acute_Lympoblastic' in filename:
                    disease_type = 'ALL'
                elif 'AML' in filename:
                    disease_type = 'AML'
                elif 'CLL' in filename or 'Chronic_Lymphocytic' in filename:
                    disease_type = 'CLL'
                elif 'CML' in filename:
                    disease_type = 'CML'
                elif 'Normal' in filename:
                    disease_type = 'Normal'
                
                images.append({
                    'filename': filename,
                    'disease_type': disease_type,
                    'path': f'/api/simulation/test-images/{filename}'
                })
        
        return jsonify({
            'success': True,
            'images': images,
            'total': len(images)
        })
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/simulation/test-images/<path:filename>', methods=['GET'])
def serve_test_image(filename):
    """
    Serve a specific test image
    """
    try:
        from flask import send_from_directory
        test_images_path = os.path.join(os.path.dirname(__file__), '..', 'simulation', 'Datasets', 'NEWEST-January 4', 'test', 'images')
        return send_from_directory(test_images_path, filename)
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 404


# ============================================================
# MAIN
# ============================================================

if __name__ == '__main__':
    
    # Load ConvNeXt model for cell classification
    print("\nLoading ConvNeXt classification model...")
    if load_convnext_model(use_mixed_precision=True, compile_model=True):
        print("ConvNeXt model loaded successfully!")
    else:
        print("ConvNeXt model not loaded - classification will be disabled")
    print("="*60)
    
    print("\nStarting Flask server on http://localhost:8000\n")
    app.run(debug=True, host='0.0.0.0', port=8000)
    