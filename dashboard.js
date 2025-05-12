let selectedCard = null;
let timerIntervals = {};
let alarmSound = new Audio("https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3");
let currentPaymentSession = null
let totalCashBalance = parseFloat(localStorage.getItem('cashBalance')) || 0;
let totalCardBalance = parseFloat(localStorage.getItem('cardBalance')) || 0;
let activeSessions = JSON.parse(localStorage.getItem('activeSessions')) || {};
let currentCARD= null
let stockData = [
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
let currentShopCardId = null;
let shopCart = [];
let currentPaymentCardId = null;
let currentPaymentAmount = 0;

const rentalOptions = {
    'ps5': [
        { label: '2 კონტროლერი', price: 8 },
        { label: '3/4 კონტროლერი', price: 14 }
    ],
    'vip': [
        { label: '1/2 კონტროლერი', price: 12 },
        { label: '3/4 კონტროლერი', price: 16 }
    ],
    'vip-premium': [
        { label: '1/2 კონტროლერი', price: 15 },
        { label: '3/4 კონტროლერი', price: 20 }
    ],
    'sache': [
        { label: 'ჩვეულებრივი', price: 10 }
    ]
};
let totalPrice = 0;

window.addEventListener('load', function() {
    if (localStorage.getItem('isLoggedIn') !== 'true') {
        window.location.href = 'index.html';
        return;
    }

    restoreActiveSessions();

    const username = localStorage.getItem('username');
    
    // Create navbar based on username
    const navbar = document.createElement('nav');
    navbar.className = 'navbar';
    
    if(username === "Gega") {
        object = document.getElementById("ctrl")
        object.classList.remove('invis');
           
    } 
    
    // Insert the navbar at the beginning of the body
    document.body.insertBefore(navbar, document.body.firstChild);

    document.getElementById('username-display').textContent = username;
    updateBalanceDisplay();
    
    document.querySelectorAll('input[name="shopPaymentType"]').forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.value === 'both') {
                document.getElementById('shopBothPayments').style.display = 'block';
                updateShopPaymentSplit();
            } else {
                document.getElementById('shopBothPayments').style.display = 'none';
            }
        });
    });

    const rentalTypeSelect = document.getElementById('rentalType');
    rentalTypeSelect.addEventListener('change', function() {
        const isFixedRental = this.value === 'Mimdinare';
        
        if (isFixedRental) {
            document.getElementById('timeInput').value = '00:00';
            totalPrice = parseFloat(this.options[this.selectedIndex].dataset.price);
            document.getElementById('hourlyPrice').value = `${totalPrice.toFixed(2)}₾`;
            document.getElementById('paymentInputs').style.display = 'none';
        } else {
            document.getElementById('paymentInputs').style.display = 'block';
            updatePrice();
        }
    });

    document.addEventListener('click', function(event) {
        const timeInput = document.getElementById('timeInput');
        const timeDropdown = document.getElementById('timeDropdown');
        
        if (!timeInput.contains(event.target) && !timeDropdown.contains(event.target)) {
            timeDropdown.classList.remove('active');
        }
    });
});

function saveState() {
    localStorage.setItem('cashBalance', totalCashBalance);
    localStorage.setItem('cardBalance', totalCardBalance);
    localStorage.setItem('activeSessions', JSON.stringify(activeSessions));
}

function formatDurationForAPI(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return [
        hours.toString().padStart(2, '0'),
        minutes.toString().padStart(2, '0'),
        secs.toString().padStart(2, '0')
    ].join(':');
}

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function restoreActiveSessions() {
    // First, fetch the current balances from API to ensure we have the latest
    updateBalanceDisplay().then(() => {
        // Then restore sessions without processing payments again
        Object.keys(activeSessions).forEach(cardId => {
            const session = activeSessions[cardId];
            const card = document.querySelector(`[data-card-id="${cardId}"]`);
            
            if (!card) return;

            const currentTime = Date.now();
            
            if (session.isPaused) {
                const timeSincePause = currentTime - session.pauseStartTime;
                session.totalPausedTime += timeSincePause;
                renderActiveSession(card, session);
                card.classList.add('paused-session');
            } else {
                const elapsedSeconds = Math.floor((currentTime - session.startTime - session.totalPausedTime) / 1000);

                if (session.isFixedRental) {
                    const remainingSeconds = Math.max(0, session.totalDuration - elapsedSeconds);
                    session.timeLeft = remainingSeconds;
                    
                    if (remainingSeconds <= 0) {
                        if ((session.payLater || session.purchases?.some(p => !p.paid)) && !session.paymentProcessed) {
                            // Only show payment popup if payment wasn't processed
                            showPaymentPopup(cardId, calculateTotalDue(session));
                        } else {
                            delete activeSessions[cardId];
                            resetCard(card);
                        }
                        return;
                    }
                } else {
                    session.elapsedSeconds = elapsedSeconds;
                }
                
                renderActiveSession(card, session);
                startTimer(
                    session.isFixedRental ? session.timeLeft : session.elapsedSeconds,
                    card, 
                    session.rentalType, 
                    session.pricePerHour, 
                    session.isFixedRental, 
                    session.payLater
                );
            }
        });
        saveState();
    });
}

function calculateTotalDue(session) {
    let amountDue = 0;
    
    // 1. Rental time amount
    if (session.payLater && !session.paymentProcessed) {
        if (session.isFixedRental) {
            amountDue += session.price;
        } else {
            // Calculate elapsed ACTIVE time in hours
            const activeTime = Date.now() - session.startTime - session.totalPausedTime;
            const elapsedHours = activeTime / (1000 * 60 * 60);
            amountDue += elapsedHours * session.pricePerHour;
        }
    }
    
    // 2. Unpaid shop items
    if (session.purchases) {
        amountDue += session.purchases
            .filter(p => !p.paid)
            .reduce((sum, p) => sum + p.total, 0);
    }
    
    return amountDue;
}

function resetCard(card) {
    card.innerHTML = '<div class="add-button" onclick="showPopup(this)">+</div><div class="plus-button" onclick="openShopWindow(this)">+</div>';
    card.classList.remove('timer-active');
    card.classList.remove('flash-alarm');
}

function renderActiveSession(card, session) {
    let displayTime, displayPrice;
    
    if (session.isFixedRental) {
        displayTime = formatTime(session.timeLeft);
        displayPrice = `Price: ₾${session.price.toFixed(2)}`;
    } else {
        displayTime = formatTime(session.elapsedSeconds);
        const currentPrice = (session.elapsedSeconds / 3600) * session.pricePerHour;
        displayPrice = `Current: ₾${currentPrice.toFixed(2)}`;
    }
    
    card.innerHTML = `
        <div>Time: ${displayTime}</div>
        <div>Type: ${session.rentalType}</div>
        <div>${displayPrice}</div>
        ${session.purchases?.length ? `<div>Items: ₾${session.purchases.reduce((sum, p) => sum + p.total, 0).toFixed(2)}</div>` : ''}
        <button class="pause-button" onclick="${session.isPaused ? 'resumeSession(this)' : 'pauseSession(this)'}">
            ${session.isPaused ? 'Resume' : 'Pause'}
        </button>
        <button class="end-button" onclick="endSession(this)">End</button>
        <div class="plus-button visible" onclick="openShopWindow(this)">+</div>
    `;
    card.classList.add('timer-active');
    if (session.isPaused) {
        card.classList.add('paused-session');
    } else {
        card.classList.remove('paused-session');
    }
}

