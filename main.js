import { BETS, freshState, loadState, saveState, nextBet, formatMoney } from './state.js';
import { rollGrid, resolveCascades, resolveRevolvers, fireCollector, tierName } from './engine.js';
import { t, renderGrid, updateHud, setStatus, setCharacter, setShotCount, showToast, celebrate, showPaytable, showAutoplay, showBuyBonus, showGamble, closeModal, setBusy } from './ui.js';

let state = freshState();
let savedOverrides = {};
let soundContext;
const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
const money = (value) => formatMoney(value);

function beep(frequency=440, duration=.06) {
  if (!state.sound) return;
  try { soundContext ||= new (window.AudioContext || window.webkitAudioContext)(); const oscillator=soundContext.createOscillator(); const gain=soundContext.createGain(); oscillator.frequency.value=frequency; oscillator.type='triangle'; gain.gain.setValueAtTime(.035,soundContext.currentTime); gain.gain.exponentialRampToValueAtTime(.001,soundContext.currentTime+duration); oscillator.connect(gain).connect(soundContext.destination); oscillator.start(); oscillator.stop(soundContext.currentTime+duration); } catch (error) { /* audio is optional */ }
}

function sync() { updateHud(state); }
async function persist() { if (!(await saveState(state))) showToast(t('errors.save')); }
function setState(next) { state={...state,...next}; sync(); }
function revealOptions() { return { bet:state.bet, noBronze:state.bonusType==='PISTOLS', delay:state.turbo?25:65 }; }

function winLevel(value) { if (value >= 1000) return 'epicWin'; if (value >= 200) return 'hugeWin'; if (value >= 50) return 'megaWin'; if (value >= 15) return 'bigWin'; return ''; }
function winStatus(value) { const level=winLevel(value/state.bet); return level ? { key:`status.${level}` } : { key:'status.win', values:{amount:money(value)} }; }
function cashFromGamble(type, roll) {
  if (type==='SALOON') { if (roll===2) return [1,2,3,4][Math.floor(Math.random()*4)]; if (roll===3) return [5,10,15,20][Math.floor(Math.random()*4)]; return [25,50,100][Math.floor(Math.random()*3)]; }
  if (roll<=3) return [5,10,15,20][Math.floor(Math.random()*4)]; if (roll<=7) return [25,50,100][Math.floor(Math.random()*3)]; return [150,250,500][Math.floor(Math.random()*3)];
}

function startBonus(type, shouldAsk=true) {
  setState({bonusType:type, freeSpinsRemaining:10, bulletCollector:type==='PISTOLS'?5:0, collectorResetValue:5, gameState:'IDLE'});
  setStatus('bonus.start',{name:t(`bonus.${type==='SALOON'?'saloon':type==='TRAIL'?'trail':'pistols'}`)}); setCharacter('character.big'); beep(660,.14); persist();
  if (shouldAsk && type!=='PISTOLS') window.setTimeout(()=>showGamble(type, handleGamble),220); else window.setTimeout(()=>runSpin(),420);
}
function handleGamble(choice) {
  if (choice==='play') { state.gameState='IDLE'; sync(); runSpin(); return; }
  if (choice==='upgradeTrail') { startBonus('TRAIL',true); return; }
  if (choice==='upgradePistols') { startBonus('PISTOLS',false); return; }
  if (choice?.cash) { const amount=cashFromGamble(state.bonusType,choice.roll)*state.bet; state.balance+=amount; state.totalWon+=amount; state.gameState='IDLE'; state.pendingWin=amount; state.bonusType=null; state.freeSpinsRemaining=0; state.bulletCollector=0; sync(); setStatus('status.win',{amount:money(amount)}); showToast(t('modal.cashAward')); beep(740,.15); persist(); }
}

