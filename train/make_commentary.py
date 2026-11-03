"""
make_commentary.py
Writes 2 short sentences per notable ball (English + Hinglish) using a LOCAL
Ollama model. Output: site/commentary.js

Before running:
  1. Install Ollama (ollama.com) and run:  ollama pull llama3.1:8b
  2. Keep Ollama running in the background.

Run from the project root:
  python train/make_commentary.py --dry     (just prints the first prompt)
  python train/make_commentary.py           (generates everything)

IMPORTANT: read and fix every Hinglish line by hand afterwards.
The script will not overwrite site/commentary.js once it exists (so your
edits are safe). Use --force to overwrite.
"""
import json
import math
import os
import re
import sys
import urllib.request

MODEL = "llama3.1:8b"   # change if you use another model, e.g. "qwen2.5:7b"
OLLAMA_URL = "http://localhost:11434/api/generate"

BASE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(BASE, "..", "site")
OUT_FILE = os.path.join(SITE, "commentary.js")

# Same numbers as app.js
PITCH_M = 17.7
REACTION_S = 0.2


def load_match():
    text = open(os.path.join(SITE, "match.js"), encoding="utf-8").read()
    target = int(re.search(r"target:\s*(\d+)", text).group(1))
    balls = []
    for line in text.splitlines():
        if "{ id:" not in line:
            continue
        b = {}
        b["id"] = int(re.search(r"id:\s*(\d+)", line).group(1))
        for key in ["over", "bowler", "type", "length", "batter", "shot"]:
            b[key] = re.search(key + r':\s*"([^"]*)"', line).group(1)
        for key in ["speed", "runs", "score", "wkts"]:
            b[key] = int(re.search(key + r":\s*(\d+)", line).group(1))
        b["wicket"] = "wicket: true" in line
        balls.append(b)
    return target, balls


def win_prob(m, target, score, wkts, balls_bowled):
    need = target - score
    if need <= 0:
        return 1.0
    if wkts >= 10 or balls_bowled >= 120:
        return 0.0
    left = 120 - balls_bowled
    rrr = min(need * 6 / left, m["rrr_cap"])
    z = (m["intercept"] + m["rrr"] * rrr + m["wickets"] * wkts
         + m["balls_left_frac"] * left / 120)
    return 1 / (1 + math.exp(-z))


def build_prompt(b, target, m):
    overs, ball_no = b["over"].split(".")
    balls_after = int(overs) * 6 + int(ball_no)
    before = win_prob(m, target, b["score"] - b["runs"],
                      b["wkts"] - (1 if b["wicket"] else 0), balls_after - 1)
    after = win_prob(m, target, b["score"], b["wkts"], balls_after)

    arrives = PITCH_M / (b["speed"] / 3.6)
    window = arrives - REACTION_S

    if b["wicket"]:
        result = "a wicket"
    elif b["runs"] == 0:
        result = "no run"
    else:
        result = str(b["runs"]) + " runs"

    if b["type"] == "spin":
        hint = "This is spin: slower, but the ball changes direction after the bounce."
    elif window < 0.25:
        hint = "The batter must predict the ball before it lands."
    else:
        hint = "The batter has very little time to decide."

    facts = (
        "Bowler type: " + b["type"] + "\n"
        "Speed: " + str(b["speed"]) + " km/h\n"
        "Length: " + b["length"] + "\n"
        "Shot: " + b["shot"] + "\n"
        "Result: " + result + "\n"
        "Time for ball to reach batter: " + format(arrives, ".2f") + " seconds\n"
        "Time left to decide after ordinary reaction time (0.2 s): "
        + format(window, ".2f") + " seconds\n"
        "Win probability of the chasing team: "
        + str(round(before * 100)) + "% to " + str(round(after * 100)) + "%\n"
        "Hint: " + hint + "\n"
    )

    prompt = (
        "You write short captions for a cricket app for casual fans.\n"
        "Use ONLY the facts below. Do not add any other facts, names, "
        "statistics or opinions.\n\n"
        + facts +
        "\nWrite exactly 2 short, simple sentences about how hard this ball "
        "was for the batter, and mention the win probability change.\n"
        "Give the answer in two languages:\n"
        '- "en": plain English\n'
        '- "hi": Hinglish (Hindi in Roman/English letters, casual and simple)\n'
        'Reply with JSON only, like: {"en": "...", "hi": "..."}'
    )
    return prompt


def ask_ollama(prompt):
    body = json.dumps({"model": MODEL, "prompt": prompt,
                       "stream": False, "format": "json"}).encode("utf-8")
    req = urllib.request.Request(OLLAMA_URL, data=body,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as resp:
        out = json.loads(resp.read().decode("utf-8"))
    data = json.loads(out["response"])
    return data["en"].strip(), data["hi"].strip()


def main():
    m = json.load(open(os.path.join(SITE, "model.json")))
    target, balls = load_match()
    print("Balls found:", len(balls))

    if "--dry" in sys.argv:
        print(build_prompt(balls[0], target, m))
        return

    if os.path.exists(OUT_FILE) and "--force" not in sys.argv:
        print("site/commentary.js already exists. Use --force to overwrite.")
        return

    result = {}
    for b in balls:
        try:
            en, hi = ask_ollama(build_prompt(b, target, m))
        except Exception as e:
            print("Ball", b["id"], "failed:", e, "-> fill in by hand")
            en, hi = "TODO", "TODO"
        result[b["id"]] = {"en": en, "hi": hi}
        print("Ball", b["id"], "done")

    with open(OUT_FILE, "w", encoding="utf-8") as f:
        f.write("// commentary.js - generated by a local model, then checked by hand.\n")
        f.write("const COMMENTARY = ")
        f.write(json.dumps(result, indent=2, ensure_ascii=False))
        f.write(";\n")
    print("Saved site/commentary.js. Now read and fix every Hinglish line!")


if __name__ == "__main__":
    main()