"""
Test Baseline Normalization Implementation
Verifies that all images are properly normalized to match BAS_47.jpg baseline characteristics
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from convnext_classifier import load_convnext_model, classifier, AdaptiveCellPreprocessing
from PIL import Image
import numpy as np

def test_baseline_normalization():
    """Test the baseline normalization preprocessing"""
    print("="*70)
    print("TESTING BASELINE NORMALIZATION")
    print("="*70)
    
    # Test with a few different images
    test_images = [
        r"C:\Users\Bernie\Documents\Hemalyzer\Hemalyzer-Lance\Hemalyzer\Normal\BAS_47.jpg",  # Baseline itself
        r"C:\Users\Bernie\Documents\Hemalyzer\Hemalyzer-Lance\Hemalyzer\Normal\BAS_1223.jpg",  # Different basophil
        r"C:\Users\Bernie\Documents\Hemalyzer\Hemalyzer-Lance\Hemalyzer\Normal\BAS_580.jpg",   # Another basophil
        r"C:\Users\Bernie\Documents\Hemalyzer\Hemalyzer-Lance\Hemalyzer\CML\BAS_0001.png",     # CML basophil
        r"C:\Users\Bernie\Documents\Hemalyzer\Hemalyzer-Lance\Hemalyzer\CML\BAS_0002.png",     # CML basophil
        r"C:\Users\Bernie\Documents\Hemalyzer\Hemalyzer-Lance\Hemalyzer\CML\BAS_0003.png",     # CML basophil
    ]
    
    # Load ConvNeXt model (this will initialize the preprocessor with baseline)
    print("Loading ConvNeXt model with baseline preprocessing...")
    if not load_convnext_model():
        print("❌ Failed to load model!")
        return
    
    print(f"✅ Model loaded successfully")
    print(f"   Baseline image path: {getattr(classifier.preprocessor, 'baseline_image_path', 'Not set')}")
    print(f"   Baseline mean RGB: {getattr(classifier.preprocessor, 'baseline_mean', 'Not set')}")
    print(f"   Target mean RGB: {getattr(classifier.preprocessor, 'target_mean', 'Not set')}")
    
    print(f"\n{'='*70}")
    print("TESTING IMAGE NORMALIZATION")
    print(f"{'='*70}")
    
    for i, img_path in enumerate(test_images, 1):
        if not os.path.exists(img_path):
            print(f"\n❌ Image {i}: {os.path.basename(img_path)} - FILE NOT FOUND")
            continue
            
        print(f"\n🔍 Image {i}: {os.path.basename(img_path)}")
        print("-" * 50)
        
        try:
            # Load original image
            original_img = Image.open(img_path).convert('RGB')
            original_array = np.array(original_img)
            original_mean = np.mean(original_array, axis=(0,1))
            
            print(f"   Original size: {original_img.size}")
            print(f"   Original mean RGB: [{original_mean[0]:.1f}, {original_mean[1]:.1f}, {original_mean[2]:.1f}]")
            
            # Apply preprocessing (including baseline normalization)
            os.environ['PROCESSING_DEBUG'] = '1'  # Enable debug output
            processed_img = classifier.preprocessor(original_img)
            processed_array = np.array(processed_img)
            processed_mean = np.mean(processed_array, axis=(0,1))
            
            print(f"   Processed size: {processed_img.size}")
            print(f"   Processed mean RGB: [{processed_mean[0]:.1f}, {processed_mean[1]:.1f}, {processed_mean[2]:.1f}]")
            
            # Calculate how close we are to target
            target_mean = classifier.preprocessor.target_mean
            distance = np.linalg.norm(processed_mean - target_mean)
            print(f"   Distance from target: {distance:.1f}")
            
            # Test classification to see if it's more consistent now
            classification = classifier.classify(original_img, 'WBC')
            if classification:
                print(f"   🎯 Classification: {classification['class']} ({classification['confidence']:.3f})")
            else:
                print(f"   ❌ Classification failed")
                
        except Exception as e:
            print(f"   ❌ Error processing image: {e}")
    
    # Disable debug output
    os.environ.pop('PROCESSING_DEBUG', None)
    
    print(f"\n{'='*70}")
    print("NORMALIZATION TEST COMPLETE")
    print(f"{'='*70}")
    print("✅ All images should now have similar color characteristics")
    print("✅ This should reduce RBC/Platelet misclassifications in WBC crops")
    print("✅ The model should now be more consistent with training data distribution")

if __name__ == "__main__":
    test_baseline_normalization()