"""
Cell Classification Thresholds and Reference Constants
Based on standard hematology reference values
"""

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
# Note: These are traditional differential reference values retained for educational context.
# The ConvNeXt model does NOT perform individual differential counts - it classifies
# each WBC as Normal or Disease type. These ranges are informational only.
NORMAL_WBC_DIFFERENTIAL = {
    'Neutrophil': {'min': 50, 'max': 70, 'display': 'Neutrophil (50-70%)'},
    'Lymphocyte': {'min': 18, 'max': 42, 'display': 'Lymphocyte (18-42%)'},
    'Monocyte': {'min': 2, 'max': 11, 'display': 'Monocyte (2-11%)'},
    'Eosinophil': {'min': 1, 'max': 3, 'display': 'Eosinophil (1-3%)'},
    'Basophil': {'min': 0, 'max': 2, 'display': 'Basophil (0-2%)'},
}

# ============================================================
# CLASSIFICATION THRESHOLDS FOR CONVNEXT 7-CLASS MODEL
# ============================================================
# Since the ConvNeXt model directly classifies each WBC as Normal or
# one of 4 disease types (AML, ALL, CML, CLL), disease-specific
# thresholds are applied based on standard hematology classification criteria.
#
# Percentage = (disease_type_count / total_wbc) × 100
# This is NOT a traditional differential count - it is the proportion
# of WBCs that the model classified as a specific disease type.
# ============================================================

# Overall Normal vs Disease WBC Classification Ratio
# Provides a top-level interpretation of the analysis
OVERALL_CLASSIFICATION_THRESHOLDS = {
    'normal': {'min_normal_pct': 95, 'interpretation': 'Predominantly Normal WBCs - no significant abnormalities classified'},
    'low': {'min_normal_pct': 85, 'max_normal_pct': 95, 'interpretation': 'Mostly Normal - low proportion of abnormal WBC classifications detected'},
    'moderate': {'min_normal_pct': 70, 'max_normal_pct': 85, 'interpretation': 'Notable Abnormal Classification - significant proportion of WBCs classified as abnormal'},
    'high': {'max_normal_pct': 70, 'interpretation': 'High Abnormal Classification - majority of WBCs classified as abnormal'}
}

# AML Classification Thresholds (Standard Hematology Criteria)
# AML classification threshold: >=20% blasts in peripheral blood
# Reference: https://www.ncbi.nlm.nih.gov/books/NBK603716/
AML_CLASSIFICATION_THRESHOLDS = {
    'below_threshold': {'max_percent': 20, 'interpretation': 'Blasts detected below blast phase classification threshold (< 20%).'},
    'blast_phase': {'min_percent': 20, 'interpretation': 'Blast Phase - >= 20% blasts detected. AML blast phase classification threshold reached.'}
}

# ALL Classification Thresholds (Standard Hematology Criteria)
# ALL classification threshold: >=20% lymphoblasts in peripheral blood
# Reference: https://www.msdmanuals.com/professional/hematology-and-oncology/leukemias/acute-lymphoblastic-leukemia-all
ALL_CLASSIFICATION_THRESHOLDS = {
    'below_threshold': {'max_percent': 20, 'interpretation': 'Lymphoblasts detected below lymphoblast classification threshold (< 20%).'},
    'lymphoblast_phase': {'min_percent': 20, 'interpretation': 'Lymphoblast Phase - >= 20% lymphoblasts detected. ALL lymphoblast classification threshold reached.'}
}

# CML Classification Thresholds (Phase-Based)
# CML categorized into phases based on blast proportion
# Reference: https://emedicine.medscape.com/article/2006731
CML_CLASSIFICATION_THRESHOLDS = {
    'chronic_phase': {'max_percent': 10, 'interpretation': 'Chronic Phase - blasts < 10%. Below accelerated phase threshold.'},
    'accelerated_phase': {'min_percent': 10, 'max_percent': 20, 'interpretation': 'Accelerated Phase - blasts 10-19%. Accelerated phase classification threshold reached.'},
    'blast_phase': {'min_percent': 20, 'interpretation': 'Blast Phase (Blast Crisis) - >= 20% blasts. Blast phase classification threshold reached.'}
}

