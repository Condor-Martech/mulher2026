import json

cache_path = "/home/diego/.mcp-figma/cache/file_yvXxe2gl3uLK7gStJZqIga_1777393099059.json"

def find_images(node, path=""):
    images = []
    node_id = node.get("id")
    node_name = node.get("name")
    
    if "fills" in node:
        for fill in node["fills"]:
            if fill.get("type") == "IMAGE" and "imageRef" in fill:
                images.append({
                    "id": node_id,
                    "name": node_name,
                    "imageRef": fill["imageRef"],
                    "path": path + " > " + node_name
                })
    
    if "children" in node:
        for child in node["children"]:
            images.extend(find_images(child, path + " > " + node_name))
            
    return images

try:
    with open(cache_path, 'r') as f:
        data = json.load(f)
        
    all_images = find_images(data["document"])
    
    # Filter for the "Dia das Mães" section if possible
    for img in all_images:
        print(f"ID: {img['id']} | Name: {img['name']} | Ref: {img['imageRef']}")
        
except Exception as e:
    print(f"Error: {e}")
