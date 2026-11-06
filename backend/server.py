"""
Flask API Server
Serves the backtest engine and authentic TradingView data utilities as a REST API.
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
from dataclasses import asdict
import os
import calendar

from backtest_engine import BacktestConfig, run_backtest, STRATEGIES, generate_pine_script
from data_downloader import FOREX_PAIRS, resolve_timeframe, download_forex_data, parse_and_save_tv_csv, download_twelve_data


app = Flask(__name__)
CORS(app)  # Allow frontend website access


# ──────────────────────────────────────────────────────
# API ENDPOINTS
# ──────────────────────────────────────────────────────

@app.route("/api/health", methods=["GET"])
def health():
    """Health check — confirms the server is running."""
    return jsonify({
        "status": "ok",
        "message": "TradingView Parity Backtest engine is running",
        "version": "2.0.0",
    })


@app.route("/api/pairs", methods=["GET"])
def get_pairs():
    """Return all available forex pairs."""
    pairs = []
    for key in FOREX_PAIRS:
        base = key[:3]
        quote = key[3:]
        pairs.append({
            "id": key,
            "name": f"{base}/{quote}",
            "base": base,
            "quote": quote,
        })
    return jsonify({"pairs": pairs})


@app.route("/api/strategies", methods=["GET"])
def get_strategies():
    """Return all available strategies with configurable parameters."""
    strategies = {}
    for key, entry in STRATEGIES.items():
        strategies[key] = {
            "name": entry["name"],
            "description": entry["description"],
            "params": entry["params"],
        }
    return jsonify({"strategies": strategies})


@app.route("/api/backtest", methods=["POST"])
def backtest():
    """
    Run backtest with exact TradingView execution logic.
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Request body must be JSON"}), 400

        if "pair" not in data:
            return jsonify({"error": "Missing required field: pair"}), 400
        if "strategy_name" not in data:
            return jsonify({"error": "Missing required field: strategy_name"}), 400

        pair = data["pair"].upper()
        if pair not in FOREX_PAIRS:
            return jsonify({
                "error": f"Unknown pair: {pair}",
                "available_pairs": list(FOREX_PAIRS.keys()),
            }), 400

        strategy_name = data["strategy_name"]
        if strategy_name not in STRATEGIES:
            return jsonify({
                "error": f"Unknown strategy: {strategy_name}",
                "available_strategies": list(STRATEGIES.keys()),
            }), 400

        timeframe_raw = data.get("timeframe", "1d")
        tf_key, resolved_period, cfg = resolve_timeframe(timeframe_raw, data.get("period"))

        config = BacktestConfig(
            pair=pair,
            timeframe=tf_key,
            period=resolved_period,
            initial_capital=float(data.get("initial_capital", 10000)),
            order_size_type=str(data.get("order_size_type", "lots")),
            order_size_value=float(data.get("order_size_value", 1.0)),
            risk_per_trade=float(data.get("risk_per_trade", 0.02)),
            process_orders_on_close=bool(data.get("process_orders_on_close", False)),
            spread_pips=float(data.get("spread_pips", 0.0)),
            strategy_name=strategy_name,
            strategy_params=data.get("strategy_params", {}),
            cut_date=data.get("cut_date", None),
        )

        if config.initial_capital <= 0 or config.initial_capital > 10_000_000:
            return jsonify({"error": "initial_capital must be between 1 and 10,000,000"}), 400

        result = run_backtest(config)

        return jsonify({
            "success": True,
            "config": asdict(config),
            "result": asdict(result),
        })

    except FileNotFoundError as e:
        return jsonify({
            "error": f"Data not found. Try downloading data first: {str(e)}"
        }), 404

    except Exception as e:
        return jsonify({"error": f"Backtest failed: {str(e)}"}), 500


