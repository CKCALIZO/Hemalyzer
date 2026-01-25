"""
Test script to verify preprocessing pipeline consistency between training and app.py
"""

import sys
import os
sys.path.append('backend')

from convnext_classifier import AdaptiveCellPreprocessing, classify_cell_crop
from PIL import Image
import numpy as np
import cv2

def test_preprocessing_pipeline():
    """Test that the preprocessing pipeline matches training exactly"""
    
    print("Testing AdaptiveCellPreprocessing pipeline...")
    
    # Test with a Normal basophil image
    test_images = [
        "Normal/BAS_47.jpg",
        "CML/BAS_0001.png"
    ]
    
    preprocessor = AdaptiveCellPreprocessing(
        target_size=384,
        normalize_staining=True,
        detect_cell=True
    )
    
    for img_path in test_images:
        if not os.path.exists(img_path):
            print(f"Skipping {img_path} - file not found")
            continue
            
        print(f"\n{'='*50}")
        print(f"Testing: {img_path}")
        
        # Load original image
        img = Image.open(img_path).convert('RGB')
        print(f"Original size: {img.size}")
        
        # Apply preprocessing (same as during training)
        preprocessed = preprocessor(img)
        print(f"Preprocessed size: {preprocessed.size}")
        
        # Check if the image is still RGB (not grayscale)
        img_array = np.array(preprocessed)
        print(f"Preprocessed shape: {img_array.shape}")
        print(f"Image channels: {img_array.shape[2] if len(img_array.shape) == 3 else 'Grayscale'}")
        
        # Test classification
        result = classify_cell_crop(img, 'WBC')
        if result:
            print(f"Classification: {result['class']} (confidence: {result['confidence']:.3f})")
            
            # Show top 3 predictions
            sorted_probs = sorted(result['probabilities'].items(), key=lambda x: x[1], reverse=True)
            print("Top 3 predictions:")
            for i, (cls_name, prob) in enumerate(sorted_probs[:3]):
                print(f"  {i+1}. {cls_name}: {prob:.3f}")
        
        print(f"{'='*50}")

if __name__ == "__main__":
    test_preprocessing_pipeline()