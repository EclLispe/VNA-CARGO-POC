from flask import Flask, jsonify
from flask_cors import CORS
import pandas as pd
import os
import numpy as np

app = Flask(__name__)
# Configure CORS to allow requests from your frontend's origin (e.g., Live Server's port)
CORS(app, resources={r"/api/*": {"origins": "http://127.0.0.1:5500"}})

# Define paths to your CSV files
ALLOCATION_CSV_PATH = 'Tài liệu phân bổ Allotment.xlsm - Phân bổ tải.csv'
STATION_CSV_PATH = 'Tài liệu phân bổ Allotment.xlsm - Station.csv'

# Global variables to store parsed data
allocation_data = []
station_data = []

# Helper function for String operations (mimicking JS .toUpperCase().trim())
# Moved this definition here so it's accessible when load_csv_data is called
def String(value):
    if value is None:
        return ""
    return str(value)

def load_csv_data():
    """
    Loads and parses data from the CSV files.
    """
    global allocation_data, station_data

    # Load Allocation Data
    if os.path.exists(ALLOCATION_CSV_PATH):
        try:
            print(f"DEBUG (Python): Attempting to load allocation data from: {ALLOCATION_CSV_PATH}")
            # Read the CSV, handling potential encoding issues and cleaning headers
            # Let pandas infer the header, but then explicitly clean column names
            df_allocation = pd.read_csv(ALLOCATION_CSV_PATH, encoding='utf-8')
            print(f"DEBUG (Python): Raw DataFrame columns: {df_allocation.columns.tolist()}")

            # Drop any rows that are completely empty (all NaN values)
            df_allocation.dropna(how='all', inplace=True)
            
            # Identify the columns to keep and rename
            # The header appears to be 15 columns, so we'll slice the DataFrame and then rename
            
            # Select only the first 15 columns before cleaning the names
            df_allocation = df_allocation.iloc[:, :15]
            
            # Clean up column names to be more JavaScript-friendly (camelCase)
            # This mapping should be carefully checked against your actual CSV header
            # Based on the CSV content provided, the header seems to be:
            # STS,DEST,Month,Flight No,Phân thị,Sector,A/C,Dow,Vị trí phân bổ,AC type,CW/ vị trí,Total CW,Net Rate ($),All in,Revenue
            # Let's map these to more JS-friendly names
            df_allocation.columns = [
                'sts', 'dest', 'month', 'flightNo', 'phanThi', 'sector', 'aC', 'dow',
                'viTriPhanBo', 'acType', 'cwViTri', 'totalCw', 'netRateUsd', 'allIn', 'revenue'
            ]
            
            # Replace NaN with None for JSON compatibility
            df_allocation = df_allocation.replace({np.nan: None})
            
            # Convert specific columns to numeric, handling errors
            numeric_cols = ['viTriPhanBo', 'cwViTri', 'totalCw', 'netRateUsd', 'allIn', 'revenue']
            for col in numeric_cols:
                if col in df_allocation.columns:
                    # .astype(str).str.replace(',', '') handles commas in numbers
                    df_allocation[col] = pd.to_numeric(df_allocation[col].astype(str).str.replace(',', ''), errors='coerce')
                    df_allocation[col] = df_allocation[col].replace({np.nan: None})
            
            allocation_data = df_allocation.to_dict(orient='records')
            print(f"DEBUG (Python): Loaded {len(allocation_data)} rows from {ALLOCATION_CSV_PATH}")
            # Print a few sample allocation data entries to verify
            print("DEBUG (Python): Sample Allocation Data (first 5 rows):")
            for i, row in enumerate(allocation_data[:5]):
                print(f"  Row {i}: {row}")

            # --- VERIFYING SPECIFIC ENTRY IN PYTHON ---
            print("\nDEBUG (Python): Checking for VN011, SGNCDG, JAN, D7 in loaded allocation_data:")
            found_entries_python = []
            for row in allocation_data:
                # Ensure all values are treated as strings for comparison and normalization
                # Using .get() with default empty string for robustness
                flight_no = String(row.get('flightNo', '')).upper().strip()
                sector = String(row.get('sector', '')).upper().strip()
                month = String(row.get('month', '')).upper().strip()
                dow = String(row.get('dow', '')).upper().strip()
                sts = String(row.get('sts', '')).upper().strip() # Also check sts

                if (flight_no == 'VN011' and
                    sector == 'SGNCDG' and
                    month == 'FEB' and
                    dow == 'D1'):
                    found_entries_python.append(row)
            print(f"DEBUG (Python): Found {len(found_entries_python)} entries matching VN011, SGNCDG, JAN, D7 in Python.")
            for i, entry in enumerate(found_entries_python):
                print(f"  Python Match {i}: STS={entry.get('sts')}, Month={entry.get('month')}, FlightNo={entry.get('flightNo')}, Sector={entry.get('sector')}, Dow={entry.get('dow')}")
            # --- END VERIFICATION ---


        except Exception as e:
            print(f"Error loading allocation data: {e}")
            allocation_data = []
    else:
        print(f"Allocation CSV not found at {ALLOCATION_CSV_PATH}")
        allocation_data = []

    # Load Station Data (assuming this part is correct)
    if os.path.exists(STATION_CSV_PATH):
        try:
            df_station = pd.read_csv(STATION_CSV_PATH, encoding='utf-8')
            df_station.dropna(how='all', inplace=True)
            df_station.columns = df_station.columns.str.strip().str.replace('"', '')
            df_station.columns = ['group', 'sector', 'station', 'ghiChu']
            df_station = df_station.replace({np.nan: None})
            
            station_data = df_station.to_dict(orient='records')
            print(f"DEBUG (Python): Loaded {len(station_data)} rows from {STATION_CSV_PATH}")
        except Exception as e:
            print(f"Error loading station data: {e}")
            station_data = []
    else:
        print(f"Station CSV not found at {STATION_CSV_PATH}")
        station_data = []

@app.route('/api/allocation-data', methods=['GET'])
def get_allocation_data():
    """
    API endpoint to serve allocation data.
    """
    return jsonify(allocation_data)

@app.route('/api/station-data', methods=['GET'])
def get_station_data():
    """
    API endpoint to serve station grouping data.
    """
    return jsonify(station_data)

# Initial data load when the Flask app starts
load_csv_data()

if __name__ == '__main__':
    app.run(debug=True)