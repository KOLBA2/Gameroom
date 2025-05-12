// Display username from localStorage
const username = localStorage.getItem('username');
document.getElementById('username-display').textContent = username || '';;
if(username === "Gega") {
    object = document.getElementById("ctrl")
    object.classList.remove('invis');
       
}     
   
// Load rental types and stock items from localStorage
let rentalOptions = JSON.parse(localStorage.getItem('rentalOptions')) || {
    'ps5-premium': [
        { label: '+2 ჯოისტიკი & 50% ფასდაკლება', price: 9 },
        { label: '+2 ჯოისტიკი', price: 18 },
        { label: 'უფასო', price: 0 },
        { label: '50% ფასდაკლება', price: 7 },
        { label: 'Fixed', price: 14 }
    ],
    'ps5': [
        { label: '+2 ჯოისტიკი & 50% ფასდაკლება', price: 6 },
        { label: '+2 ჯოისტიკი', price: 12 },
        { label: 'უფასო', price: 0 },
        { label: '50% ფასდაკლება', price: 4 },
        { label: 'Fixed', price: 8 }
    ],
    'vip': [
        { label: '+2 ჯოისტიკი & 50% ფასდაკლება', price: 8 },
        { label: '+2 ჯოისტიკი', price: 16 },
        { label: 'უფასო', price: 0 },
        { label: '50% ფასდაკლება', price: 6 },
        { label: 'Fixed', price: 10 }
    ],
    'sache': [
        { label: '50% ფასდაკლება', price: 6 },
        { label: 'უფასო', price: 0 },
        { label: 'Fixed', price: 12 }
    ]
};

let stockData = JSON.parse(localStorage.getItem('stockData')) || [
    { item: "Cappy", price: 3.10, quantity: 0 },
    { item: "Fuse tea", price: 2.60, quantity: 0 },
    { item: "Vape IZY", price: 15.00, quantity: 0 },
    { item: "Vape VOOM", price: 17.00, quantity: 0 },
    { item: "ასორტი", price: 10.00, quantity: 0 },
    { item: "ბოთლის კოკა-კოლა", price: 3.00, quantity: 0 },
    { item: "დორიტოსი", price: 3.50, quantity: 0 },
    { item: "პოპკორნი", price: 2.50, quantity: 0 },
    { item: "სნუსი DOPE", price: 23.00, quantity: 0 },
    { item: "ფრიქსი", price: 3.00, quantity: 0 },
    { item: "ქილის კოკა-კოლა", price: 2.50, quantity: 0 },
    { item: "ყავა", price: 3.00, quantity: 0 },
    { item: "ჩაი", price: 3.00, quantity: 0 },
    { item: "ჩიტოსი", price: 3.00, quantity: 0 },
    { item: "წყალი", price: 1.50, quantity: 0 },
    { item: "ხრუსტიმი დიდი", price: 3.00, quantity: 0 },
    { item: "ხრუსტიმი პატარა", price: 2.00, quantity: 0 }
];

// Render rental types and stock items
function renderRentalTypes() {
    const rentalTypesList = document.getElementById('rentalTypesList');
    rentalTypesList.innerHTML = '';

    for (const category in rentalOptions) {
        rentalOptions[category].forEach((type, index) => {
            const listItem = document.createElement('div');
            listItem.classList.add('list-item');
            listItem.innerHTML = `
                <span>${category.toUpperCase()}: ${type.label} (₾${type.price})</span>
                <button class="button danger" onclick="removeRentalType('${category}', ${index})">Remove</button>
            `;
            rentalTypesList.appendChild(listItem);
        });
    }
}

function renderStockItems() {
    const stockItemsList = document.getElementById('stockItemsList');
    stockItemsList.innerHTML = '';

    stockData.forEach((item, index) => {
        const listItem = document.createElement('div');
        listItem.classList.add('list-item');
        listItem.innerHTML = `
            <span>${item.item} (₾${item.price.toFixed(2)})</span>
            <button class="button danger" onclick="removeStockItem(${index})">Remove</button>
        `;
        stockItemsList.appendChild(listItem);
    });
}

// Add rental type
function addRentalType() {
    const category = document.getElementById('rentalCategory').value;
    const label = document.getElementById('rentalLabel').value;
    const price = parseFloat(document.getElementById('rentalPrice').value);

    if (!label || isNaN(price)) {
        alert('Please fill in all fields correctly.');
        return;
    }

    rentalOptions[category].push({ label, price });
    localStorage.setItem('rentalOptions', JSON.stringify(rentalOptions));
    renderRentalTypes();
    
    // Clear form fields after adding
    document.getElementById('rentalLabel').value = '';
    document.getElementById('rentalPrice').value = '';
}

