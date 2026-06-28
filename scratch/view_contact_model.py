import sys
import os
import inspect

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "backend"))

from models.models import Contact
print(inspect.getsource(Contact))
