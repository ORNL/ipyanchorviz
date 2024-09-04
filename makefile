SHELL=/usr/bin/env bash
VERSION=$(shell python -c "import ipyanchorviz as av; print(av.__version__)")
ENV_NAME=ipyanchorviz
MAMBA=micromamba

.PHONY: help
help: ## display all make commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

.PHONY: setup
setup:  ## make a micromamba development environment and set it up (VARS: MAMBA, ENV_NAME)
	$(MAMBA) env create -n $(ENV_NAME) -f environment.yml -y
	$(MAMBA) run -n $(ENV_NAME) pip install -r requirements.txt
	$(MAMBA) run -n $(ENV_NAME) pip install -e .
	$(MAMBA) run -n $(ENV_NAME) pre-commit install
	cd js && $(MAMBA) run -n $(ENV_NAME) yarn && $(MAMBA) run -n $(ENV_NAME) yarn run build
	$(MAMBA) run -n $(ENV_NAME) jupyter nbextension install --py --symlink --overwrite --sys-prefix ipyanchorviz
	$(MAMBA) run -n $(ENV_NAME) jupyter nbextension enable --py --sys-prefix ipyanchorviz
	@echo -e "Environment created, activate with:\n\n$(MAMBA) activate $(ENV_NAME)"

.PHONY: extension
extension: ## update extension for jupyterlab
	jupyter labextension develop --overwrite ipyanchorviz

.PHONY: pre-commit
pre-commit: ## run all pre commit checks on all files
	@pre-commit run --all-files

.PHONY: publish
publish: ## build the package and push to pypi
	@python -m build
	@twine check dist/*
	@twine upload dist/* --skip-existing

.PHONY: apply-docs
apply-docs: ## copy current sphinx docs into version-specific docs/ folder
	@rm -rf docs/latest
	@echo "Copying documentation to 'docs/latest'..."
	@cp -r sphinx/build/html docs/latest
	@echo "Copying documentation to docs/$(VERSION)"
	@rm -f docs/$(VERSION)
	@cp -r sphinx/build/html docs/$(VERSION)

.PHONY: style
style: ## run autofixers and linters
	black .
	flake8
	isort .

.PHONY: clean
clean:  ## remove auto-generated cruft files
	find . -type f -name "*.DS_Store" -ls -delete
	find . | grep -E "(__pycache__|\.pyc|\.pyo)" | xargs rm -rf
	find . | grep -E ".pytest_cache" | xargs rm -rf
	find . | grep -E ".ipynb_checkpoints" | xargs rm -rf
