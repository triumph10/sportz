// app.js - physics + model + page logic.
// SIMPLE ESTIMATES: constant ball speed, straight line, ignores the bounce
// slowing the ball down. Real balls arrive a little later than this.

// ---------- Physics ----------
const PITCH_M = 17.7;    // popping crease to popping crease is 17.68 m
const REACTION_S = 0.2;  // typical lab reaction time, about a fifth of a second
const MAX_BAR_S = 0.8;   // a bar this long = 0.8 seconds

function timeToBatter(speedKmh) {
  return PITCH_M / (speedKmh / 3.6);
}

function decisionWindow(speedKmh) {
  return timeToBatter(speedKmh) - REACTION_S;
}

// Rule uses the same rounded number the card shows (2 decimals).
function difficultyLevel(ball) {
  if (ball.type === "spin") return "spin";
  if (Number(decisionWindow(ball.speed).toFixed(2)) <= 0.25) return "predict";
  return "tight";
}

const MESSAGES = {
  predict: {
    en: "The batter must predict the ball before it lands.",
    hi: "Batter ko ball land hone se pehle hi andaza lagana padta hai."
  },
  spin: {
    en: "Slower, but the ball changes direction after the bounce.",
    hi: "Ball slow hai, lekin bounce ke baad direction badal leti hai."
  },
  tight: {
    en: "Very little time to decide the shot.",
    hi: "Shot decide karne ka time bahut kam hai."
  }
};

// ---------- Win probability ----------
let model = null; // filled from model.json

function winProb(score, wkts, ballsBowled) {
  const need = MATCH.target - score;
  if (need <= 0) return 1;
  if (wkts >= 10 || ballsBowled >= 120) return 0;
  const left = 120 - ballsBowled;
  const rrr = Math.min(need * 6 / left, model.rrr_cap);
  const z = model.intercept + model.rrr * rrr + model.wickets * wkts +
            model.balls_left_frac * left / 120;
  return 1 / (1 + Math.exp(-z));
}

function ballsBowled(ball) {
  const parts = ball.over.split(".");
  return Number(parts[0]) * 6 + Number(parts[1]);
}

// ---------- Page state ----------
let index = -1;          // index of the last ball shown (-1 = none yet)
let lang = "en";
let timer = null;
let chart = null;

// reaction game state: "idle", "waiting" or "go"
let gameState = "idle";
let gameTimeout = null;
let goTime = 0;

const $ = function (id) { return document.getElementById(id); };

function pct(p) { return Math.round(p * 100); }

function setText(id, text) { $(id).textContent = text; }

// ---------- Scoreboard ----------
function showScoreboard() {
  setText("team", MATCH.chasingTeam + " chasing " + MATCH.target +
    " (" + MATCH.bowlingTeam + " " + MATCH.firstInningsTotal + ")");
  if (index < 0) {
    setText("score", "0/0");
    setText("overs", "Overs: 0.0");
    setText("need", "Need " + MATCH.target + " off 120 balls");
    return;
  }
  const b = MATCH.balls[index];
  const left = 120 - ballsBowled(b);
  const need = MATCH.target - b.score;
  setText("score", b.score + "/" + b.wkts);
  setText("overs", "Overs: " + b.over);
  setText("need", need > 0 ? "Need " + need + " off " + left + " balls"
                           : MATCH.chasingTeam + " win!");
}

// ---------- Player strip (simulated numbers) ----------
function showPlayers(b) {
  const sr = (b.batRuns / b.batBalls * 100).toFixed(1);
  let batter = b.batRuns + " (" + b.batBalls + "), SR " + sr;
  if (b.wicket) batter += ", out";
  setText("batterName", b.batter);
  setText("batterStats", batter);
  setText("bowlerName", b.bowler);
  setText("bowlerStats", b.bowlFig);
}

// ---------- Field map (simulated direction) ----------
function showField(b) {
  const zones = document.querySelectorAll("#field .zone");
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    const hit = z.getAttribute("data-zone") === b.zone;
    z.setAttribute("class", hit ? "zone on" : "zone");
  }
  setText("fieldNote", b.zone ? "Shot went to: " + b.zone
                              : "No shot direction for this ball.");
}

