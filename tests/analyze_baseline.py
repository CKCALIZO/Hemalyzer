"""
Analyze BAS_47.jpg to establish baseline preprocessing parameters
and ensure consistent processing for all images
"""

import sys
import os
import cv2
import numpy as np
from PIL import Image
import matplotlib.pyplot as plt

sys.path.append('backend')
from convnext_classifier import AdaptiveCellPreprocessing

def analyze_baseline_image():
    """Analyze BAS_47.jpg to establish baseline preprocessing parameters"""
    
    baseline_image_path = "Normal/BAS_47.jpg"
    
    if not os.path.exists(baseline_image_path):
        print(f"Baseline image not found: {baseline_image_path}")
        return None
    
    print("="*60)
    print("BASELINE IMAGE ANALYSIS: BAS_47.jpg")
    print("="*60)
    
    # Load baseline image
    baseline_img = Image.open(baseline_image_path).convert('RGB')
    baseline_array = np.array(baseline_img)
    
    print(f"Original size: {baseline_img.size}")
    print(f"Original shape: {baseline_array.shape}")
    print(f"Original data type: {baseline_array.dtype}")
    print(f"Original value range: {baseline_array.min()}-{baseline_array.max()}")
    
    # Analyze color characteristics
    mean_rgb = np.mean(baseline_array, axis=(0,1))
    std_rgb = np.std(baseline_array, axis=(0,1))
    print(f"Mean RGB: R={mean_rgb[0]:.1f}, G={mean_rgb[1]:.1f}, B={mean_rgb[2]:.1f}")
    print(f"Std RGB:  R={std_rgb[0]:.1f}, G={std_rgb[1]:.1f}, B={std_rgb[2]:.1f}")
    
    # Test current preprocessing
    preprocessor = AdaptiveCellPreprocessing(
        target_size=384,
        normalize_staining=True,
        detect_cell=True
    )
    
    print("\n" + "="*40)
    print("PREPROCESSING ANALYSIS")
    print("="*40)
    
    # Step by step preprocessing analysis
    print("\n1. Initial resize to 384x384...")
    resized_img = baseline_img.resize((384, 384), Image.LANCZOS)
    resized_array = np.array(resized_img)
    print(f"   Resized shape: {resized_array.shape}")
    
    # Manual step-by-step preprocessing
    print("\n2. Stain normalization...")
    stain_normalized = preprocessor._normalize_staining(resized_array)
    stain_mean = np.mean(stain_normalized, axis=(0,1))
    print(f"   After stain norm - Mean RGB: R={stain_mean[0]:.1f}, G={stain_mean[1]:.1f}, B={stain_mean[2]:.1f}")
    
    print("\n3. CLAHE enhancement...")
    clahe_enhanced = preprocessor._adaptive_histogram_equalization(stain_normalized)
    clahe_mean = np.mean(clahe_enhanced, axis=(0,1))
    print(f"   After CLAHE - Mean RGB: R={clahe_mean[0]:.1f}, G={clahe_mean[1]:.1f}, B={clahe_mean[2]:.1f}")
    
    print("\n4. Cell detection and centering...")
    final_processed = preprocessor._detect_and_center_cell(clahe_enhanced)
    final_mean = np.mean(final_processed, axis=(0,1))
    print(f"   After cell detection - Mean RGB: R={final_mean[0]:.1f}, G={final_mean[1]:.1f}, B={final_mean[2]:.1f}")
    print(f"   Final shape: {final_processed.shape}")
    
    # Full preprocessing
    print("\n5. Full preprocessing pipeline...")
    fully_processed = preprocessor(baseline_img)
    fully_processed_array = np.array(fully_processed)
    full_mean = np.mean(fully_processed_array, axis=(0,1))
    print(f"   Full pipeline - Mean RGB: R={full_mean[0]:.1f}, G={full_mean[1]:.1f}, B={full_mean[2]:.1f}")
    print(f"   Full pipeline shape: {fully_processed_array.shape}")
    
    # Return baseline parameters
    baseline_params = {
        'original_size': baseline_img.size,
        'target_size': (384, 384),
        'original_mean_rgb': mean_rgb,
        'original_std_rgb': std_rgb,
        'processed_mean_rgb': full_mean,
        'stain_norm_mean': stain_mean,
        'clahe_mean': clahe_mean,
        'final_mean': final_mean
    }
    
    print("\n" + "="*60)
    print("BASELINE PARAMETERS ESTABLISHED")
    print("="*60)
    for key, value in baseline_params.items():
        print(f"{key}: {value}")
    
    return baseline_params

def test_other_images_against_baseline(baseline_params):
    """Test other sample images against the baseline"""
    
    test_images = [
        "CML/BAS_0001.png"
    ]
    
    preprocessor = AdaptiveCellPreprocessing(
        target_size=384,
        normalize_staining=True,
        detect_cell=True
    )
    
    print("\n" + "="*60)
    print("TESTING OTHER IMAGES AGAINST BASELINE")
    print("="*60)
    
    for img_path in test_images:
        if not os.path.exists(img_path):
            print(f"Skipping {img_path} - file not found")
            continue
        
        print(f"\nTesting: {img_path}")
        print("-" * 40)
        
        # Load image
        img = Image.open(img_path).convert('RGB')
        img_array = np.array(img)
        
        print(f"Original size: {img.size}")
        original_mean = np.mean(img_array, axis=(0,1))
        print(f"Original Mean RGB: R={original_mean[0]:.1f}, G={original_mean[1]:.1f}, B={original_mean[2]:.1f}")
        
        # Apply preprocessing
        processed_img = preprocessor(img)
        processed_array = np.array(processed_img)
        processed_mean = np.mean(processed_array, axis=(0,1))
        
        print(f"Processed Mean RGB: R={processed_mean[0]:.1f}, G={processed_mean[1]:.1f}, B={processed_mean[2]:.1f}")
        
        # Compare to baseline
        baseline_mean = baseline_params['processed_mean_rgb']
        diff_r = abs(processed_mean[0] - baseline_mean[0])
        diff_g = abs(processed_mean[1] - baseline_mean[1])
        diff_b = abs(processed_mean[2] - baseline_mean[2])
        
        print(f"Difference from baseline:")
        print(f"  R: {diff_r:.1f}, G: {diff_g:.1f}, B: {diff_b:.1f}")
        
        # Flag if differences are too large
        if diff_r > 30 or diff_g > 30 or diff_b > 30:
            print("  ⚠️  LARGE DIFFERENCE FROM BASELINE - may need adjustment")
        else:
            print("  ✅ Within acceptable range of baseline")

if __name__ == "__main__":
    # Analyze baseline
    baseline_params = analyze_baseline_image()
    
    if baseline_params:
        # Test other images
        test_other_images_against_baseline(baseline_params)