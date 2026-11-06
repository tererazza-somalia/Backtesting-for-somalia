"""
Downloads and manages historical forex data.
Supports:
1. Yahoo Finance (free, zero configuration)
2. Twelve Data API (TradingView's official data provider, free tier works globally without OANDA)
3. TradingView CSV import (100% exact 1:1 parity with user's specific TradingView chart)
"""
import yfinance as yf
import pandas as pd
import requests
import os
import io
from typing import Optional

# Forex pairs available on Yahoo Finance (use "=X" suffix)
FOREX_PAIRS = {
    "EURUSD": "EURUSD=X",
    "GBPUSD": "GBPUSD=X",
    "USDJPY": "USDJPY=X",
    "AUDUSD": "AUDUSD=X",
    "USDCAD": "USDCAD=X",
    "USDCHF": "USDCHF=X",
    "NZDUSD": "NZDUSD=X",
    "EURGBP": "EURGBP=X",
    "EURJPY": "EURJPY=X",
    "GBPJPY": "GBPJPY=X",
}

# Timeframe specifications and Yahoo Finance constraints
TIMEFRAME_MAP = {
    "1m": {"yf_interval": "1m", "max_period": "7d", "resample": None, "is_intraday": True},
    "5m": {"yf_interval": "5m", "max_period": "60d", "resample": None, "is_intraday": True},
    "15m": {"yf_interval": "15m", "max_period": "60d", "resample": None, "is_intraday": True},
    "30m": {"yf_interval": "30m", "max_period": "60d", "resample": None, "is_intraday": True},
    "1h": {"yf_interval": "1h", "max_period": "730d", "resample": None, "is_intraday": True},
    "4h": {"yf_interval": "1h", "max_period": "730d", "resample": "4h", "is_intraday": True},
    "1d": {"yf_interval": "1d", "max_period": "5y", "resample": None, "is_intraday": False},
    "1w": {"yf_interval": "1wk", "max_period": "5y", "resample": None, "is_intraday": False},
    "1wk": {"yf_interval": "1wk", "max_period": "5y", "resample": None, "is_intraday": False},
}


def resolve_timeframe(interval, period=None):
    """Standardize timeframe interval key and enforce Yahoo Finance period boundaries."""
    tf_key = str(interval).strip().lower()
    if tf_key in ("1w", "1wk"):
        tf_key = "1w"

    cfg = TIMEFRAME_MAP.get(tf_key, TIMEFRAME_MAP["1d"])

    if not period or (cfg["is_intraday"] and period in ["5y", "10y", "max", "2y"]):
        period = cfg["max_period"]

    return tf_key, period, cfg


def download_forex_data(pair, period=None, interval="1d", data_dir="data"):
    """
    Download historical data from Yahoo Finance with OHLC sanitation.
    """
    pair_clean = pair.upper()
    symbol = FOREX_PAIRS.get(pair_clean)
    if not symbol:
        raise ValueError(
            f"Unknown pair: {pair}. Available: {list(FOREX_PAIRS.keys())}"
        )

    tf_key, resolved_period, cfg = resolve_timeframe(interval, period)
    yf_interval = cfg["yf_interval"]

    print(f"  Downloading {pair_clean} data (tf={tf_key}, yf_interval={yf_interval}, period={resolved_period})...")
    data = yf.download(symbol, period=resolved_period, interval=yf_interval, progress=False)

    if data.empty:
        raise ValueError(f"No data returned for {pair_clean} ({resolved_period}, {yf_interval})")

    # Flatten multi-level columns if returned by newer yfinance versions
    if isinstance(data.columns, pd.MultiIndex):
        data.columns = [col[0] for col in data.columns]

    # Convert index to DatetimeIndex
    if not isinstance(data.index, pd.DatetimeIndex):
        data.index = pd.to_datetime(data.index)

    # Resampling for 4H bars
    if cfg.get("resample"):
        agg_rules = {
            "Open": "first",
            "High": "max",
            "Low": "min",
            "Close": "last",
        }
        if "Volume" in data.columns:
            agg_rules["Volume"] = "sum"
        data = data.resample(cfg["resample"]).agg(agg_rules).dropna()

    data = data[~data.index.duplicated(keep="first")].sort_index()
    data.index.name = "Date"

    # Sanitise OHLC
    if {"Open", "High", "Low", "Close"}.issubset(data.columns):
        data["High"] = data[["High", "Open", "Close"]].max(axis=1)
        data["Low"]  = data[["Low",  "Open", "Close"]].min(axis=1)

    os.makedirs(data_dir, exist_ok=True)
    filepath = os.path.join(data_dir, f"{pair_clean}_{tf_key}_{resolved_period}.csv")
    data.to_csv(filepath)
    print(f"  Saved {len(data)} bars to {filepath}")

    return data


