# AFR Attendance System - Complete Project Report

## Project Overview

**AFR (Automated Face Recognition) Attendance System** is a production-ready attendance tracking application that uses face recognition technology to automatically mark employee check-ins and check-outs. The system combines modern web technologies with machine learning to provide a seamless attendance management solution.

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 19 + TypeScript + Vite | Modern, type-safe UI framework |
| **Backend** | FastAPI + Uvicorn | High-performance async Python web framework |
| **ML Engine** | InsightFace (ArcFace) | State-of-the-art face recognition |
| **Database** | MongoDB Atlas + Motor | NoSQL database with async driver |
| **Deployment** | Docker + Docker Compose + Nginx | Containerized deployment |
| **Authentication** | JWT + OAuth2 | Token-based authentication |
| **Security** | bcrypt + python-jose | Password hashing and JWT handling |

---

## Project Structure

```
afr-attendance/
├── backend/
│   ├── app/
│   │   ├── core/           # Core configurations and utilities
│   │   ├── routes/         # API route handlers
│   │   ├── services/       # Business logic and ML services
│   │   └── main.py         # Application entry point
│   ├── requirements.txt    # Python dependencies
│   ├── Dockerfile          # Backend container definition
│   └── .env                # Environment variables
├── frontend/
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page-level components
│   │   ├── api.ts          # API client functions
│   │   ├── auth.ts         # Authentication utilities
│   │   ├── theme.ts        # Design tokens
│   │   └── App.tsx         # Main application component
│   ├── package.json        # Node.js dependencies
│   ├── vite.config.ts      # Vite configuration
│   └── Dockerfile          # Frontend container definition
├── docker-compose.yml      # Multi-container orchestration
└── README.md              # Project documentation
```

---

## Backend Architecture

### 1. Application Entry Point (`backend/app/main.py`)

**Purpose**: Initializes the FastAPI application and configures middleware.

**Key Components**:
- **Lifespan Management**: Handles database connection lifecycle (connect on startup, close on shutdown)
- **CORS Middleware**: Configures cross-origin resource sharing for frontend-backend communication
- **Global Exception Handler**: Catches unhandled exceptions and returns standardized error responses
- **Route Registration**: Includes authentication and face recognition routers

**Environment-Based Configuration**:
- Swagger docs (`/docs`) available in development mode only
- Health check endpoint at `/health` for container health monitoring

### 2. Core Configuration (`backend/app/core/config.py`)

**Purpose**: Centralized configuration management using Pydantic Settings.

**Configuration Variables**:
- `MONGO_URI`: MongoDB connection string
- `DB_NAME`: Database name (default: `afr_attendance`)
- `ALLOWED_ORIGINS`: CORS-allowed frontend origins
- `APP_ENV`: Environment mode (`development` or `production`)
- `JWT_SECRET`: Secret key for token signing
- `JWT_ALGORITHM`: Token signing algorithm (HS256)
- `JWT_EXPIRE_MINUTES`: Token expiration time (8 hours)

**Features**:
- Environment variable loading from `.env` file
- Type-safe configuration with Pydantic validation
- Cached settings instance using `lru_cache`

### 3. Database Layer (`backend/app/core/database.py`)

**Purpose**: Manages MongoDB connections and database initialization.

**Key Functions**:
- `get_database()`: Returns the database instance for use in route handlers
- `connect_db()`: Establishes async MongoDB connection with timeout configuration
- `close_db()`: Gracefully closes database connection

**Index Creation**:
- `employees`: Unique index on `employee_id`
- `recognition_log`: Indexes on `timestamp`, `employee_id + timestamp`, `status + timestamp`

**Connection Settings**:
- Server selection timeout: 10 seconds
- Connection timeout: 10 seconds
- Socket timeout: 10 seconds

### 4. Security Layer (`backend/app/core/security.py`)

**Purpose**: Handles password hashing and JWT token operations.