// ---------- Before you judge ----------
// Uses only numbers we already have: runs needed per over BEFORE this ball,
// wickets in hand BEFORE this ball, and the time to decide.
function showJudge(b) {
  const n = ballsBowled(b);
  const needBefore = MATCH.target - (b.score - b.runs);
  const leftBefore = 120 - (n - 1);
  const rate = needBefore * 6 / leftBefore;
  const wktsBefore = b.wkts - (b.wicket ? 1 : 0);
  const inHand = 10 - wktsBefore;
  const w = decisionWindow(b.speed).toFixed(2);
  const r = rate.toFixed(1);

  let en, hi;
  if (b.wicket) {
    en = "Needed " + r + " an over with " + inHand + " wickets in hand. " +
         "He had only " + w + " s to decide, so even a small misjudgement can end it.";
    hi = r + " run per over chahiye the, " + inHand + " wicket haath mein. " +
         "Decide karne ke liye sirf " + w + " s the, isliye chhoti si galti bhi out kara sakti hai.";
  } else if (rate >= 10) {
    en = "Needed " + r + " an over with " + inHand + " wickets in hand, so he had to attack. " +
         "And he had only " + w + " s to decide.";
    hi = r + " run per over chahiye the, " + inHand + " wicket haath mein, isliye attack karna hi tha. " +
         "Aur decide karne ke liye sirf " + w + " s the.";
  } else {
    en = "Needed " + r + " an over with " + inHand + " wickets in hand. " +
         "Even a calm shot had to be decided in only " + w + " s.";
    hi = r + " run per over chahiye the, " + inHand + " wicket haath mein. " +
         "Shant shot bhi sirf " + w + " s mein decide karna tha.";
  }
  setText("judgeLabel", lang === "en" ? "Before you judge" : "Judge karne se pehle");
  setText("judgeText", lang === "en" ? en : hi);
}

// ---------- Reaction game ----------
// Measures tap time after a green flash and compares it to this ball.
// The result includes screen and touch delay, so it reads a little slow.
function resetGame() {
  if (gameTimeout) { clearTimeout(gameTimeout); gameTimeout = null; }
  gameState = "idle";
  setText("gameBtn", "Start");
  $("gameBtn").className = "";
  setText("gameResult", "");
}

function gameClick() {
  if (index < 0) return;

  if (gameState === "idle") {
    gameState = "waiting";
    setText("gameBtn", "Wait...");
    setText("gameResult", "");
    gameTimeout = setTimeout(function () {
      gameState = "go";
      goTime = performance.now();
      setText("gameBtn", "TAP NOW");
      $("gameBtn").className = "go";
    }, 1000 + Math.random() * 2000);
    return;
  }

  if (gameState === "waiting") {
    resetGame();
    setText("gameResult", lang === "en" ? "Too early, try again."
                                        : "Bahut jaldi tap kiya, phir try karo.");
    return;
  }

  // gameState === "go"
  const rt = (performance.now() - goTime) / 1000;
  const arrives = timeToBatter(MATCH.balls[index].speed);
  const left = arrives - rt;
  const you = rt.toFixed(2);
  const ball = arrives.toFixed(2);
  let msg;
  if (left > 0) {
    msg = lang === "en"
      ? "You: " + you + " s. This ball arrives in " + ball + " s, so you would have " +
        left.toFixed(2) + " s left to move the bat."
      : "Tumhara time: " + you + " s. Ball " + ball + " s mein aati hai, bat chalane ke liye " +
        left.toFixed(2) + " s bachte.";
  } else {
    msg = lang === "en"
      ? "You: " + you + " s. This ball arrives in " + ball + " s, so it would already have passed you."
      : "Tumhara time: " + you + " s. Ball " + ball + " s mein aati hai, tab tak nikal chuki hoti.";
  }
  gameState = "idle";
  setText("gameBtn", "Try again");
  $("gameBtn").className = "";
  setText("gameResult", msg);
}

