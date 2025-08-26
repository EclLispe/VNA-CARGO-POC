// --- Data will now be fetched from the backend ---
let flightData = []; // Will be populated from backend
let allocationData = []; // Will be populated from backend
let stationGroupingData = []; // Will be populated from backend
let allBookingData = []; // Will be populated dynamically from allocationData

// Pagination variables
const flightsPerPage = 5; // Number of flights to display per page
let currentFlightPage = 1;
let currentFilteredFlights = []; // Store filtered flights after search

// Get screen elements
const selectFlightScreen = document.getElementById('selectFlightScreen');
const bookingDetailsScreen = document.getElementById('bookingDetailsScreen');
const selectedFlightDisplay = document.getElementById('selectedFlightDisplay');

// Get table bodies
const flightListTbody = document.querySelector('#flightListTable tbody');
const confirmBookingTbody = document.querySelector('#confirmBookingTable tbody');
const standbyBookingTbody = document.querySelector('#standbyBookingTable tbody');
const paginationContainer = document.querySelector('#flightListPagination'); // New element for pagination

// Get the buttons
const searchBtn = document.getElementById('searchBtn');
const selectFlightSubmitBtn = document.getElementById('selectFlightSubmitBtn'); // New button
const addBookingBtn = document.getElementById('addBookingBtn');
const removeBookingBtn = document.getElementById('removeBookingBtn'); // Corrected ID reference
const backToFlightSelectionBtn = document.getElementById('backToFlightSelectionBtn');


// Function to switch screens
function showScreen(screenId) {
    if (screenId === 'selectFlightScreen') {
        selectFlightScreen.classList.remove('hidden');
        bookingDetailsScreen.classList.add('hidden');
    } else if (screenId === 'bookingDetailsScreen') {
        selectFlightScreen.classList.add('hidden');
        bookingDetailsScreen.classList.remove('hidden');
    }
}

// Helper to map month string to month index (0-indexed for Date object)
const monthMap = {
    'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
    'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
};

// Helper to get DOW number from 'D1' to 'D7' (1 for Monday, 0 for Sunday)
// Date.getDay() returns 0 for Sunday, 1 for Monday... 6 for Saturday
function getDayOfWeekNumber(dowStr) {
    if (!dowStr) return -1;
    const num = parseInt(String(dowStr).replace('D', ''), 10);
    if (num === 7) return 0; // D7 is Sunday, which is 0 in JS Date.getDay()
    return num; // D1-D6 are Monday-Saturday
}

// Helper to convert JS Date.getDay() (0=Sun, 1=Mon...) to 'D1' (Mon), 'D7' (Sun) format
function convertJsDayToDowString(jsDay) {
    // Convert JS day (0-6, 0=Sun) to your DOW number (1-7, 1=Mon, 7=Sun)
    let currentDowNum = (jsDay === 0) ? 7 : jsDay;

    // Increment by 1 as requested
    let nextDowNum = currentDowNum + 1;

    // Handle wrap-around from D7 (Sunday) to D1 (Monday)
    if (nextDowNum > 7) {
        nextDowNum = 1; // D7 + 1 becomes D1
    }

    return `D${nextDowNum}`;
}

function convertJsDayToDowStringFlight(jsDay) {
    if (jsDay === 0) return 'D7'; // Sunday
    return `D${jsDay}`; // Monday (1) to Saturday (6)
}

/**
 * Calculates the nearest date for a given month and Day of Week (DOW) in the current year.
 * Ensures D1=Monday, D7=Sunday.
 * @param {string} monthStr - The month string (e.g., 'JAN').
 * @param {string} dowStr - The DOW string (e.g., 'D1').
 * @returns {string} The calculated date in 'YYYY-MM-DD' format.
 */
