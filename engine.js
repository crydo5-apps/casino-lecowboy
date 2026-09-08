export const REGULARS = ['10','J','Q','K','A','hat','cactus','pistols','skull','badge'];
export const PAYTABLE = {
  '10': [0.2,0.4,0.6,2,10,50], 'J': [0.2,0.4,0.6,2,10,50], 'Q': [0.2,0.4,0.6,2,10,50], 'K': [0.2,0.4,0.6,2,10,50], 'A': [0.2,0.4,0.6,2,10,50],
  hat: [0.4,0.6,1,3,15,75], cactus: [0.4,0.6,1,3,15,75], pistols: [0.6,1,2,5,20,100], skull: [0.6,1,2,5,20,100], badge: [1,1.4,3,10,50,200]
};
const SPECIALS = ['bronze','silver','gold','diamond','clover','goldclover','bag','reload'];
const SPECIAL_VALUES = { bronze:[1,2,3,4], silver:[5,10,15,20], gold:[25,50,100], diamond:[150,250,500], clover:[2,3,4,5,10,20], goldclover:[2,3,4,5,10,20] };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const key = (r,c) => `${r}:${c}`;
const pos = (value) => value.split(':').map(Number);
const random = (max) => Math.floor(Math.random() * max);
const pick = (values) => values[random(values.length)];
const cell = (id) => ({ kind:'regular', id });

export function symbolName(id) { return id === 'wild' ? 'wild' : id; }
export function isRegular(value) { return value?.kind === 'regular'; }
export function isWild(value) { return isRegular(value) && value.id === 'wild'; }
export function createSpecial(type) { return { kind:'special', subtype:type, value: SPECIAL_VALUES[type] ? pick(SPECIAL_VALUES[type]) : 0 }; }
export function cloneGrid(grid) { return grid.map((row) => row.map((item) => ({ ...item }))); }

function weightedSymbol(options = {}) {
  const pool = [['10',6.5],['J',6.5],['Q',6.5],['K',6.5],['A',6.5],['hat',3],['cactus',3],['pistols',2.5],['skull',2.5],['badge',1.5],['wild',options.wildBoost ? 2.4 : 1.2],['scatter',options.allowScatter === false ? 0 : 0.9]];
  const total = pool.reduce((sum, item) => sum + item[1], 0); let roll = Math.random() * total;
  for (const [id, weight] of pool) { roll -= weight; if (roll <= 0) return id; }
  return '10';
}

export function rollGrid(options = {}) {
  const grid = Array.from({ length:5 }, () => Array.from({ length:6 }, () => cell(weightedSymbol(options))));
  let scatters = grid.flat().filter((item) => item.id === 'scatter').length;
  if (options.forceWilds) {
    let changed = 0;
    for (let r=0;r<5 && changed<2;r++) for (let c=0;c<6 && changed<2;c++) if (grid[r][c].id !== 'scatter') { grid[r][c] = cell('wild'); changed++; }
  }
  if (Math.random() < (options.bonusChance || 0.38) && scatters < 3) {
    const type = pick(REGULARS.slice(0, 9)); const row = random(5); const start = random(2); const useWild = Math.random() < (options.wildClusterChance || 0.16);
    for (let i=0;i<5;i++) grid[row][start+i] = cell(useWild && i === 4 ? 'wild' : type);
  }
  scatters = grid.flat().filter((item) => item.id === 'scatter').length;
  return { grid, scatters };
}

