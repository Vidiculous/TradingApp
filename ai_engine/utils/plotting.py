import matplotlib

matplotlib.use("Agg")
import io

import matplotlib.pyplot as plt
import pandas as pd


def generate_candlestick_chart(df: pd.DataFrame, title: str = "Price Chart") -> bytes:
    """
    Generates a simple candlestick chart using matplotlib and returns the image as bytes.
    Expects df to have 'Open', 'High', 'Low', 'Close', 'Volume' columns.
    """
    try:
        # Create figure and axis
        fig, ax = plt.subplots(figsize=(10, 6))

        # Ensure index is datetime
        if not pd.api.types.is_datetime64_any_dtype(df.index):
            df.index = pd.to_datetime(df.index)

        # Plot candlesticks (manual implementation to avoid mplfinance dependency for now)
        # Up (Green) candles
        up = df[df.Close >= df.Open]
        down = df[df.Close < df.Open]

        # Plot Up candles
        ax.bar(
            up.index,
            up.Close - up.Open,
            width=0.6,
            bottom=up.Open,
            color="green",
            edgecolor="green",
        )
        ax.vlines(up.index, up.Low, up.High, color="green", linewidth=1)

        # Plot Down candles
        ax.bar(
            down.index,
            down.Close - down.Open,
            width=0.6,
            bottom=down.Open,
            color="red",
            edgecolor="red",
        )
        ax.vlines(down.index, down.Low, down.High, color="red", linewidth=1)

        ax.set_title(title)
        ax.grid(True, alpha=0.3)
        plt.xticks(rotation=45)

        # Save to buffer
        buf = io.BytesIO()
        plt.tight_layout()
        plt.savefig(buf, format="png")
        buf.seek(0)
        plt.close(fig)

        return buf.getvalue()

    except Exception as e:
        print(f"Error generating chart: {e}")
        return None