function resumeSession(button) {
    const card = button.closest('.card');
    const cardId = card.dataset.cardId;
    const session = activeSessions[cardId];
    
    if (!session || !session.isPaused) return;
    
    // Calculate how long we were paused
    const now = Date.now();
    session.totalPausedTime += now - session.pauseStartTime;
    session.isPaused = false;
    session.pauseStartTime = null;
    
    // Start the timer with adjusted times
    if (session.isFixedRental) {
        // For fixed rentals, adjust remaining time
        const activeTime = now - session.startTime - session.totalPausedTime;
        session.timeLeft = Math.max(0, session.totalDuration - Math.floor(activeTime / 1000));
        startTimer(session.timeLeft, card, session.rentalType, session.pricePerHour, true, session.payLater);
    } else {
        // For Mimdinare, use the original elapsed seconds (without paused time)
        const activeTime = now - session.startTime - session.totalPausedTime;
        session.elapsedSeconds = Math.floor(activeTime / 1000);
        startTimer(session.elapsedSeconds, card, session.rentalType, session.pricePerHour, false, session.payLater);
    }
    
    // Update UI
    renderActiveSession(card, session);
    saveState();
}

function saveHistoryEntry(entry) {
    const historyData = JSON.parse(localStorage.getItem('historyData')) || [];
    historyData.push(entry);
    localStorage.setItem('historyData', JSON.stringify(historyData));
}

function pauseSession(button) {
    const card = button.closest('.card');
    const cardId = card.dataset.cardId;
    const session = activeSessions[cardId];
    
    if (!session || session.isPaused) return;
    
    // Clear the current timer
    if (timerIntervals[cardId]) {
        clearInterval(timerIntervals[cardId]);
        delete timerIntervals[cardId];
    }
    
    // Mark as paused and record pause time
    session.isPaused = true;
    session.pauseStartTime = Date.now();
    
    // Update UI
    renderActiveSession(card, session);
    saveState();
}

async function startRental() {
    if (!selectedCard) return;

    // Get form values
    const timeInput = document.getElementById('timeInput').value;
    const rentalType = document.querySelector('#rentalType').value;
    const payLater = document.getElementById('payLaterCheckbox').checked;
    const isFixedRental = rentalType === 'Mimdinare';
    const selectedOption = document.querySelector('#rentalType option:checked');
    const pricePerHour = parseFloat(selectedOption.dataset.price);
    const cardId = selectedCard.dataset.cardId;

    // Validate inputs
    if (!isFixedRental) {
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
        if (!timeRegex.test(timeInput)) {
            alert('Please enter a valid time in HH:MM format (e.g., 01:30)');
            return;
        }
    }

    // Calculate duration and pricing
    let totalSeconds, totalPrice;
    if (isFixedRental) {
        totalSeconds = 24 * 60 * 60; // 24 hours for fixed rentals
        totalPrice = pricePerHour; // Fixed price
    } else {
        const [hours, minutes] = timeInput.split(':').map(Number);
        totalSeconds = (hours * 3600) + (minutes * 60);
        totalPrice = (hours + (minutes / 60)) * pricePerHour;
    }

    // Process payment based on rental type
    let cashAmount = 0;
    let cardAmount = 0;
    
    if (!payLater && !isFixedRental) {
        // For regular rentals - process payment immediately
        cashAmount = parseFloat(document.getElementById('cashPayment').value) || 0;
        cardAmount = parseFloat(document.getElementById('cardPayment').value) || 0;
        
        // Validate payment amounts
        const paymentTotal = cashAmount + cardAmount;
        if (Math.abs(paymentTotal - totalPrice) > 0.01) {
            alert(`Payment total (${paymentTotal.toFixed(2)}₾) doesn't match calculated price (${totalPrice.toFixed(2)}₾)`);
            return;
        }

        try {
            // Update local balances first
        
            updateBalanceDisplay();

            // Send to API
            const response = await fetch('https://ubanze.bsite.net/api/Cashreg', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    cash: cashAmount.toFixed(2),
                    card: cardAmount.toFixed(2)
                })
            });

            if (!response.ok) {
                // Revert balances if API fails
                totalCashBalance -= cashAmount;
                totalCardBalance -= cardAmount;
                updateBalanceDisplay();
                throw new Error('API payment failed');
            }

            // Record in history
            saveHistoryEntry({
                timestamp: Date.now(),
                type: rentalType,
                duration: timeInput,
                price: totalPrice,
                cashAmount: cashAmount,
                cardAmount: cardAmount,
                items: null,
                payLater: false
            });

        } catch (error) {
            console.error('Payment processing failed:', error);
            alert('Payment failed. Please try again.');
            return;
        }
    } else if (isFixedRental) {
        // For fixed rentals - store price but don't process payment yet
        totalPrice = pricePerHour;
    } else if (payLater) {
        // For pay-later rentals - calculate price but don't process payment yet
        const [hours, minutes] = timeInput.split(':').map(Number);
        totalPrice = (hours + (minutes / 60)) * pricePerHour;
    }

    // Create session record
    activeSessions[cardId] = {
        startTime: Date.now(),
        totalDuration: totalSeconds,
        rentalType: rentalType,
        isFixedRental: isFixedRental,
        pricePerHour: pricePerHour,
        price: totalPrice,
        payLater: payLater,
        cashAmount: cashAmount, // Will be 0 for pay-later/fixed (set at end)
        cardAmount: cardAmount, // Will be 0 for pay-later/fixed (set at end)
        purchases: []
    };

    // Start the session
    renderActiveSession(selectedCard, activeSessions[cardId]);
    startTimer(totalSeconds, selectedCard, rentalType, pricePerHour, isFixedRental, payLater);
    closePopup();
    saveState();

    // Show confirmation message
    if (isFixedRental) {
        alert(`Mimdinare rental started for 24 hours (₾${totalPrice.toFixed(2)} will be due at end)`);
    } else if (payLater) {
        alert(`Pay-later rental started (₾${totalPrice.toFixed(2)} will be due at end)`);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('input[name="shopPaymentMethod"]').forEach(radio => {
        radio.addEventListener('change', function() {
            updatePaymentUI();
        });
    });

    document.querySelectorAll('input[name="shopPaymentTiming"]').forEach(radio => {
        radio.addEventListener('change', function() {
            updatePaymentUI();
        });
    });
});

function updatePaymentUI() {
    const paymentMethod = document.querySelector('input[name="shopPaymentMethod"]:checked').value;
    const paymentTiming = document.querySelector('input[name="shopPaymentTiming"]:checked').value;
    const total = shopCart.reduce((sum, item) => sum + (item.quantity * item.price), 0);

    // Show/hide split payment controls
    if (paymentMethod === 'both' && paymentTiming === 'now') {
        document.getElementById('splitPaymentContainer').style.display = 'block';
        document.getElementById('shopCashAmount').value = (total / 2).toFixed(2);
        document.getElementById('shopCardAmount').value = (total / 2).toFixed(2);
        validateSplitPayment();
    } else {
        document.getElementById('splitPaymentContainer').style.display = 'none';
    }

    // Disable payment methods if paying later
    const paymentMethods = document.getElementById('paymentMethods');
    if (paymentTiming === 'later') {
        paymentMethods.style.opacity = '0.6';
        paymentMethods.querySelectorAll('input').forEach(input => {
            input.disabled = true;
        });
    } else {
        paymentMethods.style.opacity = '1';
        paymentMethods.querySelectorAll('input').forEach(input => {
            input.disabled = false;
        });
    }
}

function validateSplitPayment() {
    const total = shopCart.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const cashAmount = parseFloat(document.getElementById('shopCashAmount').value) || 0;
    const cardAmount = parseFloat(document.getElementById('shopCardAmount').value) || 0;
    const remaining = total - (cashAmount + cardAmount);

    document.getElementById('splitPaymentSummary').textContent = 
        `Total: ₾${total.toFixed(2)} (Remaining: ₾${remaining.toFixed(2)})`;

    if (remaining > 0.01) {
        document.getElementById('splitPaymentSummary').style.color = 'red';
    } else if (remaining < -0.01) {
        document.getElementById('splitPaymentSummary').style.color = 'orange';
    } else {
        document.getElementById('splitPaymentSummary').style.color = 'green';
    }
}

