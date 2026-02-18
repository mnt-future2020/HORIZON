#!/bin/bash
echo "Building Horizon Player App for web..."
cd /app/mobile/player-app
CI=1 npx expo export:web
# Fix paths for subdirectory deployment
sed -i 's|href="/|href="./|g; s|src="/|src="./|g' web-build/index.html
# Copy to frontend public
cp -r web-build/* /app/frontend/public/mobile/
# Also copy static media (fonts/images) to root static folder for absolute paths
mkdir -p /app/frontend/public/static/media
cp /app/frontend/public/mobile/static/media/* /app/frontend/public/static/media/ 2>/dev/null
echo "Done! App deployed to /mobile/"
echo "Access at: https://player-app-preview-1.preview.emergentagent.com/mobile/"
