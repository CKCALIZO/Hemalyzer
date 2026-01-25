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
    success = load_convnext_model('backend/best_leukemia_model.pth')
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
        
        print(f"\\n{'='*50}")
        print(f"Testing: {description} ({img_path})\")\n        \n        # Load and analyze image properties\n        img = Image.open(img_path).convert('RGB')\n        img_array = np.array(img)\n        \n        print(f\"Original size: {img.size}\")\n        print(f\"Original mean RGB: {np.mean(img_array, axis=(0,1))}\")\n        \n        # Test classification with new baseline preprocessing\n        result = classify_cell_crop(img, 'WBC')\n        \n        if result:\n            print(f\"\\nClassification Result:\")\n            print(f\"  Predicted class: {result['class']}\")\n            print(f\"  Confidence: {result['confidence']:.3f} ({result['confidence']*100:.1f}%)\")\n            \n            # Show top 5 predictions to see the distribution\n            sorted_probs = sorted(result['probabilities'].items(), key=lambda x: x[1], reverse=True)\n            print(f\"\\n  Top 5 predictions:\")\n            for i, (cls_name, prob) in enumerate(sorted_probs[:5]):\n                print(f\"    {i+1}. {cls_name}: {prob:.3f} ({prob*100:.1f}%)\")\n                \n            # Check for consistency improvements\n            if 'Normal' in description and 'normal' in result['class'].lower():\n                print(f\"  ✅ Correct classification for normal cell\")\n            elif 'CML' in description and 'cml' in result['class'].lower():\n                print(f\"  ✅ Correct classification for CML cell\")\n            else:\n                print(f\"  ⚠️  Classification may need further review\")\n                \n        else:\n            print(f\"❌ Classification failed\")\n            \n    print(f\"\\n{'='*60}\")\n    print(\"BASELINE PREPROCESSING TEST COMPLETE\")\n    print(\"=\"*60)\n\nif __name__ == \"__main__\":\n    test_baseline_classifier()