// match.js - SIMULATED demo match. Not real data.
// Speed and length are made up (free tracking data does not exist).
// "over" = overs completed . ball in current over, e.g. "19.6" = last ball of the match.
// "score" and "wkts" are the totals AFTER that ball.
// NEW (all simulated, values are totals AFTER that ball):
//   zone      = where the shot went or was caught (one of 8 fixed names), null if no direction
//   batRuns   = this batter's runs
//   batBalls  = this batter's balls faced
//   bowlFig   = this bowler's figures "wickets/runs (overs.balls)"
// Zones assume right-handed batters.

const MATCH = {
  chasingTeam: "Harbour Hawks",
  bowlingTeam: "Coastal Kings",
  firstInningsTotal: "175/6",
  target: 176,
  balls: [
  { id: 1, over: "0.4", bowler: "T. Nair", type: "pace", speed: 147, length: "full", batter: "A. Rao", shot: "cover drive", runs: 4, wicket: false, score: 7, wkts: 0, zone: "cover", batRuns: 7, batBalls: 4, bowlFig: "0/7 (0.4)" },
  { id: 2, over: "1.5", bowler: "R. Malik", type: "pace", speed: 144, length: "short", batter: "A. Rao", shot: "pull", runs: 6, wicket: false, score: 15, wkts: 0, zone: "midwicket", batRuns: 13, batBalls: 8, bowlFig: "0/6 (0.5)" },
  { id: 3, over: "2.2", bowler: "T. Nair", type: "pace", speed: 148, length: "good", batter: "K. Desai", shot: "edge past slip", runs: 4, wicket: false, score: 21, wkts: 0, zone: "third man", batRuns: 6, batBalls: 5, bowlFig: "0/13 (1.2)" },
  { id: 4, over: "3.5", bowler: "R. Malik", type: "pace", speed: 149, length: "full", batter: "A. Rao", shot: "yorker, bowled", runs: 0, wicket: true, score: 28, wkts: 1, zone: null, batRuns: 20, batBalls: 13, bowlFig: "1/12 (1.5)" },
  { id: 5, over: "4.4", bowler: "D. Sharma", type: "pace", speed: 142, length: "short", batter: "K. Desai", shot: "pull", runs: 6, wicket: false, score: 36, wkts: 1, zone: "midwicket", batRuns: 16, batBalls: 13, bowlFig: "0/8 (0.4)" },
  { id: 6, over: "5.2", bowler: "T. Nair", type: "pace", speed: 146, length: "short", batter: "K. Desai", shot: "pull, caught at deep square leg", runs: 0, wicket: true, score: 40, wkts: 2, zone: "square leg", batRuns: 18, batBalls: 15, bowlFig: "1/20 (2.2)" },
  { id: 7, over: "6.3", bowler: "S. Menon", type: "spin", speed: 89, length: "good", batter: "N. Kapoor", shot: "sweep", runs: 4, wicket: false, score: 48, wkts: 2, zone: "square leg", batRuns: 10, batBalls: 7, bowlFig: "0/6 (0.3)" },
  { id: 8, over: "7.5", bowler: "V. Bhat", type: "spin", speed: 94, length: "full", batter: "N. Kapoor", shot: "lofted over long-off", runs: 6, wicket: false, score: 58, wkts: 2, zone: "long off", batRuns: 18, batBalls: 12, bowlFig: "0/8 (0.5)" },
  { id: 9, over: "8.3", bowler: "S. Menon", type: "spin", speed: 92, length: "good", batter: "Y. Verma", shot: "lofted drive", runs: 4, wicket: false, score: 62, wkts: 2, zone: "long off", batRuns: 6, batBalls: 9, bowlFig: "0/12 (1.3)" },
  { id: 10, over: "9.4", bowler: "V. Bhat", type: "spin", speed: 88, length: "good", batter: "N. Kapoor", shot: "beaten by turn, stumped", runs: 0, wicket: true, score: 64, wkts: 3, zone: null, batRuns: 20, batBalls: 16, bowlFig: "1/9 (1.4)" },
  { id: 11, over: "10.3", bowler: "D. Sharma", type: "pace", speed: 141, length: "full", batter: "Y. Verma", shot: "straight drive", runs: 4, wicket: false, score: 73, wkts: 3, zone: "long off", batRuns: 12, batBalls: 17, bowlFig: "0/15 (1.3)" },
  { id: 12, over: "11.5", bowler: "V. Bhat", type: "spin", speed: 93, length: "good", batter: "Y. Verma", shot: "reverse sweep", runs: 4, wicket: false, score: 84, wkts: 3, zone: "point", batRuns: 19, batBalls: 21, bowlFig: "1/19 (2.5)" },
  { id: 13, over: "12.4", bowler: "S. Menon", type: "spin", speed: 90, length: "good", batter: "Y. Verma", shot: "sweep", runs: 4, wicket: false, score: 90, wkts: 3, zone: "fine leg", batRuns: 25, batBalls: 24, bowlFig: "0/18 (2.4)" },
  { id: 14, over: "13.2", bowler: "D. Sharma", type: "pace", speed: 128, length: "short", batter: "P. Joshi", shot: "slower ball, caught at mid-on", runs: 0, wicket: true, score: 94, wkts: 4, zone: "long on", batRuns: 8, batBalls: 10, bowlFig: "1/20 (2.2)" },
  { id: 15, over: "14.1", bowler: "R. Malik", type: "pace", speed: 145, length: "short", batter: "Y. Verma", shot: "pull", runs: 6, wicket: false, score: 102, wkts: 4, zone: "square leg", batRuns: 34, batBalls: 28, bowlFig: "1/18 (2.1)" },
  { id: 16, over: "15.3", bowler: "D. Sharma", type: "pace", speed: 140, length: "full", batter: "Y. Verma", shot: "lofted over long-on", runs: 6, wicket: false, score: 113, wkts: 4, zone: "long on", batRuns: 43, batBalls: 33, bowlFig: "1/28 (3.3)" },
  { id: 17, over: "16.2", bowler: "V. Bhat", type: "spin", speed: 93, length: "good", batter: "M. Pillai", shot: "slog sweep over midwicket", runs: 6, wicket: false, score: 125, wkts: 4, zone: "midwicket", batRuns: 14, batBalls: 10, bowlFig: "1/29 (3.2)" },
  { id: 18, over: "17.3", bowler: "T. Nair", type: "pace", speed: 148, length: "short", batter: "M. Pillai", shot: "pull", runs: 6, wicket: false, score: 134, wkts: 4, zone: "midwicket", batRuns: 22, batBalls: 15, bowlFig: "1/28 (3.3)" },
  { id: 19, over: "17.6", bowler: "T. Nair", type: "pace", speed: 145, length: "full", batter: "Y. Verma", shot: "drive over cover", runs: 6, wicket: false, score: 146, wkts: 4, zone: "cover", batRuns: 52, batBalls: 37, bowlFig: "1/40 (4.0)" },
  { id: 20, over: "18.3", bowler: "R. Malik", type: "pace", speed: 146, length: "full", batter: "Y. Verma", shot: "yorker squeezed past point", runs: 4, wicket: false, score: 155, wkts: 4, zone: "point", batRuns: 61, batBalls: 40, bowlFig: "1/32 (3.3)" },
  { id: 21, over: "18.5", bowler: "R. Malik", type: "pace", speed: 148, length: "full", batter: "Y. Verma", shot: "scoop over the keeper", runs: 4, wicket: false, score: 159, wkts: 4, zone: "fine leg", batRuns: 65, batBalls: 42, bowlFig: "1/36 (3.5)" },
  { id: 22, over: "19.1", bowler: "A. Khan", type: "pace", speed: 143, length: "good", batter: "Y. Verma", shot: "straight drive", runs: 4, wicket: false, score: 164, wkts: 4, zone: "long off", batRuns: 70, batBalls: 44, bowlFig: "0/4 (0.1)" },
  { id: 23, over: "19.3", bowler: "A. Khan", type: "pace", speed: 121, length: "short", batter: "Y. Verma", shot: "slower ball, holed out at long-on", runs: 0, wicket: true, score: 165, wkts: 5, zone: "long on", batRuns: 71, batBalls: 46, bowlFig: "1/5 (0.3)" },
  { id: 24, over: "19.4", bowler: "A. Khan", type: "pace", speed: 144, length: "full", batter: "R. Dutta", shot: "six over long-on", runs: 6, wicket: false, score: 171, wkts: 5, zone: "long on", batRuns: 6, batBalls: 1, bowlFig: "1/11 (0.4)" },
  { id: 25, over: "19.5", bowler: "A. Khan", type: "pace", speed: 145, length: "full", batter: "R. Dutta", shot: "dug out, no run", runs: 0, wicket: false, score: 171, wkts: 5, zone: null, batRuns: 6, batBalls: 2, bowlFig: "1/11 (0.5)" },
  { id: 26, over: "19.6", bowler: "A. Khan", type: "pace", speed: 143, length: "full", batter: "R. Dutta", shot: "six over long-on", runs: 6, wicket: false, score: 177, wkts: 5, zone: "long on", batRuns: 12, batBalls: 3, bowlFig: "1/17 (1.0)" }
  ]
};