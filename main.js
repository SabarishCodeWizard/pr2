const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, 'image.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        show: false,
        titleBarStyle: 'default'
    });

    win.loadFile('login.html');
    win.setTitle("PR Fabrics - Login");

    win.once('ready-to-show', () => {
        win.show();
    });

    return win;
}

// Simple PDF saving - save as HTML that can be printed as PDF
ipcMain.handle('save-pdf', async (event, htmlContent, filename) => {
    try {
        const { filePath } = await dialog.showSaveDialog({
            defaultPath: filename,
            filters: [
                { name: 'HTML Files', extensions: ['html'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        if (filePath) {
            // Save as HTML file
            fs.writeFileSync(filePath, htmlContent);
            
            // Optional: Open the file after saving
            shell.openExternal(`file://${filePath}`);
            
            return { success: true, path: filePath };
        }
        return { success: false, error: 'No file path selected' };
    } catch (error) {
        console.error('Save error:', error);
        return { success: false, error: error.message };
    }
});

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});