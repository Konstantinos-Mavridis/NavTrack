"""
pytest root conftest — adds the worker directory to sys.path so that
`import worker` works from any test file without package gymnastics.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
