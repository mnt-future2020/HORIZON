#!/bin/bash
echo "Building Horizon Player App for web..."
cd /app/mobile/player-app
CI=1 npx expo export:web
# Fix paths for subdirectory deployment
sed -i 's|href="/|href="./|g; s|src="/|src="./|g' web-build/index.html
# Copy to frontend public
cp -r web-build/* /app/frontend/public/mobile/
echo "Done! App deployed to /mobile/"
