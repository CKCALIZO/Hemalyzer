"""
Test how different crop sizes and centering affect classification
Simulates YOLO crops with varying padding and centering
"""
import sys
import os
from PIL import Image, ImageDraw
import matplotlib.pyplot as plt
import numpy as np

# Add backend directory to path
backend_dir = os.path.join(os.path.dirname(__file__), 'backend')
sys.path.insert(0, backend_dir)

from convnext_classifier import load_convnext_model, classifier


def create_test_crops(image_path, cell_bbox=None):
    """
    Create different crop variations to test preprocessing robustness
    
    Args:
        image_path: Path to cell image
        cell_bbox: Optional (x1, y1, x2, y2) of actual cell location
    
    Returns:
        Dictionary of crop variations
    """
    img = Image.open(image_path).convert('RGB')
    width, height = img.size
    
    # If no bbox provided, assume cell is roughly centered
    if cell_bbox is None:
        # Assume cell occupies center 60% of image
        margin = 0.2
        cell_bbox = (
            int(width * margin),
            int(height * margin),
            int(width * (1 - margin)),
            int(height * (1 - margin))
        )
    
    x1, y1, x2, y2 = cell_bbox
    cell_width = x2 - x1
    cell_height = y2 - y1
    cell_center_x = (x1 + x2) // 2
    cell_center_y = (y1 + y2) // 2
    max_dim = max(cell_width, cell_height)
    
    crops = {}
    
    # Original image
    crops['original'] = img
    
    # Tight crop (1.1x padding - minimal)
    crop_size = int(max_dim * 1.1)
    crops['tight_1.1x'] = create_centered_crop(img, cell_center_x, cell_center_y, crop_size)
    
    # Old setting (1.25x padding)
    crop_size = int(max_dim * 1.25)
    crops['old_1.25x'] = create_centered_crop(img, cell_center_x, cell_center_y, crop_size)
    
    # New setting (2.0x padding - more context)
    crop_size = int(max_dim * 2.0)
    crops['new_2.0x'] = create_centered_crop(img, cell_center_x, cell_center_y, crop_size)
    
    # Loose crop (3.0x padding - maximum context)
    crop_size = int(max_dim * 3.0)
    crops['loose_3.0x'] = create_centered_crop(img, cell_center_x, cell_center_y, crop_size)
    
    # Off-center crop (simulate poor YOLO detection)
    crop_size = int(max_dim * 2.0)
    offset_x = int(max_dim * 0.3)  # Shift 30% to the right
    offset_y = int(max_dim * 0.2)  # Shift 20% down
    crops['off_center_2.0x'] = create_centered_crop(
        img, 
        cell_center_x + offset_x, 
        cell_center_y + offset_y, 
        crop_size
    )
    
    return crops


