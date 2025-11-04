const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, 'image.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false
        },
        show: false, // Don't show until ready
        titleBarStyle: 'default'
    });

    // Load login page first
    win.loadFile('login.html');
    win.setTitle("PR Fabrics - Login");

    // Show window when ready to prevent visual flash
    win.once('ready-to-show', () => {
        win.show();
    });

    // Handle navigation to ensure authentication
    win.webContents.on('will-navigate', (event, navigationUrl) => {
        // You can add additional navigation controls here if needed
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
})