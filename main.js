const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'GeniusIDE - Cobalt Studios',
    icon: path.join(__dirname, 'assets/icon.ico'),
    backgroundColor: '#1e1e1e',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Load the index.html file
  mainWindow.loadFile('index.html');

  // Remove default menu bar for a cleaner IDE UI
  Menu.setApplicationMenu(null);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// --- IPC Communication Handlers ---

// 1. Open Directory Dialog
ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  const dirPath = result.filePaths[0];
  return {
    path: dirPath,
    name: path.basename(dirPath),
    tree: readDirectoryRecursive(dirPath)
  };
});

// Helper function to read folder contents
function readDirectoryRecursive(dir) {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        results.push({
          name: file,
          path: filePath,
          type: 'directory',
          children: readDirectoryRecursive(filePath)
        });
      } else {
        results.push({
          name: file,
          path: filePath,
          type: 'file'
        });
      }
    });
  } catch (err) {
    console.error(`Error reading dir ${dir}:`, err);
  }
  return results;
}

// 2. Read File Content
ipcMain.handle('file:read', async (event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { success: true, content };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 3. Save File Content
ipcMain.handle('file:save', async (event, { filePath, content }) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 4. Save As Dialog
ipcMain.handle('file:saveAs', async (event, content) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save File As'
  });
  if (result.canceled || !result.filePath) return null;

  try {
    fs.writeFileSync(result.filePath, content, 'utf-8');
    return { success: true, filePath: result.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 5. Execute Terminal Command
ipcMain.handle('terminal:execute', async (event, command) => {
  return new Promise((resolve) => {
    exec(command, { cwd: process.cwd() }, (error, stdout, stderr) => {
      resolve({
        output: stdout || stderr || (error ? error.message : 'Command executed.')
      });
    });
  });
});
