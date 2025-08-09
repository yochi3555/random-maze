import React, { useEffect, useRef, useState, useMemo } from "react";

// 🌀 Random Maze — React + Canvas (single file)
// 操作: 矢印キー / WASD。モバイルは画面のD-Pad。
// 目的: スタート(左上)からゴール(右下)まで到達。

const CANVAS_W = 560;
const CANVAS_H = 560;

function randChoice(arr) {
  return arr[(Math.random() * arr.length) | 0];
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function carveMaze(cols, rows) {
  // Each cell: { visited, walls: [top,right,bottom,left] }
  const cells = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ visited: false, walls: [true, true, true, true] }))
  );

  const stack = [];
  const start = { x: 0, y: 0 };
  stack.push(start);
  cells[start.y][start.x].visited = true;

  const dir = [
    { dx: 0, dy: -1, a: 0, b: 2 }, // up affects current top(0) & neighbor bottom(2)
    { dx: 1, dy: 0, a: 1, b: 3 }, // right
    { dx: 0, dy: 1, a: 2, b: 0 }, // down
    { dx: -1, dy: 0, a: 3, b: 1 }, // left
  ];

  while (stack.length) {
    const cur = stack[stack.length - 1];
    const neigh = [];
    for (const d of dir) {
      const nx = cur.x + d.dx;
      const ny = cur.y + d.dy;
      if (nx >= 0 && ny >= 0 && nx < cols && ny < rows && !cells[ny][nx].visited) {
        neigh.push({ nx, ny, d });
      }
    }
    if (neigh.length === 0) {
      stack.pop();
      continue;
    }
    const { nx, ny, d } = randChoice(neigh);
    // knock down walls between cur and next
    cells[cur.y][cur.x].walls[d.a] = false;
    cells[ny][nx].walls[d.b] = false;
    cells[ny][nx].visited = true;
    stack.push({ x: nx, y: ny });
  }

  return cells;
}

function drawMaze(ctx, grid, player, goal, cellSize) {
  const cols = grid[0].length;
  const rows = grid.length;

  // clear
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // background
  const g = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
  g.addColorStop(0, "#0ea5e9"); // sky-400
  g.addColorStop(1, "#0f172a"); // slate-900
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // grid offset center
  const mazeW = cols * cellSize;
  const mazeH = rows * cellSize;
  const offX = Math.floor((ctx.canvas.width - mazeW) / 2);
  const offY = Math.floor((ctx.canvas.height - mazeH) / 2);

  // cells background
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(offX - 2, offY - 2, mazeW + 4, mazeH + 4);

  // cells floor
  ctx.fillStyle = "#1e293b"; // slate-800
  ctx.fillRect(offX, offY, mazeW, mazeH);

  // draw walls
  ctx.strokeStyle = "#94a3b8"; // slate-400
  ctx.lineWidth = 3;
  ctx.lineCap = "round";

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = grid[y][x];
      const cx = offX + x * cellSize;
      const cy = offY + y * cellSize;
      if (cell.walls[0]) { // top
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + cellSize, cy);
        ctx.stroke();
      }
      if (cell.walls[1]) { // right
        ctx.beginPath();
        ctx.moveTo(cx + cellSize, cy);
        ctx.lineTo(cx + cellSize, cy + cellSize);
        ctx.stroke();
      }
      if (cell.walls[2]) { // bottom
        ctx.beginPath();
        ctx.moveTo(cx, cy + cellSize);
        ctx.lineTo(cx + cellSize, cy + cellSize);
        ctx.stroke();
      }
      if (cell.walls[3]) { // left
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, cy + cellSize);
        ctx.stroke();
      }
    }
  }

  // goal tile
  const gx = offX + goal.x * cellSize;
  const gy = offY + goal.y * cellSize;
  ctx.fillStyle = "#10b981"; // emerald-500
  ctx.fillRect(gx + 4, gy + 4, cellSize - 8, cellSize - 8);

  // player
  const px = offX + player.x * cellSize + cellSize / 2;
  const py = offY + player.y * cellSize + cellSize / 2;
  ctx.beginPath();
  ctx.arc(px, py, Math.min(10, cellSize * 0.35), 0, Math.PI * 2);
  ctx.fillStyle = "#f59e0b"; // amber-500
  ctx.fill();
}

