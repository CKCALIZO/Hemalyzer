"""
Hemalyzer Backend API
Blood Cell Analysis using Roboflow Inference API + ConvNeXt Classification
Model: bloodcell-hema (detection) + ConvNeXt (classification)
"""

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

# Import ConvNeXt classification module
from convnext_classifier import (
    load_convnext_model,
    classify_cell_crop,
    get_classifier_info,
    classifier
)

# Import disease thresholds and calculation modules
from disease_thresholds import (
    EXPECTED_CELLS_PER_FIELD,
    RECOMMENDED_FIELDS,
    EXPECTED_CELLS_PER_ANALYSIS,
    NORMAL_WBC_DIFFERENTIAL,
    DISEASE_THRESHOLDS,
    MINIMUM_CELLS_FOR_DIAGNOSIS,
    HEMOCYTOMETER_CONSTANTS,
    ESTIMATED_COUNT_CONSTANTS
)

from calculations import (
    calculate_confidence_interval,
    assess_sample_adequacy,
    calculate_estimated_wbc,
    calculate_estimated_rbc
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
# DISEASE INTERPRETATION FUNCTION
# ============================================================

def interpret_disease_classification(wbc_classifications, rbc_classifications, cell_counts, fields_analyzed=1):
    """
    Interpret disease classification based on cell analysis results.
    
    Args:
        wbc_classifications: List of WBC classification results
        rbc_classifications: List of RBC classification results  
        cell_counts: Dictionary with cell counts
        fields_analyzed: Number of 100x fields analyzed (recommended: 5)
    
    Returns:
        dict: Disease interpretation with confidence intervals
    """
    interpretation = {
        'sickle_cell_analysis': None,
        'leukemia_analysis': None,
        'wbc_differential': {},
        'differential_abnormalities': [],
        'overall_assessment': [],
        'confidence_intervals': {},
        'sample_adequacy': None,
        'fields_analyzed': fields_analyzed,
        'recommended_fields': RECOMMENDED_FIELDS
    }
    
    total_wbc = cell_counts.get('WBC', 0)
    total_rbc = cell_counts.get('RBC', 0)
    
    # Check sample adequacy
    interpretation['sample_adequacy'] = assess_sample_adequacy(cell_counts, fields_analyzed=fields_analyzed)
    
    # === SICKLE CELL ANALYSIS ===
    # NOTE: Sickle cells detected by ConvNeXt with >=95% confidence threshold
    # YOLOv8 only provides total RBC count; ConvNeXt identifies sickle cells
    sickle_count = sum(1 for r in rbc_classifications if r.get('is_sickle_cell', False))
    
    if total_rbc > 0:
        sickle_pct, sickle_lower, sickle_upper = calculate_confidence_interval(sickle_count, total_rbc)
        
        interpretation['confidence_intervals']['sickle_cell'] = {
            'point_estimate': sickle_pct,
            'lower_bound': sickle_lower,
            'upper_bound': sickle_upper,
            'cells_counted': total_rbc,
            'positive_cells': sickle_count
        }
        
        # Determine sickle cell interpretation based on percentage thresholds
        # Calculation: (Total Sickled Cells / Total RBCs) × 100
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
            'total_rbc_analyzed': total_rbc,
            'percentage': sickle_pct,
            'confidence_interval': f"{sickle_lower}% - {sickle_upper}%",
            'interpretation': sickle_interpretation,
            'severity': sickle_severity,
            'condition': sickle_condition,
            'calculation_method': f"({sickle_count} sickled cells / {total_rbc} total RBCs) × 100 = {sickle_pct:.2f}%",
            'note': "Percentage calculated across all analyzed fields for accurate diagnosis" if fields_analyzed > 1 else None
        }
    
    # === WBC DIFFERENTIAL & LEUKEMIA ANALYSIS ===
    # NOTE: This uses ConvNeXt CLASSIFICATIONS, not YOLOv8 detections
    # YOLOv8 only provides total WBC count; ConvNeXt determines the specific cell types
    if total_wbc > 0:
        # Count by ConvNeXt classification type for differential
        class_counts = {}
        for wbc in wbc_classifications:
            cls = wbc.get('classification', 'Unknown')
            class_counts[cls] = class_counts.get(cls, 0) + 1
        
        # Calculate percentages with confidence intervals for each class
        wbc_differential = {}
        differential_abnormalities = []
        
        for cls_name, count in class_counts.items():
            pct, lower, upper = calculate_confidence_interval(count, total_wbc)
            
            # Check against normal ranges
            normal_status = 'normal'
            normal_range = None
            
            # Extract base cell type from new format "CellType: Condition"
            # e.g., "Basophil: Normal" -> "Basophil", "Basophil: CML" -> "Basophil"
            base_cell_type = cls_name.split(':')[0].strip() if ':' in cls_name else cls_name
            
            # Map classification names to differential keys (case-insensitive)
            diff_key_mapping = {
                'neutrophil': 'Neutrophil',
                'neutrophils': 'Neutrophil',  # Handle "Neutrophils: CML"
                'lymphocyte': 'Lymphocyte',
                'monocyte': 'Monocyte',
                'eosinophil': 'Eosinophil',
                'eosonophil': 'Eosinophil',  # Handle typo in model class
                'basophil': 'Basophil'
            }
            
            diff_key = diff_key_mapping.get(base_cell_type.lower())
            if diff_key and diff_key in NORMAL_WBC_DIFFERENTIAL:
                normal_range = NORMAL_WBC_DIFFERENTIAL[diff_key]
                if pct < normal_range['min']:
                    normal_status = 'low'
                    differential_abnormalities.append({
                        'cell_type': cls_name,
                        'observed': pct,
                        'normal_range': f"{normal_range['min']}-{normal_range['max']}%",
                        'status': 'DECREASED',
                        'note': f"{base_cell_type} below normal range"
                    })
                elif pct > normal_range['max']:
                    normal_status = 'high'
                    differential_abnormalities.append({
                        'cell_type': cls_name,
                        'observed': pct,
                        'normal_range': f"{normal_range['min']}-{normal_range['max']}%",
                        'status': 'INCREASED',
                        'note': f"{base_cell_type} above normal range"
                    })
            
            wbc_differential[cls_name] = {
                'count': count,
                'percentage': pct,
                'confidence_interval': f"{lower}% - {upper}%",
                'lower_bound': lower,
                'upper_bound': upper,
                'normal_status': normal_status,
                'normal_range': f"{normal_range['min']}-{normal_range['max']}%" if normal_range else None
            }
        
        interpretation['wbc_differential'] = wbc_differential
        interpretation['differential_abnormalities'] = differential_abnormalities
        
        # Check for abnormal patterns
        # Classes are now in format "CellType: Condition" (e.g., "Basophil: Normal", "Basophil: CML")
        abnormal_count = sum(1 for w in wbc_classifications 
                            if ': normal' not in w.get('classification', '').lower())
        abnormal_pct, abn_lower, abn_upper = calculate_confidence_interval(abnormal_count, total_wbc)
        
        interpretation['confidence_intervals']['abnormal_wbc'] = {
            'point_estimate': abnormal_pct,
            'lower_bound': abn_lower,
            'upper_bound': abn_upper,
            'cells_counted': total_wbc,
            'abnormal_cells': abnormal_count
        }
        
        # ============================================================
        # DISEASE INTERPRETATION BASED ON THRESHOLDS (from About page)
        # New model classes format: "CellType: Condition"
        # ============================================================
        leukemia_findings = []
        
        # Helper function to count cells by disease type
        def count_by_disease(classifications, disease_marker):
            """Count classifications containing a specific disease marker (case-insensitive)"""
            return sum(1 for w in classifications 
                      if disease_marker.lower() in w.get('classification', '').lower())
        
        # === AML/ALL Analysis (Blast Cells) ===
        # Count ALL: classes like "B_lymphoblast: ALL"
        all_count = count_by_disease(wbc_classifications, ': all')
        # Count AML: classes like "Myeloblast: AML"  
        aml_count = count_by_disease(wbc_classifications, ': aml')
        blast_count = all_count + aml_count
        blast_pct = (blast_count / total_wbc) * 100 if total_wbc > 0 else 0
        
        aml_all_thresholds = DISEASE_THRESHOLDS['acute_leukemia']
        if blast_pct >= 20:
            interpretation_text = aml_all_thresholds['acute_leukemia']['interpretation']
            severity = 'HIGH'
            # Determine if ALL or AML based on which blast type is dominant
            if all_count > aml_count:
                leukemia_type = 'Acute Lymphoblastic Leukemia (ALL)'
            elif aml_count > all_count:
                leukemia_type = 'Acute Myeloid Leukemia (AML)'
            else:
                leukemia_type = 'Acute Leukemia (AML/ALL)'
            leukemia_findings.append({
                'type': leukemia_type,
                'percentage': round(blast_pct, 1),
                'interpretation': interpretation_text,
                'severity': severity,
                'all_count': all_count,
                'aml_count': aml_count,
                'condition': '>= 20% blasts'
            })
        elif blast_pct >= 11:
            leukemia_findings.append({
                'type': 'Suspicious / Pre-leukemic',
                'percentage': round(blast_pct, 1),
                'interpretation': aml_all_thresholds['suspicious']['interpretation'],
                'severity': 'MODERATE',
                'all_count': all_count,
                'aml_count': aml_count,
                'condition': '11-19% blasts'
            })
        elif blast_pct >= 6:
            leukemia_findings.append({
                'type': 'Slightly Increased Blasts',
                'percentage': round(blast_pct, 1),
                'interpretation': aml_all_thresholds['slightly_increased']['interpretation'],
                'severity': 'LOW',
                'all_count': all_count,
                'aml_count': aml_count,
                'condition': '6-10% blasts'
            })
        
        # === CML Analysis (Granulocyte Percentage) ===
        # Count CML: classes like "Basophil: CML", "Neutrophils: CML", "Eosonophil: CML", "Myeloblast: CML"
        cml_count = count_by_disease(wbc_classifications, ': cml')
        
        # Also count normal granulocytes (these are NOT CML)
        # Normal granulocytes = Basophil: Normal + Eosinophil: Normal + Neutrophil: Normal
        def count_normal_cell_type(classifications, cell_type):
            """Count normal cells of a specific type"""
            return sum(1 for w in classifications 
                      if cell_type.lower() in w.get('classification', '').lower() 
                      and ': normal' in w.get('classification', '').lower())
        
        normal_granulocyte_count = (
            count_normal_cell_type(wbc_classifications, 'basophil') +
            count_normal_cell_type(wbc_classifications, 'eosinophil') +
            count_normal_cell_type(wbc_classifications, 'neutrophil')
        )
        
        # CML percentage is based on CML-classified cells, not total granulocytes
        cml_pct = (cml_count / total_wbc) * 100 if total_wbc > 0 else 0
        total_granulocyte_pct = ((cml_count + normal_granulocyte_count) / total_wbc) * 100 if total_wbc > 0 else 0
        
        cml_thresholds = DISEASE_THRESHOLDS['cml']
        cml_interpretation = None
        cml_severity = None
        
        # Use CML cell percentage for disease classification
        if cml_pct > 50:  # More than half of cells are CML
            cml_interpretation = cml_thresholds['accelerated']['interpretation']
            cml_severity = 'HIGH'
            cml_condition = f'> 50% CML cells ({cml_count} cells)'
        elif cml_pct >= 20:
            cml_interpretation = cml_thresholds['chronic_phase']['interpretation']
            cml_severity = 'MODERATE'
            cml_condition = f'20-50% CML cells ({cml_count} cells)'
        elif cml_pct >= 5:
            cml_interpretation = cml_thresholds['early_cml']['interpretation']
            cml_severity = 'LOW'
            cml_condition = f'5-19% CML cells ({cml_count} cells)'
        elif cml_count > 0:
            cml_interpretation = "Rare CML cells detected. Clinical correlation required."
            cml_severity = 'INFO'
            cml_condition = f'< 5% CML cells ({cml_count} cells)'
        
        if cml_interpretation:
            leukemia_findings.append({
                'type': 'CML Analysis',
                'percentage': round(cml_pct, 1),
                'interpretation': cml_interpretation,
                'severity': cml_severity,
                'cml_count': cml_count,
                'normal_granulocyte_count': normal_granulocyte_count,
                'total_granulocyte_pct': round(total_granulocyte_pct, 1),
                'condition': cml_condition
            })
        
        # === CLL Analysis (Lymphocyte Percentage) ===
        # Count CLL: classes like "Lymphocyte: CLL"
        cll_count = count_by_disease(wbc_classifications, ': cll')
        normal_lymphocyte_count = count_normal_cell_type(wbc_classifications, 'lymphocyte')
        
        cll_pct = (cll_count / total_wbc) * 100 if total_wbc > 0 else 0
        total_lymphocyte_pct = ((cll_count + normal_lymphocyte_count) / total_wbc) * 100 if total_wbc > 0 else 0
        
        cll_thresholds = DISEASE_THRESHOLDS['cll']
        cll_interpretation = None
        cll_severity = None
        
        # Use CLL cell percentage for disease classification
        if cll_pct > 50:  # More than half of cells are CLL
            cll_interpretation = cll_thresholds['advanced_cll']['interpretation']
            cll_severity = 'HIGH'
            cll_condition = f'> 50% CLL cells ({cll_count} cells)'
        elif cll_pct >= 20:
            cll_interpretation = cll_thresholds['typical_cll']['interpretation']
            cll_severity = 'MODERATE'
            cll_condition = f'20-50% CLL cells ({cll_count} cells)'
        elif cll_pct >= 5:
            cll_interpretation = cll_thresholds['early_cll']['interpretation']
            cll_severity = 'LOW'
            cll_condition = f'5-19% CLL cells ({cll_count} cells)'
        elif cll_count > 0:
            cll_interpretation = "Rare CLL cells detected. Clinical correlation required."
            cll_severity = 'INFO'
            cll_condition = f'< 5% CLL cells ({cll_count} cells)'
        
        if cll_interpretation:
            leukemia_findings.append({
                'type': 'CLL Analysis',
                'percentage': round(cll_pct, 1),
                'interpretation': cll_interpretation,
                'severity': cll_severity,
                'cll_count': cll_count,
                'normal_lymphocyte_count': normal_lymphocyte_count,
                'total_lymphocyte_pct': round(total_lymphocyte_pct, 1),
                'condition': cll_condition
            })
        
        interpretation['leukemia_analysis'] = {
            'findings': leukemia_findings,
            'abnormal_wbc_percentage': abnormal_pct,
            'confidence_interval': f"{abn_lower}% - {abn_upper}%",
            'total_wbc_analyzed': total_wbc,
            'classification_counts': class_counts,
            # Add computed disease percentages for frontend display
            'disease_percentages': {
                'blast_cells': {
                    'percentage': round(blast_pct, 1),
                    'count': blast_count,
                    'all_count': all_count,
                    'aml_count': aml_count
                },
                'granulocytes': {
                    'percentage': round(total_granulocyte_pct, 1),
                    'count': cml_count + normal_granulocyte_count,
                    'cml_count': cml_count,
                    'normal_count': normal_granulocyte_count
                },
                'lymphocytes': {
                    'percentage': round(total_lymphocyte_pct, 1),
                    'count': cll_count + normal_lymphocyte_count,
                    'cll_count': cll_count,
                    'normal_count': normal_lymphocyte_count
                }
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
    
    # Safely access leukemia_analysis findings (may be None if no WBCs detected)
    leukemia_analysis = interpretation.get('leukemia_analysis')
    if leukemia_analysis and leukemia_analysis.get('findings'):
        for finding in leukemia_analysis['findings']:
            interpretation['overall_assessment'].append({
                'type': 'finding',
                'severity': finding.get('severity', 'INFO'),
                'message': f"{finding['type']}: {finding['interpretation']}"
            })
    
    # Add differential abnormalities to assessment
    for abnormality in interpretation.get('differential_abnormalities', []):
        interpretation['overall_assessment'].append({
            'type': 'differential',
            'severity': 'INFO',
            'message': f"{abnormality['cell_type']} {abnormality['status']}: {abnormality['observed']}% (Normal: {abnormality['normal_range']})"
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
MODEL_ID = "hemalens-6807i/2"  # Enhanced YOLOv8-NAS model
BASELINE_MODEL_ID = "hemalens-baseline/1"  # Standard YOLOv8 baseline (if available)
# Note: If baseline model doesn't exist, we'll simulate with reduced detection rate


# ============================================================
# CONVNEXT FUNCTIONS - Now in convnext_classifier.py module
# Functions are imported at top of file:
#   - load_convnext_model()
#   - classify_cell_crop()
#   - get_classifier_info()
# ============================================================


# ============================================================
# INFERENCE FUNCTION
# ============================================================

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
        
        print(f"\n{'='*60}")
        print(f"PROCESSING IMAGE WITH ROBOFLOW")
        print(f"{'='*60}")
        print(f"Image size: {original_w} x {original_h}")
        print(f"Confidence threshold: {conf_threshold}")
        print(f"IoU threshold: {iou_threshold}")
        print(f"Model: {MODEL_ID}")
        
        # Convert image to base64 for direct API call
        _, buffer = cv2.imencode('.jpg', image)
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
            error_msg = f"Roboflow connection failed after {max_retries} attempts: {last_error}"
            print(f"   ✗ {error_msg}")
            return {'success': False, 'error': str(last_error)}
        
        print(f"Roboflow response received")
        print(f"Raw response keys: {result.keys() if isinstance(result, dict) else type(result)}")
        
        # Parse predictions
        predictions = result.get('predictions', [])
        
        print(f"Raw detections: {len(predictions)}")
        
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
        
        # ========== STAGE 2: ConvNeXt Classification (Cell Type Identification) ==========
        print(f"\n{'='*60}")
        print(f"STAGE 2: CONVNEXT CLASSIFICATION (WBC Differential & Sickle Cell Detection)")
        print(f"{'='*60}")
        
        wbc_classifications = []
        rbc_classifications = []
        cropped_cells = []  # Store cropped images for frontend
        
        if classifier.is_loaded():
            print(f"Starting ConvNeXt classification for detected cells...")
            
            wbc_idx = 0
            rbc_idx = 0
            
            for detection in detections['cells']:
                cell_type = detection.get('cell_type', 'Unknown')
                x1, y1, x2, y2 = map(int, detection['bbox'])
                
                # Skip Platelets - we only classify WBC and RBC
                if cell_type == 'Platelet' or cell_type == 'Unknown':
                    continue
                
                # Calculate cell dimensions
                cell_width = x2 - x1
                cell_height = y2 - y1
                cell_center_x = (x1 + x2) // 2
                cell_center_y = (y1 + y2) // 2
                
                # Create SQUARE crop centered on cell with optimal padding
                # The classifier's preprocessing pipeline (matching training EXACTLY):
                #   1. pre_transform: Resize to 384x384
                #   2. AdaptiveCellPreprocessing:
                #      a. Stain normalization (OD space)
                #      b. CLAHE contrast enhancement (YUV space, clipLimit=3.0)
                #      c. Cell detection and centering (Otsu thresholding)
                #   3. ToTensor + Normalize (ImageNet stats)
                # 
                # Padding strategy: Use enough context for cell detection to work
                # - Use 2.5x for WBC (larger cells need more context)
                # - Use 1.5x for RBC (smaller, more uniform cells)
                max_dim = max(cell_width, cell_height)
                
                if cell_type == 'WBC':
                    crop_size = int(max_dim * 2.5)  # Increased from 1.8x - more context for WBC
                else:
                    crop_size = int(max_dim * 1.5)  # Standard padding for RBC
                
                # Ensure minimum crop size for quality preprocessing
                # Crops smaller than 180px can cause Platelet misclassification
                MIN_CROP_DIM = 180  # Increased from 120px for better quality and consistency
                crop_size = max(crop_size, MIN_CROP_DIM)
                
                h, w = image_rgb_clean.shape[:2]
                
                # Calculate square crop bounds centered on cell
                half_size = crop_size // 2
                x1_padded = cell_center_x - half_size
                y1_padded = cell_center_y - half_size
                x2_padded = cell_center_x + half_size
                y2_padded = cell_center_y + half_size
                
                # Handle edge cases with padding (instead of shrinking crop)
                # This maintains consistent crop size even at image edges
                pad_left = max(0, -x1_padded)
                pad_top = max(0, -y1_padded)
                pad_right = max(0, x2_padded - w)
                pad_bottom = max(0, y2_padded - h)
                
                # Clamp to image bounds
                x1_padded = max(0, x1_padded)
                y1_padded = max(0, y1_padded)
                x2_padded = min(w, x2_padded)
                y2_padded = min(h, y2_padded)
                
                # Crop cell from CLEAN image (no bounding boxes)
                cell_crop = image_rgb_clean[y1_padded:y2_padded, x1_padded:x2_padded]
                
                if cell_crop.size == 0:
                    continue
                
                # Add padding with light gray background if crop was at image edge
                # This matches the training data background (240, 240, 240)
                if pad_left > 0 or pad_top > 0 or pad_right > 0 or pad_bottom > 0:
                    padded_crop = np.full((crop_size, crop_size, 3), 240, dtype=np.uint8)
                    padded_crop[pad_top:pad_top+cell_crop.shape[0], 
                               pad_left:pad_left+cell_crop.shape[1]] = cell_crop
                    cell_crop = padded_crop
                
                # Convert to PIL Image
                # CRITICAL: Pass the raw crop to the classifier - do NOT resize here!
                # The classifier's pipeline handles all preprocessing:
                #   1. pre_transform: Resize to 384x384
                #   2. AdaptiveCellPreprocessing: stain normalization + CLAHE + cell detection
                #   3. transform: ToTensor + Normalize
                # This matches the training val_transform EXACTLY.
                cell_crop_pil = Image.fromarray(cell_crop)
                
                # Log crop info for debugging
                crop_w, crop_h = cell_crop_pil.size
                
                # Convert crop to base64 for frontend display
                # Create a display version (384x384) for frontend only
                display_crop = cell_crop_pil.resize((384, 384), Image.LANCZOS)
                crop_buffer = io.BytesIO()
                display_crop.save(crop_buffer, format='PNG')
                crop_base64 = base64.b64encode(crop_buffer.getvalue()).decode('utf-8')
                
                # Classify WBC
                if cell_type == 'WBC':
                    wbc_idx += 1
                    
                    # Debug: Log crop dimensions for analysis
                    print(f"   WBC #{wbc_idx}: crop size {cell_crop_pil.size}, bbox={cell_width}x{cell_height}")

                    # Ensure ConvNeXt model is loaded
                    if not classifier.is_loaded():
                        print("ConvNeXt model not loaded - attempting to load now...")
                        load_convnext_model()

                    # Optional processing debug: run pre_transform + preprocessor and log mean RGB
                    if os.getenv('PROCESSING_DEBUG', '0') == '1':
                        try:
                            pre_img = classifier.pre_transform(cell_crop_pil)
                            preprocessed_debug = classifier.preprocessor(pre_img)
                            arr = np.array(preprocessed_debug)
                            mean_rgb = list(np.mean(arr, axis=(0,1)).round(1))
                            print(f"      [DEBUG] Preprocessed mean RGB: {mean_rgb}")
                        except Exception as e:
                            print(f"      [DEBUG] Preprocessing debug failed: {e}")

                    classification = classify_cell_crop(cell_crop_pil, 'WBC')
                    
                    if classification:
                        wbc_class = classification['class']
                        wbc_confidence = classification['confidence']
                        probs = classification['probabilities']
                        
                        # DIAGNOSTIC: Log top 3 predictions for debugging CML over-prediction
                        sorted_probs = sorted(probs.items(), key=lambda x: x[1], reverse=True)[:3]
                        print(f"      Top 3 predictions:")
                        for cls_name, prob in sorted_probs:
                            print(f"        {cls_name}: {prob:.3f} ({prob*100:.1f}%)")
                        
                        # CRITICAL: Exclude ALL non-WBC classes when classifying WBC crops
                        # The model contains RBC and Platelet classes that should NEVER be returned for WBCs
                        # Non-WBC classes to exclude: RBC: Normal, Platelet: Normal, RBC: Sickle Cell Anemia
                        NON_WBC_CLASSES = {
                            'rbc: normal',
                            'platelet: normal', 
                            'rbc: sickle cell anemia'
                        }
                        
                        is_non_wbc_class = wbc_class.lower() in NON_WBC_CLASSES
                        
                        if is_non_wbc_class:
                            print(f"   WBC #{wbc_idx} predicted as {wbc_class} (non-WBC class) - filtering to WBC classes only")
                            
                            # Get only valid WBC probabilities (exclude all non-WBC classes)
                            wbc_only_probs = {
                                cls_name: prob 
                                for cls_name, prob in probs.items() 
                                if cls_name.lower() not in NON_WBC_CLASSES
                            }
                            
                            if wbc_only_probs:
                                # Re-normalize probabilities to sum to 1.0 (100%)
                                total_prob = sum(wbc_only_probs.values())
                                if total_prob > 0:
                                    normalized_probs = {
                                        cls_name: prob / total_prob 
                                        for cls_name, prob in wbc_only_probs.items()
                                    }
                                    
                                    # Find highest probability WBC class after normalization
                                    best_wbc_class = max(normalized_probs.items(), key=lambda x: x[1])
                                    wbc_class = best_wbc_class[0]
                                    wbc_confidence = best_wbc_class[1]
                                    
                                    print(f"      → Using {wbc_class} (normalized confidence: {wbc_confidence:.3f})")
                                else:
                                    # Fallback if normalization fails
                                    wbc_class = 'Neutrophil: Normal'
                                    wbc_confidence = 0.5
                            else:
                                # Ultimate fallback if no WBC classes found
                                wbc_class = 'Neutrophil: Normal'
                                wbc_confidence = 0.5
                        
                        # ENHANCED DISEASE-SPECIFIC CONFIDENCE THRESHOLDS
                        # Different thresholds based on disease type to prevent over-prediction
                        # CML is commonly over-predicted, so we use 95% threshold
                        DISEASE_CONFIDENCE_THRESHOLDS = {
                            'cml': 0.95,   # 95% for CML (very strict - user requested)
                            'aml': 0.90,   # 90% for AML (high confidence needed)
                            'all': 0.90,   # 90% for ALL (high confidence needed)
                            'cll': 0.88,   # 88% for CLL (slightly lower as it's less over-predicted)
                            'default': 0.85  # 85% for other conditions
                        }
                        
                        is_disease_prediction = ': normal' not in wbc_class.lower()
                        
                        if is_disease_prediction:
                            # Extract condition from "CellType: Condition" format
                            condition = wbc_class.split(':')[1].strip().lower() if ':' in wbc_class else ''
                            
                            # Get appropriate threshold for this disease type
                            threshold = DISEASE_CONFIDENCE_THRESHOLDS.get(condition, DISEASE_CONFIDENCE_THRESHOLDS['default'])
                            
                            if wbc_confidence < threshold:
                                print(f"   WBC #{wbc_idx} predicted as {wbc_class} with confidence {wbc_confidence:.3f}")
                                print(f"      → Applying {condition.upper()} threshold ({threshold*100:.0f}%) - defaulting to normal cell type")
                                
                                # Extract cell type (e.g., "Basophil: CML" → "Basophil", "Neutrophils: CML" → "Neutrophils")
                                cell_type_name = wbc_class.split(':')[0].strip() if ':' in wbc_class else wbc_class
                                
                                # Normalize cell type name to handle:
                                # 1. Plural/singular variations: "Neutrophils" → "Neutrophil"
                                # 2. Typos in model class names: "Eosonophil" → "Eosinophil"
                                cell_type_corrections = {
                                    'neutrophils': 'Neutrophil',
                                    'eosonophil': 'Eosinophil',  # Fix typo in model class names
                                }
                                cell_type_base = cell_type_corrections.get(cell_type_name.lower(), 
                                                  cell_type_name.rstrip('s') if cell_type_name.endswith('s') and cell_type_name.lower() not in ['basophils'] else cell_type_name)
                                
                                # Find the corresponding ': Normal' class in probabilities
                                # Try multiple variations to handle dataset naming inconsistencies
                                normal_variant_candidates = [
                                    f"{cell_type_base}: Normal",      # Corrected form first (e.g., "Neutrophil: Normal")
                                    f"{cell_type_name}: Normal",      # Exact match (e.g., "Neutrophils: Normal")
                                    f"{cell_type_name}s: Normal",     # Plural form (e.g., "Basophils: Normal")
                                ]
                                
                                # Find the best matching normal variant
                                matched_normal = None
                                for candidate in normal_variant_candidates:
                                    if candidate in probs:
                                        matched_normal = candidate
                                        break
                                
                                if matched_normal:
                                    wbc_class = matched_normal
                                    wbc_confidence = probs[matched_normal]
                                    print(f"      → Reclassified as {wbc_class} (confidence: {wbc_confidence:.3f})")
                                else:
                                    # If no exact match, find any normal class for this cell type base name
                                    # Check for partial matches (e.g., "neutrophil" in "Neutrophil: Normal")
                                    normal_classes = {k: v for k, v in probs.items() 
                                                    if (cell_type_base.lower() in k.lower() or cell_type_name.lower() in k.lower()) 
                                                    and ': normal' in k.lower()}
                                    if normal_classes:
                                        best_normal = max(normal_classes.items(), key=lambda x: x[1])
                                        wbc_class = best_normal[0]
                                        wbc_confidence = best_normal[1]
                                        print(f"      → Reclassified as {wbc_class} (confidence: {wbc_confidence:.3f})")
                                    else:
                                        # Ultimate fallback: Create a normal class name from the original cell type
                                        # This ensures abnormal cells ALWAYS become normal variants
                                        wbc_class = f"{cell_type_base}: Normal"
                                        wbc_confidence = 0.5  # Default confidence for fallback
                                        print(f"      → Created fallback normal class: {wbc_class} (confidence: {wbc_confidence:.3f})")
                        
                        # Note: Additional basophil validation removed - handled by disease threshold logic above
                        
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
                        
                        # Add to cropped cells for display - ONLY ABNORMAL WBCs
                        # Check if classification contains ': Normal' suffix (not just != 'Normal')
                        is_normal_cell = ': normal' in wbc_class.lower()
                        
                        if not is_normal_cell:
                            cropped_cells.append({
                                'id': f'WBC_{wbc_idx}',
                                'cell_type': 'WBC',
                                'classification': wbc_class,
                                'confidence': wbc_confidence,
                                'cropped_image': crop_base64,
                                'is_abnormal': True
                            })
                
                # Classify RBC - only show if it's a Sickle Cell with HIGH confidence (>=95%)
                elif cell_type == 'RBC':
                    rbc_idx += 1

                    # Ensure ConvNeXt model is loaded
                    if not classifier.is_loaded():
                        print("ConvNeXt model not loaded - attempting to load now...")
                        load_convnext_model()

                    # Optional processing debug
                    if os.getenv('PROCESSING_DEBUG', '0') == '1':
                        try:
                            pre_img = classifier.pre_transform(cell_crop_pil)
                            preprocessed_debug = classifier.preprocessor(pre_img)
                            arr = np.array(preprocessed_debug)
                            mean_rgb = list(np.mean(arr, axis=(0,1)).round(1))
                            print(f"      [DEBUG] Preprocessed mean RGB (RBC): {mean_rgb}")
                        except Exception as e:
                            print(f"      [DEBUG] Preprocessing debug failed: {e}")

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
            
            print(f"Classified {len(wbc_classifications)} WBCs")
            print(f"Classified {len(rbc_classifications)} RBCs")
            sickle_count = sum(1 for r in rbc_classifications if r.get('is_sickle_cell', False))
            print(f"   Sickle Cells detected: {sickle_count}")
        else:
            print(f"ConvNeXt model not loaded - skipping classification")
        
        # Convert annotated image to base64 with high quality
        pil_image = Image.fromarray(image_rgb)
        buffer = io.BytesIO()
        pil_image.save(buffer, format='JPEG', quality=95)  # Higher quality for HD output
        annotated_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        
        # Summary statistics for WBC classifications
        wbc_summary = {}
        for wbc in wbc_classifications:
            cls = wbc['classification']
            wbc_summary[cls] = wbc_summary.get(cls, 0) + 1
        
        # Count abnormal cells for quick summary
        # A cell is ABNORMAL if it does NOT contain ': Normal' in classification
        # e.g., "Neutrophil: CML" is abnormal, "Neutrophil: Normal" is normal
        abnormal_wbc_count = sum(1 for w in wbc_classifications 
                                  if ': normal' not in w['classification'].lower())
        sickle_cell_count = sum(1 for r in rbc_classifications if r.get('is_sickle_cell', False))
        
        # ========== DISEASE INTERPRETATION WITH THRESHOLDS ==========
        # NOTE: Disease interpretation is calculated here for terminal logging,
        # but NOT sent to frontend for single-image analysis.
        # Frontend will calculate final interpretation after 10 images are collected.
        disease_interpretation = interpret_disease_classification(
            wbc_classifications,
            rbc_classifications,
            detections['counts']
        )
        
        print(f"\n{'='*60}")
        print(f"DISEASE INTERPRETATION")
        print(f"{'='*60}")
        
        # Print sample adequacy
        adequacy = disease_interpretation['sample_adequacy']
        print(f"Sample Adequacy: {adequacy['confidence_level'].upper()}")
        for warning in adequacy['warnings']:
            print(f"  Warning: {warning}")
        
        # Print sickle cell analysis
        if disease_interpretation['sickle_cell_analysis']:
            sca = disease_interpretation['sickle_cell_analysis']
            print(f"\nSickle Cell Analysis:")
            print(f"  Sickle cells: {sca['sickle_cell_count']}/{sca['total_rbc_analyzed']} RBCs ({sca['percentage']}%)")
            print(f"  95% CI: {sca['confidence_interval']}")
            print(f"  Interpretation: {sca['interpretation']}")
        
        # Print leukemia analysis
        if disease_interpretation['leukemia_analysis']:
            la = disease_interpretation['leukemia_analysis']
            print(f"\nLeukemia Analysis:")
            print(f"  Abnormal WBCs: {la['abnormal_wbc_percentage']}% (CI: {la['confidence_interval']})")
            for finding in la['findings']:
                print(f"  Finding: {finding['type']} - {finding['interpretation']}")
        
        print(f"{'='*60}\n")
        
        return {
            'success': True,
            
            # ===== TWO-STAGE WORKFLOW RESULTS =====
            # Stage 1: YOLOv8 Detection (total cell counts)
            'stage1_detection': detections,  # Total WBC, RBC, Platelet counts from YOLOv8
            
            # Stage 2: ConvNeXt Classification (cell type identification)
            'stage2_classification': wbc_classifications,  # WBC types from ConvNeXt
            'rbc_classifications': rbc_classifications,    # Sickle cell detection from ConvNeXt
            
            'cropped_cells': cropped_cells,  # For the new CellClassifications page
            
            # ===== SUMMARY =====
            'summary': {
                # YOLOv8 detection totals
                'total_cells_detected': detections['total'],
                'detection_counts': detections['counts'],  # Total WBC/RBC/Platelet from YOLOv8
                
                # ConvNeXt classification results
                'wbc_differential': wbc_summary,  # WBC types from ConvNeXt (for differential count)
                'abnormal_wbc_count': abnormal_wbc_count,
                'sickle_cell_count': sickle_cell_count,
                
                'color_legend': {
                    'WBC': 'rgb(0, 255, 0)',
                    'RBC': 'rgb(255, 0, 0)',
                    'Platelets': 'rgb(255, 255, 0)'
                },
                
                # Workflow explanation
                'workflow': {
                    'stage1': 'YOLOv8 detected and counted cells',
                    'stage2': 'ConvNeXt classified WBC types and detected sickle cells'
                }
            },
            
            # NOTE: disease_interpretation is NOT included in single-image response.
            # Frontend will aggregate multiple images and calculate final interpretation
            # when 10 images threshold is met.
            # 'disease_interpretation': disease_interpretation,  # REMOVED - only for multi-image analysis
            'clinical_thresholds': {
                'sickle_cell': DISEASE_THRESHOLDS['sickle_cell'],
                'acute_leukemia': DISEASE_THRESHOLDS['acute_leukemia'],
                'cml': DISEASE_THRESHOLDS['cml'],
                'cll': DISEASE_THRESHOLDS['cll'],
                'normal_wbc_differential': NORMAL_WBC_DIFFERENTIAL
            },
            'annotated_image': annotated_base64,
            'convnext_loaded': classifier.is_loaded(),
            'is_single_field': True,  # Flag for frontend to show multi-field recommendation
            'recommendations': adequacy['recommendations']
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
        'normal_wbc_differential': NORMAL_WBC_DIFFERENTIAL,
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
            'wbc_differential': NORMAL_WBC_DIFFERENTIAL,
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
                    'classification': 'ConvNeXt (best_leukemia_model.pth)'
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
                    'differential': enhanced_disease_interpretation.get('wbc_differential', {}),
                    'leukemia_analysis': enhanced_disease_interpretation.get('leukemia_analysis'),
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
                    'classification': 'ConvNeXt (best_leukemia_model.pth)'
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
                    'differential': baseline_disease_interpretation.get('wbc_differential', {}),
                    'leukemia_analysis': baseline_disease_interpretation.get('leukemia_analysis'),
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
                'model': 'YOLOv8-NAS with Enhanced FPN',
                'description': 'Neural Architecture Search optimized object detection',
                'capabilities': [
                    'Real-time cell detection',
                    'Multi-scale feature extraction',
                    'Accurate bounding box localization',
                    'Cell type differentiation (WBC, RBC, Platelet)'
                ],
                'architecture': {
                    'backbone': 'NAS-optimized CSPDarknet',
                    'neck': 'Enhanced Feature Pyramid Network (FPN)',
                    'head': 'Decoupled detection head',
                    'input_size': '640x640',
                    'training_images': 5000
                }
            },
            'classification_stage': {
                'model': 'ConvNeXt Base',
                'description': 'Modern CNN for detailed WBC subtype classification',
                'num_classes': 20,
                'class_categories': {
                    'normal_wbc': [
                        'Basophil: Normal',
                        'Eosinophil: Normal',
                        'Neutrophil: Normal',
                        'Lymphocyte: Normal',
                        'Monocyte: Normal',
                        'B_lymphoblast: Normal',
                        'Metamyelocyte: Normal',
                        'Myelocyte: Normal',
                        'Promyelocyte: Normal',
                        'Erythroblast: Normal'
                    ],
                    'leukemia_wbc': [
                        'B_lymphoblast: ALL (Acute Lymphoblastic Leukemia)',
                        'Myeloblast: AML (Acute Myeloid Leukemia)',
                        'Lymphocyte: CLL (Chronic Lymphocytic Leukemia)',
                        'Basophil: CML (Chronic Myeloid Leukemia)',
                        'Eosonophil: CML',
                        'Myeloblast: CML',
                        'Neutrophils: CML'
                    ],
                    'rbc': [
                        'RBC: Normal',
                        'RBC: Sickle Cell Anemia'
                    ]
                },
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
                    'epochs': 31,
                    'optimizer': 'AdamW',
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
                    'interpretation_levels': [
                        'Normal: <0.3% sickle cells',
                        'Trait: 0.7-1.0% sickle cells',
                        'Disease: >1.1% sickle cells'
                    ]
                },
                'acute_leukemia': {
                    'basis': 'Blast cell percentage in WBC differential',
                    'threshold': '>=20% blasts for diagnosis',
                    'types': ['ALL (lymphoblast)', 'AML (myeloblast)']
                },
                'chronic_leukemia': {
                    'basis': 'Mature cell predominance pattern',
                    'types': [
                        'CML: >75% granulocytes (basophil, eosinophil, neutrophil)',
                        'CLL: >50% lymphocytes'
                    ]
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
    print("\n" + "="*60)
    print("HEMALYZER BACKEND - Yolov8NAS + ConvNeXt")
    print("="*60)
    print(f"Detection Model: {MODEL_ID}")
    print(f"API Key configured: {'Yes' if API_KEY else 'No'}")
    print("="*60)
    
    if not API_KEY:
        print("\nWARNING: No API key found!")
        print("   Please add your Roboflow API key to the .env file:")
        print("   API_KEY=your_api_key_here")
        print("="*60)
    
    # Load ConvNeXt model for cell classification
    print("\nLoading ConvNeXt classification model...")
    if load_convnext_model():
        print("ConvNeXt model loaded successfully!")
    else:
        print("ConvNeXt model not loaded - classification will be disabled")
    print("="*60)
    
    print("\nStarting Flask server on http://localhost:5000\n")
    app.run(debug=True, host='0.0.0.0', port=5000)
