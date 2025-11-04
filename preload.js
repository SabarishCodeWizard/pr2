const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    savePDF: (htmlContent, filename) => ipcRenderer.invoke('save-pdf', htmlContent, filename),
    isElectron: true
});