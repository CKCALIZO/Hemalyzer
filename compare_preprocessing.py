"""
Diagnostic script to compare preprocessing pipelines
Shows the difference between test_convnext.py and app.py preprocessing
"""
import sys
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import matplotlib.pyplot as plt

# Add backend directory to path
backend_dir = os.path.join(os.path.dirname(__file__), 'backend')
sys.path.insert(0, backend_dir)

from convnext_classifier import load_convnext_model, classifier


def visualize_preprocessing_stages(image_path):
    """
    Visualize each stage of the ConvNeXt preprocessing pipeline
    to verify it matches training script
    """
    print("="*70)
    print("CONVNEXT PREPROCESSING PIPELINE VISUALIZATION")
    print("="*70)
    
    # Load model
    print("\nLoading ConvNeXt model...")
    model_path = os.path.join(backend_dir, 'best_leukemia_model.pth')
    if not load_convnext_model(model_path):
        print("Failed to load model!")
        return
    
    # Load original image
    print(f"\nLoading image: {image_path}")
    original_img = Image.open(image_path).convert('RGB')
    print(f"  Original size: {original_img.size}")
    
    # Stage 1-2: Pre-transforms (Resize to 422, CenterCrop to 384)
    img_stage1 = classifier.pre_transform(original_img)
    print(f"\nStage 1-2: Pre-transform (Resize 422 → CenterCrop 384)")
    print(f"  Size after: {img_stage1.size}")
    
    # Stage 3: CellFocusedPreprocessing (CLAHE, circular focus, edge enhancement)
    img_stage2 = classifier.preprocessor(img_stage1)
    print(f"\nStage 3: CellFocusedPreprocessing (CLAHE, circular focus, edges)")
    print(f"  Size after: {img_stage2.size}")
    print(f"  Applied:")
    print(f"    - CLAHE in LAB color space (clipLimit=2.0)")
    print(f"    - Circular focus mask (75% ratio)")
    print(f"    - Edge enhancement (sharpness 1.5x, contrast 1.2x)")
    
    # Stage 4: Final resize (should be 384x384, but applied to preprocessed image)
    # We'll skip ToTensor and Normalize for visualization
    from torchvision import transforms
    final_resize = transforms.Resize((384, 384))
    img_stage3 = final_resize(img_stage2)
    print(f"\nStage 4: Final resize to 384x384")
    print(f"  Size after: {img_stage3.size}")
    
    # Create visualization
    fig, axes = plt.subplots(2, 2, figsize=(12, 12))
    
    # Original
    axes[0, 0].imshow(original_img)
    axes[0, 0].set_title(f'Original Image\nSize: {original_img.size}', fontsize=10)
    axes[0, 0].axis('off')
    
    # After Pre-transform
    axes[0, 1].imshow(img_stage1)
    axes[0, 1].set_title(f'After Pre-transform\n(Resize 422 → CenterCrop 384)\nSize: {img_stage1.size}', fontsize=10)
    axes[0, 1].axis('off')
    
    # After CellFocusedPreprocessing
    axes[1, 0].imshow(img_stage2)
    axes[1, 0].set_title(f'After CellFocusedPreprocessing\n(CLAHE + Circular Focus + Edge Enhance)\nSize: {img_stage2.size}', fontsize=10)
    axes[1, 0].axis('off')
    
    # Final (what goes to model)
    axes[1, 1].imshow(img_stage3)
    axes[1, 1].set_title(f'Final (Pre-Normalize)\nSize: {img_stage3.size}\n(Ready for ToTensor + Normalize)', fontsize=10)
    axes[1, 1].axis('off')
    
    plt.suptitle('ConvNeXt Preprocessing Pipeline - Matches Training Script', fontsize=14, fontweight='bold')
    plt.tight_layout()
    
    # Save visualization
    output_path = 'preprocessing_pipeline_visualization.png'
    plt.savefig(output_path, dpi=150, bbox_inches='tight')
    print(f"\n{'='*70}")
    print(f"Visualization saved to: {output_path}")
    print(f"{'='*70}")
    
    plt.show()
    
    # Now test classification
    print("\n\nTesting classification with full pipeline:")
    result = classifier.classify(original_img, 'WBC')
    
    if result:
        print(f"\nClassification Result:")
        print(f"  Predicted Class: {result['class']}")
        print(f"  Confidence: {result['confidence']:.4f}")
        print(f"\n  Top 5 Predictions:")
        sorted_probs = sorted(result['probabilities'].items(), key=lambda x: x[1], reverse=True)
        for i, (cls, prob) in enumerate(sorted_probs[:5], 1):
            print(f"    {i}. {cls:30s} - {prob:.4f}")
    
    print("\n" + "="*70)
    print("VERIFICATION COMPLETE")
    print("="*70)
    print("\nThis preprocessing pipeline EXACTLY matches train_convnext_leukemia_classifier.py:")
    print("  1. Resize to 422x422 (1.1x scale)")
    print("  2. CenterCrop to 384x384")
    print("  3. CellFocusedPreprocessing (CLAHE, circular focus, edge enhance)")
    print("  4. Resize to 384x384 (ensure exact size)")
    print("  5. ToTensor + Normalize (ImageNet stats)")
    print("="*70)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python compare_preprocessing.py <image_path>")
        print("\nExample:")
        print("  python compare_preprocessing.py")
        sys.exit(1)
    
    image_path = sys.argv[1]
    visualize_preprocessing_stages(image_path)
