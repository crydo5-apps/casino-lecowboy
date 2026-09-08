import { PAYTABLE } from './engine.js';
import { formatMoney } from './state.js';

export const t = (key, values = {}) => {
  const value = window.miniappI18n?.t(key, values) ?? key;
  return String(value);
};
const $ = (id) => document.getElementById(id);
const setText = (id, value) => { const node=$(id); if (node) node.textContent=String(value); };
const cellKey = (r,c) => `${r}:${c}`;
const SYMBOL_ASSETS = {
  '10': 'royal-10.png', J: 'royal-j.png', Q: 'royal-q.png', K: 'royal-k.png', A: 'royal-a.png',
  hat: 'cowboy-hat.png', cactus: 'cactus.png', pistols: 'crossed-pistols.png', skull: 'skull.png', badge: 'sheriff-badge.png',
  wild: 'wanted-wild.png', scatter: 'fs-scatter.png', cylinder: 'revolver-cylinder.png',
  bronze: 'bronze-coin.png', silver: 'silver-coin.png', gold: 'gold-coin.png', diamond: 'diamond.png',
  clover: 'green-clover.png', goldclover: 'gold-clover.png', bag: 'loot-bag.png', reload: 'reload.png'
};
const SYMBOL_ASSET_ROOT = './attached_assets/generated_images/symbols/';

const symbolClass = (item) => {
  if (!item) return 'royal';
  if (item.kind === 'cylinder') return 'cylinder';
  if (item.kind === 'special') return item.subtype;
  if (item.id === 'wild') return 'wild';
  if (item.id === 'scatter') return 'scatter';
  return ['hat','cactus','pistols','skull','badge'].includes(item.id) ? item.id : 'royal';
};
const symbolLabel = (item) => {
  if (!item) return '';
  if (item.kind === 'cylinder') return t('revolver.shots');
  if (item.kind === 'special') return t(`pay.${item.subtype}Short`);
  return item.id === '10' ? t('pay.royalShort') : t(`pay.${item.id}Short`);
};

export function renderGrid(grid, options = {}) {
  const root=$('reelGrid'); if (!root) return;
  const winners=new Set(options.winners || []), shot=options.shot ? cellKey(...options.shot) : '';
  root.replaceChildren();
  grid.forEach((row,r) => row.forEach((item,c) => {
    const cell=document.createElement('div'); cell.className='cell'; cell.setAttribute('role','gridcell'); cell.dataset.position=cellKey(r,c);
    if (winners.has(cellKey(r,c))) cell.classList.add('winner');
    if (options.drop) cell.classList.add('drop');
    if (shot === cellKey(r,c)) cell.classList.add('shot-target');
    const symbol=document.createElement('div'); const className=symbolClass(item); const assetKey=item?.kind==='special'?item.subtype:item?.kind==='cylinder'?'cylinder':item?.id; symbol.className=`symbol ${className}`; symbol.textContent=symbolLabel(item); symbol.setAttribute('aria-label',symbolLabel(item));
    if (SYMBOL_ASSETS[assetKey]) { symbol.classList.add('has-art'); symbol.style.backgroundImage=`url("${SYMBOL_ASSET_ROOT}${SYMBOL_ASSETS[assetKey]}")`; }
    if (item?.value && item.kind==='special' && !['clover','goldclover'].includes(item.subtype)) { const badge=document.createElement('span'); badge.className='special-value'; badge.textContent=`${item.value}×`; symbol.appendChild(badge); }
    cell.appendChild(symbol); root.appendChild(cell);
  }));
}

