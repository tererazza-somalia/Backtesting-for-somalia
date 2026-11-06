"""
Core backtesting engine.
Engineered for exact 1:1 parity with TradingView's Strategy Tester and Pine Script v5.
Supports:
- TradingView ta.* indicator math (Wilder's RMA for RSI, SMA-seeded EMA, Bollinger Bands, MACD)
- Next Bar Open execution (process_orders_on_close=False, TradingView's default)
- Current Bar Close execution (process_orders_on_close=True)
- Forex Standard Lot sizing (1.0 Standard Lot = 100,000 units, $10/pip on EUR/USD), contracts, cash, % equity
- Zero-spread baseline (TradingView Strategy Tester default) & configurable slippage/spread
- Authentic TradingView CSV loader and Pine Script v5 script generator
"""
import pandas as pd
import numpy as np
import os
from dataclasses import dataclass, asdict, field
from typing import Optional, Tuple


# ──────────────────────────────────────────────────────
# DATA CLASSES
# ──────────────────────────────────────────────────────

@dataclass
class BacktestConfig:
    """Configuration for a single backtest run matching TradingView Strategy Properties."""
    pair: str                                    # e.g., "EURUSD"
    timeframe: str = "1d"                        # e.g., "1d", "1h"
    period: str = "5y"                           # data period: "1y", "2y", "5y"
    initial_capital: float = 10000.0             # starting balance in USD
    order_size_type: str = "lots"                # "lots" (100k units), "contracts", "cash", "percent_of_equity"
    order_size_value: float = 1.0                # e.g. 1.0 lot, or 100000 contracts, or $10000, or 100%
    risk_per_trade: float = 0.02                 # legacy fallback fraction (2%)
    process_orders_on_close: bool = False        # False = Open of next bar (TradingView default); True = Close of signal bar
    spread_pips: float = 0.0                     # spread in pips (0.0 matches TradingView default strategy tester)
    strategy_name: str = "sma_crossover"
    strategy_params: dict = field(default_factory=dict)
    cut_date: Optional[str] = None               # Optional cut-off date to hide future data (Bar Replay)


@dataclass
class Trade:
    """A single completed trade matching TradingView List of Trades."""
    trade_id: int
    type: str             # "LONG" or "SHORT"
    entry_date: str
    exit_date: str
    entry_price: float
    exit_price: float
    pnl: float            # profit/loss in account currency ($)
    pnl_pct: float        # profit/loss as percentage of initial capital
    bars_held: int        # how many bars the trade was open


@dataclass
class BacktestResult:
    """Full results from a backtest run matching TradingView Strategy Tester Performance Summary."""
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    total_profit: float
    total_profit_pct: float
    max_drawdown: float
    max_drawdown_pct: float
    profit_factor: float
    sharpe_ratio: float
    avg_trade_pnl: float
    avg_winner: float
    avg_loser: float
    best_trade: float
    worst_trade: float
    avg_bars_held: float
    equity_curve: list
    equity_dates: list
    trades: list


# ──────────────────────────────────────────────────────
# EXACT TRADINGVIEW TECHNICAL INDICATORS (ta.*)
# ──────────────────────────────────────────────────────

def calc_sma(series: pd.Series, period: int) -> pd.Series:
    """TradingView ta.sma: Simple Moving Average."""
    period = int(period)
    return series.rolling(window=period, min_periods=period).mean()


def calc_ema(series: pd.Series, period: int) -> pd.Series:
    """
    TradingView ta.ema:
    - Initial value at index (period - 1) is SMA of first 'period' values.
    - Subsequent values: EMA[i] = alpha * Price[i] + (1 - alpha) * EMA[i-1]
      where alpha = 2.0 / (period + 1.0).
    """
    period = int(period)
    n = len(series)
    if n < period:
        return pd.Series(np.nan, index=series.index)

    vals = series.to_numpy(dtype=float)
    out = np.full(n, np.nan, dtype=float)

    # First valid window is seeded with SMA
    sma_seed = np.nanmean(vals[:period])
    out[period - 1] = sma_seed
    alpha = 2.0 / (period + 1.0)
    alpha_inv = 1.0 - alpha

    for i in range(period, n):
        out[i] = alpha * vals[i] + alpha_inv * out[i - 1]

    return pd.Series(out, index=series.index)


