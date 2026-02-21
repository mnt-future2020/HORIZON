FROM python:3.11-slim
WORKDIR /app
COPY shared /app/shared
COPY venue-service/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/shared/requirements.txt -r /app/requirements.txt
COPY venue-service/ /app/
EXPOSE 8002
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]