**Functions**:
- `hash_password()`: Hashes passwords using bcrypt with salt
- `verify_password()`: Verifies password against hashed version
- `create_access_token()`: Creates JWT access token with user claims
- `decode_token()`: Decodes and validates JWT tokens

**Security Features**:
- Bcrypt for secure password hashing (work factor configurable)
- JWT tokens with expiration
- HS256 algorithm for token signing

### 5. Permissions System (`backend/app/core/permissions.py`)

**Purpose**: Role-based access control (RBAC) implementation.

**Roles**:
- **admin**: Full system access
- **operator**: Can register employees, recognize faces, view logs (no user management)
- **viewer**: Read-only access (recognize faces, view logs)

**Permission Matrix**:
| Permission | Admin | Operator | Viewer |
|------------|-------|----------|--------|
| face:detect | ✅ | ✅ | ✅ |
| face:recognize | ✅ | ✅ | ✅ |
| face:view_log | ✅ | ✅ | ✅ |
| face:view_employees | ✅ | ✅ | ✅ |
| face:register_employee | ✅ | ✅ | ❌ |
| face:delete_employee | ✅ | ❌ | ❌ |
| auth:view_users | ✅ | ❌ | ❌ |
| auth:create_user | ✅ | ❌ | ❌ |
| auth:delete_user | ✅ | ❌ | ❌ |

### 6. Dependency Injection (`backend/app/core/deps.py`)

**Purpose**: FastAPI dependencies for authentication and authorization.

**Key Dependencies**:
- `get_current_user()`: Extracts and validates JWT token, returns current user
- `require_permission(permission)`: Checks if user has specific permission
- `require_admin()`: Shortcut for admin-only access

**Flow**:
1. OAuth2PasswordBearer extracts token from `Authorization: Bearer <token>` header
2. Token is decoded and validated
3. User is fetched from database
4. Permission check is performed if required

### 7. Authentication Routes (`backend/app/routes/auth.py`)

**Endpoints**:

#### GET `/api/auth/status` (Public)
- Checks if any users exist in the system
- Used by frontend to determine if setup is needed

#### POST `/api/auth/register` (First-run only)
- Creates the first admin user
- Only allowed when no users exist
- Automatically assigns role: `admin`

#### POST `/api/auth/users` (Admin only)
- Creates new users with specified roles
- Requires `auth:create_user` permission
- Prevents duplicate usernames

#### POST `/api/auth/login`
- Authenticates user with username/password
- Returns JWT access token and user info
- Uses OAuth2PasswordRequestForm for standard OAuth2 flow

#### GET `/api/auth/me`
- Returns current authenticated user info
- Requires valid JWT token

#### GET `/api/auth/users` (Admin only)
- Lists all users (excluding passwords)
- Requires admin role

#### DELETE `/api/auth/users/{username}` (Admin only)
- Deletes a user
- Prevents self-deletion

### 8. Face Recognition Routes (`backend/app/routes/face.py`)

**Endpoints**:

#### POST `/api/face/detect`
- Fast face detection without database lookup
- Returns bounding boxes for all detected faces
- Uses InsightFace detector
- Requires `face:detect` permission

#### POST `/api/face/register`
- Registers a new employee face
- Generates 512-dimensional ArcFace embedding
- Stores up to 3 face encodings per employee
- Requires `face:register_employee` permission
- Returns registration progress (e.g., "Image 2/3 registered")

#### POST `/api/face/recognize`
- Recognizes a face against registered employees
- Compares embedding with all stored encodings
- Implements check-in/check-out logic:
  - First recognition of day → check-in
  - Subsequent recognition → check-out (after 1-minute delay)
  - Too soon after check-in → "already checked in" message
- Logs all recognition attempts (matched and unknown)
- Requires `face:recognize` permission

#### GET `/api/face/log`
- Returns recent recognition log entries
- Query parameter: `limit` (1-200, default: 20)
- Sorted by timestamp (newest first)
- Requires `face:view_log` permission