export function findClusters(grid) {
  const wins = [];
  for (const type of REGULARS) {
    const visited = new Set();
    for (let r=0;r<5;r++) for (let c=0;c<6;c++) {
      const start = grid[r]?.[c]; const startKey = key(r,c);
      if (visited.has(startKey) || !isRegular(start) || (start.id !== type && start.id !== 'wild')) continue;
      const queue = [[r,c]], cells = []; visited.add(startKey);
      while (queue.length) {
        const [cr,cc] = queue.shift(); cells.push([cr,cc]);
        for (const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nr=cr+dr, nc=cc+dc, nextKey=key(nr,nc), next=grid[nr]?.[nc];
          if (nr>=0 && nr<5 && nc>=0 && nc<6 && !visited.has(nextKey) && isRegular(next) && (next.id===type || next.id==='wild')) { visited.add(nextKey); queue.push([nr,nc]); }
        }
      }
      if (cells.length >= 5) wins.push({ type, cells, size:cells.length, payout:PAYTABLE[type][Math.min(5, cells.length >= 14 ? 5 : Math.floor((cells.length-5)/2))] });
    }
  }
  return wins;
}

function refill(grid, wins, options) {
  const winTypes = new Set(wins.map((win) => win.type));
  const removed = new Set(wins.flatMap((win) => win.cells.map(([r,c]) => key(r,c))));
  for (let r=0;r<5;r++) for (let c=0;c<6;c++) if (isRegular(grid[r][c]) && (removed.has(key(r,c)) || grid[r][c].id === 'wild' || winTypes.has(grid[r][c].id))) removed.add(key(r,c));
  const next = Array.from({ length:5 }, () => Array(6).fill(null));
  for (let c=0;c<6;c++) {
    const survivors=[];
    for (let r=4;r>=0;r--) if (!removed.has(key(r,c))) survivors.push(grid[r][c]);
    for (let r=4, i=0;r>=0;r--,i++) next[r][c] = survivors[i] || cell(weightedSymbol({ ...options, allowScatter:false }));
  }
  return { next, removed };
}

export function resolveCascades(initialGrid, options = {}, onEvent = () => {}) {
  let grid = cloneGrid(initialGrid), total = 0, cascadeCount = 0, winsCount = 0, wilds = 0;
  for (let guard=0;guard<14;guard++) {
    const wins = findClusters(grid); if (!wins.length) break;
    cascadeCount++; winsCount += wins.length;
    const wildCells = new Set(wins.flatMap((win) => win.cells.filter(([r,c]) => isWild(grid[r][c])).map(([r,c]) => key(r,c)))); wilds += wildCells.size;
    total += wins.reduce((sum, win) => sum + win.payout * options.bet, 0);
    onEvent({ type:'cascade', grid:cloneGrid(grid), wins, cascadeCount, total });
    const result = refill(grid, wins, options); grid = result.next;
    onEvent({ type:'drop', grid:cloneGrid(grid), removed:result.removed, cascadeCount });
  }
  return { grid, total, cascadeCount, winsCount, wilds };
}

function placeCylinders(grid, count) {
  const result = cloneGrid(grid), candidates=[];
  for (let r=0;r<5;r++) for (let c=0;c<6;c++) if (isRegular(result[r][c]) && result[r][c].id !== 'scatter') candidates.push([r,c]);
  for (let i=0;i<count && candidates.length;i++) { const at=candidates.splice(random(candidates.length),1)[0]; result[at[0]][at[1]]={kind:'cylinder',shots:2+random(5)}; }
  return result;
}
function randomTarget() { return [random(5),random(6)]; }
function revealOne(grid, options = {}) {
  const [r,c]=randomTarget(), target=grid[r][c];
  if (target?.kind === 'cylinder') return { grid, changed:false, at:[r,c] };
  if (target?.kind === 'special') {
    if (target.subtype === 'bronze') grid[r][c] = createSpecial('silver');
    else if (target.subtype === 'silver') grid[r][c] = createSpecial('gold');
    else if (target.subtype === 'clover') grid[r][c] = createSpecial('goldclover');
    else return { grid, changed:false, at:[r,c] };
    return { grid, changed:true, at:[r,c], upgraded:true };
  }
  const types = options.noBronze ? ['silver','silver','gold','diamond','clover','goldclover','bag','reload'] : SPECIALS;
  grid[r][c] = createSpecial(pick(types));
  return { grid, changed:true, at:[r,c] };
}

