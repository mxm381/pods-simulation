#!/bin/bash

echo "PODS Simulation - Project Setup"
echo "================================"
echo ""

# Check Node.js version
echo "Checking Node.js version..."
node_version=$(node -v)
echo "✓ Node.js $node_version"

# Check npm version
echo "Checking npm version..."
npm_version=$(npm -v)
echo "✓ npm $npm_version"

# Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
    echo ""
    echo "Creating .env.local..."
    cp .env.example .env.local
    echo "✓ .env.local created (edit with your settings)"
fi

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install
echo "✓ Root dependencies installed"

echo ""
echo "Installing backend dependencies..."
cd backend
npm install
echo "✓ Backend dependencies installed"
cd ..

echo ""
echo "Installing frontend dependencies..."
cd frontend
npm install
echo "✓ Frontend dependencies installed"
cd ..

echo ""
echo "Building backend..."
cd backend
npm run build
echo "✓ Backend built"
cd ..

echo ""
echo "Setup complete! 🚀"
echo ""
echo "Next steps:"
echo "  1. Edit .env.local with your configuration (if needed)"
echo "  2. Run 'npm run dev' to start development servers"
echo "  3. Open http://localhost:3000 in your browser"
echo ""
echo "For Docker:"
echo "  docker-compose up"
echo ""
