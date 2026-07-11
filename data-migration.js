/**
 * 数据导入/导出 + 云端同步工具
 * 使用 jsonblob.com 免费存储（无需 API key）
 * 允许在不同设备/浏览器之间自动同步 localStorage 数据
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

  var SYNC_BLOB_KEY = 'tradeflow_sync_blob_id';
  var SYNC_API = 'https://jsonblob.com/api/jsonBlob';

  function _getSyncId() {
    return localStorage.getItem(SYNC_BLOB_KEY);
  }

  function _setSyncId(id) {
    localStorage.setItem(SYNC_BLOB_KEY, id);
  }

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
    data._ts = Date.now();
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

  var _toastBottom = '100px';

  window.DataMigration = {

    /* ========== Export / Import (manual) ========== */

    exportData: function() {
      var d = _collectData();
      delete d._ts;
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

    /* ========== Cloud Sync ========== */

    syncToCloud: function() {
      return new Promise(function(resolve, reject) {
        var blobId = _getSyncId();
        var data = _collectData();
        var payload = JSON.stringify(data);

        var xhr = new XMLHttpRequest();
        xhr.open('PUT', SYNC_API + '/' + blobId, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onload = function() {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({ success: true, count: Object.keys(data).length - 1 });
          } else if (xhr.status === 404) {
            // blob was deleted, create new
            DataMigration._createBlob(data).then(resolve).catch(reject);
          } else {
            reject(new Error('HTTP ' + xhr.status));
          }
        };
        xhr.onerror = function() { reject(new Error('网络错误')); };
        xhr.send(payload);
      });
    },

    syncFromCloud: function() {
      return new Promise(function(resolve, reject) {
        var blobId = _getSyncId();
        if (!blobId) {
          reject(new Error('尚未创建同步空间，请先在任一设备上传数据'));
          return;
        }
        var xhr = new XMLHttpRequest();
        xhr.open('GET', SYNC_API + '/' + blobId, true);
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.onload = function() {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              var data = JSON.parse(xhr.responseText);
              var count = _applyData(data);
              resolve({ success: true, count: count, remoteTs: data._ts });
            } catch (e) {
              reject(new Error('数据解析失败'));
            }
          } else {
            reject(new Error('HTTP ' + xhr.status));
          }
        };
        xhr.onerror = function() { reject(new Error('网络错误')); };
        xhr.send();
      });
    },

    _createBlob: function(data) {
      return new Promise(function(resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', SYNC_API, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onload = function() {
          if (xhr.status >= 200 && xhr.status < 300) {
            var loc = xhr.getResponseHeader('Location') || xhr.getResponseHeader('location');
            if (loc) {
              var id = loc.split('/').pop();
              _setSyncId(id);
            }
            resolve({ success: true, count: Object.keys(data).length - 1 });
          } else {
            reject(new Error('创建失败 HTTP ' + xhr.status));
          }
        };
        xhr.onerror = function() { reject(new Error('网络错误')); };
        xhr.send(JSON.stringify(data));
      });
    },

    initSync: function() {
      var blobId = _getSyncId();
      if (blobId) {
        return Promise.resolve({ exists: true, blobId: blobId });
      }
      return this._createBlob(_collectData()).then(function() {
        return { exists: false, blobId: _getSyncId() };
      });
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
      var hasId = !!_getSyncId();
      var el = document.createElement('div');
      el.id = 'dm-modal';
      el.style.cssText = 'position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;';
      el.innerHTML =
        '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.6);" onclick="DataMigration._closeModal()"></div>' +
        '<div style="position:relative;background:#111827;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:20px;width:90%;max-width:380px;z-index:1;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">' +
            '<span style="font-size:16px;font-weight:600;color:#F1F5F9;">云端同步</span>' +
            '<button onclick="DataMigration._closeModal()" style="background:none;border:none;color:#64748B;cursor:pointer;font-size:20px;line-height:1;">&times;</button>' +
          '</div>' +
          '<p style="font-size:12px;color:#94A3B8;margin:0 0 14px;">数据保存在云端，手机和电脑自动共享。首次使用需先上传，之后在任何设备点"拉取"即可同步。</p>' +
          '<div id="dm-sync-status" style="font-size:12px;min-height:20px;margin-bottom:10px;"></div>' +
          '<div style="display:flex;flex-direction:column;gap:8px;">' +
            '<button id="dm-sync-upload" onclick="DataMigration._doSyncUpload()" style="width:100%;padding:12px;border-radius:6px;border:none;cursor:pointer;font-size:14px;font-weight:500;background:#EF4444;color:#fff;">上传到云端</button>' +
            '<button id="dm-sync-download" onclick="DataMigration._doSyncDownload()" style="width:100%;padding:12px;border-radius:6px;border:1px solid rgba(239,68,68,0.3);cursor:pointer;font-size:14px;font-weight:500;background:transparent;color:#F87171;">从云端拉取</button>' +
          '</div>' +
          (hasId ? '<p style="font-size:10px;color:#64748B;margin:10px 0 0;text-align:center;">同步ID: ' + _getSyncId().substring(0,8) + '...</p>' : '') +
        '</div>';
      document.body.appendChild(el);
    },

    /* ========== Internal ========== */

    _doSyncUpload: function() {
      var status = document.getElementById('dm-sync-status');
      var btn = document.getElementById('dm-sync-upload');
      if (!status || !btn) return;
      btn.disabled = true;
      btn.style.opacity = '0.5';
      status.style.color = '#94A3B8';
      status.textContent = '正在上传...';

      DataMigration.syncToCloud().then(function(r) {
        status.style.color = '#4ADE80';
        status.textContent = '上传成功，已同步 ' + r.count + ' 项数据';
        btn.disabled = false;
        btn.style.opacity = '1';
        // refresh modal to show sync ID
        setTimeout(function() { DataMigration.showSyncModal(); }, 1200);
      }).catch(function(e) {
        status.style.color = '#EF4444';
        status.textContent = '上传失败: ' + e.message;
        btn.disabled = false;
        btn.style.opacity = '1';
      });
    },

    _doSyncDownload: function() {
      var status = document.getElementById('dm-sync-status');
      var btn = document.getElementById('dm-sync-download');
      if (!status || !btn) return;
      btn.disabled = true;
      btn.style.opacity = '0.5';
      status.style.color = '#94A3B8';
      status.textContent = '正在拉取...';

      DataMigration.syncFromCloud().then(function(r) {
        status.style.color = '#4ADE80';
        status.textContent = '拉取成功，已导入 ' + r.count + ' 项数据，页面即将刷新...';
        btn.disabled = false;
        btn.style.opacity = '1';
        setTimeout(function() { location.reload(); }, 1500);
      }).catch(function(e) {
        status.style.color = '#EF4444';
        status.textContent = '拉取失败: ' + e.message;
        btn.disabled = false;
        btn.style.opacity = '1';
      });
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
      t.style.cssText = 'position:fixed;bottom:' + _toastBottom + ';left:50%;transform:translateX(-50%);background:#1E2642;color:#F1F5F9;padding:8px 20px;border-radius:8px;font-size:13px;z-index:3000;border:1px solid rgba(255,255,255,0.1);white-space:nowrap;';
      document.body.appendChild(t);
      setTimeout(function() { t.remove(); }, 2000);
    },

    _closeModal: function() {
      var m = document.getElementById('dm-modal');
      if (m) m.remove();
    },

    closeModal: function() { this._closeModal(); }
  };
})();