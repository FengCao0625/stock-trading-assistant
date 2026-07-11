/**
 * 数据导入/导出 + 云端同步工具
 * 同步方案：生成包含数据的链接，在另一设备打开即自动导入
 * 无需后端、无需 API、无需注册
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

  function _collectData() {
    var data = {};
    STORAGE_KEYS.forEach(function(k) {
      var v = localStorage.getItem(k);
      if (v !== null) data[k] = v;
    });
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf('tradeflow_suggestions_') === 0) {
        var v = localStorage.getItem(k);
        if (v !== null) data[k] = v;
      }
    }
    return data;
  }

  function _applyData(data) {
    var count = 0;
    Object.keys(data).forEach(function(k) {
      if (k.indexOf('tradeflow_') === 0) {
        localStorage.setItem(k, data[k]);
        count++;
      }
    });
    return count;
  }

  function _toastBottom() {
    return window.innerWidth < 768 ? '100px' : '40px';
  }

  window.DataMigration = {

    /* ========== Export / Import (manual) ========== */

    exportData: function() {
      var d = _collectData();
      return JSON.stringify(d, null, 2);
    },

    importData: function(jsonStr) {
      try {
        var data = JSON.parse(jsonStr);
        return { success: true, count: _applyData(data) };
      } catch (e) {
        return { success: false, error: e.message };
      }
    },

    /* ========== Link-based Sync ========== */

    generateSyncLink: function() {
      var data = _collectData();
      var json = JSON.stringify(data);
      var encoded = btoa(unescape(encodeURIComponent(json)));
      // Split into chunks to keep URL reasonable (GitHub Pages has limits)
      // Use current page as base
      var base = window.location.href.split('#')[0].split('?')[0];
      return base + '#sync=' + encoded;
    },

    importFromSyncLink: function() {
      var hash = window.location.hash;
      if (hash.indexOf('#sync=') === 0) {
        var encoded = hash.substring(6);
        try {
          var json = decodeURIComponent(escape(atob(encoded)));
          var data = JSON.parse(json);
          if (Object.keys(data).length > 0) {
            _applyData(data);
            // Clean URL
            history.replaceState(null, '', window.location.href.split('#')[0]);
            return data;
          }
        } catch (e) {
          console.warn('Sync link parse error:', e);
        }
      }
      return null;
    },

    /* ========== Modals ========== */

    showExportModal: function() {
      this._closeModal();
      var data = this.exportData();
      var hasData = Object.keys(JSON.parse(data)).length > 0;
      var el = document.createElement('div');
      el.id = 'dm-modal';
      el.style.cssText = 'position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;';
      el.innerHTML =
        '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.6);" onclick="DataMigration._closeModal()"></div>' +
        '<div style="position:relative;background:#111827;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:20px;width:90%;max-width:460px;z-index:1;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">' +
            '<span style="font-size:16px;font-weight:600;color:#F1F5F9;">数据导出</span>' +
            '<button onclick="DataMigration._closeModal()" style="background:none;border:none;color:#64748B;cursor:pointer;font-size:20px;line-height:1;">&times;</button>' +
          '</div>' +
          '<p style="font-size:12px;color:#94A3B8;margin:0 0 10px;">复制文本，在其他设备"导入数据"即可迁移。</p>' +
          '<textarea id="dm-export-area" readonly style="width:100%;height:140px;background:#0D1321;border:1px solid rgba(255,255,255,0.08);border-radius:6px;color:#F1F5F9;font-size:11px;font-family:monospace;padding:10px;resize:vertical;outline:none;">' +
            (hasData ? data : '（当前无数据）') +
          '</textarea>' +
          '<div style="display:flex;gap:8px;margin-top:12px;">' +
            '<button onclick="DataMigration._copyExport()" style="flex:1;padding:10px;border-radius:6px;border:none;cursor:pointer;font-size:13px;font-weight:500;background:#EF4444;color:#fff;">' +
              (hasData ? '复制到剪贴板' : '关闭') +
            '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(el);
    },

    showImportModal: function() {
      this._closeModal();
      var el = document.createElement('div');
      el.id = 'dm-modal';
      el.style.cssText = 'position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;';
      el.innerHTML =
        '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.6);" onclick="DataMigration._closeModal()"></div>' +
        '<div style="position:relative;background:#111827;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:20px;width:90%;max-width:460px;z-index:1;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">' +
            '<span style="font-size:16px;font-weight:600;color:#F1F5F9;">数据导入</span>' +
            '<button onclick="DataMigration._closeModal()" style="background:none;border:none;color:#64748B;cursor:pointer;font-size:20px;line-height:1;">&times;</button>' +
          '</div>' +
          '<p style="font-size:12px;color:#94A3B8;margin:0 0 10px;">粘贴从其他设备导出的数据文本。</p>' +
          '<textarea id="dm-import-area" placeholder="在此粘贴导出的数据..." style="width:100%;height:140px;background:#0D1321;border:1px solid rgba(255,255,255,0.08);border-radius:6px;color:#F1F5F9;font-size:11px;font-family:monospace;padding:10px;resize:vertical;outline:none;"></textarea>' +
          '<div id="dm-import-msg" style="font-size:12px;margin-top:6px;min-height:18px;"></div>' +
          '<div style="display:flex;gap:8px;margin-top:10px;">' +
            '<button onclick="DataMigration._doImport()" style="flex:1;padding:10px;border-radius:6px;border:none;cursor:pointer;font-size:13px;font-weight:500;background:#EF4444;color:#fff;">确认导入</button>' +
            '<button onclick="DataMigration._closeModal()" style="flex:1;padding:10px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);cursor:pointer;font-size:13px;font-weight:500;background:#1A2035;color:#94A3B8;">取消</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(el);
    },

    showSyncModal: function() {
      this._closeModal();
      var el = document.createElement('div');
      el.id = 'dm-modal';
      el.style.cssText = 'position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;';
      el.innerHTML =
        '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.6);" onclick="DataMigration._closeModal()"></div>' +
        '<div style="position:relative;background:#111827;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:20px;width:90%;max-width:420px;z-index:1;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">' +
            '<span style="font-size:16px;font-weight:600;color:#F1F5F9;">数据同步</span>' +
            '<button onclick="DataMigration._closeModal()" style="background:none;border:none;color:#64748B;cursor:pointer;font-size:20px;line-height:1;">&times;</button>' +
          '</div>' +

          // Step 1: Generate link
          '<div style="margin-bottom:14px;">' +
            '<div style="font-size:13px;font-weight:500;color:#F1F5F9;margin-bottom:6px;">第一步：生成同步链接</div>' +
            '<p style="font-size:11px;color:#94A3B8;margin:0 0 8px;">点击下方按钮生成一个包含你所有数据的链接，复制后发送到另一台设备（微信/QQ/邮件均可）。</p>' +
            '<button onclick="DataMigration._genAndCopyLink()" style="width:100%;padding:10px;border-radius:6px;border:none;cursor:pointer;font-size:13px;font-weight:500;background:#EF4444;color:#fff;margin-bottom:6px;">生成同步链接并复制</button>' +
            '<div id="dm-sync-link-status" style="font-size:11px;min-height:16px;margin-top:4px;"></div>' +
          '</div>' +

          '<div style="height:1px;background:rgba(255,255,255,0.06);margin:14px 0;"></div>' +

          // Step 2: Import from link
          '<div>' +
            '<div style="font-size:13px;font-weight:500;color:#F1F5F9;margin-bottom:6px;">第二步：在另一设备打开链接</div>' +
            '<p style="font-size:11px;color:#94A3B8;margin:0 0 8px;">在手机/另一台电脑上粘贴并打开链接，数据会自动导入。也可以手动粘贴链接：</p>' +
            '<input id="dm-sync-link-input" type="text" placeholder="粘贴同步链接..." style="width:100%;height:36px;background:#0D1321;border:1px solid rgba(255,255,255,0.08);border-radius:6px;color:#F1F5F9;font-size:12px;padding:0 10px;outline:none;margin-bottom:8px;box-sizing:border-box;" />' +
            '<button onclick="DataMigration._importFromLink()" style="width:100%;padding:10px;border-radius:6px;border:1px solid rgba(239,68,68,0.3);cursor:pointer;font-size:13px;font-weight:500;background:transparent;color:#F87171;">从链接导入</button>' +
            '<div id="dm-sync-import-status" style="font-size:11px;min-height:16px;margin-top:4px;"></div>' +
          '</div>' +
        '</div>';
      document.body.appendChild(el);
    },

    /* ========== Internal ========== */

    _genAndCopyLink: function() {
      var status = document.getElementById('dm-sync-link-status');
      if (!status) return;

      var data = _collectData();
      if (Object.keys(data).length === 0) {
        status.style.color = '#F59E0B';
        status.textContent = '当前无数据可同步';
        return;
      }

      var link = this.generateSyncLink();

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).then(function() {
          status.style.color = '#4ADE80';
          status.textContent = '链接已复制！发送到另一台设备打开即可同步。';
        }).catch(function() {
          DataMigration._showLinkFallback(link, status);
        });
      } else {
        this._showLinkFallback(link, status);
      }
    },

    _showLinkFallback: function(link, status) {
      // Show the link in a textarea for manual copy
      status.style.color = '#94A3B8';
      status.innerHTML = '<textarea id="dm-sync-link-area" style="width:100%;height:60px;background:#0D1321;border:1px solid rgba(255,255,255,0.08);border-radius:4px;color:#F1F5F9;font-size:10px;font-family:monospace;padding:6px;resize:vertical;outline:none;margin-top:4px;">' + link + '</textarea><span style="color:#94A3B8;">请手动复制上方链接</span>';
    },

    _importFromLink: function() {
      var input = document.getElementById('dm-sync-link-input');
      var status = document.getElementById('dm-sync-import-status');
      if (!input || !status) return;

      var url = input.value.trim();
      if (!url) {
        status.style.color = '#F59E0B';
        status.textContent = '请粘贴同步链接';
        return;
      }

      // Extract #sync= part
      var match = url.match(/#sync=([A-Za-z0-9+/=]+)/);
      if (!match) {
        status.style.color = '#EF4444';
        status.textContent = '无效的同步链接';
        return;
      }

      try {
        var json = decodeURIComponent(escape(atob(match[1])));
        var data = JSON.parse(json);
        var count = _applyData(data);
        status.style.color = '#4ADE80';
        status.textContent = '成功导入 ' + count + ' 项数据，页面即将刷新...';
        setTimeout(function() { location.reload(); }, 1500);
      } catch (e) {
        status.style.color = '#EF4444';
        status.textContent = '导入失败：' + e.message;
      }
    },

    _copyExport: function() {
      var area = document.getElementById('dm-export-area');
      if (!area) return;
      var data = area.value;
      if (data === '（当前无数据）') { this._closeModal(); return; }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(data).then(function() {
          DataMigration._showToast('已复制到剪贴板');
          DataMigration._closeModal();
        });
      } else {
        area.select();
        document.execCommand('copy');
        this._showToast('已复制到剪贴板');
        this._closeModal();
      }
    },

    _doImport: function() {
      var area = document.getElementById('dm-import-area');
      var msg = document.getElementById('dm-import-msg');
      if (!area || !msg) return;
      var text = area.value.trim();
      if (!text) { msg.style.color = '#EF4444'; msg.textContent = '请粘贴数据'; return; }
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
      t.style.cssText = 'position:fixed;bottom:' + _toastBottom() + ';left:50%;transform:translateX(-50%);background:#1E2642;color:#F1F5F9;padding:8px 20px;border-radius:8px;font-size:13px;z-index:3000;border:1px solid rgba(255,255,255,0.1);white-space:nowrap;';
      document.body.appendChild(t);
      setTimeout(function() { t.remove(); }, 2000);
    },

    _closeModal: function() {
      var m = document.getElementById('dm-modal');
      if (m) m.remove();
    },

    closeModal: function() { this._closeModal(); }
  };

  /* ========== Auto-import from sync link on page load ========== */
  var autoData = DataMigration.importFromSyncLink();
  if (autoData && Object.keys(autoData).length > 0) {
    setTimeout(function() {
      DataMigration._showToast('已从同步链接导入 ' + Object.keys(autoData).length + ' 项数据');
    }, 500);
  }
})();