async function renderEngineEvent(event) {
  if (event.type==='cascade') { setStatus('status.cascade'); renderGrid(event.grid,{winners:event.wins.flatMap((win)=>win.cells.map(([r,c])=>`${r}:${c}`))}); beep(520,.04); await wait(state.turbo?35:110); }
  else if (event.type==='drop') { renderGrid(event.grid,{drop:true}); await wait(state.turbo?35:100); }
  else if (event.type==='cylinders') { setStatus('status.revolver'); setCharacter('character.shoot'); setShotCount(event.count*4); renderGrid(event.grid); beep(300,.08); }
  else if (event.type==='shot'||event.type==='bullet'||event.type==='lootReveal') { renderGrid(event.grid,{shot:event.at}); setShotCount(Math.max(0,(event.totalShots||event.shotTotal||0)-event.shotTotal)); beep(event.type==='bullet'?390:570,.045); await wait(state.turbo?20:80); }
  else if (event.type==='reload') { setStatus('revolver.reload'); renderGrid(event.grid); setShotCount(6); beep(250,.12); }
  else if (event.type==='specialPayout') { renderGrid(event.grid); setShotCount(0); if (event.payout?.total) setStatus('status.win',{amount:money(event.payout.total*state.bet)}); }
}

async function runSpin() {
  if (state.gameState!=='IDLE') return;
  const inBonus=Boolean(state.bonusType && state.freeSpinsRemaining>0);
  if (!inBonus && state.balance < state.bet) { showToast(t('status.noBalance')); return; }
  const override={...savedOverrides}; savedOverrides={};
  if (!inBonus) state.balance-=state.bet; else state.freeSpinsRemaining=Math.max(0,state.freeSpinsRemaining-1);
  state.spins+=1; state.gameState='SPINNING'; state.pendingWin=0; sync(); setBusy(true); setStatus(inBonus?'status.bonus':'status.spinning'); setCharacter('character.spin'); beep(180,.05);
  const options={...override, allowScatter:state.bonusType!=='PISTOLS', wildBoost:inBonus, bonusChance:override.bonusChance ?? (inBonus?.62:.38), wildClusterChance:inBonus?.28:.16};
  const landed=rollGrid(options); state.grid=landed.grid; renderGrid(state.grid,{drop:true}); await wait(state.turbo?55:170);
  const cascades=resolveCascades(state.grid,{bet:state.bet,...options},(event)=>{ renderEngineEvent(event); });
  state.grid=cascades.grid; await wait(state.turbo?45:130);
  let total=cascades.total;
  if (cascades.wilds && landed.scatters<3) { const reveal=await resolveRevolvers(state.grid,cascades.wilds,revealOptions(),renderEngineEvent); state.grid=reveal.grid; total+=reveal.total; }
  if (inBonus && (state.bonusType==='TRAIL'||state.bonusType==='PISTOLS')) {
    const before=state.bulletCollector; state.bulletCollector+=cascades.winsCount;
    setStatus('bonus.collectorReady',{count:state.bulletCollector}); sync();
    const shouldFire=state.bonusType==='PISTOLS' || state.freeSpinsRemaining===0;
    if (shouldFire && state.bulletCollector>0) { const bullets=state.bulletCollector; setStatus('bonus.collectorFire',{count:bullets}); setCharacter('character.shoot'); const fired=await fireCollector(state.grid,bullets,revealOptions(),renderEngineEvent); state.grid=fired.grid; total+=fired.total; state.bulletCollector=state.bonusType==='PISTOLS'?Math.max(before,5):0; }
  }
  state.pendingWin=total; state.balance+=total; state.totalWon+=total; state.gameState='IDLE'; sync(); await wait(state.turbo?60:160);
  if (total>0) { const result=winStatus(total); setStatus(result.key,result.values); setCharacter(total/state.bet>=15?'character.big':'character.win'); celebrate(total/state.bet); beep(total/state.bet>=15?860:620,.16); }
  else setStatus('status.ready');
  await persist();
  const scatterCount=landed.scatters;
  if (inBonus) {
    if (scatterCount===2 && state.bonusType!=='PISTOLS') { state.freeSpinsRemaining+=2; setStatus('bonus.retriggers',{count:2}); }
    if (scatterCount>=3 && state.bonusType!=='PISTOLS') { state.freeSpinsRemaining+=4; setStatus('bonus.retriggers',{count:4}); }
    sync();
    if (state.freeSpinsRemaining>0) { setBusy(false); if (state.autoplay===0) window.setTimeout(()=>runSpin(),state.turbo?180:550); else window.setTimeout(()=>runSpin(),state.turbo?120:350); return; }
    const finished=state.bonusType; state.bonusType=null; state.bulletCollector=0; sync(); showToast(t('modal.roundComplete')); setCharacter('character.idle');
    if (finished) { await persist(); }
  } else if (scatterCount>=3) {
    const type=scatterCount>=5?'PISTOLS':scatterCount===4?'TRAIL':'SALOON'; startBonus(type,true);
  }
  setBusy(false);
  if (state.autoplay>0 && !state.bonusType) { state.autoplay-=1; sync(); if (state.autoplay>0) window.setTimeout(()=>runSpin(),state.turbo?130:480); else setStatus('autoplay.done'); }
}

