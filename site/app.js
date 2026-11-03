// app.js - physics, win-probability model, chat and page logic.
const PITCH_M = 17.7, REACTION_S = 0.2, MAX_BAR_S = 0.8;
const timeToBatter = kmh => PITCH_M / (kmh / 3.6);
const decisionWindow = kmh => timeToBatter(kmh) - REACTION_S;
const level = b => b.type === "spin" ? "spin" : (Number(decisionWindow(b.speed).toFixed(2)) <= 0.25 ? "predict" : "tight");

const T = {
  hook: { en: "Think you'd have hit that? Prove it in 0.2 seconds.", hi: "Tum hote toh maar paate? 0.2 second mein dikhao." },
  diff: { predict: { en: "Guess before it lands", hi: "Pehle hi andaza" }, spin: { en: "Spin", hi: "Spin" }, tight: { en: "Tight", hi: "Tight" } },
  judge: { en: "Before you judge:", hi: "Judge karne se pehle:" },
  gameLabel: { en: "Beat the batter", hi: "Batter ko haraao" },
  gameHint: { en: "Tap the moment the button turns green.", hi: "Button hara hote hi tap karo." },
  ready: { en: "Press Next ball to start the chase.", hi: "Chase shuru karne ke liye Next ball dabao." },
  thinking: { en: "Thinking...", hi: "Soch raha hai..." },
  unavailable: { en: "(Assistant offline, built-in summary shown)", hi: "(Assistant offline, built-in summary dikha rahe hain)" },
  sugg: {
    en: ["Why this shot?", "Could he have left it?", "How big was the pressure?", "Was this his fault?"],
    hi: ["Ye shot kyun?", "Chhod sakta tha kya?", "Pressure kitna tha?", "Kya isme uski galti thi?"]
  }
};

let model = null, index = -1, lang = "en", timer = null, chat = [];
let gameState = "idle", gameTimeout = null, goTime = 0;
const $ = id => document.getElementById(id);
const setText = (id, t) => { $(id).textContent = t; };
const pct = p => Math.round(p * 100);
const bowled = b => { const p = b.over.split("."); return Number(p[0]) * 6 + Number(p[1]); };

function winProb(score, wkts, balls) {
  const need = MATCH.target - score;
  if (need <= 0) return 1;
  if (wkts >= 10 || balls >= 120) return 0;
  const left = 120 - balls, rrr = Math.min(need * 6 / left, model.rrr_cap);
  return 1 / (1 + Math.exp(-(model.intercept + model.rrr * rrr + model.wickets * wkts + model.balls_left_frac * left / 120)));
}

function showScoreboard() {
  setText("team", MATCH.chasingTeam + " chasing " + MATCH.target + " (" + MATCH.bowlingTeam + " " + MATCH.firstInningsTotal + ")");
  if (index < 0) {
    setText("score", "0/0"); setText("overs", "0.0 ov"); setText("need", "Need " + MATCH.target + " off 120");
    setText("crr", "-"); setText("rrr", (MATCH.target * 6 / 120).toFixed(2)); setText("inhand", "10"); $("rrrChip").className = "chip"; return;
  }
  const b = MATCH.balls[index], n = bowled(b), left = 120 - n, need = MATCH.target - b.score;
  setText("score", b.score + "/" + b.wkts); setText("overs", b.over + " ov");
  setText("need", need > 0 ? "Need " + need + " off " + left : MATCH.chasingTeam + " win!");
  setText("crr", (b.score * 6 / n).toFixed(2));
  const rrr = need > 0 && left > 0 ? need * 6 / left : null;
  setText("rrr", rrr === null ? "-" : rrr.toFixed(2)); setText("inhand", String(10 - b.wkts));
  $("rrrChip").className = rrr !== null && rrr >= 12 ? "chip hot" : "chip";
}

