class LlmChat:
    def __init__(self, api_key, session_id, system_message):
        pass
    def with_model(self, provider, model):
        return self
    async def send_message(self, message):
        return "{}"

class UserMessage:
    def __init__(self, text, file_contents=None):
        pass

class FileContentWithMimeType:
    def __init__(self, file_path, mime_type):
        pass