#### GET `/api/face/employees`
- Lists all registered employees
- Excludes face encodings from response
- Requires `face:view_employees` permission

#### DELETE `/api/face/employees/{employee_id}`
- Deletes an employee and all their face data
- Requires `face:delete_employee` permission

#### GET `/api/face/attendance`
- Returns attendance records with check-in/check-out sessions
- Query parameters:
  - `date_from`: ISO date string (YYYY-MM-DD)
  - `date_to`: ISO date string (YYYY-MM-DD)
  - `employee_id`: Filter by specific employee
- Groups events into sessions (check-in + optional check-out pairs)
- Calculates duration for each session
- Requires `face:view_log` permission

#### GET `/api/face/attendance/today-summary`
- Returns quick summary of today's attendance
- Includes currently checked-in employees
- Requires `face:view_log` permission

### 9. Face Recognition Service (`backend/app/services/face_service.py`)

**Purpose**: Core ML operations for face detection and recognition.

**Model**: InsightFace `buffalo_sc` (ArcFace)
- Lightweight model suitable for CPU inference
- 512-dimensional face embeddings
- ONNX runtime for cross-platform compatibility

**Key Functions**:

#### `get_face_app()`
- Singleton pattern for model loading
- Loads model once on first use
- Configured for CPU execution

#### `detect_face(image_bytes)`
- Decodes image from bytes
- Detects faces using InsightFace detector
- Returns bounding boxes (x, y, width, height)
- Handles multiple faces in single image

#### `generate_encoding(image_bytes)`
- Generates 512-dimensional face embedding
- Validates single face in image
- Returns normalized embedding vector
- Used for employee registration

#### `compare_faces(encoding1, encoding2, threshold)`
- Computes cosine similarity between embeddings
- Default threshold: 0.4 (tuned for buffalo_sc)
- Returns match status and similarity score
- Both embeddings are unit vectors (normalized)

---

## Frontend Architecture

### 1. Application Structure (`frontend/src/App.tsx`)

**Purpose**: Main application component managing routing and authentication state.

**State Management**:
- `user`: Current authenticated user
- `needsSetup`: Whether initial admin setup is required
- `checking`: Loading state during authentication check
- `page`: Current active page

**Authentication Flow**:
1. On mount, checks for stored JWT token
2. If token exists, validates with `/api/auth/me`
3. Checks if system needs initial setup via `/api/auth/status`
4. Redirects to login page if not authenticated
5. Shows setup page if no users exist

**Page Routing**:
- dashboard: Dashboard overview
- recognition: Live face recognition
- employees: Employee management
- reports: Attendance reports
- users: User management (admin only)
- settings: System settings

### 2. API Client (`frontend/src/api.ts`)

**Purpose**: Centralized API communication layer.

**Features**:
- Automatic JWT token injection via `authHeaders()`
- Standardized error handling with `handleResponse()`
- Auto-logout on 401 responses
- Type-safe interfaces for API responses

**API Categories**:

#### Authentication
- `login()`: User login
- `setupAdmin()`: Initial admin creation
- `createUser()`: Create new user (admin)
- `fetchUsers()`: List all users (admin)
- `deleteUser()`: Delete user (admin)

#### Face Recognition
- `registerImage()`: Register employee face
- `detectFaces()`: Detect faces in image
- `recognizeFace()`: Recognize face
- `fetchLog()`: Fetch recognition log
- `fetchEmployees()`: List employees
- `deleteEmployee()`: Delete employee

#### Attendance
- `fetchAttendance()`: Fetch attendance records with filters
- `fetchTodaySummary()`: Fetch today's attendance summary

### 3. Authentication Utilities (`frontend/src/auth.ts`)

**Purpose**: Client-side authentication state management.