function showOverTracker() {
  const box = $("overBalls"); box.innerHTML = "";
  if (index < 0) return;
  const cur = bowled(MATCH.balls[index]), start = Math.floor((cur - 1) / 6) * 6;
  for (let i = 0; i <= index; i++) {
    const b = MATCH.balls[i], n = bowled(b);
    if (n <= start || n > cur) continue;
    const el = document.createElement("span");
    el.textContent = b.wicket ? "W" : b.runs === 0 ? "\u2022" : String(b.runs);
    el.className = b.wicket ? "out" : b.runs === 6 ? "r6" : b.runs === 4 ? "r4" : "";
    box.appendChild(el);
  }
}

const ZONES = { "long off": 22.5, "cover": 67.5, "point": 112.5, "third man": 157.5, "fine leg": 202.5, "square leg": 247.5, "midwicket": 292.5, "long on": 337.5 };
function pt(a, r) { const t = a * Math.PI / 180; return (100 + r * Math.sin(t)).toFixed(1) + "," + (100 - r * Math.cos(t)).toFixed(1); }
function buildZones() {
  let h = "";
  for (const name in ZONES) {
    const c = ZONES[name], l = pt(c, 68).split(",");
    h += '<path class="zone" data-zone="' + name + '" d="M100,100 L' + pt(c - 22.5, 90) + " A90,90 0 0 1 " + pt(c + 22.5, 90) + ' Z"/>';
    h += '<text class="zl" x="' + l[0] + '" y="' + l[1] + '">' + name + "</text>";
  }
  $("zones").innerHTML = h;
}
function showField(b) {
  document.querySelectorAll("#field .zone").forEach(z => z.setAttribute("class", z.dataset.zone === b.zone ? "zone on" : "zone"));
  const line = $("shotLine"), end = $("shotEnd"), a = ZONES[b.zone];
  if (a === undefined) {
    setText("fieldNote", b.wicket ? "Out. No shot played through the field." : "No shot direction (simulated)");
    line.setAttribute("class", "shot hide"); end.setAttribute("class", "shotend hide"); return;
  }
  const d = b.runs >= 4 ? 88 : b.wicket ? 78 : 50, r = a * Math.PI / 180;
  const x = (100 + d * Math.sin(r)).toFixed(1), y = (113 - d * Math.cos(r)).toFixed(1), six = b.runs === 6 ? " six" : "";
  setText("fieldNote", (b.wicket ? "Out: " + b.shot : b.shot + (b.runs ? ", " + b.runs + " run" + (b.runs > 1 ? "s" : "") : ", no run")) + " (simulated)");
  line.setAttribute("x2", x); line.setAttribute("y2", y); end.setAttribute("cx", x); end.setAttribute("cy", y);
  end.setAttribute("class", "shotend" + six); line.setAttribute("class", "shot" + six); void line.getBoundingClientRect();
  line.setAttribute("class", "shot draw" + six);
}

function context(b) {
  const n = bowled(b), needB = MATCH.target - (b.score - b.runs), leftB = 120 - (n - 1);
  const rate = (needB * 6 / leftB).toFixed(1), inHand = 10 - (b.wkts - (b.wicket ? 1 : 0));
  return { rate, inHand, attack: needB * 6 / leftB >= 10 };
}
function story(b) {
  const w = decisionWindow(b.speed).toFixed(2), sp = b.speed, turn = b.type === "spin";
  if (b.wicket) return { en: b.bowler + " sent down a " + sp + " km/h " + b.length + " ball. " + b.batter + " had " + w + " s to read it, and it got there first.", hi: b.bowler + " ne " + sp + " km/h ki ball dali. " + b.batter + " ke paas padhne ko " + w + " s the, ball pehle pahunch gayi." };
  if (b.runs === 6) return { en: w + " s to decide" + (turn ? ", with the turn to read as well" : "") + ". He still cleared the rope.", hi: "Decide karne ko " + w + " s" + (turn ? ", upar se turn bhi padhna tha" : "") + ". Phir bhi ball rope ke paar." };
  if (b.runs === 4) return { en: w + " s to pick the gap, and he found it.", hi: "Gap dhoondhne ko " + w + " s, aur usne dhoondh liya." };
  return { en: w + " s to decide and nothing to show for it. That is how thin the margin is.", hi: "Decide karne ko " + w + " s, aur run nahi bana. Margin itna hi patla hai." };
}
function judge(b) {
  const c = context(b), w = decisionWindow(b.speed).toFixed(2);
  return { en: c.rate + " an over needed, " + c.inHand + " wickets in hand, " + w + " s to choose a shot." + (c.attack ? " Attack was the only option." : ""),
    hi: c.rate + " run per over chahiye the, " + c.inHand + " wicket haath mein, shot chunne ko " + w + " s." + (c.attack ? " Attack karna hi tha." : "") };
}