function getNearestDateForMonthAndDOW(monthStr, dowStr) {
    const safeMonthStr = monthStr ? String(monthStr).toUpperCase().trim() : '';
    const targetMonthIndex = monthMap[safeMonthStr]; // 0-11
    const targetDayOfWeek = getDayOfWeekNumber(dowStr); // 0-6 (Sunday-Saturday)
    const currentYear = new Date().getFullYear(); // Use current year (2025)

    if (targetMonthIndex === undefined || targetDayOfWeek === -1) {
        console.warn(`Invalid month or DOW provided to getNearestDateForMonthAndDOW: Month='${monthStr}', DOW='${dowStr}'. Defaulting to 2025-01-01.`);
        return `2025-01-01`;
    }

    let date = new Date(currentYear, targetMonthIndex, 1); // Start from the 1st of the target month
    let currentDay = date.getDay(); // DOW of the 1st of the month

    // Calculate how many days to add to reach the targetDayOfWeek
    // (targetDayOfWeek - currentDay + 7) % 7 ensures a positive offset
    let daysToAdd = (targetDayOfWeek - currentDay + 7) % 7;

    date.setDate(1 + daysToAdd); // Set to the first occurrence of targetDayOfWeek

    // Format to YYYY-MM-DD
    return date.toISOString().split('T')[0];
}


/**
 * Populates the flight list table with provided data.
 * @param {Array<Object>} data - Array of flight objects.
 */
function populateFlightList(data) {
    flightListTbody.innerHTML = ''; // Clear existing rows

    const startIndex = (currentFlightPage - 1) * flightsPerPage;
    const endIndex = startIndex + flightsPerPage;
    const flightsToDisplay = data.slice(startIndex, endIndex);

    flightsToDisplay.forEach(flight => {
        const row = document.createElement('tr');
        row.classList.add('cursor-pointer', 'hover:bg-blue-50');

        row.innerHTML = `
            <td class="py-3 px-6">
                <input type="radio" name="selectedFlight" class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 flight-radio" data-flight-number="${flight.flightNumber}" data-sector="${flight.sector}" data-depart-date="${flight.departDate}">
            </td>
            <td class="py-3 px-6">${flight.flightNumber || 'N/A'}</td>
            <td class="py-3 px-6">${flight.sector || 'N/A'}</td>
            <td class="py-3 px-6">${flight.departDate || 'N/A'}</td>
            <td class="py-3 px-6">${flight.aircraftType || 'N/A'}</td>
            <td class="py-3 px-6">${flight.status || 'N/A'}</td>
        `;
        flightListTbody.appendChild(row);

        row.addEventListener('click', (event) => {
            const radio = row.querySelector('.flight-radio');
            if (event.target !== radio) {
                radio.checked = true;
            }
        });
    });

    renderPagination(data.length);
}

/**
 * Loads and filters booking details for a specific flight based on its number and depart date.
 * @param {string} flightNumberFromRadio - The flight number selected from the radio button.
 * @param {string} departDateFromRadio - The depart date selected from the radio button.
 */