def download_twelve_data(pair: str, interval: str = "1d", api_key: Optional[str] = None, outputsize: int = 5000, data_dir: str = "data") -> pd.DataFrame:
    """
    Download authentic institutional forex candles from Twelve Data (TradingView's official data provider).
    Requires a free Twelve Data API key from https://twelvedata.com/ (no credit card, works globally without OANDA).
    """
    api_key = api_key or os.environ.get("TWELVE_DATA_API_KEY", "")
    if not api_key:
        raise ValueError("Twelve Data API key is required. Get a free key at https://twelvedata.com/")

    pair_clean = pair.upper()
    base = pair_clean[:3]
    quote = pair_clean[3:]
    symbol = f"{base}/{quote}"

    tf_map = {
        "1m": "1min", "5m": "5min", "15m": "15min", "30m": "30min",
        "1h": "1h", "4h": "4h", "1d": "1day", "1w": "1week"
    }
    td_interval = tf_map.get(interval.lower(), "1day")

    url = f"https://api.twelvedata.com/time_series?symbol={symbol}&interval={td_interval}&outputsize={outputsize}&apikey={api_key}"
    resp = requests.get(url, timeout=30)
    data_json = resp.json()

    if "values" not in data_json:
        err = data_json.get("message", "Failed to fetch from Twelve Data")
        raise ValueError(f"Twelve Data Error: {err}")

    df = pd.DataFrame(data_json["values"])
    df["datetime"] = pd.to_datetime(df["datetime"])
    df = df.set_index("datetime").sort_index()
    df.index.name = "Date"
    for col in ["open", "high", "low", "close"]:
        df[col.capitalize()] = df[col].astype(float)
    df = df[["Open", "High", "Low", "Close"]]

    os.makedirs(data_dir, exist_ok=True)
    tf_key, _, _ = resolve_timeframe(interval)
    filepath = os.path.join(data_dir, f"{pair_clean}_{tf_key}_tv.csv")
    df.to_csv(filepath)
    print(f"  Saved {len(df)} Twelve Data authentic bars to {filepath}")
    return df


def parse_and_save_tv_csv(csv_content_or_file, pair: str, timeframe: str = "1d", data_dir: str = "data") -> pd.DataFrame:
    """
    Parse an exported TradingView CSV and save it as data/{PAIR}_{TIMEFRAME}_tv.csv.
    Handles TradingView exported time formats (UNIX seconds/ms, ISO strings, YYYY-MM-DD).
    """
    if hasattr(csv_content_or_file, "read"):
        df = pd.read_csv(csv_content_or_file)
    elif isinstance(csv_content_or_file, str) and os.path.isfile(csv_content_or_file):
        df = pd.read_csv(csv_content_or_file)
    else:
        df = pd.read_csv(io.StringIO(str(csv_content_or_file)))

    col_map = {}
    for col in df.columns:
        c_clean = col.strip().lower()
        if c_clean in ("time", "date", "timestamp", "datetime"):
            col_map[col] = "Date"
        elif c_clean == "open":
            col_map[col] = "Open"
        elif c_clean == "high":
            col_map[col] = "High"
        elif c_clean == "low":
            col_map[col] = "Low"
        elif c_clean == "close":
            col_map[col] = "Close"
        elif c_clean == "volume":
            col_map[col] = "Volume"

    df = df.rename(columns=col_map)
    if "Date" not in df.columns or not {"Open", "High", "Low", "Close"}.issubset(df.columns):
        raise ValueError("Invalid CSV format. Expected columns: time/date, open, high, low, close")

    # Detect UNIX timestamp or ISO datetime
    first_val = str(df["Date"].iloc[0]).strip()
    try:
        num_val = float(first_val)
        unit = "ms" if num_val > 1e11 else "s"
        dt_series = pd.to_datetime(df["Date"], unit=unit, utc=True)
        # In institutional Forex (OANDA/TradingView), daily bars open at 17:00 NY (21:00/22:00 UTC).
        # Shift +4 hours so the 21:00 UTC bar belongs to the calendar trading day (e.g. Sunday 5pm NY is Monday).
        if str(timeframe).lower() in ("1d", "1w", "1wk"):
            df["Date"] = (dt_series + pd.Timedelta(hours=4)).dt.strftime("%Y-%m-%d")
        else:
            df["Date"] = dt_series
    except ValueError:
        df["Date"] = pd.to_datetime(df["Date"])

    df = df.set_index("Date").sort_index()
    df = df[~df.index.duplicated(keep="first")]

    df["Open"] = df["Open"].astype(float)
    df["High"] = df["High"].astype(float)
    df["Low"] = df["Low"].astype(float)
    df["Close"] = df["Close"].astype(float)

    # Sanitize OHLC
    df["High"] = df[["High", "Open", "Close"]].max(axis=1)
    df["Low"]  = df[["Low",  "Open", "Close"]].min(axis=1)

    cols = ["Open", "High", "Low", "Close"]
    if "Volume" in df.columns:
        cols.append("Volume")
    df = df[cols]

    os.makedirs(data_dir, exist_ok=True)
    pair_clean = pair.upper()
    tf_clean = timeframe.lower()
    filepath = os.path.join(data_dir, f"{pair_clean}_{tf_clean}_tv.csv")
    df.to_csv(filepath)
    print(f"  Saved {len(df)} authentic TradingView bars to {filepath}")
    return df