export function updateHud(state) {
  setText('balanceValue', formatMoney(state.balance)); setText('betValue', formatMoney(state.bet)); setText('betReadout', formatMoney(state.bet)); setText('spinHint', formatMoney(state.bet));
  setText('winValue', `WIN ${formatMoney(state.pendingWin)}`); setText('autoplayCount', state.autoplay > 0 ? `(${state.autoplay})` : '');
  const badge=$('bonusBadge'), collector=$('collectorPanel');
  if (state.bonusType && state.freeSpinsRemaining > 0) { badge?.classList.remove('hidden'); setText('bonusName', t(`bonus.${state.bonusType==='SALOON'?'saloonShort':state.bonusType==='TRAIL'?'trailShort':'pistolsShort'}`)); setText('freeSpinsValue', `${state.freeSpinsRemaining} FS`); } else badge?.classList.add('hidden');
  if (state.bonusType==='TRAIL' || state.bonusType==='PISTOLS') { collector?.classList.remove('hidden'); setText('bulletCount', state.bulletCollector); renderBullets(state.bulletCollector); } else collector?.classList.add('hidden');
  $('turboButton')?.classList.toggle('active', Boolean(state.turbo)); setText('turboState', state.turbo ? 'ON' : 'OFF');
  $('soundButton')?.classList.toggle('sound-on', state.sound); setText('soundIcon', state.sound ? 'ON' : 'OFF');
}
function renderBullets(count) { const root=$('bulletStack'); if (!root) return; root.style.opacity=count ? '1' : '.35'; root.title=t('collector.bullets',{count}); }
export function setStatus(key, values = {}) { setText('statusMessage', t(key, values)); }
export function setCharacter(key) { setText('characterLine', t(key)); }
export function setShotCount(value) { const node=$('shotCounter'); if (!node) return; node.classList.toggle('hidden', !value); node.querySelector('strong').textContent=String(value || 0); }

export function showToast(message, duration=2200) { const node=$('toast'); if (!node) return; node.textContent=message; node.classList.add('show'); window.clearTimeout(showToast.timer); showToast.timer=window.setTimeout(()=>node.classList.remove('show'),duration); }
export function celebrate(level) { const smokey=$('smokey'); smokey?.classList.add('celebrate'); window.setTimeout(()=>smokey?.classList.remove('celebrate'),1100); if (level >= 50) { const confetti=document.createElement('div'); confetti.className='confetti'; document.body.appendChild(confetti); window.setTimeout(()=>confetti.remove(),950); } }

function modalFrame(title, subtitle='') {
  const root=$('modalRoot'); root.classList.remove('hidden'); root.replaceChildren();
  const card=document.createElement('div'); card.className='modal-card';
  const close=document.createElement('button'); close.className='modal-close'; close.type='button'; close.setAttribute('aria-label',t('buttons.close')); close.textContent='×'; close.addEventListener('click',closeModal);
  const heading=document.createElement('h2'); heading.id='modalTitle'; heading.className='modal-title'; heading.textContent=title;
  const sub=document.createElement('p'); sub.className='modal-subtitle'; sub.textContent=subtitle;
  card.append(close,heading,sub); root.appendChild(card); root.onclick=(event)=>{if(event.target===root) closeModal();}; return card;
}
export function closeModal() { const root=$('modalRoot'); root.classList.add('hidden'); root.replaceChildren(); root.onclick=null; }
function section(card,title,content) { const block=document.createElement('section'); block.className='modal-section'; const h=document.createElement('h3'); h.textContent=title; const p=document.createElement('div'); p.appendChild(content); block.append(h,p); card.appendChild(block); }
function paragraph(text) { const p=document.createElement('p'); p.className='modal-subtitle'; p.textContent=text; return p; }

export function showPaytable() {
  const card=modalFrame(t('modal.paytableTitle'),t('modal.paytableIntro')); const grid=document.createElement('div'); grid.className='pay-grid';
  const items=[['10','10 / J / Q / K / A'],['hat',t('pay.hat')],['cactus',t('pay.cactus')],['pistols',t('pay.pistols')],['skull',t('pay.skull')],['badge',t('pay.badge')],['wild',t('pay.wild')],['scatter',t('pay.scatter')]];
  items.forEach(([id,name])=>{const item=document.createElement('div');item.className='pay-card';const icon=document.createElement('span');icon.className=`pay-symbol ${id}`;icon.textContent=id==='10'?'10':symbolLabel({kind:'regular',id});icon.setAttribute('aria-label',icon.textContent);if(SYMBOL_ASSETS[id]){icon.classList.add('has-art');icon.style.backgroundImage=`url("${SYMBOL_ASSET_ROOT}${SYMBOL_ASSETS[id]}")`;}const label=document.createElement('span');label.textContent=name;const value=document.createElement('strong');value.textContent=id==='wild'||id==='scatter'?'FEATURE':id==='10'?'0.2×–50×':id==='badge'?'1×–200×':id==='hat'||id==='cactus'?'0.4×–75×':'0.6×–100×';item.append(icon,label,value);grid.appendChild(item);});
  section(card,t('modal.symbols'),grid); section(card,t('modal.features'),paragraph(t('modal.featureText'))); section(card,t('modal.bonuses'),paragraph(t('modal.bonusText'))); section(card,t('modal.gamble'),paragraph(t('modal.gambleText'))); card.appendChild(paragraph(t('modal.disclosure')));
}

