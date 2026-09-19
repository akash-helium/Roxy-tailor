const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tailorDesktop', {
  printRaw: (base64) => ipcRenderer.invoke('print-raw', base64),
  listPrinters: () => ipcRenderer.invoke('list-printers'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  sendWhatsApp: (payload) => ipcRenderer.invoke('send-whatsapp', payload),
});
