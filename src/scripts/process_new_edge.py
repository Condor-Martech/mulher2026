import sys
from PIL import Image
import numpy as np

def process_torn_edge(input_path, output_path):
    # Open image
    img = Image.open(input_path).convert("RGBA")
    data = np.array(img)
    
    # Identify "white" pixels (background)
    # The user's image has a clean white border
    red, green, blue, alpha = data.T
    
    # Define white threshold (very high to only catch the background)
    white_areas = (red > 240) & (green > 240) & (blue > 240)
    
    # Make white areas transparent
    data[white_areas.T] = (0, 0, 0, 0)
    
    # Save as WebP
    new_img = Image.fromarray(data)
    new_img.save(output_path, "WEBP", quality=95)
    print(f"Processed image saved to {output_path}")

if __name__ == "__main__":
    process_torn_edge(sys.argv[1], sys.argv[2])
