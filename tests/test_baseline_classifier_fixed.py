"""
Test the updated convnext_classifier with baseline preprocessing
"""

import sys
import os
sys.path.append('backend')

from convnext_classifier import classify_cell_crop, load_convnext_model
from PIL import Image
import numpy as np

def test_baseline_classifier():
    """Test the updated classifier with baseline preprocessing"""
    
    print("="*60)
    print("TESTING UPDATED CONVNEXT CLASSIFIER")
    print("with Baseline Preprocessing")
    print("="*60)
    
    # Load the model
    print("Loading ConvNeXt model...")
    success = load_convnext_model('best_leukemia_model.pth')
    if not success:
        print("❌ Failed to load model")
        return
    print("✅ Model loaded successfully")
    
    # Test images
    test_images = [
        ("Normal/BAS_47.jpg", "Normal Basophil"),
        ("CML/BAS_0001.png", "CML Basophil")
    ]
    
    for img_path, description in test_images:
        if not os.path.exists(img_path):
            print(f"Skipping {img_path} - file not found")
            continue
        
        print(f"\n{'='*50}")
        print(f"Testing: {description} ({img_path})")
        
        # Load and analyze image properties
        img = Image.open(img_path).convert('RGB')
        img_array = np.array(img)
        
        print(f"Original size: {img.size}")
        print(f"Original mean RGB: {np.mean(img_array, axis=(0,1))}")
        
        # Test classification with new baseline preprocessing
        result = classify_cell_crop(img, 'WBC')
        
        if result:
            print(f"\nClassification Result:")
            print(f"  Predicted class: {result['class']}")
            print(f"  Confidence: {result['confidence']:.3f} ({result['confidence']*100:.1f}%)")
            
            # Show top 5 predictions to see the distribution
            sorted_probs = sorted(result['probabilities'].items(), key=lambda x: x[1], reverse=True)
            print(f"\n  Top 5 predictions:")
            for i, (cls_name, prob) in enumerate(sorted_probs[:5]):
                print(f"    {i+1}. {cls_name}: {prob:.3f} ({prob*100:.1f}%)")
                
            # Check for consistency improvements
            if 'Normal' in description and 'normal' in result['class'].lower():
                print(f"  ✅ Correct classification for normal cell")
            elif 'CML' in description and 'cml' in result['class'].lower():
                print(f"  ✅ Correct classification for CML cell")
            else:
                print(f"  ⚠️  Classification may need further review")
                
        else:
            print(f"❌ Classification failed")
            
    print(f"\n{'='*60}")
    print("BASELINE PREPROCESSING TEST COMPLETE")
    print("="*60)

if __name__ == "__main__":
    test_baseline_classifier()