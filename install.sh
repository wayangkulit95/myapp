#!/bin/bash

# Ensure script is run as root
if [ "$(id -u)" -ne 0 ]; then
    echo "This script must be run as root" 
    exit 1
fi

echo "Starting installation..."

# Update and upgrade system packages
echo "Updating and upgrading system packages..."
apt update -y
apt upgrade -y

# Install necessary packages
echo "Installing necessary packages..."
apt install -y curl git build-essential libssl-dev sqlite3 libsqlite3-dev

# Install Node.js (Recommended version)
echo "Installing Node.js..."
curl -sL https://deb.nodesource.com/setup_16.x | bash -
apt install -y nodejs

# Check Node.js and NPM installation
echo "Verifying Node.js and NPM installation..."
node -v
npm -v

# Clone the application repository (change the URL if needed)
echo "Cloning the IPTV app repository..."
git clone https://github.com/your-username/your-iptv-repo.git /root/myapp

# Navigate to the app directory
cd /root/myapp

# Create package.json if it doesn't exist
if [ ! -f package.json ]; then
    echo "Creating package.json..."
    cat > package.json <<EOL
{
  "name": "myapp",
  "version": "1.0.0",
  "description": "IPTV App",
  "main": "app.js",
  "scripts": {
    "start": "node app.js"
  },
  "dependencies": {
    "express": "^4.17.1",
    "sqlite3": "^5.0.2",
    "bcrypt": "^5.1.0",
    "axios": "^1.3.1",
    "cors": "^2.8.5",
    "dotenv": "^16.0.3",
    "express-session": "^1.17.2",
    "node-fetch": "^3.2.4",
    "ejs": "^3.1.9"  # Added ejs dependency
  }
}
EOL
fi

# Install application dependencies
echo "Installing application dependencies..."
npm install

# Check if schema.sql exists
if [ ! -f /root/myapp/schema.sql ]; then
    echo "Error: schema.sql not found. Please ensure the schema file exists."
    exit 1
fi

# Set up SQLite database
echo "Setting up SQLite database..."
sqlite3 /root/myapp/data.db < /root/myapp/schema.sql

# Provide instructions for accessing the app
echo "Installation complete!"
echo "Your IPTV app (myapp) is running. To access it, go to http://your-vps-ip:3000"
echo "To start the app, run: node /root/myapp/app.js"
echo "To stop the app, use CTRL+C in the terminal"

# Optional: Clean up
echo "Cleaning up..."
apt autoremove -y

echo "Installation finished!"