// ---------- Chat ----------
function delivery(b) {
  if (b.type === "spin") return "spin, turns after pitching";
  if (b.speed <= 130) return "slower ball";
  if (b.length === "short") return "short ball or bouncer";
  if (b.length === "full" && b.speed >= 145) return "yorker or full ball";
  return "good-length pace ball";
}
function addMsg(cls, text) {
  const el = document.createElement("div"); el.className = "m " + cls; el.textContent = text;
  $("msgs").appendChild(el); $("msgs").scrollTop = $("msgs").scrollHeight; return el;
}
function buildSugg() {
  $("sugg").innerHTML = "";
  T.sugg[lang].forEach(q => { const b = document.createElement("button"); b.textContent = q; b.onclick = () => ask(q); $("sugg").appendChild(b); });
}
function facts(b) {
  const c = context(b), n = bowled(b);
  const before = winProb(b.score - b.runs, b.wkts - (b.wicket ? 1 : 0), n - 1), after = winProb(b.score, b.wkts, n);
  const recent = MATCH.balls.slice(Math.max(0, index - 3), index).map(x => x.over + " " + (x.wicket ? "wicket" : x.runs + " runs"));
  return {
    over: b.over, bowler: b.bowler, batter: b.batter, speed_kmh: b.speed, length: b.length, delivery_type: b.type,
    likely_delivery: delivery(b), shot: b.shot, shot_zone: b.zone || "none", runs: b.runs, wicket: b.wicket,
    seconds_ball_takes_to_arrive: Number(timeToBatter(b.speed).toFixed(2)), reaction_time_seconds: REACTION_S,
    seconds_to_decide: Number(decisionWindow(b.speed).toFixed(2)),
    batter_score: b.batRuns + " off " + b.batBalls, bowler_figures: b.bowlFig,
    runs_per_over_needed: Number(c.rate), wickets_in_hand: c.inHand, target: MATCH.target, score_after: b.score + "/" + b.wkts,
    win_chance_before_pct: pct(before), win_chance_after_pct: pct(after), previous_balls: recent
  };
}
function ask(preset) {
  const q = (typeof preset === "string" ? preset : $("askIn").value).trim();
  if (index < 0) { addMsg("sys", T.ready[lang]); return; }
  if (!q || $("askBtn").disabled) return;
  const b = MATCH.balls[index], at = index, history = chat.slice(-6);
  $("askIn").value = ""; addMsg("u", q); chat.push({ role: "user", content: q });
  $("askBtn").disabled = true; const wait = addMsg("a", T.thinking[lang]);
  fetch("/api/explain", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ facts: facts(b), question: q, lang: lang, history: history }) })
    .then(r => { if (!r.ok) throw new Error("fail"); return r.json(); })
    .then(d => { if (!d.text) throw new Error("empty"); if (at === index) { wait.textContent = d.text; chat.push({ role: "assistant", content: d.text }); } else wait.remove(); })
    .catch(() => { if (at === index) wait.textContent = story(b)[lang] + " " + T.unavailable[lang]; else wait.remove(); })
    .then(() => { $("askBtn").disabled = false; });
}