async function updatePaymentBalances(cashAmount, cardAmount) {
    try {
        const response = await fetch('https://ubanze.bsite.net/api/Cashreg', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                cash: cashAmount.toFixed(2),
                card: cardAmount.toFixed(2)
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Update local balances after successful API call
        totalCashBalance += cashAmount;
        totalCardBalance += cardAmount;
        updateBalanceDisplay();

        return await response.json(); // Return the response data if needed
    } catch (error) {
        console.error('Error updating payment balances:', error);
        // You might want to handle the error here, maybe show a message to the user
        throw error; // Re-throw the error if you want calling code to handle it
    }
}

async function processShopPurchase() {
    if (shopCart.length === 0 || !currentShopCardId) {
        closeShopWindow();
        return;
    }

    const total = shopCart.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    if (total <= 0) {
        closeShopWindow();
        return;
    }

    const paymentTiming = document.querySelector('input[name="shopPaymentTiming"]:checked').value;
    const paymentMethod = document.querySelector('input[name="shopPaymentMethod"]:checked').value;
    const totalItems = shopCart.reduce((sum, item) => sum + item.quantity, 0);

    if (paymentTiming === 'now') {
        // Process immediate payment
        let cashAmount = 0;
        let cardAmount = 0;

        if (paymentMethod === 'cash') {
            cashAmount = total;
        } else if (paymentMethod === 'card') {
            cardAmount = total;
        } else if (paymentMethod === 'both') {
            cashAmount = parseFloat(document.getElementById('shopCashAmount').value) || 0;
            cardAmount = parseFloat(document.getElementById('shopCardAmount').value) || 0;
            
            if (Math.abs((cashAmount + cardAmount) - total) > 0.01) {
                alert(`Payment total doesn't match purchase total`);
                return;
            }
        }

        // Process payment
        await completeShopPurchase(cashAmount, cardAmount);
        
        // Create shop purchase data for API
        const purchaseData = {
            date: new Date().toISOString(),
            type: 'shop',
            duration: "00:00:00",
            price: parseFloat(total.toFixed(2)),
            itemsPurchased: totalItems
        };

        // Send to API
        try {
            await sendPurchaseData(purchaseData);
        } catch (error) {
            console.error('Failed to send shop purchase data:', error);
        }

        // Add to history
        saveHistoryEntry({
            timestamp: Date.now(),
            type: 'Shop Purchase',
            price: total,
            cashAmount: cashAmount,
            cardAmount: cardAmount,
            items: shopCart,
            paidNow: true
        });

        closeShopWindow();
    } else {
        // Pay later - add to session
        const session = activeSessions[currentShopCardId];
        if (!session) {
            alert('No active session found for this station.');
            return;
        }

        // Initialize purchases array if it doesn't exist
        if (!session.purchases) {
            session.purchases = [];
        }

        // Add the new purchase
        session.purchases.push({
            items: JSON.parse(JSON.stringify(shopCart)),
            total: total,
            timestamp: Date.now(),
            paid: false
        });

        // Update session's purchase data for API
        if (!session.purchaseData) {
            session.purchaseData = {
                date: new Date().toISOString(),
                type: getStationType(selectedCard),
                duration: session.isFixedRental ? 
                    formatDurationForAPI(session.totalDuration) : 
                    formatDurationForAPI(session.elapsedSeconds),
                price: 0,
                itemsPurchased: 0
            };
        }
        session.purchaseData.itemsPurchased = (session.purchaseData.itemsPurchased || 0) + totalItems;

        alert(`Added ₾${total.toFixed(2)} to session. Will be paid when session ends.`);
        closeShopWindow();
    }

    shopCart = [];
    saveState();
}

function startTimer(initialSeconds, card, rentalType, pricePerHour, isFixedRental = false, payLater = false) {
    const cardId = card.dataset.cardId;
    const session = activeSessions[cardId];
    
    if (!session || session.isPaused) return; // Don't start timer if session is paused

    // Clear any existing timer
    if (timerIntervals[cardId]) {
        clearInterval(timerIntervals[cardId]);
        delete timerIntervals[cardId];
    }

    function updateTimer() {
        const now = Date.now();
        // Calculate ACTIVE time (total time minus paused time)
        const activeTime = now - session.startTime - session.totalPausedTime;
       
        if (isFixedRental) {
            // For fixed rentals (counting down)
            const remainingSeconds = Math.max(0, session.totalDuration - Math.floor(activeTime / 1000));
            session.timeLeft = remainingSeconds;
     
            
            if (remainingSeconds <= 0 && !session.isCompleted) {
                session.isCompleted = true;
                triggerAlarm(card);

                if (session.payLater || session.purchases?.some(p => !p.paid)) {
                    showPaymentPopup(cardId, calculateTotalDue(session));
                }
            }
        } else {
            // For Mimdinare (counting up)
            const elapsedSeconds = Math.floor(activeTime / 1000);
            session.elapsedSeconds = elapsedSeconds;
        }
        
        renderActiveSession(card, session);
        saveState();
    }

    // Start the timer
    timerIntervals[cardId] = setInterval(updateTimer, 1000);
    updateTimer(); // Initial update
}

function showPaymentPopup(cardId, amount, isShopPurchase = false) {
    currentPaymentCardId = cardId;
    currentPaymentAmount = amount;
    
    // Update payment popup UI
    document.getElementById('paymentAmount').value = amount.toFixed(2);
    document.getElementById('paymentCashAmount').value = amount.toFixed(2);
    document.getElementById('paymentCardAmount').value = '0';
    document.getElementById('paymentTotalAmount').textContent = `Total: ₾${amount.toFixed(2)}`;
    
    // Set the payment type indicator
    document.getElementById('paymentTypeIndicator').textContent = 
        isShopPurchase ? 'Shop Purchase' : 'Rental Payment';
    
    // Show the popup and overlay
    document.getElementById('paymentPopup').style.display = 'block';
    document.getElementById('paymentOverlay').style.display = 'block';
    
    // Make sure they're on top of everything
    document.getElementById('paymentPopup').style.zIndex = '1000';
    document.getElementById('paymentOverlay').style.zIndex = '999';
}

function closePaymentPopup() {
    document.getElementById('paymentPopup').style.display = 'none';
    document.getElementById('paymentOverlay').style.display = 'none';
    currentPaymentCardId = null;
    currentPaymentAmount = 0;
}

function updatePaymentCashAmount() {
    const cardAmount = parseFloat(document.getElementById('paymentCardAmount').value) || 0;
    const cashAmount = currentPaymentAmount - cardAmount;
    document.getElementById('paymentCashAmount').value = cashAmount > 0 ? cashAmount.toFixed(2) : '0';
    document.getElementById('paymentTotalAmount').textContent = `Total: ₾ ${currentPaymentAmount.toFixed(2)}`;
}

function updatePaymentCardAmount() {
    const cashAmount = parseFloat(document.getElementById('paymentCashAmount').value) || 0;
    const cardAmount = currentPaymentAmount - cashAmount;
    document.getElementById('paymentCardAmount').value = cardAmount > 0 ? cardAmount.toFixed(2) : '0';
    document.getElementById('paymentTotalAmount').textContent = `Total: ₾ ${currentPaymentAmount.toFixed(2)}`;
}

async function confirmPayment() {
    const cashAmount = parseFloat(document.getElementById('paymentCashAmount').value) || 0;
    const cardAmount = parseFloat(document.getElementById('paymentCardAmount').value) || 0;
    const paymentTotal = cashAmount + cardAmount;

    if (Math.abs(paymentTotal - currentPaymentAmount) > 0.01) {
        alert('The sum of cash and card payments must equal the amount due.');
        return;
    }

    try {
        // Process payments through API
        const response = await fetch('https://ubanze.bsite.net/api/Cashreg', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                cash: cashAmount,
                card: cardAmount
            })
        });

        if (!response.ok) {
            throw new Error('Payment processing failed');
        }

        // Update local balances
        totalCashBalance += cashAmount;
        totalCardBalance += cardAmount;
        updateBalanceDisplay();

        const session = activeSessions[currentPaymentCardId];
        if (session) {
            // Mark all purchases as paid (both rental and shop items)
            session.paymentProcessed = true;
            
            if (session.purchases) {
                session.purchases.forEach(p => p.paid = true);
            }

            // Save to history with all details
            saveHistoryEntry({
                timestamp: Date.now(),
                type: session.rentalType,
                duration: session.isFixedRental ? 
                    formatTime(session.totalDuration) : 
                    formatTime(session.elapsedSeconds),
                price: currentPaymentAmount,
                cashAmount: cashAmount,
                cardAmount: cardAmount,
                items: session.purchases || [],
                station: currentPaymentCardId,
                rentalDetails: {
                    isFixedRental: session.isFixedRental,
                    pricePerHour: session.pricePerHour
                }
            });

            // Clean up session
            const card = document.querySelector(`[data-card-id="${currentPaymentCardId}"]`);
            if (card) resetCard(card);
            delete activeSessions[currentPaymentCardId];
            if (timerIntervals[currentPaymentCardId]) {
                clearInterval(timerIntervals[currentPaymentCardId]);
                delete timerIntervals[currentPaymentCardId];
            }
        }

        closePaymentPopup();
        saveState();
        alert('Payment processed successfully!');

    } catch (error) {
        console.error('Payment failed:', error);
        alert(`Payment failed: ${error.message}`);
        
        // Revert balance updates if payment failed
        totalCashBalance -= cashAmount;
        totalCardBalance -= cardAmount;
        updateBalanceDisplay();
    }
}

