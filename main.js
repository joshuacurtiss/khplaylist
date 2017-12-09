// Libraries
const electron=require("electron");
const {app, BrowserWindow}=electron;
const fs=require("fs-extra");
const path=require("path");

// Constants
const APPDATADIR=app.getPath('userData')+path.sep;

app.on("ready", () => {

    // Init app data directories
    fs.ensureDirSync(APPDATADIR+"media");
    fs.ensureDirSync(APPDATADIR+"webvttcache")
    
    // Create playlist window
    var videoWin=new BrowserWindow({frame:false, fullscreen:true});
    videoWin.loadURL(`file://${__dirname}/views/index.html`);
    exports.win=videoWin;

});

exports.dir=__dirname;

exports.createSecondWin=()=>{
    var screens=electron.screen.getAllDisplays();
    var screen=screens.length>1?screens[1]:null;
    if( screen ) {
        var secondWin=new BrowserWindow({alwaysOnTop:true, frame:false, autoHideMenuBar:true, x:screen.bounds.x, y:screen.bounds.y});
        secondWin.loadURL(`file://${__dirname}/views/second.html`);
        secondWin.webContents.on('dom-ready', function(){
            secondWin.setFullScreen(true);
        });
        secondWin.on("enter-full-screen",(e,i)=>{
            exports.win.webContents.executeJavaScript(`videoController.pushUpdate()`);
        });
        return secondWin;
    }
}

exports.quit=()=>{
    app.quit();
}