"""
Test to compare detection with NAS vs non-NAS models
This will help identify if NAS modules are causing detection issues
"""

from ultralytics import YOLO
from PIL import Image
import numpy as np
import cv2
import sys
from pathlib import Path

def test_model(model_path, image_path, model_description):
    """Test a single model"""
    print(f"\n{'='*70}")
    print(f"Testing: {model_description}")
    print(f"Model: {model_path}")
    print(f"{'='*70}")
    
    try:
        # Load model
        model = YOLO(str(model_path))
        print(f"✅ Model loaded")
        print(f"   Classes: {model.names}")
        
        # Load image
        image = Image.open(image_path)
        image_np = np.array(image)
        
        if len(image_np.shape) == 2:
            image_np = cv2.cvtColor(image_np, cv2.COLOR_GRAY2RGB)
        elif image_np.shape[2] == 4:
            image_np = cv2.cvtColor(image_np, cv2.COLOR_RGBA2RGB)
        
        # Run inference with current "best" settings
        results = model.predict(
            source=image_np,
            conf=0.1,
            iou=0.3,
            imgsz=640,
            max_det=2000,
            agnostic_nms=True,
            verbose=False
        )
        
        boxes = results[0].boxes
        
        # Count detections
        class_counts = {}
        for box in boxes:
            cls_name = model.names.get(int(box.cls[0]))
            class_counts[cls_name] = class_counts.get(cls_name, 0) + 1
        
        print(f"\n📊 Results:")
        print(f"   Total detections: {len(boxes)}")
        for cls, count in class_counts.items():
            print(f"   - {cls}: {count}")
        
        return len(boxes), class_counts
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 0, {}


def main():
    if len(sys.argv) < 2:
        print("Usage: python test_nas_vs_nonnas.py <image_path>")
        print("\nExample:")
        print("  python test_nas_vs_nonnas.py ../testing-grounds/sample.jpg")
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    if not Path(image_path).exists():
        print(f"❌ Image not found: {image_path}")
        sys.exit(1)
    
    # Models to test
    models_dir = Path(__file__).parent / "models"
    
    models_to_test = [
        (models_dir / "best (2).pt", "best (2).pt - NAS Model (Currently Used)"),
        (models_dir / "best.pt", "best.pt - Alternative Model"),
    ]
    
    print("="*70)
    print("🔬 NAS vs Non-NAS Detection Comparison")
    print("="*70)
    print(f"📁 Image: {Path(image_path).name}")
    
    results = []
    
    for model_path, description in models_to_test:
        if model_path.exists():
            count, class_counts = test_model(model_path, image_path, description)
            results.append((description, count, class_counts))
        else:
            print(f"\n⚠️  Model not found: {model_path}")
    
    # Summary
    print("\n" + "="*70)
    print("📊 COMPARISON SUMMARY")
    print("="*70)
    
    if len(results) >= 2:
        for desc, count, _ in results:
            print(f"{desc}: {count} detections")
        
        diff = abs(results[0][1] - results[1][1])
        if diff > 50:
            print(f"\n⚠️  SIGNIFICANT DIFFERENCE: {diff} detections")
            print("This suggests NAS modules may be affecting detection!")
            print("\n💡 Recommendation:")
            better_model = max(results, key=lambda x: x[1])
            print(f"   Use: {better_model[0].split(' - ')[0]}")
        else:
            print(f"\n✅ Both models perform similarly (difference: {diff})")
    
    print("="*70)
