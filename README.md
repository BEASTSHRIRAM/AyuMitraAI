# Healthcare AI Agent - AyuMitraAI

A comprehensive Healthcare AI Agent platform that connects patients with nearby clinics and hospitals, helping them get quick medical assistance through AI-powered symptom analysis and intelligent doctor allocation.

## 🌟 Key Features

### For Patients
- **AI Symptom Analysis**: Describe symptoms and get AI-powered medical routing recommendations
- **Nearby Clinic Discovery**: Find unrecognized clinics and healthcare facilities in your area
- **Urgency Assessment**: AI determines urgency level (critical, moderate, mild)
- **Smart Doctor Matching**: Get matched with available doctors based on symptoms and specialization
- **Real-time Availability**: See which doctors are online and available

### For Doctors
- **Professional Dashboard**: Comprehensive dashboard with patient requests and statistics
- **Online/Offline Toggle**: Control your availability with a simple switch
- **Time Slot Management**: Configure working hours with customizable slots
  - Set specific days (Monday-Sunday)
  - Define start and end times
  - Configure slot duration (e.g., 40 minutes per patient)
  - Set maximum patients per slot
- **Patient Request Management**: View, accept, and complete patient consultations
- **Performance Tracking**: Monitor total requests, pending requests, and patients treated
- **Facility Integration**: Register with clinic or hospital using unique facility ID

### For Clinic Administrators
- **Clinic Registration**: Register your clinic with complete details
- **Unique Clinic ID**: Receive a unique ID for doctor registration
- **Doctor Information**: Add primary doctor details and specialization
- **Facility Details**: Specify nurses, medicine shop, emergency capabilities
- **Location Mapping**: Add address and coordinates for patient discovery

### For Hospital Administrators
- **Hospital Registration**: Multi-step registration process
- **Unique Hospital ID**: Receive a unique ID for doctor registration
- **Multiple Doctors**: Add multiple doctors with specializations
- **Comprehensive Facilities**: Specify rooms, ICU beds, operation theatres
- **Services Management**: List available services (MRI, CT, Physiotherapy, etc.)
- **Emergency Department**: Indicate emergency capabilities

## 🏗️ System Architecture

### User Roles
1. **Patient** - Seeks medical assistance
2. **Doctor** - Provides medical consultations
3. **Clinic Administrator** - Manages clinic registration
4. **Hospital Administrator** - Manages hospital registration

### Registration Flow
1. **Clinic/Hospital Admin** registers facility → Receives unique ID
2. **Doctor** registers using facility ID → Gets linked to clinic/hospital
3. **Patient** describes symptoms → AI matches with available doctors
4. **Doctor** receives request → Accepts and treats patient

## 🚀 Technology Stack

### Backend
- **FastAPI** - High-performance Python web framework
- **MongoDB** - NoSQL database for flexible data storage
- **Cerebras AI** - Ultra-fast AI inference for symptom analysis
- **JWT Authentication** - Secure token-based authentication
- **Pydantic** - Data validation and settings management

### Frontend
- **React** - Modern UI library
- **React Router** - Client-side routing
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Beautiful, accessible component library
- **Lucide Icons** - Clean, consistent icon set
- **Sonner** - Toast notifications

## 📦 Installation

### Prerequisites
- Python 3.8+
- Node.js 16+
- MongoDB instance
- Cerebras API key

### Backend Setup
```bash
cd backend
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=ayumitra
CEREBRAS_API_KEY=your_cerebras_api_key
MAPPLES_API_KEY=your_mapples_api_key
JWT_SECRET_KEY=your_secret_key
CORS_ORIGINS=http://localhost:3000
EOF

# Run server
python server.py
```

### Frontend Setup
```bash
cd frontend
npm install

# Create .env file
cat > .env << EOF
REACT_APP_API_URL=http://localhost:8000/api
EOF

# Run development server
npm start
```

## 🔑 API Endpoints

### Authentication
- `POST /api/auth/register` - Register patient/admin
- `POST /api/auth/register-doctor` - Register doctor with facility ID
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Patient
- `POST /api/analyze-symptoms` - Analyze symptoms and get recommendations
- `GET /api/history` - Get symptom analysis history

### Doctor
- `GET /api/doctor/profile` - Get doctor profile
- `PUT /api/doctor/availability` - Update online status and time slots
- `GET /api/doctor/requests` - Get patient requests
- `GET /api/doctor/stats` - Get dashboard statistics
- `POST /api/doctor/request/{id}/accept` - Accept patient request
- `POST /api/doctor/request/{id}/complete` - Complete consultation

### Facilities
- `POST /api/clinics/register` - Register clinic
- `POST /api/hospitals/register` - Register hospital
- `GET /api/clinics` - List all clinics
- `GET /api/hospitals` - List all hospitals
- `GET /api/facilities/search` - Search facilities by name

## 🎯 How It Works

### Patient Journey
1. Patient signs up and logs in
2. Describes symptoms in detail
3. AI analyzes symptoms and determines urgency
4. System recommends nearby doctors/facilities
5. Patient can view doctor availability and contact

### Doctor Journey
1. Doctor registers with clinic/hospital ID
2. Sets up availability and time slots
3. Toggles online when ready to accept patients
4. Receives patient requests based on specialization
5. Accepts and manages consultations
6. Tracks performance metrics

### Admin Journey
1. Admin registers clinic/hospital
2. Receives unique facility ID
3. Shares ID with doctors for registration
4. Doctors get automatically linked to facility
5. Facility appears in patient search results

## 🔐 Security Features
- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control
- Secure API endpoints
- Environment variable configuration

## 🌐 AI-Powered Features
- **Symptom Analysis**: Cerebras AI analyzes patient symptoms
- **Urgency Detection**: Determines if immediate care is needed
- **Specialty Matching**: Recommends appropriate medical specialization
- **Smart Routing**: Matches patients with available doctors
- **Context-Aware**: Considers age, location, and urgency

## 📱 User Interface
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Dark Mode**: Full dark mode support
- **Smooth Animations**: Polished transitions and interactions
- **Accessible**: Built with accessibility in mind
- **Intuitive**: Clean, modern interface

## 🔄 Future Enhancements
- Real-time chat between patients and doctors
- Video consultation integration
- Prescription management
- Medical records storage
- Insurance integration
- Multi-language support
- Mobile apps (iOS/Android)
- Payment gateway integration
- Appointment scheduling
- SMS/Email notifications

## 📄 License
MIT License

## 🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Support
For support, email support@ayumitra.ai or open an issue in the repository.

---

Built with ❤️ for better healthcare accessibility
