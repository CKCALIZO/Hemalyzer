"""
Statistical Calculations and Helper Functions
For blood cell analysis confidence intervals and sample adequacy assessment
"""

import numpy as np
from disease_thresholds import (
    DISEASE_THRESHOLDS,
    MINIMUM_CELLS_FOR_DIAGNOSIS,
    RECOMMENDED_FIELDS,
    ESTIMATED_COUNT_CONSTANTS
)


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
                f"Upload {RECOMMENDED_FIELDS - fields_analyzed} more fields for 100+ WBCs."
            )
    
    # Check RBC count for sickle cell analysis
    from disease_thresholds import EXPECTED_CELLS_PER_ANALYSIS
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


def calculate_estimated_wbc(average_per_hpf, num_hpf=10, multiplier_override=None, total_wbc_count=None):
    """
    Calculate estimated WBC count using blood smear formula
    
    Formula: WBC/μL = (Total WBC count / 10) × 2,000
    
    Args:
        average_per_hpf: Average WBC count per High Power Field (HPF) (for backward compatibility)
        num_hpf: Number of HPFs counted (minimum 10 recommended)
        multiplier_override: Custom multiplier (default 2,000)
        total_wbc_count: Total WBC count across all fields (preferred method)
    
    Returns:
        dict: Calculation details and result
    """
    constants = ESTIMATED_COUNT_CONSTANTS['WBC']
    multiplier = multiplier_override if multiplier_override else constants['multiplier']
    
    # Formula: WBC/μL = (Total WBC count / 10) × 2,000
    if total_wbc_count is not None:
        avg_calculated = total_wbc_count / 10
        wbc_per_ul = avg_calculated * multiplier
        formula_text = f"(Total {total_wbc_count} / 10) × {multiplier:,} = {wbc_per_ul:,.0f} cells/μL"
    else:
        avg_calculated = average_per_hpf
        wbc_per_ul = avg_calculated * multiplier
        formula_text = f"Ave. WBC/HPF ({round(avg_calculated, 2)}) × {multiplier:,} = {wbc_per_ul:,.0f} cells/μL"
    
    # Convert to SI units (cells/L)
    cells_per_liter = wbc_per_ul * 1e6
    
    return {
        'cell_type': 'WBC',
        'average_per_hpf': round(avg_calculated, 2),
        'total_wbc_count': total_wbc_count,
        'num_hpf_counted': num_hpf,
        'multiplier': multiplier,
        'cells_per_ul': round(wbc_per_ul, 2),
        'cells_per_liter': cells_per_liter,
        'cells_per_liter_scientific': f"{cells_per_liter:.2e}",
        'formula': formula_text,
        'description': 'Estimated WBC count (cells/μL) = (Total WBC count / 10) × 2,000',
        'note': constants['note'],
        'min_hpf_recommended': constants['min_hpf']
    }


def calculate_estimated_rbc(average_per_field, num_fields=10, multiplier_override=None):
    """
    Calculate estimated RBC concentration using blood smear formula
    
    Formula: Estimated RBC count (cells/μL) = Ave. RBCs per field × 200,000
    
    Args:
        average_per_field: Average RBC count per 100x oil immersion HPF
        num_fields: Number of fields counted
        multiplier_override: Custom multiplier (default 200,000)
    
    Returns:
        dict: Calculation details and result
    """
    constants = ESTIMATED_COUNT_CONSTANTS['RBC']
    multiplier = multiplier_override if multiplier_override else constants['multiplier']
    
    # Formula: Estimated RBC count (cells/μL) = Ave. RBCs per field × 200,000
    rbc_per_ul = average_per_field * multiplier
    
    # Convert to SI units (cells/L) and millions per μL for display
    cells_per_liter = rbc_per_ul * 1e6
    rbc_millions_per_ul = rbc_per_ul / 1e6
    
    return {
        'cell_type': 'RBC',
        'average_per_field': round(average_per_field, 2),
        'num_fields_counted': num_fields,
        'multiplier': multiplier,
        'cells_per_ul': round(rbc_per_ul, 2),
        'cells_per_ul_millions': f"{rbc_millions_per_ul:.2f} × 10⁶",
        'cells_per_liter': cells_per_liter,
        'cells_per_liter_scientific': f"{cells_per_liter:.2e}",
        'formula': f"Ave. RBCs/field ({round(average_per_field, 2)}) × {multiplier:,} = {rbc_per_ul:,.0f} cells/μL",
        'description': constants['description'],
        'note': constants['note'],
        'typical_per_field': constants['typical_per_field']
    }