def create_centered_crop(img, center_x, center_y, crop_size):
    """Create a square crop centered on specified point"""
    width, height = img.size
    
    x1 = max(0, center_x - crop_size // 2)
    y1 = max(0, center_y - crop_size // 2)
    x2 = min(width, center_x + crop_size // 2)
    y2 = min(height, center_y + crop_size // 2)
    
    # Maintain square aspect ratio
    actual_width = x2 - x1
    actual_height = y2 - y1
    if actual_width != actual_height:
        min_side = min(actual_width, actual_height)
        x2 = x1 + min_side
        y2 = y1 + min_side
    
    return img.crop((x1, y1, x2, y2))


def test_crop_variations(image_path, cell_bbox=None):
    """
    Test how different crop variations affect classification
    """
    print("="*70)
    print("CROP VARIATION TEST - Classification Robustness")
    print("="*70)
    
    # Load model
    print("\nLoading ConvNeXt model...")
    model_path = os.path.join(backend_dir, 'best_leukemia_model.pth')
    if not load_convnext_model(model_path):
        print("Failed to load model!")
        return
    
    print(f"\nTesting image: {image_path}")
    
    # Create crop variations
    crops = create_test_crops(image_path, cell_bbox)
    
    # Test each crop variation
    results = {}
    print("\n" + "-"*70)
    print("Testing different crop sizes and positions...")
    print("-"*70)
    
    for crop_name, crop_img in crops.items():
        if crop_name == 'original':
            continue
        
        # Classify
        result = classifier.classify(crop_img, 'WBC')
        
        if result:
            results[crop_name] = result
            print(f"\n{crop_name}:")
            print(f"  Crop size: {crop_img.size}")
            print(f"  Predicted: {result['class']}")
            print(f"  Confidence: {result['confidence']:.4f}")
            
            # Show top 3
            sorted_probs = sorted(result['probabilities'].items(), key=lambda x: x[1], reverse=True)
            print(f"  Top 3:")
            for i, (cls, prob) in enumerate(sorted_probs[:3], 1):
                print(f"    {i}. {cls:30s} - {prob:.4f}")
    
    # Create visualization
    print("\n" + "-"*70)
    print("Creating visualization...")
    print("-"*70)
    
    fig, axes = plt.subplots(2, 3, figsize=(15, 10))
    axes = axes.flatten()
    
    crop_names = ['tight_1.1x', 'old_1.25x', 'new_2.0x', 'loose_3.0x', 'off_center_2.0x', 'original']
    
    for idx, crop_name in enumerate(crop_names):
        if crop_name not in crops:
            continue
        
        crop_img = crops[crop_name]
        axes[idx].imshow(crop_img)
        
        if crop_name in results:
            result = results[crop_name]
            title = f"{crop_name}\n{result['class']}\nConf: {result['confidence']:.3f}"
        else:
            title = f"{crop_name}\n(Original - Full Image)"
        
        axes[idx].set_title(title, fontsize=9)
        axes[idx].axis('off')
    
    plt.suptitle(f'Crop Variation Effects on Classification\n{os.path.basename(image_path)}', 
                 fontsize=12, fontweight='bold')
    plt.tight_layout()
    
    # Save
    output_path = 'crop_variation_test.png'
    plt.savefig(output_path, dpi=150, bbox_inches='tight')
    print(f"\nVisualization saved to: {output_path}")
    
    plt.show()
    
    # Analysis
    print("\n" + "="*70)
    print("ANALYSIS")
    print("="*70)
    
    # Check consistency
    predictions = [r['class'] for r in results.values()]
    confidences = [r['confidence'] for r in results.values()]
    
    unique_predictions = set(predictions)
    
    if len(unique_predictions) == 1:
        print(f"\n✓ CONSISTENT: All crops predicted same class: {predictions[0]}")
        print(f"  Confidence range: {min(confidences):.3f} - {max(confidences):.3f}")
        print(f"  Average confidence: {np.mean(confidences):.3f}")
    else:
        print(f"\n✗ INCONSISTENT: Multiple predictions detected!")
        print(f"  Predictions: {unique_predictions}")
        print(f"  This suggests crop size/positioning affects classification")
    
    # Recommend best setting
    best_crop = max(results.items(), key=lambda x: x[1]['confidence'])
    print(f"\n  Highest confidence: {best_crop[0]} ({best_crop[1]['confidence']:.3f})")
    
    print("\n" + "="*70)
    print("RECOMMENDATIONS")
    print("="*70)
    print("\n1. CROP PADDING:")
    print("   - 1.1x: Too tight, may cut off cell edges")
    print("   - 1.25x: Old setting, minimal context")
    print("   - 2.0x: NEW - Better balance of cell + context (RECOMMENDED)")
    print("   - 3.0x: May include too much background")
    
    print("\n2. IMAGE QUALITY:")
    print("   - CLAHE preprocessing helps normalize quality differences")
    print("   - Increased CLAHE clipLimit (3.0) for better quality handling")
    
    print("\n3. CELL CENTERING:")
    print("   - Circular focus ratio increased to 0.85 (from 0.75)")
    print("   - More forgiving for off-center cells")
    print("   - YOLO should provide well-centered crops")
    
    print("\n" + "="*70)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python test_crop_variations.py <image_path>")
        print("\nExample:")
        print("  python test_crop_variations.py Normal/BAS_47.jpg")
        print("  python test_crop_variations.py CML/BAS_0001.png")
        sys.exit(1)
    
    image_path = sys.argv[1]
    test_crop_variations(image_path)