def calc_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    """
    TradingView ta.rsi:
    - Uses Wilder's smoothing (ta.rma) where alpha = 1.0 / period.
    - Seeded by initial SMA of gains and losses.
    """
    period = int(period)
    n = len(series)
    if n <= period:
        return pd.Series(np.nan, index=series.index)

    vals = series.to_numpy(dtype=float)
    deltas = np.diff(vals)  # length n - 1

    gains = np.where(deltas > 0, deltas, 0.0)
    losses = np.where(deltas < 0, -deltas, 0.0)

    rsi = np.full(n, np.nan, dtype=float)

    # SMA seed at index period
    avg_gain = np.mean(gains[:period])
    avg_loss = np.mean(losses[:period])

    if avg_loss == 0:
        rsi[period] = 100.0
    else:
        rs = avg_gain / avg_loss
        rsi[period] = 100.0 - (100.0 / (1.0 + rs))

    for i in range(period, len(deltas)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
        bar_idx = i + 1
        if avg_loss == 0:
            rsi[bar_idx] = 100.0
        else:
            rs = avg_gain / avg_loss
            rsi[bar_idx] = 100.0 - (100.0 / (1.0 + rs))

    return pd.Series(rsi, index=series.index)


def calc_bollinger_bands(series: pd.Series, period: int = 20, std_dev: float = 2.0) -> Tuple[pd.Series, pd.Series, pd.Series]:
    """TradingView Bollinger Bands: basis (SMA), upper, lower."""
    period = int(period)
    mid = calc_sma(series, period)
    std = series.rolling(window=period, min_periods=period).std(ddof=1)
    upper = mid + float(std_dev) * std
    lower = mid - float(std_dev) * std
    return mid, upper, lower


def crossover(s1: pd.Series, s2: pd.Series) -> pd.Series:
    """TradingView ta.crossover: True where s1 crossed over s2."""
    prev_s1 = s1.shift(1)
    prev_s2 = s2.shift(1)
    return (prev_s1 <= prev_s2) & (s1 > s2)


def crossunder(s1: pd.Series, s2: pd.Series) -> pd.Series:
    """TradingView ta.crossunder: True where s1 crossed under s2."""
    prev_s1 = s1.shift(1)
    prev_s2 = s2.shift(1)
    return (prev_s1 >= prev_s2) & (s1 < s2)


# ──────────────────────────────────────────────────────
# STRATEGIES (MATCHING TRADINGVIEW BUILT-IN LOGIC)
# Each returns a DataFrame with:
#   "Long_Signal": True on the bar where long entry is triggered
#   "Short_Signal": True on the bar where short entry is triggered
# ──────────────────────────────────────────────────────

def strategy_sma_crossover(df: pd.DataFrame, fast_period: int = 10, slow_period: int = 50) -> pd.DataFrame:
    """
    TradingView SMA Crossover:
    BUY  when fast SMA crosses ABOVE slow SMA (ta.crossover).
    SELL when fast SMA crosses BELOW slow SMA (ta.crossunder).
    """
    df = df.copy()
    fast = calc_sma(df["Close"], int(fast_period))
    slow = calc_sma(df["Close"], int(slow_period))
    df["SMA_Fast"] = fast
    df["SMA_Slow"] = slow

    df["Long_Signal"] = crossover(fast, slow)
    df["Short_Signal"] = crossunder(fast, slow)
    return df


def strategy_ema_crossover(df: pd.DataFrame, fast_period: int = 9, slow_period: int = 21) -> pd.DataFrame:
    """
    TradingView EMA Crossover:
    BUY  when fast EMA crosses ABOVE slow EMA (ta.crossover).
    SELL when fast EMA crosses BELOW slow EMA (ta.crossunder).
    """
    df = df.copy()
    fast = calc_ema(df["Close"], int(fast_period))
    slow = calc_ema(df["Close"], int(slow_period))
    df["EMA_Fast"] = fast
    df["EMA_Slow"] = slow

    df["Long_Signal"] = crossover(fast, slow)
    df["Short_Signal"] = crossunder(fast, slow)
    return df


def strategy_rsi(df: pd.DataFrame, period: int = 14, oversold: float = 30, overbought: float = 70) -> pd.DataFrame:
    """
    TradingView Built-in RSI Strategy:
    BUY  when RSI crosses ABOVE oversold line (ta.crossover(rsi, oversold)).
    SELL when RSI crosses BELOW overbought line (ta.crossunder(rsi, overbought)).
    """
    df = df.copy()
    rsi = calc_rsi(df["Close"], int(period))
    df["RSI"] = rsi
    oversold_line = pd.Series(float(oversold), index=df.index)
    overbought_line = pd.Series(float(overbought), index=df.index)

    df["Long_Signal"] = crossover(rsi, oversold_line)
    df["Short_Signal"] = crossunder(rsi, overbought_line)
    return df


def strategy_macd(df: pd.DataFrame, fast: int = 12, slow: int = 26, signal: int = 9) -> pd.DataFrame:
    """
    TradingView Built-in MACD Strategy:
    BUY  when MACD line crosses above Signal line (ta.crossover).
    SELL when MACD line crosses below Signal line (ta.crossunder).
    """
    df = df.copy()
    ema_fast = calc_ema(df["Close"], int(fast))
    ema_slow = calc_ema(df["Close"], int(slow))
    macd_line = ema_fast - ema_slow
    signal_line = calc_ema(macd_line, int(signal))

    df["MACD_Line"] = macd_line
    df["MACD_Signal"] = signal_line
    df["MACD_Histogram"] = macd_line - signal_line

    df["Long_Signal"] = crossover(macd_line, signal_line)
    df["Short_Signal"] = crossunder(macd_line, signal_line)
    return df


def strategy_bollinger_bands(df: pd.DataFrame, period: int = 20, std_dev: float = 2.0) -> pd.DataFrame:
    """
    TradingView Built-in Bollinger Bands Strategy:
    BUY  when Close crosses above lower band (bounce back up).
    SELL when Close crosses below upper band (pull back down).
    """
    df = df.copy()
    mid, upper, lower = calc_bollinger_bands(df["Close"], int(period), float(std_dev))
    df["BB_Mid"] = mid
    df["BB_Upper"] = upper
    df["BB_Lower"] = lower

    df["Long_Signal"] = crossover(df["Close"], lower)
    df["Short_Signal"] = crossunder(df["Close"], upper)
    return df


def strategy_triple_ema(df: pd.DataFrame, fast_period: int = 5, mid_period: int = 13, slow_period: int = 34) -> pd.DataFrame:
    """
    TradingView Triple EMA Trend Alignment:
    BUY  when fast > mid > slow transitions to True.
    SELL when fast < mid < slow transitions to True.
    """
    df = df.copy()
    fast = calc_ema(df["Close"], int(fast_period))
    mid = calc_ema(df["Close"], int(mid_period))
    slow = calc_ema(df["Close"], int(slow_period))
    df["EMA_Fast"] = fast
    df["EMA_Mid"] = mid
    df["EMA_Slow"] = slow

    bullish = (fast > mid) & (mid > slow)
    bearish = (fast < mid) & (mid < slow)

    df["Long_Signal"] = bullish & (~bullish.shift(1).fillna(False))
    df["Short_Signal"] = bearish & (~bearish.shift(1).fillna(False))
    return df


# ── Strategy registry ──

STRATEGIES = {
    "sma_crossover": {
        "fn": strategy_sma_crossover,
        "name": "SMA Crossover",
        "description": "TradingView SMA crossover: enters long on ta.crossover, enters short on ta.crossunder.",
        "params": {
            "fast_period": {"type": "int", "default": 10, "min": 2, "max": 200, "label": "Fast Period"},
            "slow_period": {"type": "int", "default": 50, "min": 5, "max": 500, "label": "Slow Period"},
        },
    },
    "ema_crossover": {
        "fn": strategy_ema_crossover,
        "name": "EMA Crossover",
        "description": "TradingView EMA crossover using exact SMA-seeded ta.ema formulas.",
        "params": {
            "fast_period": {"type": "int", "default": 9, "min": 2, "max": 200, "label": "Fast Period"},
            "slow_period": {"type": "int", "default": 21, "min": 5, "max": 500, "label": "Slow Period"},
        },
    },
    "rsi": {
        "fn": strategy_rsi,
        "name": "RSI Strategy",
        "description": "TradingView built-in RSI: buys on oversold exit (crossover), sells on overbought exit (crossunder).",
        "params": {
            "period":     {"type": "int", "default": 14, "min": 2, "max": 100, "label": "RSI Period"},
            "oversold":   {"type": "int", "default": 30, "min": 5, "max": 50,  "label": "Oversold Level"},
            "overbought": {"type": "int", "default": 70, "min": 50, "max": 95, "label": "Overbought Level"},
        },
    },
    "macd": {
        "fn": strategy_macd,
        "name": "MACD Strategy",
        "description": "TradingView built-in MACD: buys when MACD line crosses above signal line, sells on reverse.",
        "params": {
            "fast":   {"type": "int", "default": 12, "min": 2, "max": 100, "label": "Fast EMA"},
            "slow":   {"type": "int", "default": 26, "min": 5, "max": 200, "label": "Slow EMA"},
            "signal": {"type": "int", "default": 9,  "min": 2, "max": 50,  "label": "Signal Line"},
        },
    },
    "bollinger_bands": {
        "fn": strategy_bollinger_bands,
        "name": "Bollinger Bands",
        "description": "TradingView built-in Bollinger Bands mean reversion strategy.",
        "params": {
            "period":  {"type": "int",   "default": 20,  "min": 5,   "max": 200, "label": "Period"},
            "std_dev": {"type": "float", "default": 2.0, "min": 0.5, "max": 4.0, "label": "Std Deviations"},
        },
    },
    "triple_ema": {
        "fn": strategy_triple_ema,
        "name": "Triple EMA",
        "description": "Buys on transition to strong uptrend (fast > mid > slow), sells on downtrend.",
        "params": {
            "fast_period": {"type": "int", "default": 5,  "min": 2, "max": 50,  "label": "Fast Period"},
            "mid_period":  {"type": "int", "default": 13, "min": 5, "max": 100, "label": "Mid Period"},
            "slow_period": {"type": "int", "default": 34, "min": 10, "max": 200, "label": "Slow Period"},
        },
    },
}


# ──────────────────────────────────────────────────────
# PINE SCRIPT V5 GENERATOR (FOR DIRECT TRADINGVIEW VERIFICATION)
# ──────────────────────────────────────────────────────

def generate_pine_script(config: BacktestConfig) -> str:
    """Generate exact Pine Script v5 strategy code matching this backtest configuration."""
    sname = config.strategy_name
    sparams = config.strategy_params or {}
    poc_str = "true" if config.process_orders_on_close else "false"

    qty_type_tv = "strategy.fixed"
    qty_val_tv = 100000
    if config.order_size_type == "lots":
        qty_val_tv = int(config.order_size_value * 100000)
    elif config.order_size_type == "contracts":
        qty_val_tv = int(config.order_size_value)
    elif config.order_size_type == "cash":
        qty_type_tv = "strategy.cash"
        qty_val_tv = int(config.order_size_value)
    elif config.order_size_type == "percent_of_equity":
        qty_type_tv = "strategy.percent_of_equity"
        qty_val_tv = int(config.order_size_value)

    header = f"""//@version=5
strategy("{sname.upper()} TV Parity", overlay=true, initial_capital={int(config.initial_capital)}, default_qty_type={qty_type_tv}, default_qty_value={qty_val_tv}, currency=currency.USD, process_orders_on_close={poc_str})
"""

    if sname == "sma_crossover":
        fast = sparams.get("fast_period", 10)
        slow = sparams.get("slow_period", 50)
        body = f"""
fastPeriod = input.int({fast}, "Fast Period")
slowPeriod = input.int({slow}, "Slow Period")

fastSMA = ta.sma(close, fastPeriod)
slowSMA = ta.sma(close, slowPeriod)

plot(fastSMA, "Fast SMA", color=color.blue, linewidth=2)
plot(slowSMA, "Slow SMA", color=color.orange, linewidth=2)

longCondition = ta.crossover(fastSMA, slowSMA)
shortCondition = ta.crossunder(fastSMA, slowSMA)

if (longCondition)
    strategy.entry("Long", strategy.long)

if (shortCondition)
    strategy.entry("Short", strategy.short)
"""
    elif sname == "ema_crossover":
        fast = sparams.get("fast_period", 9)
        slow = sparams.get("slow_period", 21)
        body = f"""
fastPeriod = input.int({fast}, "Fast Period")
slowPeriod = input.int({slow}, "Slow Period")

fastEMA = ta.ema(close, fastPeriod)
slowEMA = ta.ema(close, slowPeriod)

plot(fastEMA, "Fast EMA", color=color.green, linewidth=2)
plot(slowEMA, "Slow EMA", color=color.red, linewidth=2)

if (ta.crossover(fastEMA, slowEMA))
    strategy.entry("Long", strategy.long)

if (ta.crossunder(fastEMA, slowEMA))
    strategy.entry("Short", strategy.short)
"""
    elif sname == "rsi":
        period = sparams.get("period", 14)
        oversold = sparams.get("oversold", 30)
        overbought = sparams.get("overbought", 70)
        body = f"""
rsiLength = input.int({period}, "RSI Period")
oversold = input.int({oversold}, "Oversold Level")
overbought = input.int({overbought}, "Overbought Level")

rsiVal = ta.rsi(close, rsiLength)

if (ta.crossover(rsiVal, oversold))
    strategy.entry("Long", strategy.long)

if (ta.crossunder(rsiVal, overbought))
    strategy.entry("Short", strategy.short)
"""
    elif sname == "macd":
        fast = sparams.get("fast", 12)
        slow = sparams.get("slow", 26)
        signal = sparams.get("signal", 9)
        body = f"""
fastLen = input.int({fast}, "Fast EMA")
slowLen = input.int({slow}, "Slow EMA")
signalLen = input.int({signal}, "Signal Line")

fastEMA = ta.ema(close, fastLen)
slowEMA = ta.ema(close, slowLen)
macdLine = fastEMA - slowEMA
signalLine = ta.ema(macdLine, signalLen)

if (ta.crossover(macdLine, signalLine))
    strategy.entry("Long", strategy.long)

if (ta.crossunder(macdLine, signalLine))
    strategy.entry("Short", strategy.short)
"""
    elif sname == "bollinger_bands":
        period = sparams.get("period", 20)
        std_dev = sparams.get("std_dev", 2.0)
        body = f"""
bbLen = input.int({period}, "Period")
bbMult = input.float({std_dev}, "StdDev")

basis = ta.sma(close, bbLen)
dev = bbMult * ta.stdev(close, bbLen)
upper = basis + dev
lower = basis - dev

plot(basis, "Basis", color=color.gray)
plot(upper, "Upper", color=color.red)
plot(lower, "Lower", color=color.green)

if (ta.crossover(close, lower))
    strategy.entry("Long", strategy.long)

if (ta.crossunder(close, upper))
    strategy.entry("Short", strategy.short)
"""
    else:  # triple_ema
        fast = sparams.get("fast_period", 5)
        mid = sparams.get("mid_period", 13)
        slow = sparams.get("slow_period", 34)
        body = f"""
fastP = input.int({fast}, "Fast EMA")
midP = input.int({mid}, "Mid EMA")
slowP = input.int({slow}, "Slow EMA")

eFast = ta.ema(close, fastP)
eMid = ta.ema(close, midP)
eSlow = ta.ema(close, slowP)

bullish = eFast > eMid and eMid > eSlow
bearish = eFast < eMid and eMid < eSlow

if (bullish and not bullish[1])
    strategy.entry("Long", strategy.long)

if (bearish and not bearish[1])
    strategy.entry("Short", strategy.short)
"""
    return header + body


# ──────────────────────────────────────────────────────
# DATA LOADER (TRADINGVIEW CSV PRIORITY)
# ──────────────────────────────────────────────────────

def format_index_date(idx) -> str:
    """Format DatetimeIndex cleanly matching TradingView timestamps."""
    if hasattr(idx, "strftime"):
        dt = pd.to_datetime(idx)
        # Shift forex daily session starting at 21:00/22:00 UTC to next calendar business day
        if hasattr(dt, "hour") and dt.hour >= 20 and dt.minute == 0 and dt.second == 0:
            dt = dt + pd.Timedelta(hours=4)
            return dt.strftime("%Y-%m-%d")
        if hasattr(idx, "hour") and (idx.hour != 0 or idx.minute != 0 or idx.second != 0):
            return idx.strftime("%Y-%m-%d %H:%M")
        return idx.strftime("%Y-%m-%d")
    return str(idx)


def load_data(pair: str, timeframe: str = "1d", period: Optional[str] = None, data_dir: str = "data") -> pd.DataFrame:
    """Load cached CSV data. Prioritizes exported TradingView CSV data for zero discrepancy."""
    from data_downloader import resolve_timeframe, download_forex_data
    tf_key, resolved_period, cfg = resolve_timeframe(timeframe, period)
    pair_clean = pair.upper()

    tv_filepath = os.path.join(data_dir, f"{pair_clean}_{tf_key}_tv.csv")
    deep_filepath = os.path.join(data_dir, f"{pair_clean}_1m_deep.csv")
    oanda_filepath = os.path.join(data_dir, f"{pair_clean}_{tf_key}_oanda.csv")

    if os.path.exists(tv_filepath):
        filepath = tv_filepath
    elif tf_key == "1m" and os.path.exists(deep_filepath):
        filepath = deep_filepath
    elif os.path.exists(oanda_filepath):
        filepath = oanda_filepath
    else:
        filepath = os.path.join(data_dir, f"{pair_clean}_{tf_key}_{resolved_period}.csv")
        if not os.path.exists(filepath):
            download_forex_data(pair, period=resolved_period, interval=timeframe, data_dir=data_dir)

    df = pd.read_csv(filepath, index_col="Date", parse_dates=True)
    df = df[~df.index.duplicated(keep="first")].sort_index()

    # Sanitise OHLC
    if {"Open", "High", "Low", "Close"}.issubset(df.columns):
        df["High"] = df[["High", "Open", "Close"]].max(axis=1)
        df["Low"]  = df[["Low",  "Open", "Close"]].min(axis=1)

    return df


# ──────────────────────────────────────────────────────
# FOREX PNL & LOT VALUATION HELPERS
# ──────────────────────────────────────────────────────

def calculate_units(config: BacktestConfig, capital: float, fill_price: float) -> float:
    """Calculate position units based on order size specification."""
    if config.order_size_type == "lots":
        # Standard Forex Lot: 1.0 Lot = 100,000 units (Mini = 10k, Micro = 1k)
        return float(config.order_size_value) * 100000.0
    elif config.order_size_type in ("contracts", "units"):
        return float(config.order_size_value)
    elif config.order_size_type == "cash":
        # Fixed dollar amount of base currency
        return float(config.order_size_value) / fill_price if fill_price > 0 else 0.0
    elif config.order_size_type == "percent_of_equity":
        allocated = capital * (float(config.order_size_value) / 100.0)
        return allocated / fill_price if fill_price > 0 else 0.0
    else:
        # Fallback to 1 standard lot
        return 100000.0


def calculate_forex_pnl(pair: str, trade_type: str, entry_price: float, exit_price: float, units: float) -> float:
    """
    Calculate exact Forex PnL in USD (account currency).
    - Pairs where USD is quote (EURUSD, GBPUSD, AUDUSD, NZDUSD):
      PnL = (exit - entry) * units  [for LONG]
    - Pairs where USD is base (USDJPY, USDCAD, USDCHF):
      PnL = ((exit - entry) * units) / exit_price
    """
    pair_clean = pair.upper().replace("/", "").replace("=X", "")
    quote = pair_clean[3:] if len(pair_clean) >= 6 else "USD"

    if trade_type == "LONG":
        pnl_quote = (exit_price - entry_price) * units
    else:
        pnl_quote = (entry_price - exit_price) * units

    if quote == "USD":
        return pnl_quote
    elif quote in ("JPY", "CAD", "CHF") and exit_price > 0:
        return pnl_quote / exit_price
    else:
        return pnl_quote


# ──────────────────────────────────────────────────────
# BACKTEST EXECUTION ENGINE
# ──────────────────────────────────────────────────────

def run_backtest(config: BacktestConfig) -> BacktestResult:
    """
    Execute a backtest matching TradingView Strategy Tester.

    Execution Flow:
    1. Load historical bars (prioritizing TradingView exported data).
    2. Compute technical indicators and detect ta.crossover / ta.crossunder signals.
    3. Simulate order execution:
       - If process_orders_on_close is False (TradingView default):
         Signal on bar i executes on Open of bar i + 1.
       - If process_orders_on_close is True:
         Signal on bar i executes on Close of bar i.
    4. Calculate exact Forex PnL with standard lot sizing and 0-spread baseline.
    5. Return comprehensive performance summary and trade log.
    """
    df = load_data(
        config.pair.upper(),
        timeframe=config.timeframe,
        period=config.period,
    )

    if df.empty:
        raise ValueError(f"No data available for {config.pair}")

    # Slice data up to cut_date if specified (Bar Replay)
    if config.cut_date:
        try:
            cut_str = str(config.cut_date).strip()
            try:
                num_val = float(cut_str)
                unit = "ms" if num_val > 1e11 else "s"
                cut_dt = pd.to_datetime(num_val, unit=unit)
            except ValueError:
                cut_dt = pd.to_datetime(cut_str)

            if df.index.tz is not None and cut_dt.tz is None:
                cut_dt = cut_dt.tz_localize(df.index.tz)
            elif df.index.tz is None and cut_dt.tz is not None:
                cut_dt = cut_dt.tz_localize(None)

            sliced_df = df[df.index <= cut_dt]
            if len(sliced_df) >= 20:
                df = sliced_df
            elif len(sliced_df) > 0:
                df = df.iloc[:min(len(df), 20)]
        except Exception as e:
            print(f"Error filtering cut date: {e}")

    # Apply strategy logic
    strategy_entry = STRATEGIES.get(config.strategy_name)
    if not strategy_entry:
        raise ValueError(
            f"Unknown strategy '{config.strategy_name}'. "
            f"Available: {list(STRATEGIES.keys())}"
        )

    strategy_fn = strategy_entry["fn"]
    df = strategy_fn(df, **config.strategy_params)

    # Spread calculation
    pip_multiplier = 0.01 if "JPY" in config.pair.upper() else 0.0001
    spread_cost = config.spread_pips * pip_multiplier

    # Trading simulation
    capital = config.initial_capital
    position = 0         # 0=flat, 1=long, -1=short
    entry_price = 0.0
    entry_idx = 0
    entry_date = ""
    trade_units = 0.0

    trades: list[Trade] = []
    equity_curve = [capital]
    equity_dates = [format_index_date(df.index[0])]
    trade_counter = 0

    n_bars = len(df)
    pending_signal = 0  # 1 for queued long, -1 for queued short

    for i in range(n_bars):
        curr_row = df.iloc[i]
        curr_date_str = format_index_date(df.index[i])

        # ── EXECUTE QUEUED ORDER ON BAR OPEN (TradingView Default) ──
        if not config.process_orders_on_close and pending_signal != 0:
            open_price = float(curr_row["Open"])

            if pending_signal == 1:
                # CLOSE SHORT IF OPEN
                if position == -1:
                    exit_p = open_price + spread_cost
                    pnl = calculate_forex_pnl(config.pair, "SHORT", entry_price, exit_p, trade_units)
                    capital += pnl
                    trade_counter += 1
                    trades.append(Trade(
                        trade_id=trade_counter,
                        type="SHORT",
                        entry_date=entry_date,
                        exit_date=curr_date_str,
                        entry_price=round(entry_price, 5),
                        exit_price=round(exit_p, 5),
                        pnl=round(pnl, 2),
                        pnl_pct=round(pnl / config.initial_capital * 100, 4),
                        bars_held=i - entry_idx,
                    ))
                    position = 0

                # OPEN LONG
                if position == 0:
                    position = 1
                    entry_price = open_price + spread_cost
                    entry_idx = i
                    entry_date = curr_date_str
                    trade_units = calculate_units(config, capital, entry_price)

            elif pending_signal == -1:
                # CLOSE LONG IF OPEN
                if position == 1:
                    exit_p = open_price - spread_cost
                    pnl = calculate_forex_pnl(config.pair, "LONG", entry_price, exit_p, trade_units)
                    capital += pnl
                    trade_counter += 1
                    trades.append(Trade(
                        trade_id=trade_counter,
                        type="LONG",
                        entry_date=entry_date,
                        exit_date=curr_date_str,
                        entry_price=round(entry_price, 5),
                        exit_price=round(exit_p, 5),
                        pnl=round(pnl, 2),
                        pnl_pct=round(pnl / config.initial_capital * 100, 4),
                        bars_held=i - entry_idx,
                    ))
                    position = 0

                # OPEN SHORT
                if position == 0:
                    position = -1
                    entry_price = open_price - spread_cost
                    entry_idx = i
                    entry_date = curr_date_str
                    trade_units = calculate_units(config, capital, entry_price)

            pending_signal = 0

        # ── DETECT SIGNALS AT BAR CLOSE ──
        long_sig = bool(curr_row.get("Long_Signal", False))
        short_sig = bool(curr_row.get("Short_Signal", False))

        if config.process_orders_on_close:
            # Immediate execution on current bar close
            close_price = float(curr_row["Close"])

            if long_sig and position != 1:
                if position == -1:
                    exit_p = close_price + spread_cost
                    pnl = calculate_forex_pnl(config.pair, "SHORT", entry_price, exit_p, trade_units)
                    capital += pnl
                    trade_counter += 1
                    trades.append(Trade(
                        trade_id=trade_counter,
                        type="SHORT",
                        entry_date=entry_date,
                        exit_date=curr_date_str,
                        entry_price=round(entry_price, 5),
                        exit_price=round(exit_p, 5),
                        pnl=round(pnl, 2),
                        pnl_pct=round(pnl / config.initial_capital * 100, 4),
                        bars_held=i - entry_idx,
                    ))
                position = 1
                entry_price = close_price + spread_cost
                entry_idx = i
                entry_date = curr_date_str
                trade_units = calculate_units(config, capital, entry_price)

            elif short_sig and position != -1:
                if position == 1:
                    exit_p = close_price - spread_cost
                    pnl = calculate_forex_pnl(config.pair, "LONG", entry_price, exit_p, trade_units)
                    capital += pnl
                    trade_counter += 1
                    trades.append(Trade(
                        trade_id=trade_counter,
                        type="LONG",
                        entry_date=entry_date,
                        exit_date=curr_date_str,
                        entry_price=round(entry_price, 5),
                        exit_price=round(exit_p, 5),
                        pnl=round(pnl, 2),
                        pnl_pct=round(pnl / config.initial_capital * 100, 4),
                        bars_held=i - entry_idx,
                    ))
                position = -1
                entry_price = close_price - spread_cost
                entry_idx = i
                entry_date = curr_date_str
                trade_units = calculate_units(config, capital, entry_price)

        else:
            # Queue signal to execute on next bar open (TradingView default)
            if long_sig and position != 1:
                pending_signal = 1
            elif short_sig and position != -1:
                pending_signal = -1

        # Track equity over time
        unrealized = 0.0
        if position == 1:
            unrealized = calculate_forex_pnl(config.pair, "LONG", entry_price, float(curr_row["Close"]), trade_units)
        elif position == -1:
            unrealized = calculate_forex_pnl(config.pair, "SHORT", entry_price, float(curr_row["Close"]), trade_units)

        if i > 0:
            equity_curve.append(round(capital + unrealized, 2))
            equity_dates.append(curr_date_str)

    # Calculate summary metrics
    if not trades:
        return BacktestResult(
            total_trades=0, winning_trades=0, losing_trades=0,
            win_rate=0.0, total_profit=0.0, total_profit_pct=0.0,
            max_drawdown=0.0, max_drawdown_pct=0.0, profit_factor=0.0,
            sharpe_ratio=0.0, avg_trade_pnl=0.0, avg_winner=0.0,
            avg_loser=0.0, best_trade=0.0, worst_trade=0.0, avg_bars_held=0.0,
            equity_curve=equity_curve, equity_dates=equity_dates, trades=[],
        )

    winners = [t for t in trades if t.pnl > 0]
    losers = [t for t in trades if t.pnl <= 0]

    total_profit = capital - config.initial_capital
    gross_profit = sum(t.pnl for t in winners) if winners else 0.0
    gross_loss = abs(sum(t.pnl for t in losers)) if losers else 0.0

    peak = config.initial_capital
    max_dd = 0.0
    for eq in equity_curve:
        if eq > peak:
            peak = eq
        dd = peak - eq
        if dd > max_dd:
            max_dd = dd

    returns = pd.Series(equity_curve).pct_change().dropna()
    sharpe = float(returns.mean() / returns.std() * np.sqrt(252)) if returns.std() > 0 else 0.0

    trades_dicts = [asdict(t) for t in trades]
    pnl_list = [t.pnl for t in trades]

    return BacktestResult(
        total_trades=len(trades),
        winning_trades=len(winners),
        losing_trades=len(losers),
        win_rate=round(len(winners) / len(trades) * 100, 2),
        total_profit=round(total_profit, 2),
        total_profit_pct=round(total_profit / config.initial_capital * 100, 2),
        max_drawdown=round(max_dd, 2),
        max_drawdown_pct=round(max_dd / config.initial_capital * 100, 2),
        profit_factor=round(gross_profit / gross_loss, 2) if gross_loss > 0 else 999.0,
        sharpe_ratio=round(sharpe, 2),
        avg_trade_pnl=round(sum(pnl_list) / len(pnl_list), 2),
        avg_winner=round(sum(t.pnl for t in winners) / len(winners), 2) if winners else 0.0,
        avg_loser=round(sum(t.pnl for t in losers) / len(losers), 2) if losers else 0.0,
        best_trade=round(max(pnl_list), 2),
        worst_trade=round(min(pnl_list), 2),
        avg_bars_held=round(sum(t.bars_held for t in trades) / len(trades), 1),
        equity_curve=equity_curve,
        equity_dates=equity_dates,
        trades=trades_dicts,
    )


# ──────────────────────────────────────────────────────
# CLI TEST RUNNER
# ──────────────────────────────────────────────────────

if __name__ == "__main__":
    cfg = BacktestConfig(
        pair="EURUSD",
        timeframe="1d",
        period="5y",
        initial_capital=10000,
        order_size_type="lots",
        order_size_value=1.0,
        process_orders_on_close=False,
        spread_pips=0.0,
        strategy_name="sma_crossover",
        strategy_params={"fast_period": 10, "slow_period": 50},
    )

    res = run_backtest(cfg)
    print()
    print("=" * 60)
    print("  TRADINGVIEW PARITY BACKTEST ENGINE | EUR/USD 5Y")
    print("=" * 60)
    print(f"  Total Trades:     {res.total_trades}")
    print(f"  Win Rate:         {res.win_rate}% ({res.winning_trades} wins / {res.losing_trades} losses)")
    print(f"  Total Net Profit: ${res.total_profit} ({res.total_profit_pct}%)")
    print(f"  Profit Factor:    {res.profit_factor}")
    print(f"  Max Drawdown:     ${res.max_drawdown} ({res.max_drawdown_pct}%)")
    print(f"  Avg Trade P&L:    ${res.avg_trade_pnl}")
    print(f"  Best Trade:       ${res.best_trade}")
    print(f"  Worst Trade:      ${res.worst_trade}")
    print(f"  Avg Bars Held:    {res.avg_bars_held}")
    print("=" * 60)
    if res.trades:
        print()
        print("  First 3 Trades:")
        for t in res.trades[:3]:
            print(f"    #{t['trade_id']} {t['type']} | {t['entry_date']} @ {t['entry_price']} -> {t['exit_date']} @ {t['exit_price']} | PnL: ${t['pnl']}")
        print("  ...")
        print("  Last 3 Trades:")
        for t in res.trades[-3:]:
            print(f"    #{t['trade_id']} {t['type']} | {t['entry_date']} @ {t['entry_price']} -> {t['exit_date']} @ {t['exit_price']} | PnL: ${t['pnl']}")