// Remove rental type
function removeRentalType(category, index) {
    if (confirm('Are you sure you want to remove this rental type?')) {
        rentalOptions[category].splice(index, 1);
        localStorage.setItem('rentalOptions', JSON.stringify(rentalOptions));
        renderRentalTypes();
    }
}

// Add stock item
async function addStockItem() {
    const itemName = document.getElementById('stockItemName').value.trim();
    const itemPrice = parseFloat(document.getElementById('stockItemPrice').value);
    const quantity = parseFloat(document.getElementById('quantityitem').value);

    // Validate inputs
    if (!itemName || isNaN(itemPrice) || isNaN(quantity) || itemPrice <= 0 || quantity <= 0) {
        alert('Please fill in all fields with valid positive values.');
        return;
    }

    try {
        // Prepare API request payload
        const productData = {
            productName: itemName,
            price: itemPrice,
            initialStock: quantity
        };

        // Make API request
        const response = await fetch('https://ubanze.bsite.net/api/products/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(productData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to create product');
        }

        const createdProduct = await response.json();

        // Update local storage only after successful API call
        stockData.push({ 
            item: createdProduct.productName, 
            price: createdProduct.price, 
            quantity: createdProduct.initialStock,
            id: createdProduct.id // Store the ID returned from API
        });
        
        loadStockData() 

        // Clear form fields
        document.getElementById('stockItemName').value = '';
        document.getElementById('stockItemPrice').value = '';
        document.getElementById('quantityitem').value = '';

        alert(`Product "${createdProduct.productName}" added successfully!`);

    } catch (error) {
        console.error('Error adding product:', error);
        alert(`Failed to add product: ${error.message}`);
    }
}
async function loadStockData() {
    try {
        // 1. Fetch data from API
        const response = await fetch('https://ubanze.bsite.net/api/products/all');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // 2. Parse the JSON response
        const apiData = await response.json();
        console.log('API response:', apiData);

        // 3. Transform API data to match your existing format
        stockData = apiData.map(product => ({
            item: product.name,       // Maps "name" to "item"
            price: product.price,     // Keeps price as-is
            quantity: product.stockQuantity  // Maps "stockQuantity" to "quantity"
        }));

        // 4. Save to localStorage
        localStorage.setItem('stockData', JSON.stringify(stockData));
        
        // 5. Render the items
        renderStockItems();

        console.log('Stock data loaded successfully from API');

    } catch (error) {
        console.error('Error loading stock from API:', error);
        
        // 6. Fallback to localStorage if API fails
        try {
            const localData = localStorage.getItem('stockData');
            if (localData) {
                stockData = JSON.parse(localData);
                renderStockItems();
                console.log('Loaded stock data from localStorage fallback');
            } else {
                console.warn('No local stock data available');
                stockData = []; // Initialize empty if no data exists
            }
        } catch (localError) {
            console.error('Error loading from localStorage:', localError);
            stockData = []; // Initialize empty if error occurs
        }
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    loadStockData();
});
// Remove stock item
async function removeStockItem(index) {
    if (!confirm('Are you sure you want to remove this stock item?')) {
        return;
    }

    try {
        // Get the product to remove
        const productToRemove = stockData[index];
        if (!productToRemove) {
            throw new Error('Product not found');
        }

        // Extract just the product name before the space and parenthesis
        const productName = productToRemove.item.split(' (')[0];
        console.log(productName)
        // Make API request
        const response = await fetch(
            `https://ubanze.bsite.net/api/products/remove/${encodeURIComponent(productName)}`, 
            {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        // Handle empty responses
        if (!response.ok) {
            let errorMessage = `HTTP error! Status: ${response.status}`;
            try {
                // Only try to parse JSON if there's content
                const errorData = response.status !== 204 ? await response.json() : null;
                errorMessage = errorData?.message || errorMessage;
            } catch (e) {
                console.warn('Could not parse error response', e);
            }
            throw new Error(errorMessage);
        }

        // Success - update local state
        stockData.splice(index, 1);
        localStorage.setItem('stockData', JSON.stringify(stockData));
        renderStockItems();

        alert(`"${productName}" was successfully removed`);

    } catch (error) {
        console.error('Delete failed:', {
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
        
        alert(`Failed to remove product: ${error.message}`);
    }
}
// Reset all configuration
function resetConfiguration() {
    if (confirm('Are you sure you want to reset all configuration? This action cannot be undone.')) {
        localStorage.removeItem('rentalOptions');
        localStorage.removeItem('stockData');
        rentalOptions = {
            'ps5-premium': [],
            'ps5': [],
            'vip': [],
            'sache': []
        };
        stockData = [];
        renderRentalTypes();
        renderStockItems();
    }
}

// Redirect to dashboard
function redirectToDashboard() {
    window.location.href = 'dashboard.html';
}

// Logout function
function logout() {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('username');
    window.location.href = 'index.html';
}

// Initial render
renderRentalTypes();
renderStockItems();