@app.route("/api/pine-script", methods=["POST"])
def get_pine_script():
    """Generate exact Pine Script v5 code matching the user's current backtest configuration."""
    try:
        data = request.get_json() or {}
        pair = data.get("pair", "EURUSD").upper()
        strategy_name = data.get("strategy_name", "sma_crossover")
        timeframe = data.get("timeframe", "1d")

        config = BacktestConfig(
            pair=pair,
            timeframe=timeframe,
            initial_capital=float(data.get("initial_capital", 10000)),
            order_size_type=str(data.get("order_size_type", "lots")),
            order_size_value=float(data.get("order_size_value", 1.0)),
            process_orders_on_close=bool(data.get("process_orders_on_close", False)),
            spread_pips=float(data.get("spread_pips", 0.0)),
            strategy_name=strategy_name,
            strategy_params=data.get("strategy_params", {}),
        )

        code = generate_pine_script(config)
        return jsonify({"success": True, "pine_script": code})
    except Exception as e:
        return jsonify({"error": f"Failed to generate Pine Script: {str(e)}"}), 500


@app.route("/api/upload-tv-data", methods=["POST"])
def upload_tv_data():
    """
    Import TradingView exported CSV file to achieve 100% data parity.
    Supports file uploads or direct CSV string bodies.
    """
    try:
        pair = request.form.get("pair") or (request.json and request.json.get("pair")) or "EURUSD"
        timeframe = request.form.get("timeframe") or (request.json and request.json.get("timeframe")) or "1d"
        pair = pair.upper()

        file = request.files.get("file") if request.files else None
        if file:
            df = parse_and_save_tv_csv(file, pair=pair, timeframe=timeframe)
        elif request.json and "csv_data" in request.json:
            df = parse_and_save_tv_csv(request.json["csv_data"], pair=pair, timeframe=timeframe)
        else:
            return jsonify({"error": "No file or csv_data provided"}), 400

        return jsonify({
            "success": True,
            "message": f"Successfully loaded {len(df)} authentic TradingView bars for {pair} ({timeframe})",
            "pair": pair,
            "timeframe": timeframe,
            "bars": len(df),
            "start": str(df.index[0]),
            "end": str(df.index[-1]),
        })
    except Exception as e:
        return jsonify({"error": f"Failed to parse TradingView CSV: {str(e)}"}), 400


@app.route("/api/twelve-data", methods=["POST"])
def fetch_twelve_data():
    """Download authentic institutional candles from Twelve Data without an OANDA account."""
    try:
        data = request.get_json() or {}
        pair = data.get("pair", "EURUSD").upper()
        timeframe = data.get("timeframe", "1d")
        api_key = data.get("api_key", None)

        df = download_twelve_data(pair, interval=timeframe, api_key=api_key)

        return jsonify({
            "success": True,
            "message": f"Successfully downloaded {len(df)} bars from Twelve Data",
            "pair": pair,
            "timeframe": timeframe,
            "bars": len(df),
            "start": str(df.index[0]),
            "end": str(df.index[-1]),
        })
    except Exception as e:
        return jsonify({"error": f"Twelve Data fetch failed: {str(e)}"}), 500