**Functions**:
- `getToken()`: Retrieves JWT from localStorage
- `saveAuth()`: Saves token and user info to localStorage
- `clearAuth()`: Clears authentication data
- `getUser()`: Returns current user from localStorage

**Storage**: Uses localStorage for token persistence

### 4. Theme System (`frontend/src/theme.ts`)

**Purpose**: Centralized design tokens for consistent UI.

**Color Palette**:
- Light app background with dark sidebar
- Accent color: mauve/burgundy (#8b3a5e)
- Status colors: green, red, yellow, blue
- Semantic colors for success, error, warning, info

**Typography & Spacing**:
- Predefined border radius values
- Shadow definitions for depth
- Consistent spacing tokens

### 5. Components

#### Sidebar (`frontend/src/components/Sidebar.tsx`)
- Navigation menu with role-based visibility
- Active page highlighting
- User info display
- Logout functionality

#### Header (`frontend/src/components/Header.tsx`)
- Top navigation bar
- Page title display
- Current date display

#### Login Page (`frontend/src/components/LoginPage.tsx`)
- Login form with username/password
- Initial setup mode for first admin creation
- Form validation
- Error handling

#### Recognition Panel (`frontend/src/components/RecognitionPanel.tsx`)
- Camera feed display
- Real-time face detection overlay
- Capture functionality
- Recognition result display
- Bounding box visualization

#### Register Panel (`frontend/src/components/RegisterPanel.tsx`)
- Employee registration form
- Image capture/upload
- Registration progress tracking
- Multi-image support (up to 3)

### 6. Pages

#### Dashboard Page (`frontend/src/pages/DashboardPage.tsx`)
- Overview statistics
- Today's attendance summary
- Recent recognition log
- Employee count
- Quick actions

#### Live Recognition Page (`frontend/src/pages/LiveRecognitionPage.tsx`)
- Real-time camera feed
- Continuous face detection
- Auto-capture with configurable delay
- Recognition results display
- Attendance logging

#### Employees Page (`frontend/src/pages/EmployeesPage.tsx`)
- Employee list with search
- Employee registration
- Employee deletion
- Registration status display
- Department filtering

#### Reports Page (`frontend/src/pages/ReportsPage.tsx`)
- Attendance report with date range filter
- Employee-specific filtering
- Session details (check-in/check-out)
- Duration calculations
- Export functionality

#### Users Page (`frontend/src/pages/UsersPage.tsx`)
- User management (admin only)
- User creation with role assignment
- User deletion
- Role-based access display

#### Settings Page (`frontend/src/pages/SettingsPage.tsx`)
- Collapsible settings cards
- Camera selection
- Auto capture duration (with +/- controls)
- Image quality settings
- Liveness detection toggle
- Recognition confidence threshold
- Stable face duration
- Attendance marking mode
- System information display

---

## Database Schema

### Collections

#### `users`
```javascript
{
  _id: ObjectId,
  username: string (unique),
  password: string (bcrypt hash),
  full_name: string,
  role: string ("admin" | "operator" | "viewer"),
  created_at: datetime
}
```

#### `employees`
```javascript
{
  _id: ObjectId,
  employee_id: string (unique),
  name: string,
  department: string,
  encodings: array<number[]> (512-dim vectors),
  created_at: datetime,
  updated_at: datetime
}
```

#### `recognition_log`
```javascript
{
  _id: ObjectId,
  employee_id: string,
  name: string,
  department: string,
  time: string (formatted),
  timestamp: datetime,
  status: string ("Matched" | "Unknown"),
  type: string ("check_in" | "check_out" | "unknown"),
  similarity: number
}
```

---

## Deployment

### Docker Configuration

#### Backend Dockerfile
- Python 3.12 base image
- Installs dependencies from requirements.txt
- Exposes port 8000
- Runs with uvicorn server

#### Frontend Dockerfile
- Multi-stage build (node → nginx)
- Builds React app with Vite
- Serves static files with nginx
- Exposes port 80

#### Docker Compose
- Orchestrates backend and frontend containers
- Backend health check for dependency management
- Environment variable injection
- Port mapping (8000, 3000)

### Environment Variables

**Backend (.env)**:
```
MONGO_URI=mongodb://localhost:27017
DB_NAME=afr_attendance
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
APP_ENV=development
JWT_SECRET=change-this-secret-in-production
```

**Frontend (.env)**:
```
VITE_API_URL=http://localhost:8000
```

---

## Development Workflow

### Backend Development
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

### Frontend Development
```bash
cd frontend
npm install
npm run dev
```

### Production Build
```bash
docker-compose up --build -d
```

---

## Key Features

### 1. Face Recognition
- Real-time face detection using InsightFace
- 512-dimensional ArcFace embeddings
- Cosine similarity matching
- Configurable confidence threshold
- Multi-face support in registration

### 2. Attendance Management
- Automatic check-in/check-out detection
- 1-minute cooldown between check-in and check-out
- Session pairing and duration calculation
- Daily attendance summaries
- Historical reports with filtering

### 3. Security
- JWT-based authentication
- Role-based access control
- Password hashing with bcrypt
- CORS protection
- Permission-based API access

### 4. User Experience
- Responsive design
- Real-time camera feed
- Collapsible settings panels
- +/- controls for numeric values
- Loading states and error handling
- Auto-logout on session expiration

### 5. Administration
- User management (admin only)
- Employee registration with multiple images
- Recognition log viewing
- Attendance report generation
- System configuration

---

## API Endpoints Summary

### Authentication
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/auth/status` | Check setup status | Public |
| POST | `/api/auth/register` | Create first admin | Public (first-run) |
| POST | `/api/auth/users` | Create user | Admin |
| POST | `/api/auth/login` | User login | Public |
| GET | `/api/auth/me` | Current user | Authenticated |
| GET | `/api/auth/users` | List users | Admin |
| DELETE | `/api/auth/users/{username}` | Delete user | Admin |

### Face Recognition
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/face/detect` | Detect faces | All roles |
| POST | `/api/face/register` | Register employee | Admin, Operator |
| POST | `/api/face/recognize` | Recognize face | All roles |
| GET | `/api/face/log` | Recognition log | All roles |
| GET | `/api/face/employees` | List employees | All roles |
| DELETE | `/api/face/employees/{id}` | Delete employee | Admin |
| GET | `/api/face/attendance` | Attendance report | All roles |
| GET | `/api/face/attendance/today-summary` | Today's summary | All roles |

---

## Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   - Check MONGO_URI in .env
   - Verify MongoDB is accessible
   - Check network connectivity

2. **Face Detection Not Working**
   - Ensure camera permissions are granted
   - Check browser console for errors
   - Verify InsightFace model loaded correctly

3. **Authentication Errors**
   - Check JWT_SECRET is set
   - Verify token hasn't expired
   - Clear localStorage and re-login

4. **CORS Errors**
   - Check ALLOWED_ORIGINS in .env
   - Verify frontend URL is included
   - Check browser console for specific error

---

## Future Enhancements

### Potential Improvements
1. **Liveness Detection**: Add active liveness checks (blink, head movement)
2. **Multi-Camera Support**: Support multiple camera inputs
3. **Offline Mode**: Cache recognition data for offline operation
4. **Mobile App**: React Native mobile application
5. **Analytics Dashboard**: Advanced analytics and reporting
6. **Notification System**: Email/SMS notifications for attendance
7. **Export Features**: CSV/PDF export for reports
8. **Biometric Backup**: Add fingerprint as secondary authentication

---

## Conclusion

The AFR Attendance System is a comprehensive, production-ready solution for automated attendance tracking using face recognition. It combines modern web technologies with state-of-the-art ML models to provide a seamless user experience while maintaining security and reliability. The modular architecture allows for easy extension and maintenance, making it suitable for various organizational needs.
