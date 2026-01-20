"""
ConvNeXt Model Tester
Simple script to test best_leukemia_model.pth with individual cell images

Usage:
    python test_convnext.py path/to/cell_image.jpg
    python test_convnext.py path/to/folder/  (tests all images in folder)
"""

import sys
import os
from pathlib import Path
from PIL import Image
import json

# Add backend to path to import convnext_classifier
backend_path = Path(__file__).parent / 'backend'
sys.path.insert(0, str(backend_path))

from convnext_classifier import load_convnext_model, classify_cell_crop, get_classifier_info


def test_single_image(image_path, cell_type='WBC'):
    """Test a single image"""
    print(f"\n{'='*60}")
    print(f"Testing: {image_path}")
    print(f"{'='*60}")
    
    try:
        # Load image
        img = Image.open(image_path).convert('RGB')
        print(f"Image size: {img.size}")
        print(f"Testing as: {cell_type}")
        
        # Classify
        result = classify_cell_crop(img, cell_type=cell_type)
        
        if result:
            print(f"\n✓ Classification Results:")
            print(f"  Predicted Class: {result['class']}")
            print(f"  Confidence: {result['confidence']:.1%}")
            
            if cell_type == 'RBC':
                print(f"  Is Sickle Cell: {result['is_sickle_cell']}")
                print(f"  Sickle Confidence: {result['sickle_cell_confidence']:.1%}")
            
            print(f"\n  Top 5 Predictions:")
            sorted_probs = sorted(result['probabilities'].items(), key=lambda x: x[1], reverse=True)
            for i, (cls, prob) in enumerate(sorted_probs[:5], 1):
                print(f"    {i}. {cls}: {prob:.1%}")
            
            return result
        else:
            print("✗ Classification failed - model not loaded")
            return None
            
    except Exception as e:
        print(f"✗ Error processing image: {e}")
        import traceback
        traceback.print_exc()
        return None


def test_folder(folder_path, cell_type='WBC', max_images=None):
    """Test all images in a folder"""
    print(f"\n{'='*60}")
    print(f"Testing folder: {folder_path}")
    print(f"{'='*60}\n")
    
    # Get all image files
    image_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff'}
    folder = Path(folder_path)
    
    image_files = []
    for ext in image_extensions:
        image_files.extend(folder.glob(f'*{ext}'))
        image_files.extend(folder.glob(f'*{ext.upper()}'))
    
    if not image_files:
        print(f"No images found in {folder_path}")
        return
    
    print(f"Found {len(image_files)} images")
    if max_images:
        image_files = image_files[:max_images]
        print(f"Testing first {max_images} images\n")
    
    # Test each image
    results = []
    for img_path in image_files:
        result = test_single_image(img_path, cell_type)
        if result:
            results.append({
                'file': img_path.name,
                'class': result['class'],
                'confidence': result['confidence']
            })
    
    # Summary
    if results:
        print(f"\n{'='*60}")
        print(f"SUMMARY - Tested {len(results)} images")
        print(f"{'='*60}")
        
        # Group by classification
        class_counts = {}
        for r in results:
            cls = r['class']
            class_counts[cls] = class_counts.get(cls, 0) + 1
        
        print("\nClassification Distribution:")
        for cls, count in sorted(class_counts.items(), key=lambda x: x[1], reverse=True):
            pct = (count / len(results)) * 100
            print(f"  {cls}: {count} ({pct:.1f}%)")
        
        # Save results to JSON
        output_file = 'test_results.json'
        with open(output_file, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"\nDetailed results saved to: {output_file}")


def interactive_mode():
    """Interactive testing mode"""
    print("\n" + "="*60)
    print("ConvNeXt Interactive Tester")
    print("="*60)
    print("\nCommands:")
    print("  test <image_path> [wbc|rbc]  - Test a single image")
    print("  folder <folder_path> [wbc|rbc] [max_count] - Test folder")
    print("  info - Show model info")
    print("  quit - Exit")
    print("="*60 + "\n")
    
    while True:
        try:
            cmd = input("\n> ").strip()
            
            if not cmd:
                continue
                
            if cmd.lower() in ['quit', 'exit', 'q']:
                print("Goodbye!")
                break
                
            if cmd.lower() == 'info':
                info = get_classifier_info()
                print(f"\nModel Info:")
                print(f"  Loaded: {info['loaded']}")
                print(f"  Device: {info['device']}")
                print(f"  Number of Classes: {info['num_classes']}")
                print(f"  Classes: {info['class_names']}")
                continue
            
            parts = cmd.split()
            
            if parts[0].lower() == 'test' and len(parts) >= 2:
                image_path = parts[1]
                cell_type = parts[2].upper() if len(parts) > 2 else 'WBC'
                test_single_image(image_path, cell_type)
                
            elif parts[0].lower() == 'folder' and len(parts) >= 2:
                folder_path = parts[1]
                cell_type = parts[2].upper() if len(parts) > 2 else 'WBC'
                max_images = int(parts[3]) if len(parts) > 3 else None
                test_folder(folder_path, cell_type, max_images)
                
            else:
                print("Unknown command. Type 'quit' to exit.")
                
        except KeyboardInterrupt:
            print("\n\nGoodbye!")
            break
        except Exception as e:
            print(f"Error: {e}")


def main():
    """Main function"""
    print("\n" + "="*60)
    print("ConvNeXt Leukemia Model Tester")
    print("="*60)
    
    # Load model
    print("\nLoading model...")
    model_path = Path(__file__).parent / 'backend' / 'best_leukemia_model.pth'
    
    if not model_path.exists():
        print(f"✗ Model not found at: {model_path}")
        print("  Please ensure best_leukemia_model.pth is in the backend folder")
        sys.exit(1)
    
    if load_convnext_model(str(model_path)):
        print("✓ Model loaded successfully!")
        
        # Show model info
        info = get_classifier_info()
        print(f"\nModel Information:")
        print(f"  Device: {info['device']}")
        print(f"  Classes: {info['num_classes']}")
        print(f"  Sickle Cell Index: {info['sickle_cell_class_idx']}")
        
        # Check command line args
        if len(sys.argv) > 1:
            # Command line mode
            test_path = sys.argv[1]
            cell_type = sys.argv[2].upper() if len(sys.argv) > 2 else 'WBC'
            
            if Path(test_path).is_file():
                test_single_image(test_path, cell_type)
            elif Path(test_path).is_dir():
                max_images = int(sys.argv[3]) if len(sys.argv) > 3 else None
                test_folder(test_path, cell_type, max_images)
            else:
                print(f"✗ Path not found: {test_path}")
        else:
            # Interactive mode
            interactive_mode()
    else:
        print("✗ Failed to load model")
        sys.exit(1)


if __name__ == '__main__':
    main()
