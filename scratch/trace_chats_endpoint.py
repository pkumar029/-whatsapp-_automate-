import sys
import os
import inspect

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "backend"))

from routes.contacts import get_whatsapp_chats

print("Runtime source code of get_whatsapp_chats:")
print(inspect.getsource(get_whatsapp_chats))
