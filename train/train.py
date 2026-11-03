"""
train.py
Trains a logistic regression win-probability model on ipl_rows.csv.
Splits by MATCH (not by ball) so no match appears in both train and test.

"""
import os
import json

import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, log_loss
from sklearn.model_selection import GroupShuffleSplit

BASE = os.path.dirname(os.path.abspath(__file__))
CSV_FILE = os.path.join(BASE, "ipl_rows.csv")

RRR_CAP = 20  # required run rate is capped at 20 (browser must do the same)
FEATURES = ["rrr", "wickets", "balls_left_frac"]


def main():
    df = pd.read_csv(CSV_FILE)
    df["rrr"] = df["rrr"].clip(upper=RRR_CAP)

    X = df[FEATURES]
    y = df["label"]

    # Split by match: ~80% of matches for training, ~20% for testing
    splitter = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
    train_idx, test_idx = next(splitter.split(X, y, groups=df["match_id"]))
    X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
    y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]

    print("Train matches:", df.iloc[train_idx]["match_id"].nunique())
    print("Test matches: ", df.iloc[test_idx]["match_id"].nunique())

    model = LogisticRegression(max_iter=1000)
    model.fit(X_train, y_train)

    probs = model.predict_proba(X_test)[:, 1]

    # Baseline: always predict 50%
    base = [0.5] * len(y_test)

    print()
    print("Model    log loss:", round(log_loss(y_test, probs), 4))
    print("Baseline log loss:", round(log_loss(y_test, base), 4))
    print("Model    Brier   :", round(brier_score_loss(y_test, probs), 4))
    print("Baseline Brier   :", round(brier_score_loss(y_test, base), 4))

    print()
    print("Intercept:", round(float(model.intercept_[0]), 4))
    for name, coef in zip(FEATURES, model.coef_[0]):
        print(f"Coef {name}:", round(float(coef), 4))
        
        # ---- Step 4: export for the browser ----
    out = {
        "intercept": float(model.intercept_[0]),
        "rrr": float(model.coef_[0][0]),
        "wickets": float(model.coef_[0][1]),
        "balls_left_frac": float(model.coef_[0][2]),
        "rrr_cap": RRR_CAP,
    }
    site_dir = os.path.join(BASE, "..", "site")
    os.makedirs(site_dir, exist_ok=True)
    with open(os.path.join(site_dir, "model.json"), "w") as f:
        json.dump(out, f, indent=2)
    print("\nSaved site/model.json")

    # ---- Sanity checks ----
    def win_prob(runs_needed, balls_left, wickets):
        rrr = min(runs_needed * 6 / balls_left, RRR_CAP)
        z = (out["intercept"] + out["rrr"] * rrr
             + out["wickets"] * wickets
             + out["balls_left_frac"] * balls_left / 120)
        return 1 / (1 + 2.718281828 ** (-z))

    print("60 off 30, 8 down:", round(win_prob(60, 30, 8), 3), "(should be low)")
    print("20 off 30, 2 down:", round(win_prob(20, 30, 2), 3), "(should be high)")
    print("30 off 12, 4 down:", round(win_prob(30, 12, 4), 3), "(should be lowish)")
    print("Start, 180 off 120, 0 down:", round(win_prob(180, 120, 0), 3), "(near 50%)")    


if __name__ == "__main__":
    main()
    