// ---------- Reaction game ----------
function resetGame() { clearTimeout(gameTimeout); gameState = "idle"; setText("gameBtn", "Start"); $("gameBtn").className = ""; setText("gameResult", ""); }
function gameClick() {
  if (index < 0) { setText("gameResult", T.ready[lang]); return; }
  if (gameState === "idle") {
    gameState = "waiting"; setText("gameBtn", "Wait..."); setText("gameResult", "");
    gameTimeout = setTimeout(() => { gameState = "go"; goTime = performance.now(); setText("gameBtn", "TAP NOW"); $("gameBtn").className = "go"; }, 1000 + Math.random() * 2000);
    return;
  }
  if (gameState === "waiting") { resetGame(); setText("gameResult", lang === "en" ? "Too early. He can't do that either." : "Bahut jaldi. Wo bhi aisa nahi kar sakta."); return; }
  const rt = (performance.now() - goTime) / 1000, arrives = timeToBatter(MATCH.balls[index].speed), left = arrives - rt;
  const you = rt.toFixed(2), ball = arrives.toFixed(2); let msg;
  if (left > 0) msg = lang === "en" ? "You: " + you + " s. Ball: " + ball + " s. You'd have " + left.toFixed(2) + " s to swing. He has to decide inside that." : "Tum: " + you + " s. Ball: " + ball + " s. Swing ke liye " + left.toFixed(2) + " s bachte. Usse pehle decide bhi karna hai.";
  else msg = lang === "en" ? "You: " + you + " s. Ball: " + ball + " s. It's already past you. Still blaming the batter?" : "Tum: " + you + " s. Ball: " + ball + " s. Nikal chuki hai. Ab bhi batter ko dosh doge?";
  gameState = "idle"; setText("gameBtn", "Go again"); $("gameBtn").className = ""; setText("gameResult", msg);
}

// ---------- Ball panel ----------
function showCard() {
  setText("hook", T.hook[lang]); setText("gameLabel", T.gameLabel[lang]); setText("gameHint", T.gameHint[lang]); setText("judgeLabel", T.judge[lang]);
  buildSugg();
  if (index < 0) {
    setText("tag", "READY"); $("tag").className = "tag"; setText("diff", "");
    setText("headline", T.ready[lang]); setText("detail", "");
    ["batterName", "batterStats", "bowlerName", "bowlerStats", "tBall", "tReact", "window", "judgeText", "wp"].forEach(id => setText(id, ""));
    $("barBall").style.width = "0%"; $("barReact").style.width = "0%"; $("wpFill").style.width = "50%";
    document.querySelectorAll("#field .zone").forEach(z => z.setAttribute("class", "zone"));
    $("shotLine").setAttribute("class", "shot hide"); $("shotEnd").setAttribute("class", "shotend hide"); setText("fieldNote", "Shots appear here as the chase unfolds."); return;
  }
  const b = MATCH.balls[index], n = bowled(b);
  const before = winProb(b.score - b.runs, b.wkts - (b.wicket ? 1 : 0), n - 1), after = winProb(b.score, b.wkts, n);
  const arrives = timeToBatter(b.speed), win = decisionWindow(b.speed), lv = level(b);
  let tag = b.runs === 0 ? "DOT BALL" : b.runs + " RUNS", cls = "tag";
  if (b.wicket) { tag = "WICKET"; cls = "tag wicket"; } else if (b.runs === 6) { tag = "SIX"; cls = "tag six"; } else if (b.runs === 4) { tag = "FOUR"; cls = "tag four"; }
  setText("tag", tag); $("tag").className = cls; setText("diff", T.diff[lv][lang]); $("diff").className = "diff " + lv;
  setText("headline", b.over + "  " + b.bowler + " to " + b.batter);
  setText("detail", b.speed + " km/h " + b.type + ", " + b.length + " length, " + b.shot);
  setText("batterName", b.batter); setText("batterStats", b.batRuns + " (" + b.batBalls + "), SR " + (b.batRuns / b.batBalls * 100).toFixed(1) + (b.wicket ? ", out" : ""));
  setText("bowlerName", b.bowler); setText("bowlerStats", b.bowlFig);
  setText("tBall", arrives.toFixed(2) + " s"); setText("tReact", REACTION_S.toFixed(2) + " s");
  $("barBall").style.width = arrives / MAX_BAR_S * 100 + "%"; $("barReact").style.width = REACTION_S / MAX_BAR_S * 100 + "%";
  setText("window", win.toFixed(2) + " s"); setText("judgeText", judge(b)[lang]); showField(b);
  const ch = pct(after) - pct(before);
  setText("wp", MATCH.chasingTeam + " win chance " + pct(before) + "% \u2192 " + pct(after) + "% (" + (ch >= 0 ? "+" : "") + ch + ")");
  $("wpFill").style.width = pct(after) + "%";
}

