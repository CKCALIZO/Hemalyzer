"""
Test script to verify Roboflow connection and model
"""
from inference_sdk import InferenceHTTPClient
import cv2
import base64

# Initialize client
CLIENT = InferenceHTTPClient(
    api_url="https://serverless.roboflow.com",
    api_key="C1pdct7s9ZN0eGIlgmTG"
)

# Test with a sample image
print("🔍 Testing Roboflow connection...")
print("📦 Model: bloodcell-hema/5")

# Create a simple test - read any image
test_image_path = input("Enter path to test image (or press Enter to skip): ").strip()

if test_image_path and test_image_path != "":
    try:
        # Read image
        image = cv2.imread(test_image_path)
        if image is None:
            print("❌ Could not read image")
        else:
            print(f"✅ Image loaded: {image.shape}")
            
            # Convert to base64
            _, buffer = cv2.imencode('.jpg', image)
            image_base64 = base64.b64encode(buffer).decode('utf-8')
            
            print("📤 Sending to Roboflow...")
            
            # Call Roboflow
            result = CLIENT.infer(image_base64, model_id="bloodcell-hema/5")
            
            print("📥 Response received!")
            print(f"Response type: {type(result)}")
            print(f"Response keys: {result.keys() if isinstance(result, dict) else 'N/A'}")
            
            predictions = result.get('predictions', [])
            print(f"\n✅ Found {len(predictions)} predictions")
            
            for i, pred in enumerate(predictions[:5]):  # Show first 5
                print(f"  {i+1}. Class: {pred.get('class')}, Confidence: {pred.get('confidence'):.3f}")
            
            if len(predictions) > 5:
                print(f"  ... and {len(predictions) - 5} more")
                
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
else:
    print("⏭️  Skipping image test")

print("\n✅ Test complete")
