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

# Import ConvNeXt classification module
from convnext_classifier import (
    load_convnext_model,
    classify_cell_crop,
    get_classifier_info,
    classifier
)


# Load environment variables from .env file
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# ============================================================
# CLINICAL THRESHOLDS FOR 100x MAGNIFICATION
# Based on standard hematology reference values
# ============================================================

# Expected cells per 100x field of view (single field)
EXPECTED_CELLS_PER_FIELD = {
    'RBC': 150,      # ~100-200 RBCs per field
    'WBC': 3,        # ~0-5 WBCs per field (rare)
    'Platelets': 12  # ~5-20 platelets per field
}

# Recommended analysis: 5 fields of 100x magnification
RECOMMENDED_FIELDS = 5
EXPECTED_CELLS_PER_ANALYSIS = {
    'RBC': 150 * RECOMMENDED_FIELDS,       # ~750 RBCs across 5 fields
    'WBC': 3 * RECOMMENDED_FIELDS,         # ~15 WBCs across 5 fields (need 100 for reliable diff)
    'Platelets': 12 * RECOMMENDED_FIELDS   # ~60 platelets across 5 fields
}

# Normal WBC Differential Count (percentage ranges)
# Reference: Standard hematology peripheral blood smear manual
# Note: Band Neutrophil excluded (not in training dataset)
NORMAL_WBC_DIFFERENTIAL = {
    'Neutrophil': {'min': 50, 'max': 70, 'display': 'Neutrophil (50-70%)'},
    'Lymphocyte': {'min': 18, 'max': 42, 'display': 'Lymphocyte (18-42%)'},
    'Monocyte': {'min': 2, 'max': 11, 'display': 'Monocyte (2-11%)'},
    'Eosinophil': {'min': 1, 'max': 3, 'display': 'Eosinophil (1-3%)'},
    'Basophil': {'min': 0, 'max': 2, 'display': 'Basophil (0-2%)'},
}

# Disease Classification Thresholds (Based on About page reference tables)
DISEASE_THRESHOLDS = {
    # Sickle Cell Anemia - RBC Analysis
    # Reference: Sickle Cell Anemia Classification table
    'sickle_cell': {
        'normal': {'max_percent': 0.3, 'interpretation': 'Normal blood, no sickling observed'},
        'minimal': {'min_percent': 0.4, 'max_percent': 0.6, 'interpretation': 'Minimal sickling - may be normal or carrier'},
        'trait': {'min_percent': 0.7, 'max_percent': 1.0, 'interpretation': 'Sickle Cell Trait (HbAS) - usually mild or asymptomatic'},
        'disease': {'min_percent': 1.1, 'max_percent': 1.5, 'interpretation': 'Sickle Cell Disease - symptomatic, chronic anemia'},
        'severe': {'min_percent': 1.6, 'interpretation': 'Severe Sickle Cell Anemia (advanced HbSS)'}
    },
    
    # Acute Leukemia (AML/ALL) - Blast Cell Analysis
    # Reference: AML / ALL Leukemia Classification table
    'acute_leukemia': {
        'normal': {'max_percent': 5, 'interpretation': 'Normal Blood - with some blast cells'},
        'slightly_increased': {'min_percent': 6, 'max_percent': 10, 'interpretation': 'Slightly Increased - possibly reactive, may be normal/reactive condition'},
        'suspicious': {'min_percent': 11, 'max_percent': 19, 'interpretation': 'Suspicious / Pre-leukemic - suspicious for evolving leukemia'},
        'acute_leukemia': {'min_percent': 20, 'interpretation': 'Diagnostic level for Acute Leukemia (>= 20% blasts)'}
    },
    
    # CML - Granulocyte Analysis (Basophil, Eosinophil, Myeloblast, Neutrophils)
    # Reference: CML Leukemia Classification table
    'cml': {
        'normal': {'max_percent': 60, 'interpretation': 'Normal differential count - balanced white cell maturation'},
        'reactive': {'min_percent': 60, 'max_percent': 75, 'interpretation': 'Reactive / Secondary Leukocytosis (CML) - mild granulocytic predominance'},
        'early_cml': {'min_percent': 76, 'max_percent': 89, 'interpretation': 'Suspicious for Early Chronic Myeloid Leukemia (CML - Chronic Phase)'},
        'chronic_phase': {'min_percent': 90, 'max_percent': 95, 'interpretation': 'Typical Chronic Phase CML - granulocytes dominate differential'},
        'accelerated': {'min_percent': 95, 'interpretation': 'Accelerated Phase CML - extreme granulocytic proliferation'}
    },
    
    # CLL - Lymphocyte Analysis
    # Reference: CLL Leukemia Classification table
    'cll': {
        'normal': {'max_percent': 20, 'interpretation': 'Normal lymphocyte count - balanced white cell differential'},
        'reactive': {'min_percent': 20, 'max_percent': 40, 'interpretation': 'Reactive / Secondary Lymphocytosis - may occur with viral infections'},
        'early_cll': {'min_percent': 41, 'max_percent': 60, 'interpretation': 'Suspicious for Early / Smoldering CLL'},
        'typical_cll': {'min_percent': 61, 'max_percent': 80, 'interpretation': 'Typical Chronic Lymphocytic Leukemia (CLL)'},
        'advanced_cll': {'min_percent': 80, 'interpretation': 'Advanced / Progressive CLL - lymphocytes dominate smear'}
    }
}