async function loadBookingDetailsForFlight(flightNumberFromRadio, departDateFromRadio) {
    if (!departDateFromRadio) {
        console.error('Error: No depart date found for the selected flight radio button.');
        alert('Error: Could not determine depart date for selected flight. Please try again.');
        return;
    }

    selectedFlightDisplay.textContent = `${flightNumberFromRadio} (${departDateFromRadio})`;

    // Find the selected flight using both flightNumber AND departDate
    const selectedFlight = flightData.find(flight =>
        flight.flightNumber === flightNumberFromRadio &&
        flight.departDate === departDateFromRadio
    );

    if (!selectedFlight) {
        console.error(`Error: Selected flight ${flightNumberFromRadio} with date ${departDateFromRadio} not found in flightData.`);
        alert(`Error: Selected flight ${flightNumberFromRadio} with date ${departDateFromRadio} not found. Please try another flight.`);
        return;
    }

    let flightOrigin = '';
    let flightDestination = '';
    const flightMonth = selectedFlight.month; // Use stored month
    const flightDow = selectedFlight.dow;     // Use stored DOW
    const flightDepartDate = selectedFlight.departDate; // Use stored depart date

    if (selectedFlight.sector && selectedFlight.sector.includes('-')) {
        const sectorParts = selectedFlight.sector.split('-');
        flightOrigin = sectorParts[0];
        flightDestination = sectorParts[1];
    }

    // Normalize selected flight's properties for robust comparison
    const normalizedSelectedFlightNumber = String(flightNumberFromRadio).toUpperCase().trim();
    const normalizedSelectedFlightSector = String(selectedFlight.sector).toUpperCase().trim();
    const normalizedSelectedFlightMonth = String(flightMonth).toUpperCase().trim();
    const normalizedSelectedFlightDow = String(flightDow).toUpperCase().trim();
    const normalizedSelectedFlightDepartDate = String(flightDepartDate).toUpperCase().trim();


    // ONLY LOGGING FILTERING CRITERIA AND INCLUDED BOOKINGS NOW
    console.log('--- Filtering Bookings For ---');
    console.log('Selected Flight Number (Filter):', normalizedSelectedFlightNumber);
    console.log('Selected Flight Sector (Filter):', normalizedSelectedFlightSector);
    console.log('Selected Flight Month (Filter):', normalizedSelectedFlightMonth);
    console.log('Selected Flight DOW (Filter):', normalizedSelectedFlightDow);
    console.log('Selected Flight Depart Date (Filter):', normalizedSelectedFlightDepartDate);
    console.log('-----------------------------');


    currentConfirmBookingData = []; // Confirmed bookings are explicitly empty

    const filteredStandbyBookings = allBookingData.filter(booking => {
        const normalizedBookingFlightNumber = String(booking.flightNumber).toUpperCase().trim();
        const normalizedBookingSector = String(booking.sector).toUpperCase().trim();
        const normalizedBookingMonth = String(booking.month).toUpperCase().trim();
        const normalizedBookingDow = String(booking.dow).toUpperCase().trim();
        const normalizedBookingDepartDate = String(booking.departDate).toUpperCase().trim();

        const isFlightMatch = normalizedBookingFlightNumber === normalizedSelectedFlightNumber;
        const isMonthMatch = normalizedBookingMonth === normalizedSelectedFlightMonth;
        const isDowMatch = normalizedBookingDow === normalizedSelectedFlightDow;
        const isSectorMatch = normalizedBookingSector === normalizedSelectedFlightSector;
        const isDateMatch = normalizedBookingDepartDate === normalizedSelectedFlightDepartDate;
        const isStatusMatch = booking.status === 'Standby';

        return isFlightMatch && isMonthMatch && isDowMatch && isSectorMatch && isDateMatch && isStatusMatch;
    });

    currentStandbyBookingData = filteredStandbyBookings.map(booking => ({ ...booking, ori: flightOrigin, des: flightDestination, status: 'None' }));

    console.log('--- Standby Bookings Included (After Filter) ---');
    if (currentStandbyBookingData.length === 0) {
        console.log('No standby bookings found for the selected flight and criteria.');
    } else {
        currentStandbyBookingData.forEach(booking => {
            console.log(`Included AWB: ${booking.awb || 'N/A'}`);
            console.log('Raw Booking Data:', booking);
            console.log(`  Flight: ${booking.flightNumber}, Sector: ${booking.sector}, Month: ${booking.month}, DOW: ${booking.dow}, Depart Date: ${booking.departDate}, Status: ${booking.status}`);
        });
    }
    console.log('------------------------------------------------');


    // --- Allotment Calculation Logic ---
    const groupAllocations = {};
    const groupBookedCW = {};

    allocationData.forEach(alloc => {
        const normalizedAllocFlightNo = String(alloc.flightNo).toUpperCase().trim();
        const normalizedAllocSector = String(alloc.sector).toUpperCase().trim();
        const normalizedAllocMonth = String(alloc.month).toUpperCase().trim();
        const normalizedAllocDow = String(alloc.dow).toUpperCase().trim();
        const normalizedAllocDepartDate = String(alloc.departDate || '').toUpperCase().trim();

        if (normalizedAllocFlightNo === normalizedSelectedFlightNumber &&
            normalizedAllocSector === normalizedSelectedFlightSector &&
            normalizedAllocMonth === normalizedSelectedFlightMonth &&
            normalizedAllocDow === normalizedSelectedFlightDow &&
            normalizedAllocDepartDate === normalizedSelectedFlightDepartDate) {

            const matchingStationGroups = stationGroupingData.filter(sg =>
                (String(sg.station || '').toUpperCase().trim() === String(alloc.sts || '').toUpperCase().trim() ||
                 String(sg.station || '').toUpperCase().trim() === String(alloc.dest || '').toUpperCase().trim()) &&
                String(sg.sector || '').toUpperCase().trim() === normalizedSelectedFlightSector
            );

            matchingStationGroups.forEach(stationGroupEntry => {
                const groupName = stationGroupEntry.group;
                if (!groupAllocations[groupName]) {
                    groupAllocations[groupName] = {
                        totalAllocatedPositions: 0,
                        relevantStations: new Set()
                    };
                }
                groupAllocations[groupName].totalAllocatedPositions += (Number(alloc.viTriPhanBo) || 0) * (Number(alloc.ttlDay) || 1);
                groupAllocations[groupName].relevantStations.add(stationGroupEntry.station);
            });
        }
    });

    const allCurrentBookings = [...currentConfirmBookingData, ...currentStandbyBookingData];

    allCurrentBookings.forEach(booking => {
        const normalizedBookingStation = String(booking.station).toUpperCase().trim();
        const normalizedBookingSector = String(booking.sector).toUpperCase().trim();

        const groupEntry = stationGroupingData.find(sg =>
            String(sg.station || '').toUpperCase().trim() === normalizedBookingStation &&
            String(sg.sector || '').toUpperCase().trim() === normalizedBookingSector
        );

        if (groupEntry) {
            const groupName = groupEntry.group;
            if (!groupBookedCW[groupName]) {
                groupBookedCW[groupName] = 0;
            }
            groupBookedCW[groupName] += Number(booking.cw) || 0;
        }
    });

    const allotmentSidebar = document.querySelector('#bookingDetailsScreen .sidebar:first-of-type');
    if (allotmentSidebar) {
        allotmentSidebar.querySelectorAll('.dynamic-allotment-item').forEach(item => item.remove());

        for (const groupName in groupAllocations) {
            const allocatedPositions = groupAllocations[groupName].totalAllocatedPositions;
            const bookedCW = groupBookedCW[groupName] || 0;

            let percentage = 0;
            if (allocatedPositions > 0) {
                percentage = (bookedCW / allocatedPositions) * 100;
            }

            const newItem = document.createElement('div');
            newItem.className = 'sidebar-item dynamic-allotment-item';
            newItem.dataset.group = groupName;
            newItem.innerHTML = `
                <span>${groupName}</span>
                <span class="font-medium">${percentage.toFixed(2)}%</span>
                <select class="status-dropdown w-24 ml-2">
                    <option>✔</option>
                    <option>✖</option>
                </select>
            `;
            allotmentSidebar.appendChild(newItem);
        }
    }
    // --- End Allotment Calculation Logic ---

    populateBookingList(confirmBookingTbody, currentConfirmBookingData, 'confirm');
    populateBookingList(standbyBookingTbody, currentStandbyBookingData, 'standby');
    calculateTotals();
    showScreen('bookingDetailsScreen');
}


