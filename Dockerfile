# Use the official Python image as a base
FROM python:3.9-slim

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container at /app
COPY backend/requirements.txt .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the backend code
COPY backend /app/backend

# Copy the frontend code
COPY frontend /app/frontend

# Set the working directory to the backend folder where main.py is located
WORKDIR /app/backend

# Run uvicorn when the container launches
# Cloud Run overrides the port, so we should use the PORT environment variable
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
