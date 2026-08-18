# AFR – Automated Face Recognition Attendance System

A production-ready attendance system using InsightFace ArcFace embeddings, FastAPI, MongoDB Atlas, and React.

## Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | React 19 + TypeScript + Vite        |
| Backend  | FastAPI + Uvicorn                   |
| ML       | InsightFace `buffalo_sc` (ArcFace)  |
| Database | MongoDB Atlas (Motor async driver)  |
| Deploy   | Docker + Docker Compose + Nginx     |

## Local Development

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
cp .env.example .env           # Fill in MONGO_URI
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Production Deploy (Docker)

```bash
# 1. Fill in backend/.env with real MONGO_URI and set ALLOWED_ORIGINS to your domain
# 2. Build and start
docker-compose up --build -d
```

Frontend → http://localhost:80  
Backend API → http://localhost:8000  

## Environment Variables (`backend/.env`)

| Variable          | Description                          | Default                    |
|-------------------|--------------------------------------|----------------------------|
| `MONGO_URI`       | MongoDB connection string            | `mongodb://localhost:27017` |
| `DB_NAME`         | Database name                        | `afr_attendance`           |
| `ALLOWED_ORIGINS` | Comma-separated allowed CORS origins | `http://localhost:5173`    |
| `APP_ENV`         | `development` or `production`        | `development`              |

## API Endpoints

| Method | Path                          | Description                   |
|--------|-------------------------------|-------------------------------|
| POST   | `/api/face/detect`            | Fast face bbox detection      |
| POST   | `/api/face/register`          | Register employee face image  |
| POST   | `/api/face/recognize`         | Recognize face against DB     |
| GET    | `/api/face/log`               | Recent recognition log        |
| GET    | `/api/face/employees`         | List all employees            |
| DELETE | `/api/face/employees/{id}`    | Delete employee               |
| GET    | `/health`                     | Health check                  |
