#!/bin/bash
# Move to the directory where this script is located
cd "$(dirname "$0")"

echo "=========================================================="
echo "🔄 Starting RentAHuman Earnings Sync Scraper..."
echo "=========================================================="

# Check if python3 is installed
if ! command -v python3 &> /dev/null
then
    echo "❌ Python 3 is not installed on this Mac."
    echo "Please download and install it from: https://www.python.org/downloads/"
    read -p "Press Enter to exit..."
    exit 1
fi

# Check if selenium is installed
python3 -c "import selenium" &> /dev/null
if [ $? -ne 0 ]; then
    echo "📦 Selenium library is not installed. Installing it now..."
    pip3 install selenium
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install selenium. Please run this command manually in Terminal: pip3 install selenium"
        read -p "Press Enter to exit..."
        exit 1
    fi
fi

# Run the scraper python script
if [ -f "scrape_earnings_gui.py" ]; then
    python3 scrape_earnings_gui.py
else
    echo "❌ Error: scrape_earnings_gui.py file not found in this folder."
fi

echo "=========================================================="
echo "✅ Finished!"
read -p "Press Enter to exit..."
