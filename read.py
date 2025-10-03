import trimesh
import os

folder = "public/meteors"

for file in os.listdir(folder):
    if file.endswith(".glb"):
        path = os.path.join(folder, file)
        try:
            mesh = trimesh.load(path, force='scene')  # handles GLB
            # Compute overall bounding box
            bounds = mesh.bounds  # [[minx, miny, minz], [maxx, maxy, maxz]]
            size = bounds[1] - bounds[0]
            print(f"{file}: size = {size}, max dim = {size.max()}")
        except Exception as e:
            print(f"{file}: error {e}")
