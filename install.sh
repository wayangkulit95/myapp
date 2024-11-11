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
git clone https://github.com/wayangkulit95/myapp.git /root/myapp

# Navigate to the app directory
cd /root/myapp

# Install application dependencies
echo "Installing application dependencies..."
npm install

# Set up SQLite database
echo "Setting up SQLite database..."
sqlite3 /root/myapp/data.db < /root/myapp/schema.sql

# Provide instructions for accessing the app
echo "Installation complete!"
echo "Your IPTV app is running. To access it, go to http://your-vps-ip:3000"
echo "To check the logs, run: pm2 logs myapp"
echo "To stop the app, run: pm2 stop myapp"
echo "To restart the app, run: pm2 restart myapp"
echo "To view the status, run: pm2 status"

# Optional: Clean up
echo "Cleaning up..."
apt autoremove -y

echo "Installation finished!"