async function endSession(button) {
    selectedCard = button.parentElement;
    currentCARD = selectedCard.getAttribute('data-card-id');
    const card = button.closest('.card');
    if (!card) return;
    
    const cardId = card.dataset.cardId;
    const session = activeSessions[cardId];
    
    if (!session) return;
    if (session.isPaused) {
        const now = Date.now();
        session.totalPausedTime += now - session.pauseStartTime;
        session.isPaused = false;
    }

    // Stop the timer immediately
    if (timerIntervals[cardId]) {
        clearInterval(timerIntervals[cardId]);
        delete timerIntervals[cardId];
    }

    // Calculate total amount due (rental + shop purchases)
    const amountDue = calculateTotalDue(session);

    // Lock the card during payment process
    card.innerHTML = `
        <div class="payment-pending">
            <div>Processing payment...</div>
            <div class="loading-spinner"></div>
        </div>
    `;

    if (amountDue > 0) {
        // Show payment popup with all amounts due
        showPaymentPopup(cardId, amountDue, false);
    } else {
        // No payment needed - end session immediately
        delete activeSessions[cardId];
        resetCard(card);
        saveState();
    }
}

function triggerAlarm(card) {
    if (!card) return;
    
    const cardId = card.dataset.cardId;
    const session = activeSessions[cardId];
    
    if (!session) return;
    
    // Create alarm overlay that won't disappear until payment is processed
    const alarmOverlay = document.createElement('div');
    alarmOverlay.className = 'alarm-overlay';
    alarmOverlay.innerHTML = `
        <div class="timer-display">TIME'S UP!</div>
        <div>Please complete payment</div>
        <button class="stop-alarm-btn" onclick="processAlarmPayment('${cardId}')">
            PROCESS PAYMENT
        </button>
    `;
    
    // Clear any existing content and add overlay
    card.innerHTML = '';
    card.appendChild(alarmOverlay);
    card.classList.add('timer-active', 'flash-alarm');
    
    // Play alarm sound
    try {
        alarmSound.currentTime = 0;
        alarmSound.loop = true;
        const playPromise = alarmSound.play();
        
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.error("Playback failed:", error);
                if (navigator.vibrate) navigator.vibrate([200,100,200,100,200]);
            });
        }
    } catch (e) {
        console.error("Sound error:", e);
    }
}

async function processAlarmPayment(cardId) {
    const session = activeSessions[cardId];
    if (!session) return;

    // Calculate total amount due (rental + any purchases)
    const amountDue = calculateTotalDue(session);

    // Show payment popup
    showPaymentPopup(cardId, amountDue, false);
    
    // Stop the alarm (but keep the card locked until payment is complete)
    stopAlarmVisuals(cardId);
}

function stopAlarmVisuals(cardId) {
    const card = document.querySelector(`[data-card-id="${cardId}"]`);
    if (!card) return;
    
    card.classList.remove('flash-alarm');
    alarmSound.pause();
    alarmSound.currentTime = 0;
}

function stopAlarm(card) {
    if (!card) return;
    
    // 1. Stop visual effects
    card.classList.remove('flash-alarm');
    
    // 2. Stop sound
    alarmSound.pause();
    alarmSound.currentTime = 0;
    alarmSound.loop = false;
    
    // 3. Get card ID and session
    const cardId = card.dataset.cardId;
    const session = activeSessions[cardId];
    
    // 4. If it was a fixed rental with payLater and payment hasn't been processed
    if (session && session.isFixedRental && (session.payLater || session.purchases?.some(p => !p.paid)) && !session.paymentProcessed) {
        // Show payment popup if not already shown
        if (!document.getElementById('paymentPopup').style.display === 'block') {
            showPaymentPopup(cardId, calculateTotalDue(session));
        }
        return;
    }
    
    // 5. Otherwise reset the card
    if (activeSessions[cardId]) {
        renderActiveSession(card, activeSessions[cardId]);
    } else {
        resetCard(card);
    }
}

function resetCard(card) {
    if (!card) return;
    
    card.innerHTML = `
        <div class="add-button" onclick="showPopup(this)">+</div>
        <div class="plus-button" onclick="openShopWindow(this)">+</div>
    `;
    card.classList.remove('timer-active');
    card.classList.remove('flash-alarm');
}

function logout() {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('username');
    window.location.href = 'index.html';
}

function showPopup(button) {
    selectedCard = button.parentElement;
    currentCARD = selectedCard.getAttribute('data-card-id');
    // Create a new popup structure for initial choice
    const popup = document.getElementById('popup');
    popup.innerHTML = `
        <h2>Select Rental Mode</h2>
        <div class="rental-mode-choice">
            <button class="mode-btn" onclick="showFixedRentalOptions()">Fixed Rental</button>
            <button class="mode-btn" onclick="showMimdinareOptions()">Mimdinare</button>
        </div>
        <div class="button-group">
            <button class="cancel-btn" onclick="closePopup()">Cancel</button>
        </div>
    `;

    // Show the popup
    popup.style.display = 'block';
    document.getElementById('popupOverlay').style.display = 'block';
}

function showFixedRentalOptions() {
    const popup = document.getElementById('popup');
    const cardGrid = selectedCard.closest('.card-grid');
    const categoryTitle = cardGrid.previousElementSibling;
    let category = categoryTitle.textContent.trim().toLowerCase();
    
    // Map Georgian category names to their English keys
    const categoryMap = {
        'ps5 premium': 'ps5-premium',
        'ps5': 'ps5',
        'vip': 'vip',
        'vip premium': 'vip-premium',  
        'საჭე': 'sache'
    };

    category = categoryMap[category] || category;
    const options = rentalOptions[category] || [];

    popup.innerHTML = `
        <h2>Fixed Rental</h2>
        <div class="form-group">
            <label>Rental Type:</label>
            <select id="rentalType" onchange="updateFixedRentalPrice()">
                ${options.map(option => `
                    <option value="${option.label}" data-price="${option.price}">${option.label}</option>
                `).join('')}
            </select>
        </div>
        <div class="form-group">
            <label for="timeInput">Time Duration:</label>
            <div class="time-input-container">
                <input type="text" id="timeInput" class="time-input" placeholder="HH:MM" 
                       oninput="handleTimeInput()" onfocus="showTimeDropdown()">
                <div class="time-dropdown" id="timeDropdown">
                    <div class="time-option" onclick="selectTimeOption('0:30')">0:30</div>
                    <div class="time-option" onclick="selectTimeOption('1:00')">1:00</div>
                    <div class="time-option" onclick="selectTimeOption('2:00')">2:00</div>
                    <div class="time-option" onclick="selectTimeOption('3:00')">3:00</div>
                    <div class="time-option" onclick="selectTimeOption('4:00')">4:00</div>
                    <div class="time-option" onclick="selectTimeOption('5:00')">5:00</div>
                    <div class="time-option" onclick="selectTimeOption('6:00')">6:00</div>
                </div>
            </div>
        </div>
        <div class="form-group">
            <label>Total Price:</label>
            <input type="text" id="totalPrice" value="0.00₾" readonly>
        </div>
        <div class="pay-later-container">
            <input type="checkbox" id="payLaterCheckbox" onchange="toggleFixedPayLater()">
            <label for="payLaterCheckbox">Pay after session ends</label>
        </div>
        <div class="payment-inputs" id="fixedPaymentInputs">
            <label>Cash Payment (₾):</label>
            <input type="number" id="cashPayment" step="0.1" min="0" value="0" oninput="updateCardPaymentFixed()">
            
            <label>Card Payment (₾):</label>
            <input type="number" id="cardPayment" step="0.1" min="0" value="0" oninput="updateCashPaymentFixed()">
            
            <div class="total-amount" id="paymentTotal">Total: ₾ 0.00</div>
        </div>
        <div class="button-group">
            <button class="cancel-btn" onclick="closePopup()">Cancel</button>
            <button class="start-btn" onclick="startFixedRental()">Start</button>
        </div>
    `;

    // Initialize with default values
    document.getElementById('timeInput').value = '01:00';
    updateFixedRentalPrice();
}

