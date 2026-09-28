// Configuration
const API_KEY = 'REMOVED_FOR_SECURITY';
const TICKERS = ['SPY', 'QQQ', 'DIA'];
const CACHE_KEY_PREFIX = 'market_terminal_';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// DOM Elements
const tickerGrid = document.getElementById('ticker-grid');
const lastUpdatedEl = document.getElementById('last-updated');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    updateTimestamp();
    fetchMarketData();
});

function updateTimestamp() {
    const now = new Date();
    lastUpdatedEl.textContent = `UPDATED: ${now.toLocaleTimeString()}`;
}

async function fetchMarketData() {
    tickerGrid.innerHTML = ''; // Clear loading message
    
    for (const symbol of TICKERS) {
        try {
            const data = await getTickerData(symbol);
            renderTickerCard(symbol, data);
        } catch (error) {
            console.error(`Error fetching ${symbol}:`, error);
            renderErrorCard(symbol, error.message);
        }
    }
    
    updateTimestamp();
}

async function getTickerData(symbol) {
    // Check cache first
    const cacheKey = `${CACHE_KEY_PREFIX}${symbol}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
        const { timestamp, data } = JSON.parse(cached);
        const age = Date.now() - timestamp;
        
        if (age < CACHE_DURATION) {
            console.log(`[CACHE] Using cached data for ${symbol}`);
            return data;
        }
    }
    
    // Fetch new data
    console.log(`[API] Fetching new data for ${symbol}`);
    
    // Using Global Quote endpoint
    // Note: Alpha Vantage free tier is limited to 5 calls per minute, 500 per day.
    // We are fetching 3 tickers, so we should be fine, but concurrent requests might hit the per-minute limit.
    // Adding a small delay might be wise if we had more tickers.
    
    try {
        const response = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`);
        const json = await response.json();
        
        if (json['Note']) {
            // Rate limit hit
            console.warn("API Rate Limit Exceeded:", json['Note']);
            throw new Error("Rate Limit Exceeded");
        }
        
        if (json['Error Message']) {
            throw new Error("Invalid Symbol");
        }
        
        const quote = json['Global Quote'];
        
        if (!quote || Object.keys(quote).length === 0) {
            // Sometimes API returns empty object if rate limited silently or no data
            throw new Error("No Data Available");
        }
        
        const data = {
            price: parseFloat(quote['05. price']),
            open: parseFloat(quote['02. open']),
            high: parseFloat(quote['03. high']),
            low: parseFloat(quote['04. low']),
            change: parseFloat(quote['09. change']),
            changePercent: quote['10. change percent'],
            volume: parseInt(quote['06. volume']),
            prevClose: parseFloat(quote['08. previous close'])
        };
        
        // Save to cache
        localStorage.setItem(cacheKey, JSON.stringify({
            timestamp: Date.now(),
            data: data
        }));
        
        return data;
    } catch (e) {
        // If fetch fails (network), try to use stale cache if available
        if (cached) {
            console.warn(`[NETWORK ERROR] Using stale cache for ${symbol} due to error:`, e);
            const { data } = JSON.parse(cached);
            return data;
        }
        throw e;
    }
}

