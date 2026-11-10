"""
GNOME Quick Themer - Presets Management
Handles bundled presets and user-customized presets.
"""

import os
import json

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)

# Bundled presets locations
BUNDLED_PRESETS_FILE = os.path.join(SCRIPT_DIR, "presets.json")
if not os.path.exists(BUNDLED_PRESETS_FILE):
    BUNDLED_PRESETS_FILE = os.path.join(PROJECT_ROOT, "presets.json")

# User custom presets directory
USER_CONFIG_DIR = os.environ.get("QUICK_THEMER_CONFIG_DIR") or os.path.expanduser("~/.config/gnome-quick-themer")
USER_PRESETS_FILE = os.path.join(USER_CONFIG_DIR, "custom_presets.json")


def get_user_presets() -> dict:
    """Loads user-defined custom presets from ~/.config/gnome-quick-themer/"""
    if not os.path.exists(USER_PRESETS_FILE):
        return {}
    try:
        with open(USER_PRESETS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Warning: Could not read user presets: {e}")
        return {}


def load_presets() -> dict:
    """Loads all presets: bundled presets merged with user custom presets."""
    presets = {}
    if os.path.exists(BUNDLED_PRESETS_FILE):
        try:
            with open(BUNDLED_PRESETS_FILE, "r", encoding="utf-8") as f:
                presets = json.load(f)
        except Exception as e:
            print(f"Error loading bundled presets: {e}")

    # Merge user custom presets (user presets take priority or add new themes)
    user_presets = get_user_presets()
    presets.update(user_presets)
    return presets


def save_custom_preset(name: str, config: dict) -> bool:
    """Saves or updates a user custom preset in ~/.config/gnome-quick-themer/."""
    if not name or not name.strip():
        return False
    name = name.strip()
    try:
        os.makedirs(USER_CONFIG_DIR, exist_ok=True)
        user_presets = get_user_presets()
        user_presets[name] = config
        with open(USER_PRESETS_FILE, "w", encoding="utf-8") as f:
            json.dump(user_presets, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error saving custom preset: {e}")
        return False


def save_preset(name: str, config: dict) -> bool:
    """Alias for saving preset."""
    return save_custom_preset(name, config)


def delete_custom_preset(name: str) -> bool:
    """Deletes a user custom preset."""
    user_presets = get_user_presets()
    if name in user_presets:
        del user_presets[name]
        try:
            with open(USER_PRESETS_FILE, "w", encoding="utf-8") as f:
                json.dump(user_presets, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"Error deleting custom preset: {e}")
            return False
    return False


def delete_preset(name: str) -> bool:
    return delete_custom_preset(name)