function toggleFixedPayLater() {
    const payLater = document.getElementById('payLaterCheckbox').checked;
    document.getElementById('fixedPaymentInputs').style.display = payLater ? 'none' : 'block';
}

function updateCardPaymentFixed() {
    const totalPrice = parseFloat(document.getElementById('totalPrice').value.replace('₾', '')) || 0;
    const cashAmount = parseFloat(document.getElementById('cashPayment').value) || 0;
    const cardAmount = totalPrice - cashAmount;
    
    document.getElementById('cardPayment').value = cardAmount > 0 ? cardAmount.toFixed(2) : '0';
    updatePaymentTotalFixed();
}

function updateCashPaymentFixed() {
    const totalPrice = parseFloat(document.getElementById('totalPrice').value.replace('₾', '')) || 0;
    const cardAmount = parseFloat(document.getElementById('cardPayment').value) || 0;
    const cashAmount = totalPrice - cardAmount;
    
    document.getElementById('cashPayment').value = cashAmount > 0 ? cashAmount.toFixed(2) : '0';
    updatePaymentTotalFixed();
}

async function startFixedRental() {
    // Validate selection
    if (!selectedCard) {
        alert('Error: Please select a gaming station first');
        return;
    }

    // Get form values
    const timeInput = document.getElementById('timeInput').value;
    const rentalType = document.querySelector('#rentalType').value;
    const pricePerHour = parseFloat(document.querySelector('#rentalType option:checked').dataset.price);
    const payLater = document.getElementById('payLaterCheckbox').checked;
    const cardId = selectedCard.dataset.cardId;

    // Validate time format
    if (!/^([01]?[0-9]|2[0-3]):([0-5][0-9])$/.test(timeInput)) {
        alert('Invalid time format! Please use HH:MM (e.g. 01:30)');
        return;
    }

    // Calculate duration and price
    const [hours, minutes] = timeInput.split(':').map(Number);
    const totalSeconds = (hours * 3600) + (minutes * 60);
    const totalPrice = (hours + (minutes / 60)) * pricePerHour;

    // Process payment if not payLater
    let cashAmount = 0;
    let cardAmount = 0;
    
    if (!payLater) {
        cashAmount = parseFloat(document.getElementById('cashPayment').value) || 0;
        cardAmount = parseFloat(document.getElementById('cardPayment').value) || 0;
        
        // Validate payment
        if (Math.abs((cashAmount + cardAmount) - totalPrice) > 0.01) {
            alert(`Payment total doesn't match rental price`);
            return;
        }

        try {
            // Update local balances
            totalCashBalance += cashAmount;
            totalCardBalance += cardAmount;
            updateBalanceDisplay();

            // Send payment to cash register API
            await fetch('https://ubanze.bsite.net/api/Cashreg', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    cash: cashAmount,
                    card: cardAmount
                })
            });
        } catch (error) {
            console.error('Payment processing failed:', error);
            alert('Payment failed. Please try again.');
            return;
        }
    }

    // Create purchase data for API
    const purchaseData = {
        date: new Date().toISOString(),
        type: getStationType(selectedCard),
        duration: formatDurationForAPI(totalSeconds),
        price: parseFloat(totalPrice.toFixed(2)),
        itemsPurchased: 0
    };

    // Store in session
    activeSessions[cardId] = {
        startTime: Date.now(),
        totalDuration: totalSeconds,
        elapsedSeconds: 0,
        timeLeft: totalSeconds,
        rentalType: rentalType,
        isFixedRental: true,
        pricePerHour: pricePerHour,
        price: totalPrice,
        payLater: payLater,
        cashAmount: cashAmount,
        cardAmount: cardAmount,
        purchases: [],
        isCompleted: false,
        purchaseData: purchaseData,
        isPaused: false,
        pauseStartTime: null, // When the session was paused
        totalPausedTime: 0,
    };

    // Send to purchase API
    try {
        await sendPurchaseData(purchaseData);
    } catch (error) {
        console.error('Failed to send purchase data:', error);
        // Continue even if API fails
    }
   
    // Start the session
    renderActiveSession(selectedCard, activeSessions[cardId]);
    startTimer(totalSeconds, selectedCard, rentalType, pricePerHour, true, payLater);
    closePopup();
    saveState();

    alert(`Fixed rental started successfully!`);
}

function updateFixedRentalPrice() {
    const selectedOption = document.querySelector('#rentalType option:checked');
    if (!selectedOption) return;
    
    const pricePerHour = parseFloat(selectedOption.dataset.price);
    const timeInput = document.getElementById('timeInput').value;
    
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
    if (timeRegex.test(timeInput)) {
        const [hours, minutes] = timeInput.split(':').map(Number);
        const totalPrice = (hours + (minutes / 60)) * pricePerHour;
        
        document.getElementById('totalPrice').value = `${totalPrice.toFixed(2)}₾`;
        document.getElementById('cashPayment').value = (totalPrice / 2).toFixed(2);
        document.getElementById('cardPayment').value = (totalPrice / 2).toFixed(2);
        updatePaymentTotalFixed();
    }
}

function updatePaymentTotalFixed() {
    const cashAmount = parseFloat(document.getElementById('cashPayment').value) || 0;
    const cardAmount = parseFloat(document.getElementById('cardPayment').value) || 0;
    const totalPrice = parseFloat(document.getElementById('totalPrice').value.replace('₾', '')) || 0;
    
    const paymentTotal = cashAmount + cardAmount;
    document.getElementById('paymentTotal').textContent = `Total: ₾ ${paymentTotal.toFixed(2)}`;
    
    // Highlight if payment doesn't match total price
    if (Math.abs(paymentTotal - totalPrice) > 0.01) {
        document.getElementById('paymentTotal').classList.add('payment-mismatch');
    } else {
        document.getElementById('paymentTotal').classList.remove('payment-mismatch');
    }
}