# CLL Classification Thresholds (Lymphocyte Proportion-Based)
# CLL classification based on proportion of abnormal lymphocytes
CLL_CLASSIFICATION_THRESHOLDS = {
    'below_suspicious': {'max_percent': 40, 'interpretation': 'Abnormal lymphocytes below suspicious threshold (< 40%).'},
    'suspicious_lymphocytosis': {'min_percent': 40, 'max_percent': 50, 'interpretation': 'Suspicious Lymphocytosis - 40-50% abnormal lymphocytes. Above monitoring threshold.'},
    'typical_cll': {'min_percent': 50, 'max_percent': 70, 'interpretation': 'Typical CLL - 50-70% abnormal lymphocytes. Moderate CLL classification threshold reached.'},
    'advanced_cll': {'min_percent': 70, 'interpretation': 'Advanced/Untreated CLL - > 70% abnormal lymphocytes. High CLL classification threshold reached.'}
}

DISEASE_THRESHOLDS = {
    # Sickle Cell Anemia - RBC Analysis (unchanged, already ratio-based)
    # Percentage calculated as: (Total Sickled Cells / Total RBCs) × 100
    'sickle_cell': {
        'normal': {'max_percent': 3.0, 'interpretation': 'Normal / Smudge Cells - no significant sickling observed'},
        'mild': {'min_percent': 3.0, 'max_percent': 10.0, 'interpretation': 'Mild Sickling - Heterozygous HbAS condition (Sickle Cell Trait)'},
        'moderate': {'min_percent': 10.0, 'max_percent': 30.0, 'interpretation': 'Moderate Sickling - may correlate with symptoms or stress (possible HbSS)'},
        'severe': {'min_percent': 30.0, 'interpretation': 'Severe Sickling - suggestive of Sickle Cell Disease (HbSS)'}
    },
    
    # Disease-specific thresholds based on standard hematology criteria
    'aml': AML_CLASSIFICATION_THRESHOLDS,
    'all': ALL_CLASSIFICATION_THRESHOLDS,
    'cml': CML_CLASSIFICATION_THRESHOLDS,
    'cll': CLL_CLASSIFICATION_THRESHOLDS
}

# Minimum cell counts for reliable classification
# Based on standard hematology practice: count 100 WBCs for differential
MINIMUM_CELLS_FOR_DIAGNOSIS = {
    'wbc_differential': 100,  # Need 100 WBCs for reliable differential
    'blast_percentage': 100,  # Need 100 WBCs for blast count
    'sickle_cell': 150,       # Need 150 RBCs minimum
    'single_field_warning': True,  # Warn if only single field analyzed
    'recommended_fields': RECOMMENDED_FIELDS,  # Recommended 5 fields
    'min_fields_for_reliable': 5  # Minimum fields for reliable classification
}

# ============================================================
# EXPECTED CELL COUNTS FOR 10 HPF ANALYSIS
# Based on 100x oil immersion, ~3 WBCs per field average
# These are ABSOLUTE COUNT expectations, not percentages
# ============================================================