function renderTickerCard(symbol, data) {
    const isPositive = data.change >= 0;
    const colorClass = isPositive ? 'change-positive' : 'change-negative';
    const arrow = isPositive ? '▲' : '▼';
    const sign = isPositive ? '+' : '';
    
    const card = document.createElement('div');
    card.className = 'ticker-card';
    
    // Ticker header
    const header = document.createElement('div');
    header.className = 'ticker-header';
    
    const symbolSpan = document.createElement('span');
    symbolSpan.className = 'symbol';
    symbolSpan.textContent = symbol;
    
    const arrowSpan = document.createElement('span');
    arrowSpan.className = colorClass;
    arrowSpan.style.fontSize = '1.2em';
    arrowSpan.textContent = arrow;
    
    header.appendChild(symbolSpan);
    header.appendChild(arrowSpan);
    
    // Price
    const price = document.createElement('div');
    price.className = 'price';
    price.textContent = `$${data.price.toFixed(2)}`;
    
    // Change container
    const changeContainer = document.createElement('div');
    changeContainer.className = 'change-container';
    
    const changeValue = document.createElement('span');
    changeValue.className = `change-value ${colorClass}`;
    changeValue.textContent = `${sign}${data.change.toFixed(2)} (${sign}${data.changePercent})`;
    
    changeContainer.appendChild(changeValue);
    
    // Volume
    const volume = document.createElement('span');
    volume.className = 'volume-label';
    volume.textContent = `VOL: ${data.volume.toLocaleString()}`;
    
    // Price range container
    const rangeContainer = document.createElement('div');
    rangeContainer.style.marginTop = '10px';
    rangeContainer.style.fontSize = '10px';
    rangeContainer.style.color = 'var(--dim-color)';
    rangeContainer.style.display = 'grid';
    rangeContainer.style.gridTemplateColumns = '1fr 1fr';
    rangeContainer.style.gap = '8px';
    
    // Open
    const openDiv = document.createElement('div');
    openDiv.textContent = `O: $${data.open.toFixed(2)}`;
    
    // High
    const highDiv = document.createElement('div');
    highDiv.textContent = `H: $${data.high.toFixed(2)}`;
    
    // Low
    const lowDiv = document.createElement('div');
    lowDiv.textContent = `L: $${data.low.toFixed(2)}`;
    
    // Previous close
    const prevCloseDiv = document.createElement('div');
    prevCloseDiv.textContent = `P: $${data.prevClose.toFixed(2)}`;
    
    rangeContainer.appendChild(openDiv);
    rangeContainer.appendChild(highDiv);
    rangeContainer.appendChild(lowDiv);
    rangeContainer.appendChild(prevCloseDiv);
    
    card.appendChild(header);
    card.appendChild(price);
    card.appendChild(changeContainer);
    card.appendChild(volume);
    card.appendChild(rangeContainer);
    
    tickerGrid.appendChild(card);
}

function renderErrorCard(symbol, message) {
    const card = document.createElement('div');
    card.className = 'ticker-card';
    card.style.borderColor = 'var(--alert-color)';
    card.style.boxShadow = 'none';
    
    // Ticker header
    const header = document.createElement('div');
    header.className = 'ticker-header';
    
    const symbolSpan = document.createElement('span');
    symbolSpan.className = 'symbol';
    symbolSpan.textContent = symbol;
    
    const alertSpan = document.createElement('span');
    alertSpan.style.color = 'var(--alert-color)';
    alertSpan.textContent = '!';
    
    header.appendChild(symbolSpan);
    header.appendChild(alertSpan);
    
    // Error label
    const errorLabel = document.createElement('div');
    errorLabel.style.color = 'var(--alert-color)';
    errorLabel.style.fontSize = '12px';
    errorLabel.style.marginTop = '10px';
    errorLabel.style.fontWeight = 'bold';
    errorLabel.textContent = 'ERROR';
    
    // Error message
    const errorMessage = document.createElement('div');
    errorMessage.style.marginTop = '5px';
    errorMessage.style.fontSize = '11px';
    errorMessage.style.color = 'var(--dim-color)';
    errorMessage.textContent = message;
    
    // Unavailable notice
    const unavailable = document.createElement('div');
    unavailable.style.marginTop = '15px';
    unavailable.style.fontSize = '10px';
    unavailable.style.color = 'var(--dim-color)';
    unavailable.style.borderTop = '1px dashed var(--dim-color)';
    unavailable.style.paddingTop = '5px';
    unavailable.textContent = 'Data unavailable';
    
    card.appendChild(header);
    card.appendChild(errorLabel);
    card.appendChild(errorMessage);
    card.appendChild(unavailable);
    
    tickerGrid.appendChild(card);
}

// Auto-refresh logic (Commented out as per requirements)
/*
setInterval(() => {
    console.log("Refreshing data...");
    fetchMarketData();
}, 60000); // 1 minute refresh
*/
