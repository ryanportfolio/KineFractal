# Market Terminal v1.0

A retro-styled stock ticker dashboard built with vanilla JavaScript.

## Features
- Live market data via Alpha Vantage API (SPY, QQQ, DIA)
- Matrix/Terminal aesthetic with CRT scanline effects
- Local caching (5 min) to preserve API limits
- Responsive grid layout
- Pure vanilla JS, HTML, CSS (No frameworks)

## Setup
This is a static HTML page served from the public directory.
Access it directly at:
`/ticker/index.html`

## Configuration
Edit `ticker.js` to modify:
- `TICKERS`: Array of symbols to track
- `API_KEY`: Alpha Vantage API key
- `CACHE_DURATION`: Caching time in ms

## Limits
- Uses the free tier of Alpha Vantage (25 requests/day, 5 requests/minute).
- Data is delayed by 15 minutes.
- Caching is implemented to prevent rate limiting.
