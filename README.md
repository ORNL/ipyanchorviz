# IPyAnchorViz

[![Code style: black](https://img.shields.io/badge/code%20style-black-000000.svg)](https://github.com/psf/black)
[![PyPI version](https://badge.fury.io/py/ipyanchorviz.svg)](https://badge.fury.io/py/ipyanchorviz)

This is an ipywidgets implementation of the AnchorViz visualization, see _Chen, Nan-Chen, et al. "[AnchorViz: Facilitating classifier error discovery through interactive semantic data exploration](https://dl.acm.org/doi/abs/10.1145/3172944.3172950)"

<!-- TODO: add an image! -->

## Installation

To install, use pip:

    $ pip install ipyanchorviz

## Development

For a development installation of the Python library:

    $ git clone https://github.com/ORNL/ipyanchorviz.git
    $ cd ipyanchorviz
    $ pip install -e .

After pip, you need to install node (requires [Node.js](https://nodejs.org) and [Yarn version 1](https://classic.yarnpkg.com/)). This will need to be rebuilt when you make a JS change.hen you need to rebuild the JS when you make a code change. The yarn command is run first to install additional needed dependencies.

    $ cd js
    $ yarn
    $ yarn run build

Then to have have the extension work in Jupyter notebook:

    $ jupyter nbextension install --py --symlink --overwrite --sys-prefix ipyanchorviz
    $ jupyter nbextension enable --py --sys-prefix ipyanchorviz

When actively developing your extension for JupyterLab, run the command:

    $ jupyter labextension develop --overwrite ipyanchorviz

You then need to refresh the JupyterLab page when your javascript changes.