@app.route("/api/download-data", methods=["POST"])
def download_data():
    """Download / refresh historical data for a pair."""
    try:
        data = request.get_json()
        pair = data.get("pair", "").upper()
        period = data.get("period", "5y")
        timeframe = data.get("timeframe", "1d")

        if pair not in FOREX_PAIRS:
            return jsonify({"error": f"Unknown pair: {pair}"}), 400

        df = download_forex_data(pair, period=period, interval=timeframe)

        return jsonify({
            "success": True,
            "pair": pair,
            "bars": len(df),
            "start": str(df.index[0]),
            "end": str(df.index[-1]),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/candles", methods=["GET"])
def get_candles():
    """
    Return OHLC price data for charting. Supports multiple timeframes (1m, 5m, 15m, 1h, 4h, 1d, 1w).
    Checks priority: TradingView data > deep 1m > OANDA > Yahoo Finance cache.
    """
    try:
        pair = request.args.get("pair", "EURUSD").upper()
        timeframe = request.args.get("timeframe", "1d")
        period = request.args.get("period", None)

        if pair not in FOREX_PAIRS:
            return jsonify({"error": f"Unknown pair: {pair}"}), 400

        tf_key, resolved_period, cfg = resolve_timeframe(timeframe, period)
        os.makedirs("data", exist_ok=True)

        # Priority: TradingView CSV > deep 1m > OANDA > Yahoo Finance cache
        tv_filepath = os.path.join("data", f"{pair}_{tf_key}_tv.csv")
        deep_filepath = os.path.join("data", f"{pair}_1m_deep.csv")
        oanda_filepath = os.path.join("data", f"{pair}_{tf_key}_oanda.csv")

        if os.path.exists(tv_filepath):
            filepath = tv_filepath
        elif tf_key == "1m" and os.path.exists(deep_filepath):
            filepath = deep_filepath
        elif os.path.exists(oanda_filepath):
            filepath = oanda_filepath
        else:
            filepath = os.path.join("data", f"{pair}_{tf_key}_{resolved_period}.csv")
            is_stale = False
            if os.path.exists(filepath):
                import time as pytime
                file_age = pytime.time() - os.path.getmtime(filepath)
                max_age = 1800 if cfg.get("is_intraday") else 43200
                if file_age > max_age:
                    is_stale = True

            if not os.path.exists(filepath) or is_stale:
                try:
                    download_forex_data(pair, period=resolved_period, interval=timeframe)
                except Exception as e:
                    print(f"Warning: could not re-download {pair}: {e}")

        import pandas as pd
        df = pd.read_csv(filepath, index_col="Date", parse_dates=True)
        df = df[~df.index.duplicated(keep="first")].sort_index()

        candles = []
        prev_close = None
        is_jpy = "JPY" in pair.upper()
        pip_threshold = 0.03 if is_jpy else 0.0003
        is_intraday = cfg.get("is_intraday", False)
        seen_times = set()

        for idx, row in df.iterrows():
            if is_intraday:
                dt = pd.to_datetime(idx)
                if dt.tzinfo is None:
                    time_val = int(calendar.timegm(dt.timetuple()))
                else:
                    dt_utc = dt.tz_convert("UTC")
                    time_val = int(dt_utc.timestamp())
            else:
                dt = pd.to_datetime(idx)
                # In institutional Forex (OANDA/TradingView), daily bars open at 17:00 NY (21:00/22:00 UTC).
                # TradingView convention labels each forex daily session by its business day (e.g. Sunday 5pm NY is Monday).
                # If bar timestamp starts at 20:00-23:00 UTC, shift to the session trading date (+4 hours).
                if hasattr(dt, "hour") and dt.hour >= 20:
                    dt = dt + pd.Timedelta(hours=4)
                time_val = dt.strftime("%Y-%m-%d")

            if time_val in seen_times:
                continue
            seen_times.add(time_val)

            close_val = float(row["Close"])
            high_val = float(row["High"])
            low_val = float(row["Low"])
            raw_open = float(row["Open"])

            is_authentic = filepath.endswith("_tv.csv") or filepath.endswith("_oanda.csv") or filepath.endswith("_deep.csv")
            if not is_authentic and prev_close is not None and abs(raw_open - close_val) < pip_threshold:
                open_val = prev_close
            else:
                open_val = raw_open

            high_val = max(high_val, open_val, close_val)
            low_val = min(low_val, open_val, close_val)
            prev_close = close_val

            candles.append({
                "time": time_val,
                "open": round(open_val, 5),
                "high": round(high_val, 5),
                "low": round(low_val, 5),
                "close": round(close_val, 5),
            })

        return jsonify({
            "success": True,
            "pair": pair,
            "timeframe": timeframe,
            "candles": candles,
            "is_authentic_tv": filepath.endswith("_tv.csv"),
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Endpoint not found"}), 404


@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error"}), 500


# ──────────────────────────────────────────────────────
# START SERVER
# ──────────────────────────────────────────────────────

if __name__ == "__main__":
    print()
    print("=" * 60)
    print("  TRADINGVIEW PARITY BACKTEST API SERVER")
    print("=" * 60)
    print("  Server:       http://localhost:5000")
    print("  Health:       http://localhost:5000/api/health")
    print("  Pairs:        http://localhost:5000/api/pairs")
    print("  Strategies:   http://localhost:5000/api/strategies")
    print("  Backtest:     POST http://localhost:5000/api/backtest")
    print("  Pine Script:  POST http://localhost:5000/api/pine-script")
    print("  Upload TV:    POST http://localhost:5000/api/upload-tv-data")
    print("=" * 60)
    print()

    app.run(debug=True, port=5000, host="0.0.0.0")