function drawSpark() {
  const W = 300, H = 80, N = MATCH.balls.length, xy = (i, p) => (i / N * W).toFixed(1) + "," + (H - p * H).toFixed(1);
  const pts = [xy(0, winProb(0, 0, 0))]; let dots = "";
  for (let i = 0; i <= index; i++) {
    const b = MATCH.balls[i], p = winProb(b.score, b.wkts, bowled(b)); pts.push(xy(i + 1, p));
    if (b.wicket || b.runs === 6) { const c = xy(i + 1, p).split(","); dots += '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="4" fill="' + (b.wicket ? "#c8503f" : "#d9a35b") + '"/>'; }
  }
  $("spark").innerHTML = '<line class="mid" x1="0" y1="' + H / 2 + '" x2="' + W + '" y2="' + H / 2 + '"/><polyline class="ln" points="' + pts.join(" ") + '"/>' + dots;
}

function render() {
  chat = []; $("msgs").innerHTML = ""; addMsg("sys", index < 0 ? T.ready[lang] : (lang === "en" ? "Pick a question or type your own. I only use this ball's numbers." : "Question chuno ya khud likho. Main sirf is ball ke numbers use karta hoon."));
  $("askIn").value = ""; resetGame(); showScoreboard(); showOverTracker(); showCard(); drawSpark();
  $("nextBtn").disabled = index >= MATCH.balls.length - 1;
}
function stopAuto() { clearInterval(timer); timer = null; setText("autoBtn", "Auto-play"); }
function nextBall() { if (index < MATCH.balls.length - 1) { index++; render(); } if (index >= MATCH.balls.length - 1) stopAuto(); }
function toggleAuto() { if (timer) { stopAuto(); return; } setText("autoBtn", "Pause"); nextBall(); timer = setInterval(nextBall, 6000); }
function setLang(l) { lang = l; $("enBtn").className = l === "en" ? "on" : ""; $("hiBtn").className = l === "hi" ? "on" : ""; showCard(); }

function start() {
  buildZones();
  $("nextBtn").onclick = nextBall; $("autoBtn").onclick = toggleAuto;
  $("resetBtn").onclick = () => { stopAuto(); index = -1; render(); };
  $("startBtn").onclick = () => { if (index < 0) nextBall(); $("room").scrollIntoView(); };
  $("enBtn").onclick = () => setLang("en"); $("hiBtn").onclick = () => setLang("hi"); $("gameBtn").onclick = gameClick;
  $("askBtn").onclick = () => ask(); $("askIn").onkeydown = e => { if (e.key === "Enter") ask(); };
  fetch("model.json").then(r => r.json()).then(m => { model = m; render(); })
    .catch(() => setText("error", "Could not load model.json. Run from a local server, not file://."));
}
if (typeof MATCH !== "undefined") start();