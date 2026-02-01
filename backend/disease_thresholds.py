"""
Disease Classification Thresholds and Clinical Constants
Based on standard hematology reference values and clinical guidelines
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
    # Reference: Updated Sickle Cell Anemia Classification table
    # Percentage calculated as: (Total Sickled Cells / Total RBCs) × 100
    'sickle_cell': {
        'normal': {'max_percent': 3.0, 'interpretation': 'Normal / Smudge Cells - no clinical sickling observed'},
        'mild': {'min_percent': 3.0, 'max_percent': 10.0, 'interpretation': 'Mild Sickling - Heterozygous HbAS condition (Sickle Cell Trait)'},
        'moderate': {'min_percent': 10.0, 'max_percent': 30.0, 'interpretation': 'Moderate Sickling - may correlate with symptoms or stress (possible HbSS)'},
        'severe': {'min_percent': 30.0, 'interpretation': 'Severe Sickling - suggestive of Sickle Cell Disease (HbSS)'}
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
    # Normal lymphocyte range: 20%-35% (standard differential count reference)
    'cll': {
        'normal': {'max_percent': 35, 'interpretation': 'Normal lymphocyte count - balanced white cell differential'},
        'reactive': {'min_percent': 35, 'max_percent': 50, 'interpretation': 'Reactive / Secondary Lymphocytosis - may occur with viral infections'},
        'early_cll': {'min_percent': 51, 'max_percent': 65, 'interpretation': 'Suspicious for Early / Smoldering CLL'},
        'typical_cll': {'min_percent': 66, 'max_percent': 80, 'interpretation': 'Typical Chronic Lymphocytic Leukemia (CLL)'},
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
