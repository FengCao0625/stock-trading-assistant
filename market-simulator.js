/**
 * MarketEngine v5 — 腾讯财经 XHR 实时行情引擎
 * 主数据源: qt.gtimg.cn (XHR)  备用: hq.sinajs.cn (XHR)  兜底: 本地模拟
 */
(function() {
  'use strict';
  // ── Storage keys (MUST match what pages read/write) ──────────────
  var K_HOLDINGS = 'tradeflow_holdings';
  var K_WATCHLIST = 'tradeflow_watchlist';
  var K_ALERTS = 'tradeflow_alerts';
  var K_MYTRADES = 'tradeflow_my_trades';
  var K_USERNAME = 'tradeflow_username';

  // ── Helpers ──────────────────────────────────────────────────────
  function color(v) {
    if (v > 0) return '#EF4444';   // RED for up/profit (Chinese convention)
    if (v < 0) return '#22C55E';   // GREEN for down/loss (Chinese convention)
    return '#94A3B8';
  }
  function sign(v) { return v > 0 ? '+' : ''; }
  function fmt(v, d) {
    if (v === undefined || v === null || isNaN(v)) return '--';
    d = d !== undefined ? d : 2;
    var p = Number(v).toFixed(d).split('.');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return p.join('.');
  }
  function stripCode(c) { return String(c).replace(/\.(SH|SZ|sh|sz)$/i, ''); }
  function guessMkt(c) {
    if (/^[6]/.test(c)) return 'sh';
    if (/^[03]/.test(c)) return 'sz';
    return 'sz';
  }
  function loadJ(k, fb) { try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : fb; } catch(e) { return fb; } }
  function saveJ(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {} }

  // ── Stock catalogue ──────────────────────────────────────────────
  var STOCK_MAP = {
    '600519': { name: '贵州茅台', suffix: 'sh', sector: '白酒' },
    '000858': { name: '五粮液',   suffix: 'sz', sector: '白酒' },
    '601318': { name: '中国平安', suffix: 'sh', sector: '保险' },
    '000001': { name: '平安银行', suffix: 'sz', sector: '银行' },
    '600036': { name: '招商银行', suffix: 'sh', sector: '银行' },
    '002594': { name: '比亚迪',   suffix: 'sz', sector: '新能源车' },
    '300750': { name: '宁德时代', suffix: 'sz', sector: '新能源' },
    '601012': { name: '隆基绿能', suffix: 'sh', sector: '光伏' },
    '600900': { name: '长江电力', suffix: 'sh', sector: '电力' },
    '000333': { name: '美的集团', suffix: 'sz', sector: '家电' },
    '600276': { name: '恒瑞医药', suffix: 'sh', sector: '医药' },
    '002475': { name: '立讯精密', suffix: 'sz', sector: '电子' },
    '601899': { name: '紫金矿业', suffix: 'sh', sector: '有色' },
    '600809': { name: '山西汾酒', suffix: 'sh', sector: '白酒' },
    '002714': { name: '牧原股份', suffix: 'sz', sector: '畜牧' },
    '603288': { name: '海天味业', suffix: 'sh', sector: '调味品' },
    '300059': { name: '东方财富', suffix: 'sz', sector: '证券' },
    '002415': { name: '海康威视', suffix: 'sz', sector: '安防' },
    '600585': { name: '海螺水泥', suffix: 'sh', sector: '建材' },
    '601166': { name: '兴业银行', suffix: 'sh', sector: '银行' }
  };

  var INDEX_MAP = {
    '上证指数': { code: 'sh000001' },
    '深证成指': { code: 'sz399001' },
    '创业板指': { code: 'sz399006' }
  };

  // ── In-memory state (NEVER persist stocks/indices) ────────────────
  var state = {
    stocks: {}, indices: {}, trades: [],
    tickCount: 0, lastTick: null, source: 'none',
    intervalId: null, running: false, listeners: []
  };

  // ── XHR fetcher (reliable cross-origin, no JSONP) ──────────────
  function xhrGet(url, callback, ms) {
    var x = new XMLHttpRequest();
    var tm = setTimeout(function() { x.abort(); callback(null); }, ms || 8000);
    x.onreadystatechange = function() {
      if (x.readyState !== 4) return;
      clearTimeout(tm);
      if (x.status >= 200 && x.status < 400) {
        callback(x.responseText);
      } else {
        callback(null);
      }
    };
    x.open('GET', url, true);
    x.send();
  }

  // ── Tencent parser ───────────────────────────────────────────────
  // Response format: "v_sh600519=\"1~贵州茅台~600519~1204.98~1182.19~...\""
  function parseTencentBatch(text) {
    if (!text) return {};
    var results = {};
    var lines = text.split(';');
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      var eqIdx = line.indexOf('="');
      if (eqIdx === -1) continue;
      var raw = line.substring(eqIdx + 2);
      if (raw.charAt(raw.length - 1) === '"') {
        raw = raw.substring(0, raw.length - 1);
      }
      // Extract var name to get the code
      var varPart = line.substring(0, eqIdx);
      var codeMatch = varPart.match(/v_(sh|sz)(\d{6})$/);
      if (!codeMatch) continue;
      var code = codeMatch[2];
      var parsed = parseTencentLine(raw);
      if (parsed) {
        parsed.code = code;
        results[code] = parsed;
      }
    }
    return results;
  }

  function parseTencentLine(raw) {
    if (!raw || typeof raw !== 'string') return null;
    var f = raw.split('~');
    if (f.length < 35) return null;
    var cur = parseFloat(f[3]) || 0;
    var pc  = parseFloat(f[4]) || 0;
    var chg = cur - pc;
    var chgP = pc > 0 ? (chg / pc * 100) : 0;
    return {
      code: f[2] || '', name: f[1] || '',
      current: cur, prevClose: pc,
      open: parseFloat(f[5]) || 0,
      high: parseFloat(f[33]) || 0,
      low: parseFloat(f[34]) || 0,
      change: Math.round(chg * 100) / 100,
      changePct: Math.round(chgP * 100) / 100,
      volume: Math.round(parseFloat(f[6]) || 0),
      amount: parseFloat(f[37]) || 0,
      bid1: parseFloat(f[9])||0,  bidVol1: parseInt(f[10])||0,
      bid2: parseFloat(f[11])||0, bidVol2: parseInt(f[12])||0,
      bid3: parseFloat(f[13])||0, bidVol3: parseInt(f[14])||0,
      bid4: parseFloat(f[15])||0, bidVol4: parseInt(f[16])||0,
      bid5: parseFloat(f[17])||0, bidVol5: parseInt(f[18])||0,
      ask1: parseFloat(f[19])||0,  askVol1: parseInt(f[20])||0,
      ask2: parseFloat(f[21])||0, askVol2: parseInt(f[22])||0,
      ask3: parseFloat(f[23])||0, askVol3: parseInt(f[24])||0,
      ask4: parseFloat(f[25])||0, askVol4: parseInt(f[26])||0,
      ask5: parseFloat(f[27])||0, askVol5: parseInt(f[28])||0,
      timestamp: Date.now()
    };
  }

  // ── Sina parser ─────────────────────────────────────────────────
  function parseSinaBatch(text) {
    if (!text) return {};
    var results = {};
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      // Format: var hq_str_sh600519="...";
      var eqIdx = line.indexOf('="');
      if (eqIdx === -1) continue;
      var raw = line.substring(eqIdx + 2);
      if (raw.charAt(raw.length - 1) === '"') raw = raw.substring(0, raw.length - 1);
      if (!raw || raw.length < 10) continue;
      var varPart = line.substring(0, eqIdx);
      var codeMatch = varPart.match(/hq_str_(sh|sz)(\d{6})$/);
      if (!codeMatch) continue;
      var code = codeMatch[2];
      var parsed = parseSinaLine(raw);
      if (parsed) {
        parsed.code = code;
        results[code] = parsed;
      }
    }
    return results;
  }

  function parseSinaLine(raw) {
    if (!raw || typeof raw !== 'string') return null;
    var f = raw.split(',');
    if (f.length < 6) return null;
    var cur = parseFloat(f[3]) || 0;
    var pc  = parseFloat(f[2]) || 0;
    var chg = cur - pc;
    var chgP = pc > 0 ? (chg / pc * 100) : 0;
    var r = {
      code: '', name: f[0].replace(/"/g, '').split('_').pop() || '',
      current: cur, prevClose: pc,
      open: parseFloat(f[1]) || 0,
      high: parseFloat(f[4]) || 0,
      low: parseFloat(f[5]) || 0,
      change: Math.round(chg * 100) / 100,
      changePct: Math.round(chgP * 100) / 100,
      volume: Math.round(parseFloat(f[8]) || 0),
      amount: parseFloat(f[9]) || 0,
      timestamp: Date.now()
    };
    for (var i = 1; i <= 5; i++) {
      r['bid' + i] = cur - i * 0.01; r['bidVol' + i] = i * 100;
      r['ask' + i] = cur + i * 0.01; r['askVol' + i] = i * 100;
    }
    return r;
  }

  // ── Fetch: Tencent stocks via XHR ───────────────────────────────
  function fetchTencentStocks(codes, cb) {
    var qs = codes.map(function(c) {
      var info = STOCK_MAP[c];
      return (info ? info.suffix : guessMkt(c)) + c;
    }).join(',');
    var url = 'https://qt.gtimg.cn/q=' + qs + '&_=' + Date.now();
    xhrGet(url, function(text) {
      if (!text) { cb(false); return; }
      var parsed = parseTencentBatch(text);
      var keys = Object.keys(parsed);
      if (keys.length === 0) { cb(false); return; }
      for (var i = 0; i < keys.length; i++) {
        state.stocks[keys[i]] = parsed[keys[i]];
      }
      cb(true);
    }, 8000);
  }

  // ── Fetch: Tencent indices via XHR ──────────────────────────────
  function fetchTencentIndices(cb) {
    var qs = Object.keys(INDEX_MAP).map(function(k) { return INDEX_MAP[k].code; }).join(',');
    var url = 'https://qt.gtimg.cn/q=' + qs + '&_=' + Date.now();
    xhrGet(url, function(text) {
      if (!text) { cb(false); return; }
      var parsed = parseTencentBatch(text);
      Object.keys(INDEX_MAP).forEach(function(chName) {
        var tc = INDEX_MAP[chName].code;
        var code6 = tc.replace(/^(sh|sz)/, '');
        var p = parsed[code6];
        if (p) {
          state.indices[chName] = { value: p.current, prevClose: p.prevClose, change: p.change, changePct: p.changePct, name: chName };
        }
      });
      cb(true);
    }, 6000);
  }

  // ── Fetch: Sina fallback via XHR ────────────────────────────────
  function fetchSinaStocks(codes, cb) {
    var qs = codes.map(function(c) {
      var info = STOCK_MAP[c];
      return (info ? info.suffix : guessMkt(c)) + c;
    }).join(',');
    var url = 'https://hq.sinajs.cn/list=' + qs + '&_=' + Date.now();
    xhrGet(url, function(text) {
      if (!text) { cb(false); return; }
      var parsed = parseSinaBatch(text);
      var keys = Object.keys(parsed);
      if (keys.length === 0) { cb(false); return; }
      for (var i = 0; i < keys.length; i++) {
        state.stocks[keys[i]] = parsed[keys[i]];
      }
      cb(true);
    }, 6000);
  }

  // ── Local simulation (last resort) ───────────────────────────────
  function simulateStocks() {
    Object.keys(STOCK_MAP).forEach(function(code) {
      var info = STOCK_MAP[code];
      var base = 10 + Math.random() * 200;
      if (code === '600519') base = 1680;
      if (code === '000858') base = 150;
      if (code === '002594') base = 260;
      if (code === '300750') base = 210;
      var prev = state.stocks[code] ? state.stocks[code].prevClose : base;
      if (!state.stocks[code] || state.stocks[code].prevClose === 0) {
        state.stocks[code] = {
          code: code, name: info.name, prevClose: base, current: base,
          open: base, high: base * 1.02, low: base * 0.98,
          change: 0, changePct: 0, volume: 0, amount: 0,
          bid1: base, bidVol1: 100, ask1: base, askVol1: 100,
          bid2: 0, bidVol2: 0, ask2: 0, askVol2: 0,
          bid3: 0, bidVol3: 0, ask3: 0, askVol3: 0,
          bid4: 0, bidVol4: 0, ask4: 0, askVol4: 0,
          bid5: 0, bidVol5: 0, ask5: 0, askVol5: 0,
          timestamp: Date.now()
        };
      }
      var s = state.stocks[code];
      var j = (Math.random() - 0.48) * prev * 0.004;
      s.current = Math.max(0.01, s.current + j);
      s.high = Math.max(s.high, s.current);
      s.low = Math.min(s.low, s.current);
      s.change = Math.round((s.current - s.prevClose) * 100) / 100;
      s.changePct = s.prevClose > 0 ? Math.round(s.change / s.prevClose * 10000) / 100 : 0;
      s.volume += Math.round(Math.random() * 500);
      s.timestamp = Date.now();
      for (var i = 1; i <= 5; i++) {
        s['bid' + i] = s.current - i * 0.01; s['bidVol' + i] = i * 100;
        s['ask' + i] = s.current + i * 0.01; s['askVol' + i] = i * 100;
      }
    });
    state.indices['上证指数'] = { value: 3150 + (Math.random()-0.5)*30, prevClose: 3150, change: 0, changePct: 0, name: '上证指数' };
    state.indices['深证成指'] = { value: 10200 + (Math.random()-0.5)*80, prevClose: 10200, change: 0, changePct: 0, name: '深证成指' };
    state.indices['创业板指'] = { value: 2020 + (Math.random()-0.5)*20, prevClose: 2020, change: 0, changePct: 0, name: '创业板指' };
    Object.keys(state.indices).forEach(function(k) {
      var idx = state.indices[k];
      idx.change = Math.round((idx.value - idx.prevClose) * 100) / 100;
      idx.changePct = idx.prevClose > 0 ? Math.round(idx.change / idx.prevClose * 10000) / 100 : 0;
    });
  }

  // ── Trade generator ──────────────────────────────────────────────
  function generateTrades() {
    var codes = Object.keys(STOCK_MAP);
    var n = 1 + Math.floor(Math.random() * 3);
    var trades = [];
    for (var i = 0; i < n; i++) {
      var code = codes[Math.floor(Math.random() * codes.length)];
      var info = STOCK_MAP[code];
      var s = state.stocks[code];
      if (!s || s.current <= 0) continue;
      var isBuy = Math.random() > 0.5;
      var vol = 1 + Math.floor(Math.random() * 10);
      var price = Math.round(s.current * (1 + (Math.random()-0.5)*0.005) * 100) / 100;
      trades.push({
        code: code, codeFull: (info.suffix + code).toUpperCase(), name: info.name,
        direction: isBuy ? 'buy' : 'sell', type: isBuy ? 'buy' : 'sell',
        volume: vol, lots: vol, price: price,
        amount: Math.round(price * vol * 100 * 100) / 100,
        time: new Date().toLocaleTimeString('zh-CN')
      });
    }
    return trades;
  }

  // ── Main tick ────────────────────────────────────────────────────
  function tick() {
    var allCodes = Object.keys(STOCK_MAP);
    fetchTencentStocks(allCodes, function(stockOk) {
      if (stockOk) {
        fetchTencentIndices(function() {
          state.source = 'real';
          finalizeTick();
        });
      } else {
        fetchSinaStocks(allCodes, function(sinaOk) {
          if (sinaOk) {
            state.source = 'real';
          } else {
            simulateStocks();
            state.source = 'simulation';
          }
          finalizeTick();
        });
      }
    });
  }

  function finalizeTick() {
    state.tickCount++;
    state.lastTick = Date.now();
    state.trades = generateTrades();
    state.listeners.forEach(function(fn) { try { fn(state); } catch(e) {} });
  }

  // ── Lookup single code on demand ─────────────────────────────────
  function lookupCode(code, callback) {
    code = stripCode(code);
    if (!/^\d{6}$/.test(code)) { if (callback) callback(null); return; }
    if (state.stocks[code] && state.stocks[code].current > 0) { if (callback) callback(state.stocks[code]); return; }
    var m = guessMkt(code);
    var url = 'https://qt.gtimg.cn/q=' + m + code + '&_=' + Date.now();
    xhrGet(url, function(text) {
      if (!text) { if (callback) callback(null); return; }
      var parsed = parseTencentBatch(text);
      var p = parsed[code];
      if (!p) { if (callback) callback(null); return; }
      if (!STOCK_MAP[code]) STOCK_MAP[code] = { name: p.name, suffix: m, sector: '自定义' };
      p.code = code;
      state.stocks[code] = p;
      if (callback) callback(p);
    }, 5000);
  }

  // ── PUBLIC API ────────────────────────────────────────────────────
  var api = {
    STOCK_MAP: STOCK_MAP,
    INDEX_MAP: INDEX_MAP,

    start: function() {
      if (state.intervalId) return;
      tick();
      state.intervalId = setInterval(tick, 5000);
      state.running = true;
    },
    stop: function() {
      if (state.intervalId) { clearInterval(state.intervalId); state.intervalId = null; }
      state.running = false;
    },

    onUpdate: function(fn) { if (typeof fn === 'function') state.listeners.push(fn); },
    getStock: function(code) {
      if (!code) return null;
      return state.stocks[stripCode(code)] || null;
    },
    getAllStocks: function() { return state.stocks; },
    getIndices: function() { return state.indices; },
    getTrades: function() { return state.trades; },
    getLastSource: function() { return state.source; },

    getHoldings: function() { return loadJ(K_HOLDINGS, []); },
    setHoldings: function(h) { saveJ(K_HOLDINGS, h || []); },

    calcHoldingsMarketValue: function() {
      var results = [];
      var holdings = loadJ(K_HOLDINGS, []);
      holdings.forEach(function(item) {
        if (item.cost !== undefined && item.lots === undefined) {
          var s = state.stocks[stripCode(item.code || '')];
          item.lots = 1;
          item.buyPrice = s && s.prevClose > 0 ? s.prevClose : (item.cost / 100);
          delete item.cost; delete item.market;
        }
        var code6 = stripCode(item.code || '');
        var s = state.stocks[code6];
        var cp = s ? s.current : (item.buyPrice || 0);
        var shares = (item.lots || 0) * 100;
        var cost = shares * (item.buyPrice || 0);
        var mv = shares * cp;
        var pnl = mv - cost;
        results.push({
          code: item.code, name: item.name || (s ? s.name : code6),
          lots: item.lots, buyPrice: item.buyPrice, shares: shares,
          totalCost: Math.round(cost*100)/100, marketValue: Math.round(mv*100)/100,
          currentPrice: cp, pnl: Math.round(pnl*100)/100,
          pnlPct: cost > 0 ? Math.round(pnl/cost*10000)/100 : 0
        });
      });
      return results;
    },

    getWatchlist: function() { return loadJ(K_WATCHLIST, []); },
    addToWatchlist: function(code) {
      var w = loadJ(K_WATCHLIST, []);
      var c = stripCode(code);
      if (w.indexOf(c) === -1) { w.push(c); saveJ(K_WATCHLIST, w); }
    },
    removeFromWatchlist: function(code) {
      var w = loadJ(K_WATCHLIST, []).filter(function(c) { return c !== stripCode(code); });
      saveJ(K_WATCHLIST, w);
    },

    getAlerts: function() { return loadJ(K_ALERTS, []); },
    addAlert: function(a) { a.id = Date.now(); var arr = loadJ(K_ALERTS, []); arr.push(a); saveJ(K_ALERTS, arr); },
    removeAlert: function(id) { var arr = loadJ(K_ALERTS, []).filter(function(a) { return a.id !== id; }); saveJ(K_ALERTS, arr); },

    getMyTrades: function() { return loadJ(K_MYTRADES, []); },
    addMyTrade: function(t) {
      t.id = Date.now();
      t.time = new Date().toLocaleString('zh-CN');
      var arr = loadJ(K_MYTRADES, []);
      arr.unshift(t);
      if (arr.length > 200) arr.length = 200;
      saveJ(K_MYTRADES, arr);
    },

    getUsername: function() { try { return localStorage.getItem(K_USERNAME) || '李明'; } catch(e) { return '李明'; } },
    setUsername: function(n) { try { localStorage.setItem(K_USERNAME, n); } catch(e) {} },

    fmt: fmt, color: color, sign: sign,
    lookupCode: lookupCode
  };

  window.MarketEngine = api;
  window.MarketSimulator = window.MarketEngine;
})();