// ---------- Card ----------
function showCard() {
  if (index < 0) { $("card").hidden = true; return; }
  const b = MATCH.balls[index];
  const n = ballsBowled(b);
  const before = winProb(b.score - b.runs, b.wkts - (b.wicket ? 1 : 0), n - 1);
  const after = winProb(b.score, b.wkts, n);
  const arrives = timeToBatter(b.speed);
  const window_ = decisionWindow(b.speed);

  $("card").hidden = false;

  // tag
  let tag = b.runs === 0 ? "DOT BALL" : b.runs + " RUNS";
  let tagClass = "tag";
  if (b.wicket) { tag = "WICKET"; tagClass = "tag wicket"; }
  else if (b.runs === 6) { tag = "SIX"; tagClass = "tag six"; }
  else if (b.runs === 4) { tag = "FOUR"; }
  setText("tag", tag);
  $("tag").className = tagClass;

  setText("headline", b.over + "  " + b.bowler + " to " + b.batter);
  setText("detail", b.speed + " km/h " + b.type + ", " + b.length +
    " length, " + b.shot);

  showPlayers(b);
  showField(b);

  // two-bar timeline
  setText("tBall", arrives.toFixed(2) + " s");
  setText("tReact", REACTION_S.toFixed(2) + " s");
  $("barBall").style.width = (arrives / MAX_BAR_S * 100) + "%";
  $("barReact").style.width = (REACTION_S / MAX_BAR_S * 100) + "%";

  setText("window", "Time left to decide: " + window_.toFixed(2) + " s");
  setText("msg", MESSAGES[difficultyLevel(b)][lang]);

  showJudge(b);

  // commentary (from commentary.js)
  let text = "(Commentary not generated yet)";
  if (typeof COMMENTARY !== "undefined" && COMMENTARY[b.id]) {
    text = COMMENTARY[b.id][lang];
  }
  setText("text", text);

  const change = pct(after) - pct(before);
  setText("wp", MATCH.chasingTeam + " win chance: " + pct(before) + "% \u2192 " +
    pct(after) + "% (" + (change >= 0 ? "+" : "") + change + ")");
}

// ---------- Chart ----------
function makeChart() {
  if (typeof Chart === "undefined") {
    setText("error", "Chart could not load (check your internet).");
    return;
  }
  Chart.defaults.color = "#9fb3c8";
  Chart.defaults.borderColor = "rgba(255, 255, 255, 0.08)";
  chart = new Chart($("chart"), {
    type: "line",
    data: { labels: ["Start"], datasets: [{
      label: MATCH.chasingTeam + " win %",
      data: [pct(winProb(0, 0, 0))],
      borderColor: "#22d3ee", backgroundColor: "#22d3ee",
      pointBackgroundColor: ["#22d3ee"], tension: 0.2
    }] },
    options: {
      scales: { y: { min: 0, max: 100 } },
      plugins: { legend: { display: false } }
    }
  });
}

function updateChart() {
  if (!chart) return;
  const labels = ["Start"];
  const data = [pct(winProb(0, 0, 0))];
  const colors = ["#22d3ee"];
  for (let i = 0; i <= index; i++) {
    const b = MATCH.balls[i];
    labels.push(b.over);
    data.push(pct(winProb(b.score, b.wkts, ballsBowled(b))));
    colors.push(b.wicket ? "#ff3b4e" : "#22d3ee");
  }
  chart.data.labels = labels;
  chart.data.datasets[0].data = data;
  chart.data.datasets[0].pointBackgroundColor = colors;
  chart.update();
}

// ---------- Buttons ----------
function render() {
  resetGame();   // a new ball means a new game
  showScoreboard();
  showCard();
  updateChart();
  $("nextBtn").disabled = index >= MATCH.balls.length - 1;
}

function nextBall() {
  if (index < MATCH.balls.length - 1) {
    index++;
    render();
  }
  if (index >= MATCH.balls.length - 1) stopAuto();
}

function stopAuto() {
  if (timer) { clearInterval(timer); timer = null; }
  setText("autoBtn", "Auto-play");
}

function toggleAuto() {
  if (timer) { stopAuto(); return; }
  setText("autoBtn", "Pause");
  nextBall();
  timer = setInterval(nextBall, 4000);
}

function reset() {
  stopAuto();
  index = -1;
  render();
}

function setLang(l) {
  lang = l;
  $("enBtn").className = l === "en" ? "on" : "";
  $("hiBtn").className = l === "hi" ? "on" : "";
  showCard();
}

// ---------- Start ----------
function start() {
  fetch("model.json")
    .then(function (r) { return r.json(); })
    .then(function (m) {
      model = m;
      makeChart();
      render();
      $("nextBtn").onclick = nextBall;
      $("autoBtn").onclick = toggleAuto;
      $("resetBtn").onclick = reset;
      $("enBtn").onclick = function () { setLang("en"); };
      $("hiBtn").onclick = function () { setLang("hi"); };
      $("gameBtn").onclick = gameClick;
    })
    .catch(function () {
      setText("error", "Could not load model.json.");
    });
}

if (typeof document !== "undefined" && typeof MATCH !== "undefined") {
  start();
}