"""
build_data.py
Reads Cricsheet IPL JSON files and writes one CSV row per legal ball
of the SECOND innings (the chase).

Run from the train/ folder:  python build_data.py
"""
import glob
import json
import os

import pandas as pd

BASE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE, "data")
OUT_FILE = os.path.join(BASE, "ipl_rows.csv")


def process_match(path):
    """Return a list of row dicts for one match, or None if skipped."""
    with open(path, encoding="utf-8") as f:
        m = json.load(f)

    info = m["info"]
    outcome = info.get("outcome", {})

    # Skip: no result, tie, super-over decided, rain/DLS affected
    if "winner" not in outcome:
        return None
    if "eliminator" in outcome or "method" in outcome:
        return None
    if info.get("overs", 20) != 20:
        return None

    innings = [i for i in m["innings"] if not i.get("super_over")]
    if len(innings) < 2:
        return None

    first, second = innings[0], innings[1]

    # First innings total (all runs incl. extras)
    first_total = 0
    for over in first["overs"]:
        for d in over["deliveries"]:
            first_total += d["runs"]["total"]
    target = first_total + 1

    chasing_team = second["team"]
    label = 1 if outcome["winner"] == chasing_team else 0
    match_id = os.path.splitext(os.path.basename(path))[0]

    rows = []
    runs = 0
    wickets = 0
    legal_balls = 0

    for over in second["overs"]:
        for d in over["deliveries"]:
            runs += d["runs"]["total"]
            wickets += len(d.get("wickets", []))

            extras = d.get("extras", {})
            is_legal = ("wides" not in extras) and ("noballs" not in extras)
            if not is_legal:
                continue  # one row per LEGAL ball only
            legal_balls += 1

            balls_left = 120 - legal_balls
            runs_needed = target - runs

            # State AFTER this ball. Skip if the match is already decided.
            if balls_left <= 0 or runs_needed <= 0 or wickets >= 10:
                continue

            rows.append({
                "match_id": match_id,
                "runs_needed": runs_needed,
                "balls_left": balls_left,
                "wickets": wickets,
                "rrr": runs_needed * 6 / balls_left,
                "balls_left_frac": balls_left / 120,
                "label": label,
            })
    return rows


def main():
    files = sorted(glob.glob(os.path.join(DATA_DIR, "*.json")))
    print("JSON files found:", len(files))

    all_rows = []
    used = 0
    for path in files:
        rows = process_match(path)
        if rows:
            all_rows.extend(rows)
            used += 1

    df = pd.DataFrame(all_rows)
    df.to_csv(OUT_FILE, index=False)

    print("Matches used:", used, "| skipped:", len(files) - used)
    print("Rows:", len(df))
    print("Chasing team win rate:", round(df["label"].mean(), 3))
    print(df.head())


if __name__ == "__main__":
    main()