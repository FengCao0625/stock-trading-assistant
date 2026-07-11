/**
 * 数据导入/导出工具
 * 允许在不同设备/浏览器之间迁移 localStorage 数据
 */
(function() {
  'use strict';

  var STORAGE_KEYS = [
    'tradeflow_holdings',
    'tradeflow_total_assets',
    'tradeflow_username',
    'tradeflow_my_trades',
    'tradeflow_watchlist',
    'tradeflow_alerts'
  ];

  // Also include suggestion keys
  function getSuggestionKeys() {
    var keys = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf('tradeflow_suggestions_') === 0) keys.push(k);
    }
    return keys;
  }

  window.DataMigration = {
    exportData: function() {
      var data = {};
      STORAGE_KEYS.forEach(function(k) {
        var v = localStorage.getItem(k);
        if (v !== null) data[k] = v;
      });
      getSuggestionKeys().forEach(function(k) {
        var v = localStorage.getItem(k);
        if (v !== null) data[k] = v;
      });
      return JSON.stringify(data, null, 2);
    },

    importData: function(jsonStr) {
      try {
        var data = JSON.parse(jsonStr);
        var count = 0;
        Object.keys(data).forEach(function(k) {
          if (k.indexOf('tradeflow_') === 0) {
            localStorage.setItem(k, data[k]);
            count++;
          }
        });
        return { success: true, count: count };
      } catch (e) {
        return { success: false, error: e.message };
      }
    },

    showExportModal: function() {
      var existing = document.getElementById('dm-modal');
      if (existing) existing.remove();

      var data = this.exportData();
      var hasData = Object.keys(JSON.parse(data)).length > 0;

      var modal = document.createElement('div');
      modal.id = 'dm-modal';
      modal.style.cssText = 'position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;';
      modal.innerHTML =
        '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.6);" onclick="DataMigration.closeModal()"></div>' +
        '<div style="position:relative;background:#111827;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:24px;width:90%;max-width:460px;z-index:1;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
            '<span style="font-size:16px;font-weight:600;color:#F1F5F9;">数据导出</span>' +
            '<button onclick="DataMigration.closeModal()" style="background:none;border:none;color:#64748B;cursor:pointer;font-size:20px;line-height:1;">&times;</button>' +
          '</div>' +
          '<p style="font-size:13px;color:#94A3B8;margin:0 0 12px;">复制下方文本，在新设备上"导入数据"即可迁移所有持仓和设置。</p>' +
          '<textarea id="dm-export-area" readonly style="width:100%;height:160px;background:#0D1321;border:1px solid rgba(255,255,255,0.08);border-radius:6px;color:#F1F5F9;font-size:11px;font-family:monospace;padding:10px;resize:vertical;outline:none;">' +
            (hasData ? data : '（当前无数据）') +
          '</textarea>' +
          '<div style="display:flex;gap:8px;margin-top:14px;">' +
            '<button onclick="DataMigration._copyExport()" style="flex:1;padding:10px;border-radius:6px;border:none;cursor:pointer;font-size:13px;font-weight:500;background:#EF4444;color:#fff;">' +
              (hasData ? '复制到剪贴板' : '关闭') +
            '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(modal);
    },

    showImportModal: function() {
      var existing = document.getElementById('dm-modal');
      if (existing) existing.remove();

      var modal = document.createElement('div');
      modal.id = 'dm-modal';
      modal.style.cssText = 'position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;';
      modal.innerHTML =
        '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.6);" onclick="DataMigration.closeModal()"></div>' +
        '<div style="position:relative;background:#111827;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:24px;width:90%;max-width:460px;z-index:1;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
            '<span style="font-size:16px;font-weight:600;color:#F1F5F9;">数据导入</span>' +
            '<button onclick="DataMigration.closeModal()" style="background:none;border:none;color:#64748B;cursor:pointer;font-size:20px;line-height:1;">&times;</button>' +
          '</div>' +
          '<p style="font-size:13px;color:#94A3B8;margin:0 0 12px;">粘贴从其他设备导出的数据文本。</p>' +
          '<textarea id="dm-import-area" placeholder="在此粘贴导出的数据..." style="width:100%;height:160px;background:#0D1321;border:1px solid rgba(255,255,255,0.08);border-radius:6px;color:#F1F5F9;font-size:11px;font-family:monospace;padding:10px;resize:vertical;outline:none;"></textarea>' +
          '<div id="dm-import-msg" style="font-size:12px;margin-top:8px;min-height:18px;"></div>' +
          '<div style="display:flex;gap:8px;margin-top:10px;">' +
            '<button onclick="DataMigration._doImport()" style="flex:1;padding:10px;border-radius:6px;border:none;cursor:pointer;font-size:13px;font-weight:500;background:#EF4444;color:#fff;">确认导入</button>' +
            '<button onclick="DataMigration.closeModal()" style="flex:1;padding:10px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);cursor:pointer;font-size:13px;font-weight:500;background:#1A2035;color:#94A3B8;">取消</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(modal);
    },

    _copyExport: function() {
      var area = document.getElementById('dm-export-area');
      if (!area) return;
      var data = area.value;
      if (data === '（当前无数据）') {
        this.closeModal();
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(data).then(function() {
          DataMigration._showToast('已复制到剪贴板');
          DataMigration.closeModal();
        });
      } else {
        area.select();
        document.execCommand('copy');
        this._showToast('已复制到剪贴板');
        this.closeModal();
      }
    },

    _doImport: function() {
      var area = document.getElementById('dm-import-area');
      var msg = document.getElementById('dm-import-msg');
      if (!area || !msg) return;
      var text = area.value.trim();
      if (!text) {
        msg.style.color = '#EF4444';
        msg.textContent = '请粘贴数据';
        return;
      }
      var result = this.importData(text);
      if (result.success) {
        msg.style.color = '#4ADE80';
        msg.textContent = '成功导入 ' + result.count + ' 项数据，页面即将刷新...';
        setTimeout(function() { location.reload(); }, 1500);
      } else {
        msg.style.color = '#EF4444';
        msg.textContent = '导入失败：' + result.error;
      }
    },

    _showToast: function(text) {
      var t = document.createElement('div');
      t.textContent = text;
      t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1E2642;color:#F1F5F9;padding:8px 20px;border-radius:8px;font-size:13px;z-index:3000;border:1px solid rgba(255,255,255,0.1);';
      document.body.appendChild(t);
      setTimeout(function() { t.remove(); }, 2000);
    },

    closeModal: function() {
      var m = document.getElementById('dm-modal');
      if (m) m.remove();
    }
  };
})();