function useKeyControls(onMove) {
  useEffect(() => {
    const handle = (e) => {
      const k = e.key.toLowerCase();
      if (["arrowup", "w"].includes(k)) {
        e.preventDefault();
        onMove(0, -1);
      } else if (["arrowright", "d"].includes(k)) {
        e.preventDefault();
        onMove(1, 0);
      } else if (["arrowdown", "s"].includes(k)) {
        e.preventDefault();
        onMove(0, 1);
      } else if (["arrowleft", "a"].includes(k)) {
        e.preventDefault();
        onMove(-1, 0);
      }
    };
    window.addEventListener("keydown", handle, { passive: false });
    return () => window.removeEventListener("keydown", handle);
  }, [onMove]);
}

function useBest(storageKey, initial = null) {
  const [best, setBest] = useState(() => {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : initial;
  });
  useEffect(() => {
    if (best) localStorage.setItem(storageKey, JSON.stringify(best));
  }, [best, storageKey]);
  return [best, setBest];
}

export default function RandomMaze() {
  const canvasRef = useRef(null);
  const [cols, setCols] = useState(15);
  const [rows, setRows] = useState(15);
  const cellSize = useMemo(() => Math.floor(Math.min(CANVAS_W, CANVAS_H) / Math.max(cols, rows)), [cols, rows]);

  const [grid, setGrid] = useState(() => carveMaze(cols, rows));
  const [player, setPlayer] = useState({ x: 0, y: 0 });
  const [goal, setGoal] = useState({ x: cols - 1, y: rows - 1 });

  const [moves, setMoves] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [timeMs, setTimeMs] = useState(0);
  const [won, setWon] = useState(false);

  const bestKey = `maze_best_${cols}x${rows}`;
  const [best, setBest] = useBest(bestKey, null);

  // timer
  useEffect(() => {
    if (!startTime || won) return;
    const t = setInterval(() => setTimeMs(Date.now() - startTime), 50);
    return () => clearInterval(t);
  }, [startTime, won]);

  // draw
  useEffect(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!ctx) return;
    // HiDPI scaling
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    c.width = CANVAS_W * dpr;
    c.height = CANVAS_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawMaze(ctx, grid, player, goal, cellSize);
  }, [grid, player, goal, cellSize]);

  function regenerate(newCols = cols, newRows = rows) {
    const c = Math.max(5, Math.min(51, newCols | 0));
    const r = Math.max(5, Math.min(51, newRows | 0));
    setCols(c);
    setRows(r);
    const g = carveMaze(c, r);
    setGrid(g);
    setPlayer({ x: 0, y: 0 });
    setGoal({ x: c - 1, y: r - 1 });
    setMoves(0);
    setStartTime(Date.now());
    setTimeMs(0);
    setWon(false);
  }

  useEffect(() => {
    // initialize first maze
    regenerate(cols, rows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tryMove = (dx, dy) => {
    if (won) return;
    const x = player.x;
    const y = player.y;
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) return;
    const cell = grid[y][x];
    // walls: [top,right,bottom,left]
    if (dx === 1 && cell.walls[1]) return;
    if (dx === -1 && cell.walls[3]) return;
    if (dy === 1 && cell.walls[2]) return;
    if (dy === -1 && cell.walls[0]) return;

    setPlayer({ x: nx, y: ny });
    setMoves((m) => m + 1);

    if (nx === goal.x && ny === goal.y) {
      const finishMs = Date.now() - startTime;
      setTimeMs(finishMs);
      setWon(true);
      if (!best || finishMs < best.timeMs) {
        setBest({ timeMs: finishMs, moves: moves + 1, cols, rows, at: Date.now() });
      }
    }
  };

  useKeyControls(tryMove);

  // touch D-Pad
  const DPadBtn = ({ label, onClick, className = "" }) => (
    <button
      onClick={onClick}
      className={`rounded-xl bg-slate-800/70 text-slate-100 hover:bg-slate-700 border border-white/10 px-4 py-3 ${className}`}
    >
      {label}
    </button>
  );

  const pretty = (ms) => {
    const s = Math.floor(ms / 1000);
    const cs = Math.floor((ms % 1000) / 10);
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen w-full bg-slate-900 text-slate-100 p-4 grid place-items-center">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xl font-bold">🌀 Random Maze</div>
            <div className="text-slate-300 text-sm">WASD / 矢印キーで移動。スタート(左上) → ゴール(右下)。</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-xs text-slate-400">BEST ({cols}×{rows})</div>
              <div className="font-bold">{best ? `${pretty(best.timeMs)} / ${best.moves}steps` : "--"}</div>
            </div>
            <button
              className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold"
              onClick={() => regenerate(cols, rows)}
            >
              Regenerate
            </button>
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="w-full h-auto bg-black touch-none select-none"
            onTouchStart={(e) => {
              const t = e.changedTouches[0];
              canvasRef.current.__sx = t.clientX;
              canvasRef.current.__sy = t.clientY;
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              const t = e.changedTouches[0];
              const dx = t.clientX - (canvasRef.current.__sx || 0);
              const dy = t.clientY - (canvasRef.current.__sy || 0);
              const ax = Math.abs(dx), ay = Math.abs(dy);
              if (Math.max(ax, ay) < 18) return; // tiny tap ignore
              if (ax > ay) {
                tryMove(dx > 0 ? 1 : -1, 0);
              } else {
                tryMove(0, dy > 0 ? 1 : -1);
              }
            }}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="text-sm text-slate-300">経過: <span className="font-semibold">{pretty(timeMs)}</span> ／ ステップ: <span className="font-semibold">{moves}</span></div>
          <div className="ml-auto flex items-center gap-2">
            <label className="text-sm text-slate-300">サイズ</label>
            <input
              type="number"
              min={5}
              max={51}
              value={cols}
              onChange={(e) => setCols(Math.max(5, Math.min(51, Number(e.target.value))))}
              className="w-20 rounded-lg bg-slate-800 border border-white/10 px-2 py-1"
            />
            <span>×</span>
            <input
              type="number"
              min={5}
              max={51}
              value={rows}
              onChange={(e) => setRows(Math.max(5, Math.min(51, Number(e.target.value))))}
              className="w-20 rounded-lg bg-slate-800 border border-white/10 px-2 py-1"
            />
            <button
              className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold"
              onClick={() => regenerate(cols, rows)}
            >
              サイズ変更
            </button>
          </div>
        </div>

        {/* D-Pad for touch */}
        <div className="mt-4 grid grid-cols-3 gap-2 max-w-xs mx-auto">
          <div />
          <DPadBtn label="↑" onClick={() => tryMove(0, -1)} />
          <div />
          <DPadBtn label="←" onClick={() => tryMove(-1, 0)} />
          <div />
          <DPadBtn label="→" onClick={() => tryMove(1, 0)} />
          <div />
          <DPadBtn label="↓" onClick={() => tryMove(0, 1)} />
          <div />
        </div>

        {won && (
          <div className="mt-4 p-4 rounded-2xl bg-emerald-600/20 border border-emerald-500/40">
            <div className="text-lg font-semibold">🎉 クリア！</div>
            <div className="text-slate-200">タイム: {pretty(timeMs)} ／ ステップ: {moves}</div>
            <div className="mt-2 flex gap-2">
              <button
                className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold"
                onClick={() => regenerate(cols, rows)}
              >
                もう一回
              </button>
              <button
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-white/10"
                onClick={() => {
                  setWon(false);
                  setMoves(0);
                  setStartTime(Date.now());
                }}
              >
                続けて探索
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
