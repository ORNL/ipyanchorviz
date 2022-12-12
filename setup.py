from pathlib import Path

from jupyter_packaging import (
    combine_commands,
    create_cmdclass,
    ensure_targets,
    install_npm,
)
from setuptools import setup

JS_DIR = Path(__file__).resolve().parent / "js"

# Representative files that should exist after a successful build
jstargets = [JS_DIR / "dist" / "index.js"]

data_files_spec = [
    ("share/jupyter/nbextensions/ipyanchorviz", "ipyanchorviz/nbextension", "*.*"),
    ("share/jupyter/labextensions/ipyanchorviz", "ipyanchorviz/labextension", "**"),
    ("share/jupyter/labextensions/ipyanchorviz", ".", "install.json"),
    ("etc/jupyter/nbconfig/notebook.d", ".", "ipyanchorviz.json"),
]

cmdclass = create_cmdclass("jsdeps", data_files_spec=data_files_spec)
cmdclass["jsdeps"] = combine_commands(
    install_npm(JS_DIR, npm=["yarn"], build_cmd="build:prod"),
    ensure_targets(jstargets),
)

# See setup.cfg for other parameters
setup(cmdclass=cmdclass)
