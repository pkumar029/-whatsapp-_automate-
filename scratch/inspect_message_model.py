import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "backend"))

from models.models import Message
import inspect

print("Columns in Message model:")
for name, prop in inspect.getmembers(Message):
    if not name.startswith("_"):
        print(name)