# Minimum cell counts for reliable diagnosis
# Based on standard hematology practice: count 100 WBCs for differential
MINIMUM_CELLS_FOR_DIAGNOSIS = {
    'wbc_differential': 100,  # Need 100 WBCs for reliable differential
    'blast_percentage': 100,  # Need 100 WBCs for blast count
    'sickle_cell': 150,       # Need 150 RBCs minimum
    'single_field_warning': True,  # Warn if only single field analyzed
    'recommended_fields': RECOMMENDED_FIELDS,  # Recommended 5 fields
    'min_fields_for_reliable': 5  # Minimum fields for reliable diagnosis
}


# ============================================================
# STATISTICAL CONFIDENCE FUNCTIONS
# ============================================================

def calculate_confidence_interval(positive_cells, total_cells, confidence_level=0.95):
    """
    Calculate Wilson score confidence interval for cell percentages.
    More accurate than normal approximation for small sample sizes.
    
    Args:
        positive_cells: Number of positive/abnormal cells
        total_cells: Total cells counted
        confidence_level: Confidence level (default 0.95 for 95% CI)
    
    Returns:
        tuple: (point_estimate, lower_bound, upper_bound) as percentages
    """
    if total_cells == 0:
        return (0.0, 0.0, 0.0)
    
    # Use scipy if available, otherwise use approximation
    try:
        from scipy import stats
        z = stats.norm.ppf((1 + confidence_level) / 2)
    except ImportError:
        # Z-score for 95% CI
        z = 1.96 if confidence_level == 0.95 else 1.645
    
    p = positive_cells / total_cells
    n = total_cells
    
    # Wilson score interval
    denominator = 1 + z**2 / n
    center = (p + z**2 / (2 * n)) / denominator
    margin = z * ((p * (1 - p) / n + z**2 / (4 * n**2))**0.5) / denominator
    
    return (
        round(p * 100, 2),                          # Point estimate
        round(max(0, center - margin) * 100, 2),    # Lower bound
        round(min(1, center + margin) * 100, 2)     # Upper bound
    )


