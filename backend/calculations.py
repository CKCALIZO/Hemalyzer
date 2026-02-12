"""
Statistical Calculations and Helper Functions
For blood cell analysis confidence intervals and sample adequacy assessment
"""

import numpy as np
from disease_thresholds import (
    DISEASE_THRESHOLDS,
    MINIMUM_CELLS_FOR_DIAGNOSIS,
    RECOMMENDED_FIELDS,
    ESTIMATED_COUNT_CONSTANTS,
    EXPECTED_WBC_PER_10HPF,
    SMALL_SAMPLE_THRESHOLDS,
    NORMAL_WBC_DIFFERENTIAL
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
    Assess if sample size is adequate for reliable classification.
    
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
    
    # Check if single field (need 5 fields for reliable classification)
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


def assess_differential_finding(cell_type, observed_count, total_wbc, num_hpf=10):
    """
    Assess if a WBC differential finding is significant given sample size.
    
    For 10 HPF analysis (~30 WBCs expected), uses absolute count thresholds
    in addition to percentages to avoid false positives from sampling variation.
    
    Args:
        cell_type: WBC type (e.g., 'Neutrophil', 'Basophil')
        observed_count: Number of this cell type observed
        total_wbc: Total WBCs counted
        num_hpf: Number of HPF analyzed (default 10)
    
    Returns:
        dict: Assessment with status, expected counts, and significance
    """
    # Normalize cell type name (handle format like "Basophil: Normal" or "Basophil: CML")
    base_cell_type = cell_type.split(':')[0].strip().title()
    
    # Get thresholds for this cell type
    diff_counts = EXPECTED_WBC_PER_10HPF.get('differential_counts', {})
    cell_thresholds = diff_counts.get(base_cell_type)
    normal_range = NORMAL_WBC_DIFFERENTIAL.get(base_cell_type, {})
    
    if not cell_thresholds:
        # Unknown cell type - use percentage only
        return {
            'cell_type': cell_type,
            'assessment': 'unknown_type',
            'message': f'No reference data for {cell_type}'
        }
    
    # Calculate observed percentage
    observed_pct = (observed_count / total_wbc * 100) if total_wbc > 0 else 0
    
    # Get expected values
    expected_range = cell_thresholds.get('expected_count', (0, 0))
    acceptable_range = cell_thresholds.get('acceptable_range', (0, 10))
    flag_high = cell_thresholds.get('flag_high')
    flag_low = cell_thresholds.get('flag_low')
    normal_pct_range = cell_thresholds.get('normal_pct', (0, 100))
    
    # Scale expected counts based on actual WBC count vs expected 30
    expected_total = EXPECTED_WBC_PER_10HPF['total']['expected']  # 30
    scale_factor = total_wbc / expected_total if expected_total > 0 else 1
    
    scaled_expected_min = expected_range[0] * scale_factor
    scaled_expected_max = expected_range[1] * scale_factor
    scaled_acceptable_min = acceptable_range[0] * scale_factor
    scaled_acceptable_max = acceptable_range[1] * scale_factor
    scaled_flag_high = flag_high * scale_factor if flag_high else None
    scaled_flag_low = flag_low * scale_factor if flag_low else None
    
    # Determine status based on BOTH percentage AND absolute count
    status = 'normal'
    severity = 'INFO'
    message = ''
    is_statistically_significant = False
    
    # Small sample check - different logic for <20 WBCs vs 20-50 vs 50+
    if total_wbc < SMALL_SAMPLE_THRESHOLDS['min_for_percentage']:
        # Very small sample - use absolute counts only, be conservative
        if scaled_flag_high and observed_count > scaled_flag_high:
            status = 'elevated'
            severity = 'LOW'  # Lower severity due to small sample
            message = f'{observed_count} {base_cell_type}(s) in {total_wbc} WBCs - elevated but sample too small for reliable assessment'
        elif scaled_flag_low and observed_count < scaled_flag_low and total_wbc >= 15:
            status = 'decreased'
            severity = 'LOW'
            message = f'{observed_count} {base_cell_type}(s) in {total_wbc} WBCs - decreased but sample too small for reliable assessment'
        else:
            status = 'inconclusive'
            message = f'{observed_count} {base_cell_type}(s) - insufficient WBCs ({total_wbc}) for reliable differential'
    
    elif total_wbc < SMALL_SAMPLE_THRESHOLDS['min_for_differential']:
        # Small sample (20-50 WBCs) - use both percentage and absolute count
        # A finding is significant only if BOTH criteria are met
        pct_high = observed_pct > normal_pct_range[1]
        pct_low = observed_pct < normal_pct_range[0]
        count_high = scaled_flag_high and observed_count > scaled_flag_high
        count_low = scaled_flag_low and observed_count < scaled_flag_low
        
        if pct_high and count_high:
            status = 'high'
            severity = 'MODERATE'
            is_statistically_significant = True
            message = f'{observed_count} {base_cell_type}(s) ({observed_pct:.1f}%) exceeds both % and absolute thresholds'
        elif pct_high:
            status = 'elevated'
            severity = 'LOW'
            message = f'{observed_count} {base_cell_type}(s) ({observed_pct:.1f}%) - percentage elevated, but absolute count within sampling variation'
        elif pct_low and count_low:
            status = 'low'
            severity = 'MODERATE'
            is_statistically_significant = True
            message = f'{observed_count} {base_cell_type}(s) ({observed_pct:.1f}%) below both % and absolute thresholds'
        elif pct_low and total_wbc >= 30:
            status = 'decreased'
            severity = 'LOW'
            message = f'{observed_count} {base_cell_type}(s) ({observed_pct:.1f}%) - percentage low, may be sampling variation'
        else:
            status = 'normal'
            message = f'{observed_count} {base_cell_type}(s) ({observed_pct:.1f}%) within expected range for {total_wbc} WBCs'
    
    else:
        # Adequate sample (50+ WBCs) - use percentage-based assessment
        # Still check absolute counts for context
        pct_min = normal_range.get('min', normal_pct_range[0])
        pct_max = normal_range.get('max', normal_pct_range[1])
        
        if observed_pct > pct_max:
            deviation = observed_pct - pct_max
            if deviation > 15:
                status = 'high'
                severity = 'HIGH'
            elif deviation > 8:
                status = 'high'
                severity = 'MODERATE'
            else:
                status = 'elevated'
                severity = 'LOW'
            is_statistically_significant = deviation > 5
            message = f'{observed_count} {base_cell_type}(s) ({observed_pct:.1f}%) - above normal range ({pct_min}-{pct_max}%)'
        
        elif observed_pct < pct_min and pct_min > 0:
            deviation = pct_min - observed_pct
            if deviation > 15:
                status = 'low'
                severity = 'HIGH'
            elif deviation > 8:
                status = 'low'
                severity = 'MODERATE'
            else:
                status = 'decreased'
                severity = 'LOW'
            is_statistically_significant = deviation > 5
            message = f'{observed_count} {base_cell_type}(s) ({observed_pct:.1f}%) - below normal range ({pct_min}-{pct_max}%)'
        
        else:
            status = 'normal'
            message = f'{observed_count} {base_cell_type}(s) ({observed_pct:.1f}%) within normal range ({pct_min}-{pct_max}%)'
    
    # Calculate confidence interval for this finding
    pct, ci_lower, ci_upper = calculate_confidence_interval(observed_count, total_wbc)
    
    return {
        'cell_type': base_cell_type,
        'observed_count': observed_count,
        'observed_percentage': round(observed_pct, 1),
        'total_wbc': total_wbc,
        'status': status,
        'severity': severity,
        'message': message,
        'is_statistically_significant': is_statistically_significant,
        'expected_count_range': (round(scaled_expected_min, 1), round(scaled_expected_max, 1)),
        'acceptable_count_range': (round(scaled_acceptable_min, 1), round(scaled_acceptable_max, 1)),
        'normal_percentage_range': normal_pct_range,
        'confidence_interval': {
            'lower': ci_lower,
            'upper': ci_upper
        },
        'sample_size_note': get_sample_size_note(total_wbc)
    }


def get_sample_size_note(total_wbc):
    """Get a note explaining reliability based on WBC count."""
    if total_wbc < 20:
        return f"Very small sample ({total_wbc} WBCs). Results are preliminary. Need 100+ WBCs for reliable differential."
    elif total_wbc < 50:
        return f"Small sample ({total_wbc} WBCs). Confidence intervals are wide. Results should be confirmed with additional fields."
    elif total_wbc < 100:
        return f"Moderate sample ({total_wbc} WBCs). Results are approximate. Clinical standard requires 100 WBCs."
    else:
        return f"Adequate sample ({total_wbc} WBCs). Results are statistically reliable."


def get_expected_counts_for_hpf(num_hpf=10, wbc_per_field=3):
    """
    Get expected cell counts for a given number of HPF.
    
    Args:
        num_hpf: Number of high power fields
        wbc_per_field: Expected WBCs per field (default 3 for 100x)
    
    Returns:
        dict: Expected counts for each cell type
    """
    expected_total_wbc = num_hpf * wbc_per_field
    
    result = {
        'num_hpf': num_hpf,
        'expected_total_wbc': expected_total_wbc,
        'expected_range': (
            int(expected_total_wbc * 0.5),  # Low: 50% of expected
            int(expected_total_wbc * 1.7)   # High: 170% of expected
        ),
        'cell_type_expectations': {}
    }
    
    for cell_type, normal in NORMAL_WBC_DIFFERENTIAL.items():
        min_pct = normal['min'] / 100
        max_pct = normal['max'] / 100
        
        result['cell_type_expectations'][cell_type] = {
            'expected_count_range': (
                round(expected_total_wbc * min_pct, 1),
                round(expected_total_wbc * max_pct, 1)
            ),
            'normal_percentage': f"{normal['min']}-{normal['max']}%",
            'note': f"In {num_hpf} HPF, expect {round(expected_total_wbc * min_pct)}-{round(expected_total_wbc * max_pct)} {cell_type}(s)"
        }
    
    return result