function showMimdinareOptions() {
    const popup = document.getElementById('popup');
    const cardGrid = selectedCard.closest('.card-grid');
    const categoryTitle = cardGrid.previousElementSibling;
    let category = categoryTitle.textContent.trim().toLowerCase();
    
    // Map Georgian category names to their English keys
    const categoryMap = {
        'ps5 premium': 'ps5-premium',
        'ps5': 'ps5',
        'vip': 'vip',
        'vip premium': 'vip-premium',  
        'საჭე': 'sache'
    };

    category = categoryMap[category] || category;
    const options = rentalOptions[category] || [];

    popup.innerHTML = `
        <h2>Mimdinare Rental</h2>
        <div class="form-group">
            <label>Rental Type:</label>
            <select id="rentalType" onchange="updateMimdinarePrice()">
                ${options.map(option => `
                    <option value="${option.label}" data-price="${option.price}">${option.label}</option>
                `).join('')}
            </select>
        </div>
        <div class="form-group">
            <label>Hourly Price:</label>
            <input type="text" id="hourlyPrice" value="0.00₾" readonly>
        </div>
        <div class="pay-later-container">
            <input type="checkbox" id="payLaterCheckbox" checked>
            <label for="payLaterCheckbox">Pay after session ends</label>
        </div>
        <div class="button-group">
            <button class="cancel-btn" onclick="closePopup()">Cancel</button>
            <button class="start-btn" onclick="startMimdinareRental()">Start</button>
        </div>
    `;

    // Initialize with default values
    updateMimdinarePrice();
}

async function startMimdinareRental() {
    
    if (!selectedCard) return;

    // Get form values
    const rentalType = document.querySelector('#rentalType').value;
    console.log(rentalType)
    const pricePerHour = parseFloat(document.querySelector('#rentalType option:checked').dataset.price);
    const payLater = document.getElementById('payLaterCheckbox').checked;
    const cardId = selectedCard.dataset.cardId;

    // Create initial purchase data for API
    const purchaseData = {
        date: new Date().toISOString(),
        type: getStationType(selectedCard),
        duration: "00:00:00",
        price: 0,
        itemsPurchased: 0
    };

    // Store in session
    activeSessions[cardId] = {
        startTime: Date.now(),
        totalDuration: 0,
        rentalType: rentalType,
        isFixedRental: false,
        pricePerHour: pricePerHour,
        price: 0,
        payLater: payLater,
        cashAmount: 0,
        cardAmount: 0,
        purchases: [],
        purchaseData: purchaseData,
        isPaused: false,
        pauseStartTime: null, // When the session was paused
        totalPausedTime: 0,
    };
    bool = false

    // Send to API
    try {
        await sendPurchaseData(purchaseData);
    } catch (error) {
        console.error('Failed to send initial purchase data:', error);
    }

    
    // Start the session
    renderActiveSession(selectedCard, activeSessions[cardId]);
    startTimer(0, selectedCard, rentalType, pricePerHour, false, payLater);
    closePopup();
    saveState();
  
    alert(`Mimdinare rental started. Time is now counting up.`);
}

function updateMimdinarePrice() {
    const selectedOption = document.querySelector('#rentalType option:checked');
    if (selectedOption) {
        const price = parseFloat(selectedOption.dataset.price);
        document.getElementById('hourlyPrice').value = `${price.toFixed(2)}₾`;
    }
}

function updatePrice() {
    const selectedOption = document.querySelector('#rentalType option:checked');
    const rentalType = selectedOption.value;
    const isFixedRental = rentalType === 'Mimdinare';
    
    if (selectedOption && !isFixedRental) {
        const price = parseFloat(selectedOption.dataset.price);
        const timeInput = document.getElementById('timeInput').value;
        
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
        if (timeRegex.test(timeInput)) {
            const [hours, minutes] = timeInput.split(':').map(Number);
            totalPrice = (hours + (minutes / 60)) * price;

            document.getElementById('hourlyPrice').value = `${price.toFixed(2)}₾`;
            // Initialize with 50/50 split
            document.getElementById('cashPayment').value = (totalPrice * 0.5).toFixed(2);
            document.getElementById('cardPayment').value = (totalPrice * 0.5).toFixed(2);
            updatePaymentTotal();
        }
    } else if (isFixedRental) {
        const fixedPrice = parseFloat(selectedOption.dataset.price);
        totalPrice = fixedPrice;
        document.getElementById('hourlyPrice').value = `${fixedPrice.toFixed(2)}₾`;
        document.getElementById('cashPayment').value = '0';
        document.getElementById('cardPayment').value = '0';
        updatePaymentTotal();
    }
}

function showTimeDropdown() {
    document.getElementById('timeDropdown').classList.add('active');
}

function handleTimeInput() {
    const timeInput = document.getElementById('timeInput');
    const timeDropdown = document.getElementById('timeDropdown');
    
    if (timeInput.value.length > 0) {
        timeDropdown.classList.add('active');
    } else {
        timeDropdown.classList.remove('active');
    }
    
    updateFixedRentalPrice();
}

function selectTimeOption(time) {
    document.getElementById('timeInput').value = time;
    document.getElementById('timeDropdown').classList.remove('active');
    updateFixedRentalPrice();
}

function togglePayLater() {
    const payLater = document.getElementById('payLaterCheckbox').checked;
    document.getElementById('paymentInputs').style.display = payLater ? 'none' : 'block';
}

function updateCashPayment() {
    const cardAmount = parseFloat(document.getElementById('cardPayment').value) || 0;
    const cashAmount = totalPrice - cardAmount;
    document.getElementById('cashPayment').value = cashAmount > 0 ? cashAmount.toFixed(2) : '0';
    updatePaymentTotal();
}

function updateCardPayment() {
    const cashAmount = parseFloat(document.getElementById('cashPayment').value) || 0;
    const cardAmount = totalPrice - cashAmount;
    document.getElementById('cardPayment').value = cardAmount > 0 ? cardAmount.toFixed(2) : '0';
    updatePaymentTotal();
}

function updatePaymentTotal() {
    const cashAmount = parseFloat(document.getElementById('cashPayment').value) || 0;
    const cardAmount = parseFloat(document.getElementById('cardPayment').value) || 0;
    const total = cashAmount + cardAmount;
    document.getElementById('paymentTotal').textContent = `Total: ₾ ${totalPrice.toFixed(2)}`;
    
    // Highlight if payment doesn't match total price
    if (Math.abs(total - totalPrice) > 0.01) {
        document.getElementById('paymentTotal').classList.add('payment-mismatch');
    } else {
        document.getElementById('paymentTotal').classList.remove('payment-mismatch');
    }
}

function closePopup() {
    document.getElementById('popup').style.display = 'none';
    document.getElementById('popupOverlay').style.display = 'none';
}

function updateShopPaymentSplit() {
    const total = shopCart.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const cashAmount = parseFloat(document.getElementById('shopCashAmount').value) || 0;
    const cardAmount = parseFloat(document.getElementById('shopCardAmount').value) || 0;
    const totalEntered = cashAmount + cardAmount;
    
    if (Math.abs(totalEntered - total) > 0.01) {
        document.getElementById('shopCardAmount').value = (total - cashAmount).toFixed(2);
    }
    
    document.getElementById('shopTotal').textContent = `Total: ₾ ${total.toFixed(2)}`;
}

async function updateBalanceDisplay() {
    try {
        const response = await fetch('https://ubanze.bsite.net/api/Cashreg');
        if (!response.ok) throw new Error('Failed to fetch balances');
        
        const balanceData = await response.json();
        
        // Update local variables from API response
        totalCashBalance = balanceData.cash;
        totalCardBalance = balanceData.card;
        
        // Update UI
        document.getElementById('cash-balance').textContent = `₾ ${totalCashBalance.toFixed(2)}`;
        document.getElementById('card-balance').textContent = `₾ ${totalCardBalance.toFixed(2)}`;
        document.getElementById('total-balance').textContent = `Total: ₾ ${(totalCashBalance + totalCardBalance).toFixed(2)}`;
        
        // Update localStorage to match API
        localStorage.setItem('cashBalance', totalCashBalance);
        localStorage.setItem('cardBalance', totalCardBalance);
        
        return balanceData;
    } catch (error) {
        console.error('Balance update failed:', error);
        // Fallback to localStorage values
        totalCashBalance = parseFloat(localStorage.getItem('cashBalance')) || 0;
        totalCardBalance = parseFloat(localStorage.getItem('cardBalance')) || 0;
        
        document.getElementById('cash-balance').textContent = `₾ ${totalCashBalance.toFixed(2)}`;
        document.getElementById('card-balance').textContent = `₾ ${totalCardBalance.toFixed(2)}`;
        document.getElementById('total-balance').textContent = `Total: ₾ ${(totalCashBalance + totalCardBalance).toFixed(2)}`;
        
        throw error;
    }
}