def assess_sample_adequacy(cell_counts, analysis_type='general', fields_analyzed=1):
    """
    Assess if sample size is adequate for reliable diagnosis.
    
    Args:
        cell_counts: Dictionary with 'WBC', 'RBC', 'Platelets' counts
        analysis_type: Type of analysis being performed
        fields_analyzed: Number of 100x fields analyzed
    
    Returns:
        dict: Adequacy assessment with warnings
    """
    adequacy = {
        'is_adequate': True,
        'warnings': [],
        'recommendations': [],
        'confidence_level': 'high',
        'fields_analyzed': fields_analyzed,
        'recommended_fields': RECOMMENDED_FIELDS
    }
    
    wbc_count = cell_counts.get('WBC', 0)
    rbc_count = cell_counts.get('RBC', 0)
    
    # Check if single field (need 5 fields for reliable diagnosis)
    if fields_analyzed < RECOMMENDED_FIELDS:
        remaining_fields = RECOMMENDED_FIELDS - fields_analyzed
        adequacy['warnings'].append(
            f"Analyzed {fields_analyzed} field(s). Recommend {RECOMMENDED_FIELDS} fields for reliable differential count."
        )
        adequacy['recommendations'].append(
            f"Upload {remaining_fields} more blood smear image(s) at 100x magnification from different areas."
        )
    
    # Check WBC count for differential
    if wbc_count < 20:
        adequacy['is_adequate'] = False
        adequacy['confidence_level'] = 'very_low'
        adequacy['warnings'].append(
            f"Only {wbc_count} WBCs detected. Need at least 100 for reliable differential count."
        )
        adequacy['recommendations'].append(
            f"Upload {RECOMMENDED_FIELDS} fields from different areas of the blood smear (counting area/monolayer)."
        )
    elif wbc_count < 50:
        adequacy['confidence_level'] = 'low'
        adequacy['warnings'].append(
            f"Only {wbc_count} WBCs detected. Results have wide confidence intervals."
        )
        adequacy['recommendations'].append(
            "Consider uploading additional fields for more accurate analysis."
        )
    elif wbc_count < 100:
        adequacy['confidence_level'] = 'moderate'
        adequacy['warnings'].append(
            f"{wbc_count} WBCs detected. Differential count is approximate."
        )
        if fields_analyzed < RECOMMENDED_FIELDS:
            adequacy['recommendations'].append(
                f"For standard differential, analyze {RECOMMENDED_FIELDS} fields to reach ~100 WBCs."
            )
    
    # Check RBC count for sickle cell analysis (750 RBCs expected from 5 fields)
    expected_rbc = EXPECTED_CELLS_PER_ANALYSIS['RBC']
    if rbc_count < 150:
        adequacy['warnings'].append(
            f"Only {rbc_count} RBCs detected. Sickle cell assessment may be unreliable."
        )
    elif rbc_count < expected_rbc and fields_analyzed < RECOMMENDED_FIELDS:
        adequacy['warnings'].append(
            f"{rbc_count} RBCs analyzed. Recommend {expected_rbc} RBCs (~{RECOMMENDED_FIELDS} fields) for reliable sickle cell screening."
        )
    
    return adequacy


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
        
        # Determine sickle cell interpretation based on percentage thresholds (from About page)
        thresholds = DISEASE_THRESHOLDS['sickle_cell']
        sickle_severity = 'NORMAL'
        
        if sickle_pct <= 0.3:
            sickle_interpretation = thresholds['normal']['interpretation']
            sickle_severity = 'NORMAL'
            sickle_condition = '0% - 0.3%'
        elif sickle_pct <= 0.6:
            sickle_interpretation = thresholds['minimal']['interpretation']
            sickle_severity = 'INFO'
            sickle_condition = '0.4% - 0.6%'
        elif sickle_pct <= 1.0:
            sickle_interpretation = thresholds['trait']['interpretation']
            sickle_severity = 'LOW'
            sickle_condition = '0.7% - 1.0%'
        elif sickle_pct <= 1.5:
            sickle_interpretation = thresholds['disease']['interpretation']
            sickle_severity = 'MODERATE'
            sickle_condition = '1.1% - 1.5%'
        else:
            sickle_interpretation = thresholds['severe']['interpretation']
            sickle_severity = 'HIGH'
            sickle_condition = '> 1.6%'
        
        interpretation['sickle_cell_analysis'] = {
            'sickle_cell_count': sickle_count,
            'total_rbc_analyzed': total_rbc,
            'percentage': sickle_pct,
            'confidence_interval': f"{sickle_lower}% - {sickle_upper}%",
            'interpretation': sickle_interpretation,
            'severity': sickle_severity,
            'condition': sickle_condition,
            'note': "Finding even 1-2 sickled cells per field is clinically significant" if sickle_count > 0 else None
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
    disease_interpretation = interpret_disease_classification(
        all_wbc_classifications,
        all_rbc_classifications,
        aggregated_counts
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

# Your Roboflow model ID
MODEL_ID = "hemalens-6807i/2"


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
        
        # Convert image to base64 for Roboflow API
        _, buffer = cv2.imencode('.jpg', image)
        image_base64 = base64.b64encode(buffer).decode('utf-8')
        
        # Run inference using Roboflow
        # Note: Roboflow SDK doesn't support runtime threshold parameters
        # We'll filter results manually based on conf_threshold and iou_threshold
        result = CLIENT.infer(image_base64, model_id=MODEL_ID)
        
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
                
                # Create SQUARE crop centered on cell with extra padding
                # Use 25% padding to match training data better (was 15%)
                max_dim = max(cell_width, cell_height)
                crop_size = int(max_dim * 1.25)  # 25% extra on each side
                
                h, w = image_rgb_clean.shape[:2]
                
                # Calculate square crop bounds centered on cell
                x1_padded = max(0, cell_center_x - crop_size // 2)
                y1_padded = max(0, cell_center_y - crop_size // 2)
                x2_padded = min(w, cell_center_x + crop_size // 2)
                y2_padded = min(h, cell_center_y + crop_size // 2)
                
                # Adjust to maintain square aspect ratio if hitting image edges
                actual_width = x2_padded - x1_padded
                actual_height = y2_padded - y1_padded
                if actual_width != actual_height:
                    min_side = min(actual_width, actual_height)
                    x2_padded = x1_padded + min_side
                    y2_padded = y1_padded + min_side
                
                # Crop cell from CLEAN image (no bounding boxes)
                cell_crop = image_rgb_clean[y1_padded:y2_padded, x1_padded:x2_padded]
                
                if cell_crop.size == 0:
                    continue
                
                # Convert to PIL Image WITHOUT any resizing
                # Let ConvNeXt classifier handle ALL preprocessing to match training exactly
                cell_crop_pil = Image.fromarray(cell_crop)
                
                # Convert crop to base64 for frontend
                # Create a display version (384x384) for frontend only
                display_crop = cell_crop_pil.resize((384, 384), Image.LANCZOS)
                crop_buffer = io.BytesIO()
                display_crop.save(crop_buffer, format='PNG')
                crop_base64 = base64.b64encode(crop_buffer.getvalue()).decode('utf-8')
                
                # Classify WBC
                if cell_type == 'WBC':
                    wbc_idx += 1
                    classification = classify_cell_crop(cell_crop_pil, 'WBC')
                    
                    if classification:
                        wbc_class = classification['class']
                        wbc_confidence = classification['confidence']
                        
                        # CRITICAL: Exclude RBC and Sickle Cell predictions for WBCs
                        # RBC classes should not appear in WBC detection results
                        # If predicted as RBC or Sickle Cell, use the highest WBC class instead
                        is_non_wbc_class = (
                            'rbc' in wbc_class.lower() or 
                            'sickle' in wbc_class.lower() or
                            'platelet' in wbc_class.lower()
                        )
                        
                        if is_non_wbc_class:
                            print(f"   WBC #{wbc_idx} predicted as {wbc_class} (non-WBC class) - using next best WBC class")
                            
                            # Get only WBC probabilities (exclude RBC, Sickle, Platelet classes) and RE-NORMALIZE
                            probs = classification['probabilities']
                            wbc_only_probs = {
                                cls_name: prob 
                                for cls_name, prob in probs.items() 
                                if 'rbc' not in cls_name.lower() 
                                and 'sickle' not in cls_name.lower()
                                and 'platelet' not in cls_name.lower()
                            }
                            
                            # Re-normalize probabilities to sum to 1.0 (100%)
                            total_prob = sum(wbc_only_probs.values())
                            if total_prob > 0:
                                normalized_probs = {
                                    cls_name: prob / total_prob 
                                    for cls_name, prob in wbc_only_probs.items()
                                }
                                
                                # Find highest probability after normalization
                                best_wbc_class = max(normalized_probs.items(), key=lambda x: x[1])
                                wbc_class = best_wbc_class[0]
                                wbc_confidence = best_wbc_class[1]
                                
                                print(f"      → Using {wbc_class} (normalized confidence: {wbc_confidence:.3f})")
                            else:
                                # Fallback to Neutrophil: Normal if something goes wrong
                                wbc_class = 'Neutrophil: Normal'
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
        abnormal_wbc_count = sum(1 for w in wbc_classifications if w['classification'] != 'Normal')
        sickle_cell_count = sum(1 for r in rbc_classifications if r.get('is_sickle_cell', False))
        
        # ========== DISEASE INTERPRETATION WITH THRESHOLDS ==========
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
            
            'disease_interpretation': disease_interpretation,  # Clinical interpretation based on ConvNeXt classifications
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
