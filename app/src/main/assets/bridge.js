// Menghubungkan tampilan dengan kode Android (objek global "Native").
(() => {
  const N = window.Native;
  const DEFAULTS = { wallpaper: 'senja', customWallpaper: null, iconSize: 'm', imported: false };
  window.launcher = {
    getData: async () => {
      try {
        const d = JSON.parse(N.getData() || '{}');
        return { items: d.items || [], settings: { ...DEFAULTS, ...d.settings } };
      } catch { return { items: [], settings: { ...DEFAULTS } }; }
    },
    saveData: async d => { N.saveData(JSON.stringify(d)); },
    scanApps: async () => { try { return JSON.parse(N.listApps() || '[]'); } catch { return []; } },
    launch: async p => N.launch(p),
    info: async p => { N.appInfo(p); },
    uninstall: async p => { N.uninstall(p); },
    pickWallpaper: () => new Promise(res => { window.__wallResolve = res; N.pickWallpaper(); }),
    openHomeSettings: async () => { N.openHomeSettings(); }
  };
  window.__wallDone = url => { const r = window.__wallResolve; window.__wallResolve = null; if (r) r(url || null); };
})();
