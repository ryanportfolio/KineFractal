#!/usr/bin/env python3
"""
USD Correlation Calculator
Calculates rolling price correlations between various assets and UUP (USD proxy)
using yfinance data. Outputs JSON to stdout.
"""

import json
import sys
import warnings
from datetime import datetime, timedelta

warnings.filterwarnings('ignore')

import numpy as np
import pandas as pd
import yfinance as yf


def fetch_data():
    """Fetch 2 years of adjusted close data from yfinance."""
    tickers = {
        'USD': 'UUP',
        'SPX': 'SPY',
        'BRENT Oil': 'BNO',
        'CRB Index': 'DBC',
        'GOLD': 'GLD',
        'Bitcoin': 'BTC-USD'
    }
    
    end_date = datetime.now()
    start_date = end_date - timedelta(days=730)
    start_str = start_date.strftime('%Y-%m-%d')
    
    print(f"Fetching data from {start_str}...", file=sys.stderr)
    
    data = yf.download(
        list(tickers.values()), 
        start=start_str, 
        progress=False, 
        auto_adjust=False,
        threads=True
    )
    
    if 'Adj Close' in data.columns:
        df = data['Adj Close'].copy()
    else:
        df = data['Close'].copy()
    
    inv_tickers = {v: k for k, v in tickers.items()}
    df.rename(columns=inv_tickers, inplace=True)
    
    return df, tickers


def get_latest_metrics(df, target_col, base_col='USD'):
    """Calculate correlation metrics for a target asset vs USD."""
    pair = df[[target_col, base_col]].dropna()
    
    if len(pair) < 30:
        return None
    
    metrics = {}
    
    windows = [15, 30, 90, 120, 180]
    rolling_correlations = {}
    
    for w in windows:
        if len(pair) >= w:
            rolling_corr = pair[target_col].rolling(window=w).corr(pair[base_col])
            rolling_correlations[w] = rolling_corr
            val = rolling_corr.iloc[-1]
            metrics[f'{w}D'] = float(val) if not np.isnan(val) else None
        else:
            metrics[f'{w}D'] = None

    all_high = []
    all_low = []
    for w, rolling_corr in rolling_correlations.items():
        last_year = rolling_corr.tail(252).dropna()
        if len(last_year) > 0:
            all_high.append(float(last_year.max()))
            all_low.append(float(last_year.min()))
    
    if all_high and all_low:
        metrics['high52W'] = max(all_high)
        metrics['low52W'] = min(all_low)
    else:
        metrics['high52W'] = 0
        metrics['low52W'] = 0
    
    rolling_30d = rolling_correlations.get(30)
    if rolling_30d is not None:
        last_year_30d = rolling_30d.tail(252).dropna()
        if len(last_year_30d) > 0:
            pos_count = (last_year_30d > 0).sum()
            neg_count = (last_year_30d < 0).sum()
            total = len(last_year_30d)
            metrics['pctPos'] = round((pos_count / total) * 100) if total > 0 else 50
            metrics['pctNeg'] = round((neg_count / total) * 100) if total > 0 else 50
        else:
            metrics['pctPos'] = 50
            metrics['pctNeg'] = 50
    else:
        metrics['pctPos'] = 50
        metrics['pctNeg'] = 50
    
    return metrics


def main():
    try:
        df, tickers = fetch_data()
        
        if df.empty:
            raise Exception("No data returned from yfinance")
        
        as_of = df.index[-1].strftime('%Y-%m-%d')
        
        metrics_list = ['SPX', 'BRENT Oil', 'CRB Index', 'GOLD', 'Bitcoin']
        ticker_map = {
            'SPX': 'SPY',
            'BRENT Oil': 'BNO',
            'CRB Index': 'DBC',
            'GOLD': 'GLD',
            'Bitcoin': 'BTCUSD'
        }
        
        correlations = []
        
        for m in metrics_list:
            if m in df.columns:
                stats = get_latest_metrics(df, m)
                if stats:
                    correlations.append({
                        'metric': m,
                        'ticker': ticker_map.get(m, m),
                        '15D': stats['15D'],
                        '30D': stats['30D'],
                        '90D': stats['90D'],
                        '120D': stats['120D'],
                        '180D': stats['180D'],
                        'high52W': stats['high52W'],
                        'low52W': stats['low52W'],
                        'pctPos': stats['pctPos'],
                        'pctNeg': stats['pctNeg']
                    })
        
        pair = df[['SPX', 'USD']].dropna()
        data_points = len(pair)
        
        result = {
            'success': True,
            'asOf': as_of,
            'dataPoints': data_points,
            'correlations': correlations
        }
        
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        error_result = {
            'success': False,
            'error': str(e)
        }
        print(json.dumps(error_result))
        sys.exit(1)


if __name__ == '__main__':
    main()