export function showAutoplay(onPick) {
  const card=modalFrame(t('modal.autoplayTitle'),t('modal.autoplayIntro')); const list=document.createElement('div'); list.className='modal-actions'; [10,25,50,100,250,500,1000].forEach((count)=>{const button=document.createElement('button');button.type='button';button.textContent=t('autoplay.spins',{count});button.addEventListener('click',()=>{onPick(count);closeModal();});list.appendChild(button);}); card.appendChild(list);
}
export function showBuyBonus(onPick) {
  const card=modalFrame(t('modal.buyTitle'),t('modal.buyIntro')); const list=document.createElement('div'); list.className='option-list'; const options=[['HUNT','buy.hunt','buy.huntDesc',3],['WILD','buy.wild','buy.wildDesc',75],['SALOON','buy.saloon','buy.saloonDesc',65],['TRAIL','buy.trail','buy.trailDesc',250]];
  options.forEach(([id,name,desc,price])=>{const button=document.createElement('button');button.type='button';button.className='option-card';const copy=document.createElement('span');const title=document.createElement('span');title.textContent=t(name);const detail=document.createElement('small');detail.textContent=t(desc);copy.append(title,detail);const cost=document.createElement('strong');cost.className='option-price';cost.textContent=t('buy.price',{amount:price});button.append(copy,cost);button.addEventListener('click',()=>{onPick({id,price});closeModal();});list.appendChild(button);}); card.appendChild(list);
}
export function showGamble(type, onChoice) {
  const card=modalFrame(t('modal.gambleTitle'),t('modal.playPrompt')); const wheel=document.createElement('div'); wheel.className='gamble-wheel'; const count=type==='SALOON'?4:8; for(let i=1;i<=count;i++){const chamber=document.createElement('div');chamber.className='chamber';chamber.textContent=String(i);wheel.appendChild(chamber);} card.appendChild(wheel); const result=document.createElement('div');result.className='result-panel';result.textContent=t('modal.gambleIntro');card.appendChild(result); const actions=document.createElement('div');actions.className='choice-row'; const play=document.createElement('button');play.className='primary';play.type='button';play.textContent=t('buttons.play');const gamble=document.createElement('button');gamble.type='button';gamble.textContent=t('buttons.gamble');actions.append(play,gamble);card.appendChild(actions);
  play.addEventListener('click',()=>{closeModal();onChoice('play');}); gamble.addEventListener('click',()=>{gamble.disabled=true;play.disabled=true;const chambers=[...wheel.children];let index=0;const timer=window.setInterval(()=>{chambers.forEach((node)=>node.classList.remove('active'));chambers[index%count].classList.add('active');index++;if(index>count+4){window.clearInterval(timer);const roll=Math.floor(Math.random()*count)+1;chambers.forEach((node)=>node.classList.remove('active'));chambers[roll-1].classList.add('active');result.textContent=roll===1?t('modal.upgrade',{bonus:type==='SALOON'?t('bonus.trail'):t('bonus.pistols')}):t('modal.instant');const done=document.createElement('button');done.type='button';done.className='primary';done.textContent=roll===1?t('buttons.play'):t('buttons.collect');actions.replaceChildren(done);done.addEventListener('click',()=>{closeModal();onChoice(roll===1?(type==='SALOON'?'upgradeTrail':'upgradePistols'):{cash:true,roll});});}},95);});
}

export function setBusy(isBusy) { const ids=['spinButton','betDown','betUp','maxBetButton','autoplayButton','buyButton']; ids.forEach((id)=>{const node=$(id);if(node)node.disabled=isBusy;}); }
export function animateGridEvent(event) { renderGrid(event.grid,{winners:event.wins?.flatMap((win)=>win.cells.map(([r,c])=>cellKey(r,c))) || [],shot:event.at,drop:event.type==='drop'}); if(event.type==='shot'||event.type==='bullet') setShotCount(Math.max(0, (event.totalShots || 0)-event.shotTotal)); }