/**
 * Populates a booking list table (confirm or standby) with provided data.
 * @param {HTMLTableSectionElement} tbody - The tbody element to populate.
 * @param {Array<Object>} data - Array of booking objects.
 * @param {string} listType - Type of list ('confirm' or 'standby').
 */
function populateBookingList(tbody, data, listType) {
    tbody.innerHTML = ''; // Clear existing rows
    const statusOptions = ['None', 'KK', 'LL', 'UU', 'XX', 'CA'];
    data.forEach(booking => {
        const row = `
            <tr>
                <td class="py-3 px-6">
                    <input type="checkbox" class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 booking-checkbox" data-awb="${booking.awb}" data-list-type="${listType}">
                </td>
                <td class="py-3 px-6">
                    <select class="status-dropdown w-full p-2 border rounded-md" data-awb="${booking.awb}" data-list-type="${listType}">
                        ${statusOptions.map(option => `
                            <option value="${option}" ${booking.status === option ? 'selected' : ''}>
                                ${option}
                            </option>
                        `).join('')}
                    </select>
                </td>
                <td class="py-3 px-6">${booking.station || 'N/A'}</td>
                <td class="py-3 px-6">${booking.awb || 'N/A'}</td>
                <td class="py-3 px-6">${booking.ori || 'N/A'}</td>
                <td class="py-3 px-6">${booking.des || 'N/A'}</td>
                <td class="py-3 px-6">${booking.pieces || 'N/A'}</td>
                <td class="py-3 px-6">${booking.dim || 'N/A'}</td>
                <td class="py-3 px-6">${booking.cw || 'N/A'}</td>
                <td class="py-3 px-6">${booking.gw || 'N/A'}</td>
                <td class="py-3 px-6">${booking.vol || 'N/A'}</td>
                <td class="py-3 px-6">${booking.price || 'N/A'}</td>
                <td class="py-3 px-6">${booking.revenue || 'N/A'}</td>
                <td class="py-3 px-6">${booking.cwp || 'N/A'}</td>
                <td class="py-3 px-6">${booking.position || 'N/A'}</td>
                <td class="py-3 px-6">${booking.revLoss || 'N/A'}</td>
                <td class="py-3 px-6">${booking.allotment || 'N/A'}</td>
                <td class="py-3 px-6">${booking.agent || 'N/A'}</td>
                <td class="py-3 px-6">${booking.natureGood || 'N/A'}</td>
                <td class="py-3 px-6">${booking.alott || 'N/A'}</td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', row);
    });
}

/**
 * Calculates and displays total values for confirmed bookings.
 */
function calculateTotals() {
    let totalW = 0;
    let totalV = 0;
    let totalCPN = 0;
    let totalST = 0;
    let totalRemai = 0;
    let totalRevenue = 0;

    // Summing from currentStandbyBookingData as confirmed are removed
    currentStandbyBookingData.forEach(booking => {
        totalW += Number(booking.cw) || 0;
        totalV += Number(booking.vol) || 0;
        totalRevenue += Number(booking.revenue) || 0;
        totalCPN += Number(booking.pieces) || 0;
        totalST += Number(booking.gw) || 0;
        totalRemai += Number(booking.cwp) || 0;
    });

    document.getElementById('totalW').textContent = totalW.toFixed(2);
    document.getElementById('totalV').textContent = totalV.toFixed(2);
    document.getElementById('totalCPN').textContent = totalCPN.toFixed(2);
    document.getElementById('totalST').textContent = totalST.toFixed(2);
    document.getElementById('totalRemai').textContent = totalRemai.toFixed(2);
    document.getElementById('totalRevenue').textContent = totalRevenue.toFixed(2);
}

/**
 * Renders pagination controls for the flight list.
 * @param {number} totalFlights - Total number of flights.
 */
function renderPagination(totalFlights) {
    paginationContainer.innerHTML = ''; // Clear existing pagination

    const totalPages = Math.ceil(totalFlights / flightsPerPage);

    // Previous button
    const prevButton = document.createElement('span');
    prevButton.textContent = 'Previous';
    prevButton.className = `cursor-pointer px-3 py-1 border rounded-md ${currentFlightPage === 1 ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white hover:bg-gray-100 text-blue-600 border-blue-300'}`;
    prevButton.addEventListener('click', () => {
        if (currentFlightPage > 1) {
            currentFlightPage--;
            populateFlightList(currentFilteredFlights);
        }
    });
    paginationContainer.appendChild(prevButton);

    // Page numbers
    const maxPageLinks = 5; // Max number of page links to show at once
    let startPage = Math.max(1, currentFlightPage - Math.floor(maxPageLinks / 2));
    let endPage = Math.min(totalPages, startPage + maxPageLinks - 1);

    // Adjust startPage if we're near the end
    if (endPage - startPage + 1 < maxPageLinks) {
        startPage = Math.max(1, endPage - maxPageLinks + 1);
    }

    if (startPage > 1) {
        const firstPageLink = document.createElement('span');
        firstPageLink.textContent = '1';
        firstPageLink.className = `cursor-pointer px-3 py-1 border rounded-md mx-1 bg-white hover:bg-gray-100 text-blue-600 border-blue-300`;
        firstPageLink.addEventListener('click', () => {
            currentFlightPage = 1;
            populateFlightList(currentFilteredFlights);
        });
        paginationContainer.appendChild(firstPageLink);
        if (startPage > 2) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.className = `px-3 py-1 text-gray-500`;
            paginationContainer.appendChild(ellipsis);
        }
    }


    for (let i = startPage; i <= endPage; i++) {
        const pageLink = document.createElement('span');
        pageLink.textContent = i;
        pageLink.className = `cursor-pointer px-3 py-1 border rounded-md mx-1 ${i === currentFlightPage ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-100 text-blue-600 border-blue-300'}`;
        pageLink.addEventListener('click', () => {
            currentFlightPage = i;
            populateFlightList(currentFilteredFlights);
        });
        paginationContainer.appendChild(pageLink);
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.className = `px-3 py-1 text-gray-500`;
            paginationContainer.appendChild(ellipsis);
        }
        const lastPageLink = document.createElement('span');
        lastPageLink.textContent = totalPages;
        lastPageLink.className = `cursor-pointer px-3 py-1 border rounded-md mx-1 bg-white hover:bg-gray-100 text-blue-600 border-blue-300`;
        lastPageLink.addEventListener('click', () => {
            currentFlightPage = totalPages;
            populateFlightList(currentFilteredFlights);
        });
        paginationContainer.appendChild(lastPageLink);
    }

    // Next button
    const nextButton = document.createElement('span');
    nextButton.textContent = 'Next';
    nextButton.className = `cursor-pointer px-3 py-1 border rounded-md ${currentFlightPage === totalPages ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white hover:bg-gray-100 text-blue-600 border-blue-300'}`;
    nextButton.addEventListener('click', () => {
        if (currentFlightPage < totalPages) {
            currentFlightPage++;
            populateFlightList(currentFilteredFlights);
        }
    });
    paginationContainer.appendChild(nextButton);
}

// Function to move selected bookings from Standby to Confirm
function addStandbyToConfirm() {
    const selectedCheckboxes = document.querySelectorAll('#standbyBookingTable .booking-checkbox:checked');
    const selectedAwbs = Array.from(selectedCheckboxes).map(checkbox => checkbox.dataset.awb);

    const bookingsToAdd = [];
    currentStandbyBookingData = currentStandbyBookingData.filter(booking => {
        if (selectedAwbs.includes(booking.awb)) {
            const statusPicklist = document.querySelector(`#standbyBookingTable [data-awb="${booking.awb}"].status-dropdown`);
            const currentStatus = statusPicklist ? statusPicklist.value : 'None';

            bookingsToAdd.push({ ...booking, status: 'KK' });
            return false;
        }
        return true;
    });

    currentConfirmBookingData.push(...bookingsToAdd);

    populateBookingList(confirmBookingTbody, currentConfirmBookingData, 'confirm');
    populateBookingList(standbyBookingTbody, currentStandbyBookingData, 'standby');
    calculateTotals();
    const selectedFlightNumber = selectedFlightDisplay.textContent;
    if (selectedFlightNumber) {
        loadBookingDetailsForFlight(selectedFlightNumber);
    }
}

// Function to move selected bookings from Confirm to Standby
function removeConfirmToStandby() {
    const selectedCheckboxes = document.querySelectorAll('#confirmBookingTable .booking-checkbox:checked');
    const selectedAwbs = Array.from(selectedCheckboxes).map(checkbox => checkbox.dataset.awb);

    const bookingsToRemove = [];
    currentConfirmBookingData = currentConfirmBookingData.filter(booking => {
        if (selectedAwbs.includes(booking.awb)) {
            const statusPicklist = document.querySelector(`#confirmBookingTable [data-awb="${booking.awb}"].status-dropdown`);
            const currentStatus = statusPicklist ? statusPicklist.value : 'KK';

            bookingsToRemove.push({ ...booking, status: 'None' });
            return false;
        }
        return true;
    });

    currentStandbyBookingData.push(...bookingsToRemove);

    populateBookingList(confirmBookingTbody, currentConfirmBookingData, 'confirm');
    populateBookingList(standbyBookingTbody, currentStandbyBookingData, 'standby');
    calculateTotals();
    const selectedFlightNumber = selectedFlightDisplay.textContent;
    if (selectedFlightNumber) {
        loadBookingDetailsForFlight(selectedFlightNumber);
    }
}

// Event Listeners

// Search button click (filters flights)
searchBtn.addEventListener('click', () => {
    const sector = document.getElementById('sector').value.toLowerCase();
    const flightNumber = document.getElementById('flightNumber').value.toLowerCase();
    const departDate = document.getElementById('departDate').value;

    currentFilteredFlights = flightData.filter(flight => {
        return (sector === '' || flight.sector.toLowerCase().includes(sector)) &&
               (flightNumber === '' || flight.flightNumber.toLowerCase().includes(flightNumber)) &&
               (departDate === '' || flight.departDate === departDate);
    });
    currentFlightPage = 1;
    populateFlightList(currentFilteredFlights);
});

// View Selected Flight button click
if (selectFlightSubmitBtn) {
    selectFlightSubmitBtn.addEventListener('click', () => {
        const selectedFlightRadio = document.querySelector('.flight-radio:checked');

        if (!selectedFlightRadio) {
            alert('Please select a flight to view its bookings.');
        } else {
            const selectedFlightNumber = selectedFlightRadio.dataset.flightNumber;
            const selectedDepartDate = selectedFlightRadio.dataset.departDate;
            loadBookingDetailsForFlight(selectedFlightNumber, selectedDepartDate);
        }
    });
}

// Event listeners for the add/remove buttons (for booking details screen)
if (addBookingBtn) {
    addBookingBtn.addEventListener('click', addStandbyToConfirm);
}
if (removeBookingBtn) {
    removeBookingBtn.addEventListener('click', removeConfirmToStandby);
}

// Back to Flight Selection button click
if (backToFlightSelectionBtn) {
    backToFlightSelectionBtn.addEventListener('click', () => {
        showScreen('selectFlightScreen');
    });
}

/**
 * Fetches allocation and station data from the backend and initializes flight and booking data.
 */
async function fetchBackendData() {
    try {
        const allocationResponse = await fetch('http://127.0.0.1:5000/api/allocation-data');
        if (!allocationResponse.ok) {
            const errorText = await allocationResponse.text();
            throw new Error(`HTTP error! Status: ${allocationResponse.status}, Response: ${errorText}`);
        }
        allocationData = await allocationResponse.json();
        // console.log('Fetched Allocation Data:', allocationData); // Removed log

        const stationResponse = await fetch('http://127.0.0.1:5000/api/station-data');
        if (!stationResponse.ok) {
            const errorText = await stationResponse.text();
            throw new Error(`HTTP error! Status: ${stationResponse.status}, Response: ${errorText}`);
        }
        stationGroupingData = await stationResponse.json();
        // console.log('Fetched Station Data:', stationGroupingData); // Removed log

        // Clear and dynamically generate allBookingData from allocationData
        allBookingData = [];
        allocationData.forEach((allocItem, index) => {
            const itemFlightNo = String(allocItem.flightNo || '').toUpperCase().trim();
            const itemSector = String(allocItem.sector || '').toUpperCase().trim();
            const itemMonth = String(allocItem.month || '').toUpperCase().trim();
            const itemDow = String(allocItem.dow || '').toUpperCase().trim();

            if (!itemFlightNo || !itemSector || !itemMonth || !itemDow) {
                return; // Skip if essential flight details are missing
            }

            const bookingDepartDate = getNearestDateForMonthAndDOW(itemMonth, itemDow);
            const bookingDateObj = new Date(bookingDepartDate);
            const bookingMonth = Object.keys(monthMap).find(key => monthMap[key] === bookingDateObj.getMonth());
            const bookingDow = convertJsDayToDowString(bookingDateObj.getDay());

            const status = 'Standby'; // Always 'Standby'
            const alott = '✖'; // Always '✖' for standby

            const pieces = Number(allocItem.viTriPhanBo) || 0;
            const cw = Number(allocItem.totalCw) || (Number(allocItem.cwViTri) || 0) * pieces;
            const price = Number(allocItem.netRateUsd) || 0;
            const revenue = Number(allocItem.revenue) || (price * cw);

            const calculatedGW = (cw * 1.1);
            const calculatedVol = (cw / 100);

            const groupEntry = stationGroupingData.find(sg =>
                String(sg.station || '').toUpperCase().trim() === String(allocItem.sts || '').toUpperCase().trim() &&
                String(sg.sector || '').toUpperCase().trim() === itemSector
            );
            const groupName = groupEntry ? groupEntry.group : 'Unknown';

            // --- DEBUG LOGGING for allBookingData generation (as requested) ---
            console.log(`DEBUG (allBookingData generation): AWB: ${itemFlightNo}-${String(allocItem.sts || '').toUpperCase().trim()}-${index}`);
            console.log('  Raw allocItem from CSV:', allocItem);
            console.log(`  Derived Booking Properties: Flight=${itemFlightNo}, Sector=${itemSector}, Month=${bookingMonth}, DOW=${bookingDow}, DepartDate=${bookingDepartDate}, Station=${String(allocItem.sts || '').toUpperCase().trim()}`);
            // --- END DEBUG LOGGING ---


            allBookingData.push({
                flightNumber: itemFlightNo,
                status: status,
                station: String(allocItem.sts || '').toUpperCase().trim(),
                awb: `${itemFlightNo}-${String(allocItem.sts || '').toUpperCase().trim()}-${index}`,
                ori: String(allocItem.sts || '').toUpperCase().trim(),
                des: String(allocItem.dest || '').toUpperCase().trim(),
                pieces: pieces,
                dim: '1x1x1',
                cw: cw.toFixed(2),
                gw: calculatedGW.toFixed(2),
                vol: calculatedVol.toFixed(3),
                price: price.toFixed(2),
                revenue: revenue.toFixed(2),
                cwp: cw.toFixed(2),
                position: String(allocItem.mpViTri || `Pos: ${allocItem.viTriPhanBo || 'N/A'}`).toUpperCase().trim(),
                allotment: groupName,
                agent: 'Default Agent',
                natureGood: 'General Cargo',
                alott: alott,
                departDate: bookingDepartDate,
                month: bookingMonth,
                dow: bookingDow,
                sector: itemSector,
                revLoss: 'N/A'
            });
        });
        // console.log('Generated All Booking Data:', allBookingData); // Removed log

        // Generate flightData based on allocationData
        const uniqueFlights = new Map();
        allocationData.forEach(item => {
            const itemFlightNo = String(item.flightNo || '').toUpperCase().trim();
            const itemSector = String(item.sector || '').toUpperCase().trim();
            const itemMonth = String(item.month || '').toUpperCase().trim();
            const itemDow = String(item.dow || '').toUpperCase().trim();

            if (!itemFlightNo || !itemSector || !itemMonth || !itemDow || !item.aC) {
                return; // Skip if essential flight details are missing
            }

            const departDate = getNearestDateForMonthAndDOW(itemMonth, itemDow);
            const dateObj = new Date(departDate);
            const derivedMonth = Object.keys(monthMap).find(key => monthMap[key] === dateObj.getMonth());
            const derivedDow = convertJsDayToDowStringFlight(dateObj.getDay());

            // Create a truly unique key including the derived departDate to ensure distinct flight entries
            const flightKey = `${itemFlightNo}-${itemSector}-${derivedMonth}-${derivedDow}-${departDate}`;

            if (!uniqueFlights.has(flightKey)) {
                uniqueFlights.set(flightKey, {
                    flightNumber: itemFlightNo,
                    sector: itemSector,
                    departDate: departDate,
                    month: derivedMonth,
                    dow: derivedDow,
                    aircraftType: String(item.aC || '').toUpperCase().trim(),
                    status: 'Active'
                });
            }
        });
        flightData = Array.from(uniqueFlights.values());
        flightData.sort((a, b) => {
            const flightA = a.flightNumber || '';
            const flightB = b.flightNumber || '';
            return flightA.localeCompare(flightB);
        });

        // console.log('Generated Flight Data:', flightData); // Removed log

        currentFilteredFlights = flightData;
        populateFlightList(currentFilteredFlights);

    } catch (error) {
        console.error('Error fetching backend data:', error);
        alert('Failed to load data from backend. Please ensure the Python Flask server is running and accessible. Error details in console.');
    }
}

// Initial population when the page loads
document.addEventListener('DOMContentLoaded', () => {
    showScreen('selectFlightScreen');
    fetchBackendData();
});