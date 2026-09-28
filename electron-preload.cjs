const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tailorDesktop', {
  printRaw: (base64) => ipcRenderer.invoke('print-raw', base64),
  listPrinters: () => ipcRenderer.invoke('list-printers'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  sendWhatsApp: (payload) => ipcRenderer.invoke('send-whatsapp', payload),
  otaStatus: () => ipcRenderer.invoke('ota-status'),
  otaNotifyReady: () => ipcRenderer.invoke('ota-notify-ready'),
  otaRelaunch: () => ipcRenderer.invoke('ota-relaunch'),
  onOtaReady: (handler) => {
    const listen = (_event, payload) => handler(payload);
    ipcRenderer.on('ota-ready', listen);
    return () => ipcRenderer.removeListener('ota-ready', listen);
  },
});