function toggleDropdown(id) {
    const content = document.getElementById(id);
    content.classList.toggle('active');
}

function openShopWindow(button) {
    currentShopCardId = button.closest('.card').dataset.cardId;
    document.getElementById('shopWindow').style.display = 'block';
    document.getElementById('shopOverlay').style.display = 'block';
    populateShopItems();
}

function closeShopWindow() {
    document.getElementById('shopWindow').style.display = 'none';
    document.getElementById('shopOverlay').style.display = 'none';
    shopCart = [];
    currentShopCardId = null;
}

async function populateShopItems() {
    const shopItemsContainer = document.getElementById('shopItemsContainer');
    shopItemsContainer.innerHTML = 'Loading products...';

    try {
        const response = await fetch('https://ubanze.bsite.net/api/products/all');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const products = await response.json();
        
        // Clear the container
        shopItemsContainer.innerHTML = '';
        
        // Create shop items for each product
        products.forEach(product => {
            const shopItem = document.createElement('div');
            shopItem.classList.add('shop-item');
            shopItem.innerHTML = `
                <div class="shop-item-details">
                    <div class="shop-item-name">${product.name}</div>
                    <div class="shop-item-price">₾ ${product.price.toFixed(2)}</div>
                </div>
                <div class="shop-item-controls">
                    <div class="quantity-control" onclick="decreaseQuantity('${product.name}')">-</div>
                    <div class="quantity-display" id="quantity-${product.name}">0</div>
                    <div class="quantity-control" onclick="increaseQuantity('${product.name}')">+</div>
                </div>
            `;
            shopItemsContainer.appendChild(shopItem);
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        shopItemsContainer.innerHTML = 'Failed to load products. Please try again.';
    }
}

function increaseQuantity(itemName) {
    const quantityDisplay = document.getElementById(`quantity-${itemName}`);
    let quantity = parseInt(quantityDisplay.textContent) || 0;
    quantity++;
    quantityDisplay.textContent = quantity;
    updateShopCart(itemName, quantity);
}

function decreaseQuantity(itemName) {
    const quantityDisplay = document.getElementById(`quantity-${itemName}`);
    let quantity = parseInt(quantityDisplay.textContent) || 0;
    if (quantity > 0) {
        quantity--;
        quantityDisplay.textContent = quantity;
        updateShopCart(itemName, quantity);
    }
}

function updateShopCart(itemName, quantity) {
    const itemIndex = shopCart.findIndex(item => item.name === itemName);
    
    if (itemIndex !== -1) {
        if (quantity > 0) {
            shopCart[itemIndex].quantity = quantity;
        } else {
            shopCart.splice(itemIndex, 1);
        }
    } else if (quantity > 0) {
        // Find the price from the displayed items (since we don't have local stockData anymore)
        const shopItems = document.querySelectorAll('.shop-item');
        let price = 0;
        
        shopItems.forEach(item => {
            const nameElement = item.querySelector('.shop-item-name');
            if (nameElement && nameElement.textContent === itemName) {
                const priceText = item.querySelector('.shop-item-price').textContent;
                price = parseFloat(priceText.replace('₾', '').trim());
            }
        });
        
        if (price > 0) {
            shopCart.push({ 
                name: itemName, 
                quantity: quantity, 
                price: price 
            });
        }
    }
    
    updateShopTotal();
}

function updateShopTotal() {
    const total = shopCart.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    document.getElementById('shopTotal').textContent = `Total: ₾ ${total.toFixed(2)}`;
    
    if (document.querySelector('input[name="shopPaymentType"]:checked').value === 'both') {
        document.getElementById('shopCashAmount').value = total.toFixed(2);
        document.getElementById('shopCardAmount').value = '0';
    }
}

function filterShopItems() {
    const searchInput = document.getElementById('shopSearchInput').value.toLowerCase();
    const shopItems = document.querySelectorAll('.shop-item');
    shopItems.forEach(item => {
        const itemName = item.querySelector('.shop-item-name').textContent.toLowerCase();
        if (itemName.includes(searchInput)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

function openEndDayPopup() {
    document.getElementById('endDayPopup').style.display = 'block';
    document.getElementById('endDayOverlay').style.display = 'block';
}

function closeEndDayPopup() {
    document.getElementById('endDayPopup').style.display = 'none';
    document.getElementById('endDayOverlay').style.display = 'none';
}

async function confirmEndDay() {
    const cashToLeave = parseFloat(document.getElementById('cashToLeave').value) || 0;
    const username = localStorage.getItem('username') || 'unknown';
    
    // Validate input
    if (cashToLeave > totalCashBalance) {
        alert('You cannot leave more cash than the current balance.');
        return;
    }

    try {
        // Calculate amounts
        const cashTaken = totalCashBalance - cashToLeave;
        
        // Get current date in Georgian time (UTC+4)
        const now = new Date();
        // Add 4 hours to get Georgian time
        const georgianTime = new Date(now.getTime() + (4 * 60 * 60 * 1000));
        // Format as ISO string (this will show UTC time with +4 hours)
        const currentDate = georgianTime.toISOString();
        
        // Format for display in Georgian time
        const formattedDate = georgianTime.toLocaleString('en-GE', {
            timeZone: 'Asia/Tbilisi',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).replace(',', '');

        // Prepare the request data
        const requestData = {
            isEndDay: true,
            editedObject: "cash",
            cardBefore: totalCardBalance,
            cardAfter: 0,
            cashBefore: totalCashBalance,
            cashAfter: cashToLeave,
            operationDate: currentDate,
            username: username,
            amountDifference: cashTaken,
            createdAt: currentDate,
            modifiedAt: currentDate,
            notes: `End of day processing at ${formattedDate} (Georgia Time)`
        };

        // 1. Make API request to end day endpoint
        const response = await fetch('https://ubanze.bsite.net/api/EndOrEdit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        // 2. Make API request to reset balances
        const resetResponse = await fetch('https://ubanze.bsite.net/api/cashreg/reset-add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount: cashToLeave
            })
        });

        if (!resetResponse.ok) {
            throw new Error(`Reset API Error: ${resetResponse.status}`);
        }

        // 3. Update local balances
        totalCashBalance = cashToLeave;
        totalCardBalance = 0;

        // 4. Save to history
        saveHistoryEntry({
            timestamp: now.getTime(), // Store actual UTC timestamp
            type: 'End Day',
            cashLeft: cashToLeave,
            cashTaken: cashTaken,
            cardReset: true,
            apiConfirmed: true,
            requestData: requestData,
            georgianTime: formattedDate
        });

        // 5. Update UI
        updateBalanceDisplay();
        closeEndDayPopup();

        alert(`End of day processed successfully!\n${formattedDate} (Georgia Time)`);

    } catch (error) {
        console.error('End Day Error:', error);
        alert(`Failed to complete end of day: ${error.message}`);
    }
}

async function completeShopPurchase(cashAmount, cardAmount) {
    // Update local balances
    totalCashBalance += cashAmount;
    totalCardBalance += cardAmount;
    updateBalanceDisplay();

    try {
        // Make API call to update cash register
        const response = await fetch('https://ubanze.bsite.net/api/Cashreg', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                cash: cashAmount,
                card: cardAmount
            })
        });

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        return true;
    } catch (error) {
        console.error('Error updating cash register:', error);
        // Revert local balances if API call fails
        totalCashBalance -= cashAmount;
        totalCardBalance -= cardAmount;
        updateBalanceDisplay();
        throw error;
    }
}

function openEditBalancePopup() {
    document.getElementById('editBalancePopup').style.display = 'block';
    document.getElementById('editBalanceOverlay').style.display = 'block';
}

function closeEditBalancePopup() {
    document.getElementById('editBalancePopup').style.display = 'none';
    document.getElementById('editBalanceOverlay').style.display = 'none';
}

async function processCardPayment(amount, description) {
    if (amount <= 0) return { success: true };

    try {
        const response = await fetch('https://ubanze.bsite.net/api/Payment/card', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
            },
            body: JSON.stringify({
                amount: amount,
                description: description
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Card payment failed');
        }

        return { success: true, data: await response.json() };
    } catch (error) {
        console.error('Card payment error:', error);
        throw error;
    }
}

function validateSplitPayment() {
    const total = shopCart.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const cashAmount = parseFloat(document.getElementById('shopCashAmount').value) || 0;
    const cardAmount = parseFloat(document.getElementById('shopCardAmount').value) || 0;
    const remaining = total - (cashAmount + cardAmount);

    document.getElementById('splitPaymentSummary').textContent = 
        `Total: ₾${total.toFixed(2)} (Remaining: ₾${remaining.toFixed(2)})`;

    if (remaining > 0.01) {
        document.getElementById('splitPaymentSummary').style.color = 'red';
    } else if (remaining < -0.01) {
        document.getElementById('splitPaymentSummary').style.color = 'orange';
    } else {
        document.getElementById('splitPaymentSummary').style.color = 'green';
    }
}

async function saveBalance() {
    const balanceType = document.getElementById('balanceType').value;
    const newAmount = parseFloat(document.getElementById('newBalanceAmount').value) || 0;
    const username = localStorage.getItem('username') || 'unknown';

    try {
        // Get current balances
        const currentBalances = await fetch('https://ubanze.bsite.net/api/Cashreg').then(res => res.json());
        
        // Calculate differences
        const beforeValue = balanceType === 'cash' ? totalCashBalance : totalCardBalance;
        const afterValue = newAmount;
        const difference = afterValue - beforeValue;

        // Get Georgian time (UTC+4)
        const now = new Date();
        const georgianTime = new Date(now.getTime() + (4 * 60 * 60 * 1000));
        const currentDate = georgianTime.toISOString();

        // Prepare API data
        const requestData = {
            isEndDay: false,
            editedObject: balanceType, // "cash" or "card"
            cardBefore: balanceType === 'card' ? beforeValue : totalCardBalance,
            cardAfter: balanceType === 'card' ? afterValue : totalCardBalance,
            cashBefore: balanceType === 'cash' ? beforeValue : totalCashBalance,
            cashAfter: balanceType === 'cash' ? afterValue : totalCashBalance,
            operationDate: currentDate,
            username: username,
            amountDifference: difference,
            createdAt: currentDate,
            modifiedAt: currentDate,
            notes: `${balanceType} balance edited from ${beforeValue.toFixed(2)} to ${afterValue.toFixed(2)}`
        };

        console.log("Sending edit request:", requestData);

        // 1. Send to history API
        const historyResponse = await fetch('https://ubanze.bsite.net/api/EndOrEdit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
            },
            body: JSON.stringify(requestData)
        });

        if (!historyResponse.ok) {
            throw new Error(`History API error: ${historyResponse.status}`);
        }

        // 2. Update the actual balance
        const endpoint = balanceType === 'cash' 
            ? 'https://ubanze.bsite.net/api/cashreg/update-cash' 
            : 'https://ubanze.bsite.net/api/cashreg/update-card';

        const updateResponse = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
            },
            body: JSON.stringify({
                amount: newAmount
            })
        });

        if (!updateResponse.ok) {
            throw new Error(`Update API error: ${updateResponse.status}`);
        }

        // Update local state
        if (balanceType === 'cash') {
            totalCashBalance = newAmount;
        } else {
            totalCardBalance = newAmount;
        }

        updateBalanceDisplay();
        closeEditBalancePopup();

        alert(`ბალანსი წარმატებით განახლდა!\n` +
              `${balanceType === 'cash' ? 'ნაღდი ფული' : 'ბარათი'}: ${beforeValue.toFixed(2)}₾ → ${afterValue.toFixed(2)}₾`);

    } catch (error) {
        console.error('Balance edit error:', error);
        alert(`ბალანსის განახლების შეცდომა: ${error.message}`);
    }
}