function buyFeature(option) {
  const cost=option.price*state.bet; if (state.balance<cost) { showToast(t('status.noBalance')); return; }
  state.balance-=cost; sync(); beep(240,.1);
  if (option.id==='SALOON') startBonus('SALOON',true); else if (option.id==='TRAIL') startBonus('TRAIL',true); else if (option.id==='HUNT') { savedOverrides={bonusChance:.85}; showToast(t('buy.huntDesc')); setBusy(false); runSpin(); } else { savedOverrides={forceWilds:true,wildBoost:true}; showToast(t('buy.wildDesc')); setBusy(false); runSpin(); }
}

function startAutoplay(count) { if (state.gameState!=='IDLE') return; state.autoplay=count; state.autoplayTotal=count; sync(); setStatus('status.autoplay'); runSpin(); }
function bind() {
  document.getElementById('spinButton')?.addEventListener('click',runSpin);
  document.getElementById('betDown')?.addEventListener('click',()=>{if(state.gameState==='IDLE'){state.bet=nextBet(state.bet,-1);sync();beep(320);}});
  document.getElementById('betUp')?.addEventListener('click',()=>{if(state.gameState==='IDLE'){state.bet=nextBet(state.bet,1);sync();beep(420);}});
  document.getElementById('maxBetButton')?.addEventListener('click',()=>{if(state.gameState==='IDLE'){state.bet=BETS[BETS.length-1];sync();beep(470);}});
  document.getElementById('turboButton')?.addEventListener('click',()=>{state.turbo=!state.turbo;sync();persist();});
  document.getElementById('soundButton')?.addEventListener('click',()=>{state.sound=!state.sound;sync();if(state.sound)beep(620);persist();});
  document.getElementById('infoButton')?.addEventListener('click',showPaytable); document.getElementById('paytableButton')?.addEventListener('click',showPaytable);
  document.getElementById('autoplayButton')?.addEventListener('click',()=>{if(state.autoplay>0){state.autoplay=0;sync();setStatus('status.ready');}else showAutoplay(startAutoplay);});
  document.getElementById('buyButton')?.addEventListener('click',()=>showBuyBonus(buyFeature));
  document.addEventListener('keydown',(event)=>{if(event.code==='Space' && state.gameState==='IDLE' && document.getElementById('modalRoot').classList.contains('hidden')){event.preventDefault();runSpin();}});
}

async function boot() {
  try {
    const response = await fetch('./locales/en.json');
    const messages = await response.json();
    window.miniappI18n = { t(key, values = {}) { const value = key.split('.').reduce((current, part) => current?.[part], messages); return String(value ?? key).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? `{${name}}`); } };
  } catch (error) { /* The host miniapp may provide its own translator. */ }
  state=await loadState(); bind(); sync(); renderGrid(state.grid.length===5?state.grid:rollGrid({allowScatter:false}).grid); setStatus('status.ready');
}
window.addEventListener('DOMContentLoaded',boot);