# Expected total WBC count for 10 HPF (100x magnification)
EXPECTED_WBC_PER_10HPF = {
    'total': {
        'min': 15,       # Low end of normal
        'expected': 30,  # Average (~3 per field × 10 fields)
        'max': 50,       # High end of normal
        'note': 'Normal blood smear at 100x magnification'
    },
    # Expected absolute counts for each WBC type in 10 HPF
    # Calculated from normal differential % applied to 30 expected WBCs
    # Ranges widened to account for sampling variation
    'differential_counts': {
        'Neutrophil': {
            'normal_pct': (50, 70),        # Reference percentage
            'expected_count': (15, 21),    # 50-70% of 30 WBCs
            'acceptable_range': (10, 35),  # Wider range for small sample
            'flag_high': 36,               # Flag if > this count
            'flag_low': 8,                 # Flag if < this count (in adequate sample)
        },
        'Lymphocyte': {
            'normal_pct': (18, 42),
            'expected_count': (5, 13),     # 18-42% of 30 WBCs
            'acceptable_range': (3, 18),
            'flag_high': 20,
            'flag_low': 2,
        },
        'Monocyte': {
            'normal_pct': (2, 11),
            'expected_count': (1, 3),      # 2-11% of 30 WBCs
            'acceptable_range': (0, 6),
            'flag_high': 8,
            'flag_low': None,              # 0 monocytes can be normal in small sample
        },
        'Eosinophil': {
            'normal_pct': (1, 3),
            'expected_count': (0, 1),      # 1-3% of 30 WBCs = 0.3-0.9
            'acceptable_range': (0, 3),
            'flag_high': 4,                # >4 eosinophils in 10 HPF is suspicious
            'flag_low': None,
        },
        'Basophil': {
            'normal_pct': (0, 2),
            'expected_count': (0, 1),      # 0-2% of 30 WBCs = 0-0.6
            'acceptable_range': (0, 2),
            'flag_high': 3,                # >3 basophils in 10 HPF is suspicious
            'flag_low': None,
        },
    }
}

# Statistical confidence thresholds for small samples
# Based on binomial confidence intervals
SMALL_SAMPLE_THRESHOLDS = {
    # Minimum WBCs needed for reliable percentage assessment
    'min_for_percentage': 20,      # Below this, use absolute counts only
    'min_for_differential': 50,    # Below this, differential has high uncertainty
    'target_for_clinical': 100,    # Clinical standard for reliable differential
    
    # Confidence interval widths (approximate) for different sample sizes
    # Used to determine if a finding is statistically significant
    'ci_width_at_30': 0.18,        # ±18% at 30 WBCs (very wide)
    'ci_width_at_50': 0.14,        # ±14% at 50 WBCs
    'ci_width_at_100': 0.10,       # ±10% at 100 WBCs (acceptable)
}


# Manual Hemocytometer Calculation Constants
# Based on Neubauer Improved Hemocytometer
HEMOCYTOMETER_CONSTANTS = {
    'WBC': {
        'dilution': 20,           # 1:20 dilution
        'area_mm2': 4.0,          # 4 corner squares, 1mm² each
        'depth_mm': 0.1,          # Chamber depth
        'squares_counted': 4,     # 4 corner squares
        'description': '4 corner squares of the hemocytometer'
    },
    'RBC': {
        'dilution': 200,          # 1:200 dilution
        'area_mm2': 0.2,          # 5 small squares (0.04mm² each)
        'depth_mm': 0.1,          # Chamber depth
        'squares_counted': 5,     # 5 intermediate squares
        'description': '5 intermediate squares of the central square'
    }
}

# Estimated Count Constants (for blood smear analysis)
# Based on standard microscopy multipliers
ESTIMATED_COUNT_CONSTANTS = {
    'WBC': {
        'multiplier': 2000,           # Standard WBC multiplier
        'min_hpf': 10,                # Minimum HPFs recommended
        'description': '(Total WBC count / 10) × 2,000',
        'note': 'Multiplier may vary (1,500-2,500) based on microscope specs'
    },
    'RBC': {
        'multiplier': 200000,         # Standard RBC multiplier for blood smear
        'typical_per_field': '200-300',  # Typical RBCs in 100x oil immersion (HPF)
        'hpf_count': 10,              # Standard 10 HPF for averaging
        'description': 'Estimated RBC count (cells/μL) = Avg RBC count/10HPF × 200,000',
        'note': 'Uses microscopic observation of stained peripheral smear under oil immersion (100x). Count RBCs in 10 HPFs and calculate average.'
    }
}