document.getElementById('cashPayment').addEventListener('input', updateCardPayment);
document.getElementById('cardPayment').addEventListener('input', updateCashPayment);

window.addEventListener('beforeunload', function() {
    saveState();
});

function logPurchase(items, total) {
    const historyData = JSON.parse(localStorage.getItem('historyData')) || [];
    historyData.push({
        timestamp: new Date().toISOString(),
        type: 'Shop Purchase',
        price: total,
        items: items.filter(item => item.quantity > 0).map(item => ({
            name: item.name,
            quantity: item.quantity
        }))
    });
    localStorage.setItem('historyData', JSON.stringify(historyData));
}

function processPayment() {
    const items = [
        { name: "Cappy", quantity: 2 },
        { name: "Fuse tea", quantity: 1 }
    ];
    const total = 10.50;
    logPurchase(items, total);
    alert("Purchase logged!");
}

function updateRentalOptions() {
    const rentalTypeSelect = document.getElementById('rentalType');
    rentalTypeSelect.innerHTML = '';

    const category = selectedCard.closest('.dropdown-content').id.replace('-dropdown', '');
    const options = rentalOptions[category] || [];

    options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.label;
        optionElement.textContent = option.label;
        optionElement.dataset.price = option.price;
        rentalTypeSelect.appendChild(optionElement);
    });
}

async function sendPurchaseData(purchaseData) {
    try {
        // Create the request data in the exact format the API expects
        const requestData = {
            date: purchaseData.date || new Date().toISOString(),
            type: purchaseData.type || 'unknown', // Make sure this matches the API's expected types
            duration: purchaseData.duration || "00:00:00", // Keep as string in HH:MM:SS format
            price: purchaseData.price || 0, // Number
            itemsPurchased: purchaseData.itemsPurchased || 0 // Number
        };

        console.log("Sending to API:", JSON.stringify(requestData, null, 2));

        const response = await fetch('https://ubanze.bsite.net/api/Purchase', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData) // Send the object directly, not wrapped in array
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("API Error:", errorText);
            throw new Error(`API Error: ${errorText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Purchase failed:', error);
        throw error;
    }
}

function getStationType(card) {
    if (!card) return 'unknown';
    
    const cardGrid = card.closest('.card-grid');
    if (!cardGrid) return 'unknown';
    
    const categoryTitle = cardGrid.previousElementSibling;
    if (!categoryTitle) return 'unknown';
    
    const category = categoryTitle.textContent.trim().toLowerCase();
    
    // Map UI categories to API expected values
    const typeMap = {
       'ps5': 'ps5',
        'vip': 'vip',
        'vip premium': 'vip-premium',  // This is the key fix
        'საჭე': 'sache',
        'shop': 'shop'
    };
    
    return typeMap[category] || 'unknown';
}

function updateStockItems() {
    const shopItemsContainer = document.getElementById('shopItemsContainer');
    shopItemsContainer.innerHTML = '';

    stockData.forEach(item => {
        const shopItem = document.createElement('div');
        shopItem.classList.add('shop-item');
        shopItem.innerHTML = `
            <div class="shop-item-details">
                <div class="shop-item-name">${item.item}</div>
                <div class="shop-item-price">₾ ${item.price.toFixed(2)}</div>
            </div>
            <div class="shop-item-controls">
                <div class="quantity-control" onclick="decreaseQuantity('${item.item}')">-</div>
                <div class="quantity-display" id="quantity-${item.item}">0</div>
                <div class="quantity-control" onclick="increaseQuantity('${item.item}')">+</div>
            </div>
        `;
        shopItemsContainer.appendChild(shopItem);
    });
}

window.addEventListener('storage', function (event) {
    if (event.key === 'rentalOptions') {
        rentalOptions = JSON.parse(event.newValue);
        updateRentalOptions();
    }
    if (event.key === 'stockData') {
        stockData = JSON.parse(event.newValue);
        updateStockItems();
    }
});

updateRentalOptions();
updateStockItems();