from pathlib import Path
import shutil

BASE_DIR = Path(__file__).parent
GA_DIR = BASE_DIR / "ga"
GA_DIR.mkdir(exist_ok=True)


def save_ga(file):
    ga_path = GA_DIR / file.filename
    with open(ga_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return ga_path.name