export function payoutSpecials(grid) {
  let coins = 0, bagCount = 0, multiplier = 1;
  const values=[];
  for (let r=0;r<5;r++) for (let c=0;c<6;c++) { const item=grid[r][c]; if (item?.kind !== 'special') continue; if (['bronze','silver','gold','diamond'].includes(item.subtype)) { coins += item.value; values.push({r,c,value:item.value}); } if (item.subtype === 'bag') bagCount++; }
  for (let r=0;r<5;r++) for (let c=0;c<6;c++) { const item=grid[r][c]; if (item?.kind !== 'special') continue; if (item.subtype === 'goldclover') multiplier *= item.value; if (item.subtype === 'clover') { let near=0; for (const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) { const n=grid[r+dr]?.[c+dc]; if (n?.kind==='special' && ['bronze','silver','gold','diamond','bag'].includes(n.subtype)) near++; } if (near) multiplier *= item.value; } }
  const bagValue = bagCount ? coins * multiplier : 0;
  return { total: (coins * multiplier) + bagValue, coins, bagValue, multiplier, bagCount, values };
}

export async function resolveRevolvers(initialGrid, cylinderCount, options = {}, onEvent = () => {}) {
  let grid = placeCylinders(initialGrid, cylinderCount), cylinders=[];
  for (let r=0;r<5;r++) for (let c=0;c<6;c++) if (grid[r][c]?.kind==='cylinder') cylinders.push({r,c,shots:grid[r][c].shots});
  let shotTotal=0, reloads=0;
  onEvent({ type:'cylinders', grid:cloneGrid(grid), count:cylinders.length });
  for (let loop=0;loop<4;loop++) {
    let fired=false;
    for (const cylinder of cylinders) while (cylinder.shots > 0) {
      cylinder.shots--; shotTotal++; fired=true; const shot=revealOne(grid, options); onEvent({type:'shot', grid:cloneGrid(grid), at:shot.at, shotTotal}); await sleep(options.delay || 95);
    }
    const reloadAt=[]; for (let r=0;r<5;r++) for (let c=0;c<6;c++) if (grid[r][c]?.kind==='special' && grid[r][c].subtype==='reload') reloadAt.push([r,c]);
    if (reloadAt.length) { const [rr,cc]=reloadAt[0]; grid[rr][cc]=createSpecial('silver'); reloads++; for (const cylinder of cylinders) cylinder.shots += 2+random(5); onEvent({type:'reload',grid:cloneGrid(grid)}); await sleep(options.delay || 95); continue; }
    if (!fired) break; break;
  }
  let payout=payoutSpecials(grid), loops=0;
  while (payout.bagCount && loops<2) { loops++; for (let i=0;i<Math.max(1,cylinders.length);i++) { const shot=revealOne(grid, options); onEvent({type:'lootReveal',grid:cloneGrid(grid),at:shot.at}); await sleep(options.delay || 95); } payout=payoutSpecials(grid); }
  onEvent({type:'specialPayout',grid:cloneGrid(grid),payout,shotTotal,reloads});
  return { grid, total:payout.total * options.bet, shotTotal, reloads, payout };
}

export async function fireCollector(initialGrid, bullets, options = {}, onEvent = () => {}) {
  const grid=cloneGrid(initialGrid); let shotTotal=0;
  for (let i=0;i<bullets;i++) { const shot=revealOne(grid, options); shotTotal++; onEvent({type:'bullet',grid:cloneGrid(grid),at:shot.at,shotTotal}); await sleep(options.delay || 85); }
  const payout=payoutSpecials(grid); onEvent({type:'specialPayout',grid:cloneGrid(grid),payout,shotTotal});
  return {grid,total:payout.total*options.bet,payout,shotTotal};
}

export function tierName(type) { return type === 'SALOON' ? 'High Noon Saloon' : type === 'TRAIL' ? 'Trail of Trickery' : 'Pistols at Dawn'; }