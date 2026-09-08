const STORAGE_KEY = 'le-cowboy-session-v1';

export const BETS = [0.05, 0.10, 0.25, 0.50, 1, 2, 5, 10, 20, 40];

export function freshState() {
  return {
    balance: 1000,
    bet: 1,
    gameState: 'IDLE',
    grid: [],
    pendingWin: 0,
    totalWon: 0,
    spins: 0,
    sound: true,
    turbo: false,
    autoplay: 0,
    autoplayTotal: 0,
    bonusType: null,
    freeSpinsRemaining: 0,
    bulletCollector: 0,
    collectorResetValue: 5,
    lastMessageKey: 'status.ready'
  };
}

export async function loadState() {
  const fallback = freshState();
  try {
    const raw = await window.miniappsAI?.storage?.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const saved = JSON.parse(raw);
    return {
      ...fallback,
      ...saved,
      balance: Number.isFinite(Number(saved.balance)) ? Number(saved.balance) : fallback.balance,
      bet: BETS.includes(Number(saved.bet)) ? Number(saved.bet) : fallback.bet,
      autoplay: 0,
      gameState: 'IDLE'
    };
  } catch (error) {
    return fallback;
  }
}

export async function saveState(state) {
  try {
    const payload = {
      balance: Math.max(0, Number(state.balance.toFixed(2))),
      bet: state.bet,
      totalWon: state.totalWon,
      spins: state.spins,
      sound: state.sound,
      turbo: state.turbo,
      bonusType: state.bonusType,
      freeSpinsRemaining: state.freeSpinsRemaining,
      bulletCollector: state.bulletCollector,
      collectorResetValue: state.collectorResetValue
    };
    await window.miniappsAI?.storage?.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (error) {
    return false;
  }
}

export function formatMoney(value) {
  return Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function nextBet(current, direction) {
  const index = BETS.indexOf(Number(current));
  const nextIndex = Math.min(BETS.length - 1, Math.max(0, (index < 0 ? 4 : index) + direction));
  return BETS[nextIndex];
}