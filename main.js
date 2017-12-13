// Libraries
const electron=require("electron");
const {app, BrowserWindow}=electron;
const fs=require("fs-extra");
const path=require("path");

// Constants
const APPDATADIR=app.getPath('userData')+path.sep;

var primaryDisplay, secondaryDisplay;

app.on("ready", () => {

    // Init app data directories
    fs.ensureDirSync(APPDATADIR+"media");
    fs.ensureDirSync(APPDATADIR+"webvttcache")
    
    // Create playlist window
    var videoWin=new BrowserWindow({frame:false, fullscreen:true});
    videoWin.loadURL(`file://${__dirname}/views/index.html`);
    exports.win=videoWin;

    // Ascertain displays
    var displays=electron.screen.getAllDisplays();
    primaryDisplay=electron.screen.getDisplayMatching(videoWin.getBounds());
    secondaryDisplay=displays.find(display=>display.id!==primaryDisplay.id);
    
});

exports.dir=__dirname;

exports.createSecondWin=()=>{
    if( secondaryDisplay ) {
        var secondWin=new BrowserWindow({alwaysOnTop:true, frame:false, autoHideMenuBar:true, x:secondaryDisplay.bounds.x, y:secondaryDisplay.bounds.y});
        secondWin.loadURL(`file://${__dirname}/views/second.html`);
        secondWin.webContents.on('dom-ready', function(){
            secondWin.setFullScreen(true);
        });
        secondWin.on("enter-full-screen",(e,i)=>{
            exports.win.webContents.executeJavaScript(`
                videoController.pushUpdate();
                if( ! videoController.video.paused ) videoController.play();
            `);
        });
        return secondWin;
    }
}

exports.quit=()=>{
    app.quit();
}