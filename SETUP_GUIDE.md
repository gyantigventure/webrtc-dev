# WebRTC Platform Setup Guide

This guide will help you set up the WebRTC development platform with SIP.js and FreeSWITCH.

## 🚀 Quick Start

### Prerequisites

1. **Docker & Docker Compose**
   ```bash
   # Install Docker Desktop or Docker Engine
   # Verify installation
   docker --version
   docker-compose --version
   ```

2. **Node.js 16+ and npm**
   ```bash
   # Install Node.js from https://nodejs.org
   # Verify installation
   node --version
   npm --version
   ```

3. **Git**
   ```bash
   git --version
   ```

### Initial Setup

1. **Clone and Setup Environment**
   ```bash
   cd /Users/gyanti/Documents/project/gyanti-git/webrtc-dev
   
   # Copy environment file
   cp .env.example .env
   
   # Edit .env file with your settings
   nano .env  # or use your preferred editor
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Start the Development Environment**
   ```bash
   # Start all services
   npm run dev
   
   # Check logs
   npm run logs
   ```

## 📁 Project Structure Setup

The following directories need to be created for the full platform:

```
webrtc-dev/
├── api/                    # Backend API server
├── web/                    # Frontend React application
├── freeswitch/            # FreeSWITCH configuration
├── nginx/                 # Nginx configuration
├── database/              # Database initialization scripts
├── monitoring/            # Prometheus & Grafana config
└── ssl/                   # SSL certificates
```

### 1. Create API Directory Structure

```bash
mkdir -p api/{src,tests,config}
mkdir -p api/src/{controllers,models,routes,middleware,services}
```

### 2. Create Web Directory Structure

```bash
mkdir -p web/{src,public,tests}
mkdir -p web/src/{components,pages,hooks,services,utils,types}
```

### 3. Create FreeSWITCH Configuration

```bash
mkdir -p freeswitch/{conf,scripts}
mkdir -p freeswitch/conf/{sip_profiles,dialplan,directory}
```

### 4. Create Supporting Directories

```bash
mkdir -p nginx/conf.d
mkdir -p database
mkdir -p monitoring/{prometheus,grafana}
mkdir -p ssl
```

## 🔧 Detailed Configuration

### FreeSWITCH Setup

1. **Create Basic FreeSWITCH Configuration**
   ```bash
   # This will be populated with actual FreeSWITCH config files
   # in the next development phase
   echo "FreeSWITCH configuration to be added" > freeswitch/conf/README.md
   ```

### Database Setup

1. **Create Database Initialization Script**
   ```bash
   cat > database/init.sql << 'EOF'
-- WebRTC Platform Database Schema
CREATE DATABASE IF NOT EXISTS webrtc_platform;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    sip_extension VARCHAR(20) UNIQUE,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    avatar_url VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Call logs table
CREATE TABLE IF NOT EXISTS call_logs (
    id SERIAL PRIMARY KEY,
    call_uuid VARCHAR(100) UNIQUE,
    caller_id VARCHAR(50),
    callee_id VARCHAR(50),
    call_type VARCHAR(20) DEFAULT 'direct',
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    duration INTEGER,
    call_status VARCHAR(20),
    hangup_cause VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
EOF
   ```

### SSL Certificates Setup

1. **For Development (Self-signed)**
   ```bash
   # Create self-signed certificates for development
   openssl req -x509 -newkey rsa:4096 -keyout ssl/server.key -out ssl/server.crt -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
   ```

2. **For Production**
   ```bash
   # Use Let's Encrypt or your certificate provider
   # Copy your certificates to the ssl/ directory
   # ssl/server.crt (certificate)
   # ssl/server.key (private key)
   ```

### Nginx Configuration

1. **Create Basic Nginx Config**
   ```bash
   cat > nginx/nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    upstream api_backend {
        server api-server:3001;
    }

    upstream web_backend {
        server web-client:80;
    }

    server {
        listen 80;
        server_name localhost;

        location /api/ {
            proxy_pass http://api_backend/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }

        location / {
            proxy_pass http://web_backend/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
}
EOF
   ```

## 🐳 Docker Development Workflow

### Starting Services

```bash
# Start all services
docker-compose up -d

# Start specific service
docker-compose up -d postgres redis

# View logs
docker-compose logs -f api-server
```

### Stopping Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: This deletes data)
docker-compose down -v
```

### Rebuilding Services

```bash
# Rebuild all services
docker-compose build

# Rebuild specific service
docker-compose build api-server

# Rebuild and restart
docker-compose up -d --build
```

## 🧪 Testing Setup

### Running Tests

```bash
# Run all tests
npm test

# Run specific tests
npm run test:web
npm run test:api
```

### Database Testing

```bash
# Connect to MySQL for testing
docker-compose exec mysql mysql -u webrtc_user -p webrtc_platform

# Run MySQL queries
docker-compose exec mysql mysql -u webrtc_user -p -e "SHOW TABLES;" webrtc_platform
```

### FreeSWITCH Testing

```bash
# Connect to FreeSWITCH CLI
docker-compose exec freeswitch fs_cli

# Check FreeSWITCH status
docker-compose exec freeswitch fs_cli -x "status"
```

## 🔍 Monitoring and Debugging

### Access Monitoring Dashboards

- **Grafana Dashboard**: http://localhost:3002 (admin/admin123)
- **Prometheus**: http://localhost:9090
- **Application**: http://localhost:3000
- **API**: http://localhost:3001

### Common Debug Commands

```bash
# View all container status
docker-compose ps

# Check container logs
docker-compose logs [service-name]

# Execute commands in containers
docker-compose exec [service-name] [command]

# Check container resource usage
docker stats
```

### Health Checks

```bash
# Check API health
curl http://localhost:3001/health

# Check database connection
docker-compose exec postgres pg_isready -U webrtc_user

# Check Redis connection
docker-compose exec redis redis-cli ping
```

## 🚨 Troubleshooting

### Common Issues

1. **Port Conflicts**
   ```bash
   # Check what's using a port
   lsof -i :3000
   
   # Kill process on port
   kill -9 $(lsof -t -i:3000)
   ```

2. **Permission Issues**
   ```bash
   # Fix Docker permissions (Linux)
   sudo usermod -aG docker $USER
   
   # Fix file permissions
   sudo chown -R $USER:$USER .
   ```

3. **SSL Certificate Issues**
   ```bash
   # Regenerate self-signed certificates
   rm ssl/*
   openssl req -x509 -newkey rsa:4096 -keyout ssl/server.key -out ssl/server.crt -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
   ```

4. **Database Connection Issues**
   ```bash
   # Reset database
   docker-compose down
   docker volume rm webrtc-dev_mysql_data
   docker-compose up -d mysql
   
   # Check MySQL logs
   docker-compose logs mysql
   ```

### Getting Help

1. Check container logs: `docker-compose logs [service]`
2. Verify environment variables in `.env` file
3. Ensure all required ports are available
4. Check Docker and Docker Compose versions
5. Review the PROJECT_PLAN.md for detailed configuration

## 📋 Next Steps

After completing the setup:

1. **Implement API Server** (Week 3-4 of project plan)
2. **Develop Frontend Application** (Week 5-6 of project plan)
3. **Configure FreeSWITCH** (Week 2 of project plan)
4. **Set up SSL certificates** for production
5. **Configure monitoring** and alerting

For detailed implementation steps, refer to the [PROJECT_PLAN.md](./PROJECT_PLAN.md) file.

---

*This setup guide provides the foundation for the WebRTC development platform. Follow the project plan for detailed implementation phases.*
